#!/usr/bin/env bash
# Managed by GateRank log maintenance

set -uo pipefail

readonly EXIT_OK=0
readonly EXIT_CONFIG=1
readonly EXIT_RUNTIME=2
readonly MANAGED_MARKER="# Managed by GateRank log maintenance"
readonly WEB_SERVICE="gaterank-web"
readonly API_SERVICE="gaterank-api"
readonly EXPECTED_LOG_DRIVER="json-file"
readonly EXPECTED_LOG_MAX_SIZE="100m"
readonly EXPECTED_LOG_MAX_FILE="3"
readonly DISK_FAILURE_PERCENT=80

SOURCE_SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
REPO_ROOT="$(cd "$(dirname "$SOURCE_SCRIPT")/.." 2>/dev/null && pwd || true)"
DEFAULT_TEMPLATE_DIR="${REPO_ROOT:+$REPO_ROOT/ops/log-maintenance}"

TEMPLATE_DIR="${GATERANK_TEMPLATE_DIR:-$DEFAULT_TEMPLATE_DIR}"
COMPOSE_DIR="${GATERANK_COMPOSE_DIR:-/opt/1panel/docker/compose/gaterank}"
LOG_DIR="${GATERANK_LOG_DIR:-/opt/1panel/www/sites/gaterank/log}"
SYSTEMD_DIR="${GATERANK_SYSTEMD_DIR:-/etc/systemd/system}"
CONFIG_DIR="${GATERANK_CONFIG_DIR:-/etc/gaterank/log-maintenance}"
STATE_DIR="${GATERANK_STATE_DIR:-/var/lib/gaterank-log-maintenance}"
BACKUP_ROOT="${GATERANK_BACKUP_ROOT:-/var/backups/gaterank-log-maintenance}"
INSTALL_SCRIPT="${GATERANK_INSTALL_SCRIPT:-/usr/local/sbin/gaterank-log-maintenance}"
LOCK_FILE="${GATERANK_LOCK_FILE:-/run/lock/gaterank-log-maintenance.lock}"
LEGACY_LOGROTATE="${GATERANK_LEGACY_LOGROTATE:-/etc/logrotate.d/gaterank-access}"
DISK_PATH="${GATERANK_DISK_PATH:-/}"
WEB_URL="${GATERANK_WEB_URL:-http://127.0.0.1:18088/}"
API_URL="${GATERANK_API_URL:-http://127.0.0.1:18787/api/v1/pages/home}"
HEALTH_ATTEMPTS="${GATERANK_HEALTH_ATTEMPTS:-30}"
HEALTH_SLEEP_SECONDS="${GATERANK_HEALTH_SLEEP_SECONDS:-2}"

COMPOSE_FILE="$COMPOSE_DIR/docker-compose.yml"
COMPOSE_OVERRIDE="$COMPOSE_DIR/docker-compose.override.yml"
LOGROTATE_CONFIG="$CONFIG_DIR/gaterank-logrotate.conf"
LOGROTATE_STATE="$STATE_DIR/logrotate.status"
MAINTENANCE_README="$CONFIG_DIR/README"
INSTALLED_TEMPLATE_DIR="$CONFIG_DIR/templates"
SERVICE_FILE="$SYSTEMD_DIR/gaterank-log-maintenance.service"
TIMER_FILE="$SYSTEMD_DIR/gaterank-log-maintenance.timer"

STAGE_DIR=""
BACKUP_DIR=""
BACKUP_MANIFEST=""
INSTALL_MUTATED=0
COMPOSE_RECREATED=0
PREVIOUS_TIMER_ENABLED=0
PREVIOUS_TIMER_ACTIVE=0

timestamp() {
  date '+%Y-%m-%dT%H:%M:%S%z'
}

info() {
  printf '%s level=info %s\n' "$(timestamp)" "$*"
}

warn() {
  printf '%s level=warning %s\n' "$(timestamp)" "$*" >&2
}

error() {
  printf '%s level=error %s\n' "$(timestamp)" "$*" >&2
}

usage() {
  cat <<'EOF'
Usage:
  gaterank-log-maintenance install [--dry-run]
  gaterank-log-maintenance check
  gaterank-log-maintenance run
  gaterank-log-maintenance uninstall

Exit codes:
  0  Success, including a concurrent run skipped because the lock is busy
  1  Invalid arguments, environment, ownership, or configuration
  2  Rotation, disk threshold, runtime drift, or health verification failure
EOF
}

cleanup_stage() {
  if [[ -n "$STAGE_DIR" && -d "$STAGE_DIR" ]]; then
    rm -rf -- "$STAGE_DIR"
  fi
}

trap cleanup_stage EXIT

require_root() {
  if [[ "${GATERANK_SKIP_ROOT_CHECK:-0}" != "1" && "${EUID:-$(id -u)}" -ne 0 ]]; then
    error "root privileges are required"
    return "$EXIT_CONFIG"
  fi
}

require_commands() {
  local missing=0
  local command_name
  for command_name in "$@"; do
    if ! command -v "$command_name" >/dev/null 2>&1; then
      error "required command is missing: $command_name"
      missing=1
    fi
  done
  [[ "$missing" -eq 0 ]]
}

validate_path_value() {
  local name="$1"
  local value="$2"
  local allow_root="${3:-0}"
  if [[ "$value" != /* ||
    ( "$value" == "/" && "$allow_root" != "1" ) ||
    "$value" == *$'\n'* ||
    "$value" == *"|"* ||
    "$value" == *"&"* ]]; then
    error "$name must be a safe absolute path: $value"
    return "$EXIT_CONFIG"
  fi
}

validate_numeric_value() {
  local name="$1"
  local value="$2"
  if [[ ! "$value" =~ ^[0-9]+$ ]]; then
    error "$name must be a non-negative integer: $value"
    return "$EXIT_CONFIG"
  fi
}

validate_paths() {
  validate_path_value "COMPOSE_DIR" "$COMPOSE_DIR" || return "$EXIT_CONFIG"
  validate_path_value "LOG_DIR" "$LOG_DIR" || return "$EXIT_CONFIG"
  validate_path_value "SYSTEMD_DIR" "$SYSTEMD_DIR" || return "$EXIT_CONFIG"
  validate_path_value "CONFIG_DIR" "$CONFIG_DIR" || return "$EXIT_CONFIG"
  validate_path_value "STATE_DIR" "$STATE_DIR" || return "$EXIT_CONFIG"
  validate_path_value "BACKUP_ROOT" "$BACKUP_ROOT" || return "$EXIT_CONFIG"
  validate_path_value "INSTALL_SCRIPT" "$INSTALL_SCRIPT" || return "$EXIT_CONFIG"
  validate_path_value "LOCK_FILE" "$LOCK_FILE" || return "$EXIT_CONFIG"
  validate_path_value "LEGACY_LOGROTATE" "$LEGACY_LOGROTATE" || return "$EXIT_CONFIG"
  validate_path_value "DISK_PATH" "$DISK_PATH" 1 || return "$EXIT_CONFIG"
  validate_numeric_value "HEALTH_ATTEMPTS" "$HEALTH_ATTEMPTS" || return "$EXIT_CONFIG"
  validate_numeric_value "HEALTH_SLEEP_SECONDS" "$HEALTH_SLEEP_SECONDS" || return "$EXIT_CONFIG"
}

has_marker() {
  local path="$1"
  [[ -f "$path" ]] && grep -Fq -- "$MANAGED_MARKER" "$path"
}

refuse_symlink() {
  local path="$1"
  if [[ -L "$path" ]]; then
    error "refusing to manage symlink: $path"
    return "$EXIT_CONFIG"
  fi
}

legacy_rule_is_known() {
  local path="$1"
  local spec
  local brace_count
  local -a words

  [[ -f "$path" ]] || return 1
  [[ ! -L "$path" ]] || return 1

  brace_count="$(grep -c '{' "$path" 2>/dev/null || true)"
  [[ "$brace_count" -eq 1 ]] || return 1

  spec="$(
    awk '
      /^[[:space:]]*#/ || /^[[:space:]]*$/ { next }
      {
        line = $0
        sub(/[[:space:]]*\{.*/, "", line)
        print line
        exit
      }
    ' "$path"
  )"
  read -r -a words <<<"$spec"
  [[ "${#words[@]}" -eq 2 ]] || return 1

  if [[ "${words[0]}" == "$LOG_DIR/access.log" && "${words[1]}" == "$LOG_DIR/error.log" ]]; then
    return 0
  fi
  if [[ "${words[1]}" == "$LOG_DIR/access.log" && "${words[0]}" == "$LOG_DIR/error.log" ]]; then
    return 0
  fi
  return 1
}

resolve_template_dir() {
  if [[ -n "$TEMPLATE_DIR" && -d "$TEMPLATE_DIR" ]]; then
    return 0
  fi
  if [[ -d "$INSTALLED_TEMPLATE_DIR" ]]; then
    TEMPLATE_DIR="$INSTALLED_TEMPLATE_DIR"
    return 0
  fi
  error "template directory is unavailable: ${TEMPLATE_DIR:-<empty>}"
  return "$EXIT_CONFIG"
}

render_template() {
  local source="$1"
  local target="$2"
  sed \
    -e "s|@@LOG_DIR@@|$LOG_DIR|g" \
    -e "s|@@CONFIG_DIR@@|$CONFIG_DIR|g" \
    -e "s|@@STATE_DIR@@|$STATE_DIR|g" \
    -e "s|@@LOCK_DIR@@|$(dirname "$LOCK_FILE")|g" \
    -e "s|@@INSTALL_SCRIPT@@|$INSTALL_SCRIPT|g" \
    "$source" >"$target"
}

write_stage_readme() {
  local target="$1"
  cat >"$target" <<EOF
$MANAGED_MARKER
GateRank log maintenance is installed from the GateRank repository.

Commands:
  $INSTALL_SCRIPT check
  $INSTALL_SCRIPT run
  $INSTALL_SCRIPT uninstall

Status:
  systemctl status gaterank-log-maintenance.timer
  journalctl -u gaterank-log-maintenance.service

Policy:
  OpenResty access/error logs: rotate at 100MB, keep 14, compress old logs.
  gaterank-web/gaterank-api: Docker json-file 100MB x 3.
  Disk usage >= ${DISK_FAILURE_PERCENT}% after rotation is reported as a failure.
EOF
}

prepare_stage() {
  resolve_template_dir || return "$EXIT_CONFIG"

  local required_template
  for required_template in \
    gaterank-logrotate.conf \
    gaterank-log-maintenance.service \
    gaterank-log-maintenance.timer \
    docker-compose.override.yml; do
    if [[ ! -f "$TEMPLATE_DIR/$required_template" ]]; then
      error "required template is missing: $TEMPLATE_DIR/$required_template"
      return "$EXIT_CONFIG"
    fi
    if ! has_marker "$TEMPLATE_DIR/$required_template"; then
      error "template does not carry the managed marker: $TEMPLATE_DIR/$required_template"
      return "$EXIT_CONFIG"
    fi
  done

  STAGE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/gaterank-log-maintenance.XXXXXX")" || return "$EXIT_CONFIG"
  render_template "$TEMPLATE_DIR/gaterank-logrotate.conf" "$STAGE_DIR/gaterank-logrotate.conf"
  render_template "$TEMPLATE_DIR/gaterank-log-maintenance.service" "$STAGE_DIR/gaterank-log-maintenance.service"
  cp "$TEMPLATE_DIR/gaterank-log-maintenance.timer" "$STAGE_DIR/gaterank-log-maintenance.timer"
  cp "$TEMPLATE_DIR/docker-compose.override.yml" "$STAGE_DIR/docker-compose.override.yml"
  write_stage_readme "$STAGE_DIR/README"
}

compose_with_override() {
  local override="$1"
  shift
  docker compose -f "$COMPOSE_FILE" -f "$override" "$@"
}

compose_live() {
  if [[ -f "$COMPOSE_OVERRIDE" ]]; then
    compose_with_override "$COMPOSE_OVERRIDE" "$@"
  else
    docker compose -f "$COMPOSE_FILE" "$@"
  fi
}

compose_has_expected_services() {
  local services
  services="$(docker compose -f "$COMPOSE_FILE" config --services 2>/dev/null)" || return 1
  grep -Fxq "$WEB_SERVICE" <<<"$services" && grep -Fxq "$API_SERVICE" <<<"$services"
}

preflight_install() {
  require_root || return "$EXIT_CONFIG"
  require_commands \
    awk cmp cp curl date df dirname docker flock grep install logrotate mktemp mv rm sed \
    systemctl systemd-analyze timeout || return "$EXIT_CONFIG"
  validate_paths || return "$EXIT_CONFIG"

  if [[ ! -f "$COMPOSE_FILE" ]]; then
    error "Compose file is missing: $COMPOSE_FILE"
    return "$EXIT_CONFIG"
  fi
  if [[ ! -d "$LOG_DIR" ]]; then
    error "GateRank log directory is missing: $LOG_DIR"
    return "$EXIT_CONFIG"
  fi
  if ! compose_has_expected_services; then
    error "Compose project must contain $WEB_SERVICE and $API_SERVICE"
    return "$EXIT_CONFIG"
  fi

  local managed_path
  for managed_path in \
    "$INSTALL_SCRIPT" \
    "$LOGROTATE_CONFIG" \
    "$MAINTENANCE_README" \
    "$INSTALLED_TEMPLATE_DIR/gaterank-logrotate.conf" \
    "$INSTALLED_TEMPLATE_DIR/gaterank-log-maintenance.service" \
    "$INSTALLED_TEMPLATE_DIR/gaterank-log-maintenance.timer" \
    "$INSTALLED_TEMPLATE_DIR/docker-compose.override.yml" \
    "$SERVICE_FILE" \
    "$TIMER_FILE" \
    "$COMPOSE_OVERRIDE"; do
    refuse_symlink "$managed_path" || return "$EXIT_CONFIG"
    if [[ -e "$managed_path" ]] && ! has_marker "$managed_path"; then
      error "refusing to overwrite unmanaged file: $managed_path"
      return "$EXIT_CONFIG"
    fi
  done

  if [[ -e "$LEGACY_LOGROTATE" ]] && ! legacy_rule_is_known "$LEGACY_LOGROTATE"; then
    error "legacy logrotate file is not an exact GateRank rule: $LEGACY_LOGROTATE"
    return "$EXIT_CONFIG"
  fi

  prepare_stage || return "$EXIT_CONFIG"

  if ! logrotate --debug "$STAGE_DIR/gaterank-logrotate.conf" >/dev/null 2>&1; then
    error "staged logrotate configuration is invalid"
    return "$EXIT_CONFIG"
  fi
  if ! compose_with_override "$STAGE_DIR/docker-compose.override.yml" config --quiet; then
    error "staged Compose override is invalid"
    return "$EXIT_CONFIG"
  fi
}

create_backup_dir() {
  local stamp
  stamp="$(date +%Y%m%d-%H%M%S)"
  BACKUP_DIR="$BACKUP_ROOT/$stamp"
  if [[ -e "$BACKUP_DIR" ]]; then
    BACKUP_DIR="$BACKUP_ROOT/$stamp-$$"
  fi
  install -d -m 0750 "$BACKUP_DIR"
  BACKUP_MANIFEST="$BACKUP_DIR/manifest"
  : >"$BACKUP_MANIFEST"
}

record_target() {
  local target="$1"
  local label="$2"
  local backup_path="-"

  if [[ -e "$target" ]]; then
    backup_path="$BACKUP_DIR/$label"
    cp -a -- "$target" "$backup_path"
  fi
  printf '%s|%s\n' "$target" "$backup_path" >>"$BACKUP_MANIFEST"
}

atomic_install() {
  local source="$1"
  local target="$2"
  local mode="$3"
  local parent
  local temporary

  parent="$(dirname "$target")"
  install -d -m 0755 "$parent"
  temporary="$parent/.gaterank-log-maintenance.$$.tmp"
  install -m "$mode" "$source" "$temporary" || return 1
  mv -f -- "$temporary" "$target"
}

install_changed_file() {
  local source="$1"
  local target="$2"
  local label="$3"
  local mode="$4"

  if [[ -f "$target" ]] && cmp -s "$source" "$target"; then
    return 0
  fi
  record_target "$target" "$label" || return 1
  atomic_install "$source" "$target" "$mode" || return 1
  INSTALL_MUTATED=1
}

timer_state_before_install() {
  if systemctl is-enabled gaterank-log-maintenance.timer >/dev/null 2>&1; then
    PREVIOUS_TIMER_ENABLED=1
  fi
  if systemctl is-active gaterank-log-maintenance.timer >/dev/null 2>&1; then
    PREVIOUS_TIMER_ACTIVE=1
  fi
}

docker_log_value() {
  local service="$1"
  local field="$2"
  case "$field" in
    driver)
      docker inspect -f '{{.HostConfig.LogConfig.Type}}' "$service" 2>/dev/null
      ;;
    max-size)
      docker inspect -f '{{index .HostConfig.LogConfig.Config "max-size"}}' "$service" 2>/dev/null
      ;;
    max-file)
      docker inspect -f '{{index .HostConfig.LogConfig.Config "max-file"}}' "$service" 2>/dev/null
      ;;
    running)
      docker inspect -f '{{.State.Running}}' "$service" 2>/dev/null
      ;;
    *)
      return 1
      ;;
  esac
}

container_logging_is_expected() {
  local service="$1"
  [[ "$(docker_log_value "$service" driver || true)" == "$EXPECTED_LOG_DRIVER" ]] &&
    [[ "$(docker_log_value "$service" max-size || true)" == "$EXPECTED_LOG_MAX_SIZE" ]] &&
    [[ "$(docker_log_value "$service" max-file || true)" == "$EXPECTED_LOG_MAX_FILE" ]]
}

http_code_is_web_success() {
  case "$1" in
    200 | 301 | 302) return 0 ;;
    *) return 1 ;;
  esac
}

health_check_once() {
  local web_code
  local api_code

  [[ "$(docker_log_value "$WEB_SERVICE" running || true)" == "true" ]] || return 1
  [[ "$(docker_log_value "$API_SERVICE" running || true)" == "true" ]] || return 1
  container_logging_is_expected "$WEB_SERVICE" || return 1
  container_logging_is_expected "$API_SERVICE" || return 1
  timeout 5 docker logs --tail 2 "$WEB_SERVICE" >/dev/null 2>&1 || return 1
  timeout 5 docker logs --tail 2 "$API_SERVICE" >/dev/null 2>&1 || return 1

  web_code="$(curl --max-time 5 -sS -o /dev/null -w '%{http_code}' "$WEB_URL" 2>/dev/null || true)"
  api_code="$(curl --max-time 5 -sS -o /dev/null -w '%{http_code}' "$API_URL" 2>/dev/null || true)"
  http_code_is_web_success "$web_code" || return 1
  [[ "$api_code" == "200" ]]
}

wait_for_health() {
  local attempt=1
  while [[ "$attempt" -le "$HEALTH_ATTEMPTS" ]]; do
    if health_check_once; then
      info "health verification passed attempt=$attempt"
      return 0
    fi
    if [[ "$attempt" -lt "$HEALTH_ATTEMPTS" && "$HEALTH_SLEEP_SECONDS" -gt 0 ]]; then
      sleep "$HEALTH_SLEEP_SECONDS"
    fi
    attempt=$((attempt + 1))
  done
  error "health verification failed attempts=$HEALTH_ATTEMPTS"
  return "$EXIT_RUNTIME"
}

restore_manifest() {
  local target
  local backup_path

  [[ -f "$BACKUP_MANIFEST" ]] || return 0
  while IFS='|' read -r target backup_path; do
    [[ -n "$target" ]] || continue
    if [[ "$backup_path" == "-" ]]; then
      if has_marker "$target"; then
        rm -f -- "$target"
      fi
    else
      install -d -m 0755 "$(dirname "$target")"
      cp -a -- "$backup_path" "$target"
    fi
  done <"$BACKUP_MANIFEST"
}

rollback_install() {
  warn "rolling back GateRank log maintenance installation"
  systemctl disable --now gaterank-log-maintenance.timer >/dev/null 2>&1 || true
  restore_manifest || true
  systemctl daemon-reload >/dev/null 2>&1 || true

  if [[ "$PREVIOUS_TIMER_ENABLED" -eq 1 ]]; then
    systemctl enable gaterank-log-maintenance.timer >/dev/null 2>&1 || true
  fi
  if [[ "$PREVIOUS_TIMER_ACTIVE" -eq 1 ]]; then
    systemctl start gaterank-log-maintenance.timer >/dev/null 2>&1 || true
  fi

  if [[ "$COMPOSE_RECREATED" -eq 1 ]]; then
    if compose_live config --quiet >/dev/null 2>&1; then
      compose_live up -d --no-deps --force-recreate "$WEB_SERVICE" "$API_SERVICE" >/dev/null 2>&1 || true
    fi
  fi
}

install_templates() {
  local name
  install -d -m 0755 "$INSTALLED_TEMPLATE_DIR"
  for name in \
    gaterank-logrotate.conf \
    gaterank-log-maintenance.service \
    gaterank-log-maintenance.timer \
    docker-compose.override.yml; do
    install_changed_file "$TEMPLATE_DIR/$name" "$INSTALLED_TEMPLATE_DIR/$name" "template-$name" 0644 || return 1
  done
}

apply_install() {
  local override_changed=0
  local recreate_required=0

  timer_state_before_install
  create_backup_dir || return "$EXIT_CONFIG"

  if [[ ! -f "$COMPOSE_OVERRIDE" ]] || ! cmp -s "$STAGE_DIR/docker-compose.override.yml" "$COMPOSE_OVERRIDE"; then
    override_changed=1
  fi

  install_changed_file "$SOURCE_SCRIPT" "$INSTALL_SCRIPT" "installed-script" 0755 || return "$EXIT_CONFIG"
  install_changed_file "$STAGE_DIR/gaterank-logrotate.conf" "$LOGROTATE_CONFIG" "logrotate-config" 0644 || return "$EXIT_CONFIG"
  install_changed_file "$STAGE_DIR/README" "$MAINTENANCE_README" "maintenance-readme" 0644 || return "$EXIT_CONFIG"
  install_templates || return "$EXIT_CONFIG"
  install_changed_file "$STAGE_DIR/gaterank-log-maintenance.service" "$SERVICE_FILE" "systemd-service" 0644 || return "$EXIT_CONFIG"
  install_changed_file "$STAGE_DIR/gaterank-log-maintenance.timer" "$TIMER_FILE" "systemd-timer" 0644 || return "$EXIT_CONFIG"
  install_changed_file "$STAGE_DIR/docker-compose.override.yml" "$COMPOSE_OVERRIDE" "compose-override" 0644 || return "$EXIT_CONFIG"

  if [[ -e "$LEGACY_LOGROTATE" ]]; then
    record_target "$LEGACY_LOGROTATE" "legacy-gaterank-access" || return "$EXIT_CONFIG"
    rm -f -- "$LEGACY_LOGROTATE" || return "$EXIT_CONFIG"
    INSTALL_MUTATED=1
    info "migrated legacy logrotate rule path=$LEGACY_LOGROTATE"
  fi

  install -d -m 0755 "$STATE_DIR" "$(dirname "$LOCK_FILE")" || return "$EXIT_CONFIG"
  systemd-analyze verify "$SERVICE_FILE" "$TIMER_FILE" >/dev/null 2>&1 || return "$EXIT_CONFIG"
  compose_live config --quiet || return "$EXIT_CONFIG"
  systemctl daemon-reload || return "$EXIT_CONFIG"
  systemctl enable --now gaterank-log-maintenance.timer || return "$EXIT_CONFIG"

  if [[ "$override_changed" -eq 1 ]] ||
    ! container_logging_is_expected "$WEB_SERVICE" ||
    ! container_logging_is_expected "$API_SERVICE"; then
    recreate_required=1
  fi

  if [[ "$recreate_required" -eq 1 ]]; then
    compose_live up -d --no-deps --force-recreate "$WEB_SERVICE" "$API_SERVICE" || return "$EXIT_RUNTIME"
    COMPOSE_RECREATED=1
  fi

  wait_for_health || return "$EXIT_RUNTIME"
  "$INSTALL_SCRIPT" run || return "$EXIT_RUNTIME"
  info "installation complete backup_dir=$BACKUP_DIR recreated=$COMPOSE_RECREATED"
}

install_command() {
  local dry_run=0
  if [[ "$#" -gt 1 ]]; then
    usage >&2
    return "$EXIT_CONFIG"
  fi
  if [[ "$#" -eq 1 ]]; then
    if [[ "$1" != "--dry-run" ]]; then
      usage >&2
      return "$EXIT_CONFIG"
    fi
    dry_run=1
  fi

  preflight_install || return "$EXIT_CONFIG"
  if [[ "$dry_run" -eq 1 ]]; then
    info "dry-run passed compose=$COMPOSE_FILE log_dir=$LOG_DIR"
    info "would install script=$INSTALL_SCRIPT config=$CONFIG_DIR timer=$TIMER_FILE"
    info "would configure Docker logging services=$WEB_SERVICE,$API_SERVICE max_size=$EXPECTED_LOG_MAX_SIZE max_file=$EXPECTED_LOG_MAX_FILE"
    if [[ -e "$LEGACY_LOGROTATE" ]]; then
      info "would migrate legacy rule=$LEGACY_LOGROTATE"
    fi
    return "$EXIT_OK"
  fi

  local rc=0
  apply_install || rc=$?
  if [[ "$rc" -ne 0 ]]; then
    if [[ "$INSTALL_MUTATED" -eq 1 ]]; then
      rollback_install
    fi
    if [[ "$rc" -eq "$EXIT_RUNTIME" ]]; then
      return "$EXIT_RUNTIME"
    fi
    return "$EXIT_CONFIG"
  fi
}

disk_percent() {
  df -P "$DISK_PATH" 2>/dev/null |
    awk 'NR == 2 { value = $5; gsub(/%/, "", value); print value }'
}

file_size_or_missing() {
  local path="$1"
  if [[ -f "$path" ]]; then
    stat -c '%s' "$path" 2>/dev/null || printf 'unknown'
  else
    printf 'missing'
  fi
}

runtime_checks() {
  local rc=0
  local percent
  local service

  percent="$(disk_percent || true)"
  if [[ ! "$percent" =~ ^[0-9]+$ ]]; then
    error "unable to read disk usage path=$DISK_PATH"
    rc="$EXIT_RUNTIME"
  elif [[ "$percent" -ge "$DISK_FAILURE_PERCENT" ]]; then
    error "disk threshold exceeded usage_percent=$percent threshold=$DISK_FAILURE_PERCENT path=$DISK_PATH"
    rc="$EXIT_RUNTIME"
  else
    info "disk usage_percent=$percent threshold=$DISK_FAILURE_PERCENT path=$DISK_PATH"
  fi

  for service in "$WEB_SERVICE" "$API_SERVICE"; do
    if ! container_logging_is_expected "$service"; then
      error "Docker logging drift service=$service expected=$EXPECTED_LOG_DRIVER/$EXPECTED_LOG_MAX_SIZE/$EXPECTED_LOG_MAX_FILE"
      rc="$EXIT_RUNTIME"
    else
      info "Docker logging service=$service driver=$EXPECTED_LOG_DRIVER max_size=$EXPECTED_LOG_MAX_SIZE max_file=$EXPECTED_LOG_MAX_FILE"
    fi
  done

  info "log size path=$LOG_DIR/access.log bytes=$(file_size_or_missing "$LOG_DIR/access.log")"
  info "log size path=$LOG_DIR/error.log bytes=$(file_size_or_missing "$LOG_DIR/error.log")"
  return "$rc"
}

run_command() {
  if [[ "$#" -ne 0 ]]; then
    usage >&2
    return "$EXIT_CONFIG"
  fi
  require_root || return "$EXIT_CONFIG"
  require_commands df docker flock install logrotate stat || return "$EXIT_CONFIG"
  validate_paths || return "$EXIT_CONFIG"

  install -d -m 0755 "$(dirname "$LOCK_FILE")" "$STATE_DIR" || return "$EXIT_CONFIG"
  exec 9>"$LOCK_FILE"
  if ! flock -n 9; then
    info "maintenance skipped reason=lock_busy lock=$LOCK_FILE"
    return "$EXIT_OK"
  fi

  local rc=0
  if [[ ! -f "$LOGROTATE_CONFIG" ]] || ! has_marker "$LOGROTATE_CONFIG"; then
    error "managed logrotate configuration is missing or unowned: $LOGROTATE_CONFIG"
    rc="$EXIT_RUNTIME"
  elif ! logrotate --state "$LOGROTATE_STATE" "$LOGROTATE_CONFIG"; then
    error "logrotate failed config=$LOGROTATE_CONFIG"
    rc="$EXIT_RUNTIME"
  else
    info "logrotate completed config=$LOGROTATE_CONFIG"
  fi

  runtime_checks || rc="$EXIT_RUNTIME"
  info "maintenance finished exit_code=$rc"
  return "$rc"
}

check_managed_installation() {
  local rc=0
  local path
  for path in \
    "$INSTALL_SCRIPT" \
    "$LOGROTATE_CONFIG" \
    "$MAINTENANCE_README" \
    "$SERVICE_FILE" \
    "$TIMER_FILE" \
    "$COMPOSE_OVERRIDE"; do
    if [[ ! -f "$path" ]] || ! has_marker "$path"; then
      error "managed installation file is missing or unowned: $path"
      rc="$EXIT_CONFIG"
    fi
  done
  return "$rc"
}

check_command() {
  if [[ "$#" -ne 0 ]]; then
    usage >&2
    return "$EXIT_CONFIG"
  fi
  require_commands df docker grep stat systemctl || return "$EXIT_CONFIG"
  validate_paths || return "$EXIT_CONFIG"
  check_managed_installation || return "$EXIT_CONFIG"

  local rc=0
  local timer_enabled
  local timer_active
  local service_result

  timer_enabled="$(systemctl is-enabled gaterank-log-maintenance.timer 2>/dev/null || true)"
  timer_active="$(systemctl is-active gaterank-log-maintenance.timer 2>/dev/null || true)"
  service_result="$(systemctl show gaterank-log-maintenance.service -p Result -p ExecMainStatus 2>/dev/null || true)"
  info "timer enabled=${timer_enabled:-unknown} active=${timer_active:-unknown}"
  printf '%s\n' "$service_result"

  if [[ "$timer_enabled" != "enabled" || "$timer_active" != "active" ]]; then
    error "systemd timer is not enabled and active"
    rc="$EXIT_RUNTIME"
  fi
  runtime_checks || rc="$EXIT_RUNTIME"
  return "$rc"
}

uninstall_targets_are_owned() {
  local target
  for target in \
    "$INSTALL_SCRIPT" \
    "$LOGROTATE_CONFIG" \
    "$MAINTENANCE_README" \
    "$INSTALLED_TEMPLATE_DIR/gaterank-logrotate.conf" \
    "$INSTALLED_TEMPLATE_DIR/gaterank-log-maintenance.service" \
    "$INSTALLED_TEMPLATE_DIR/gaterank-log-maintenance.timer" \
    "$INSTALLED_TEMPLATE_DIR/docker-compose.override.yml" \
    "$SERVICE_FILE" \
    "$TIMER_FILE" \
    "$COMPOSE_OVERRIDE"; do
    refuse_symlink "$target" || return "$EXIT_CONFIG"
    if [[ -e "$target" ]] && ! has_marker "$target"; then
      error "refusing to remove unmanaged file: $target"
      return "$EXIT_CONFIG"
    fi
  done
}

uninstall_command() {
  if [[ "$#" -ne 0 ]]; then
    usage >&2
    return "$EXIT_CONFIG"
  fi
  require_root || return "$EXIT_CONFIG"
  require_commands rm systemctl || return "$EXIT_CONFIG"
  validate_paths || return "$EXIT_CONFIG"
  uninstall_targets_are_owned || return "$EXIT_CONFIG"

  systemctl disable --now gaterank-log-maintenance.timer >/dev/null 2>&1 || true

  local target
  for target in \
    "$COMPOSE_OVERRIDE" \
    "$TIMER_FILE" \
    "$SERVICE_FILE" \
    "$INSTALLED_TEMPLATE_DIR/docker-compose.override.yml" \
    "$INSTALLED_TEMPLATE_DIR/gaterank-log-maintenance.timer" \
    "$INSTALLED_TEMPLATE_DIR/gaterank-log-maintenance.service" \
    "$INSTALLED_TEMPLATE_DIR/gaterank-logrotate.conf" \
    "$MAINTENANCE_README" \
    "$LOGROTATE_CONFIG" \
    "$INSTALL_SCRIPT"; do
    if [[ -e "$target" ]]; then
      rm -f -- "$target"
      info "removed managed file path=$target"
    fi
  done

  systemctl daemon-reload || return "$EXIT_CONFIG"
  info "uninstall complete backups_preserved=$BACKUP_ROOT state_preserved=$STATE_DIR containers_restarted=false"
}

main() {
  local command="${1:-}"
  if [[ "$#" -gt 0 ]]; then
    shift
  fi

  case "$command" in
    install)
      install_command "$@"
      ;;
    check)
      check_command "$@"
      ;;
    run)
      run_command "$@"
      ;;
    uninstall)
      uninstall_command "$@"
      ;;
    -h | --help | help)
      usage
      ;;
    *)
      usage >&2
      return "$EXIT_CONFIG"
      ;;
  esac
}

main "$@"
