#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT="$ROOT_DIR/scripts/gaterank-log-maintenance.sh"
TEMPLATE_DIR="$ROOT_DIR/ops/log-maintenance"

TEST_COUNT=0
SKIP_COUNT=0

pass() {
  TEST_COUNT=$((TEST_COUNT + 1))
  printf 'ok %d - %s\n' "$TEST_COUNT" "$1"
}

fail() {
  printf 'not ok - %s\n' "$1" >&2
  exit 1
}

assert_file() {
  [[ -f "$1" ]] || fail "expected file: $1"
}

assert_no_file() {
  [[ ! -e "$1" ]] || fail "expected path to be absent: $1"
}

assert_contains() {
  grep -Fq -- "$2" "$1" || fail "expected '$2' in $1"
}

assert_exit() {
  local expected="$1"
  shift
  local actual=0
  "$@" >/dev/null 2>&1 || actual=$?
  [[ "$actual" -eq "$expected" ]] || fail "expected exit $expected, got $actual: $*"
}

write_fake() {
  local name="$1"
  shift
  {
    printf '#!/usr/bin/env bash\n'
    printf 'set -euo pipefail\n'
    printf '%s\n' "$@"
  } >"$FAKE_BIN/$name"
  chmod +x "$FAKE_BIN/$name"
}

setup_fixture() {
  TEST_TMP="$(mktemp -d)"
  export TEST_TMP
  FAKE_BIN="$TEST_TMP/bin"
  FAKE_CALLS="$TEST_TMP/calls.log"
  export FAKE_CALLS
  mkdir -p \
    "$FAKE_BIN" \
    "$TEST_TMP/compose" \
    "$TEST_TMP/logs" \
    "$TEST_TMP/systemd" \
    "$TEST_TMP/etc-logrotate" \
    "$TEST_TMP/config" \
    "$TEST_TMP/state" \
    "$TEST_TMP/backups" \
    "$TEST_TMP/install-bin" \
    "$TEST_TMP/run"
  : >"$FAKE_CALLS"

  cat >"$TEST_TMP/compose/docker-compose.yml" <<'YAML'
services:
  gaterank-web:
    image: example/web:main
  gaterank-api:
    image: example/api:main
YAML

  export GATERANK_SKIP_ROOT_CHECK=1
  export GATERANK_TEMPLATE_DIR="$TEMPLATE_DIR"
  export GATERANK_COMPOSE_DIR="$TEST_TMP/compose"
  export GATERANK_LOG_DIR="$TEST_TMP/logs"
  export GATERANK_SYSTEMD_DIR="$TEST_TMP/systemd"
  export GATERANK_CONFIG_DIR="$TEST_TMP/config"
  export GATERANK_STATE_DIR="$TEST_TMP/state"
  export GATERANK_BACKUP_ROOT="$TEST_TMP/backups"
  export GATERANK_INSTALL_SCRIPT="$TEST_TMP/install-bin/gaterank-log-maintenance"
  export GATERANK_LOCK_FILE="$TEST_TMP/run/gaterank-log-maintenance.lock"
  export GATERANK_LEGACY_LOGROTATE="$TEST_TMP/etc-logrotate/gaterank-access"
  export GATERANK_DISK_PATH="$TEST_TMP"
  export GATERANK_WEB_URL="http://127.0.0.1:18088/"
  export GATERANK_API_URL="http://127.0.0.1:18787/api/v1/pages/home"
  export GATERANK_HEALTH_ATTEMPTS=1
  export GATERANK_HEALTH_SLEEP_SECONDS=0
  export FAKE_DISK_PERCENT=41
  export FAKE_DOCKER_MAX_SIZE=100m
  export FAKE_DOCKER_MAX_FILE=3
  export FAKE_FLOCK_BUSY=0
  export FAKE_HEALTH_CODE=200
  export FAKE_COMPOSE_FAIL=0

  write_fake docker '
printf "docker %s\n" "$*" >>"$FAKE_CALLS"
if [[ "${1:-}" == "compose" ]]; then
  if [[ "$*" == *"config --services"* ]]; then
    printf "gaterank-web\ngaterank-api\n"
    exit 0
  fi
  if [[ "$*" == *"config --quiet"* ]]; then
    [[ "${FAKE_COMPOSE_FAIL:-0}" == "0" ]]
    exit
  fi
  if [[ "$*" == *"up -d"* ]]; then
    exit 0
  fi
fi
if [[ "${1:-}" == "inspect" ]]; then
  format="${3:-}"
  case "$format" in
    *State.Running*) printf "true\n" ;;
    *LogConfig.Type*) printf "json-file\n" ;;
    *max-size*) printf "%s\n" "${FAKE_DOCKER_MAX_SIZE:-100m}" ;;
    *max-file*) printf "%s\n" "${FAKE_DOCKER_MAX_FILE:-3}" ;;
    *LogPath*) printf "%s/docker.log\n" "$TEST_TMP" ;;
    *) printf "unknown\n" ;;
  esac
  exit 0
fi
if [[ "${1:-}" == "logs" ]]; then
  exit 0
fi
exit 0'

  write_fake systemctl '
printf "systemctl %s\n" "$*" >>"$FAKE_CALLS"
case "${1:-}" in
  is-enabled) printf "enabled\n" ;;
  is-active) printf "active\n" ;;
  show) printf "Result=success\nExecMainStatus=0\n" ;;
esac
exit 0'

  write_fake systemd-analyze '
printf "systemd-analyze %s\n" "$*" >>"$FAKE_CALLS"
exit 0'

  write_fake logrotate '
printf "logrotate %s\n" "$*" >>"$FAKE_CALLS"
exit 0'

  write_fake curl '
printf "curl %s\n" "$*" >>"$FAKE_CALLS"
printf "%s" "${FAKE_HEALTH_CODE:-200}"
exit 0'

  write_fake timeout '
shift
exec "$@"'

  write_fake flock '
printf "flock %s\n" "$*" >>"$FAKE_CALLS"
if [[ "${FAKE_FLOCK_BUSY:-0}" == "1" ]]; then
  exit 1
fi
exit 0'

  write_fake df '
printf "Filesystem 1024-blocks Used Available Capacity Mounted on\n"
printf "/dev/test 100000 41000 59000 %s%% %s\n" "${FAKE_DISK_PERCENT:-41}" "${GATERANK_DISK_PATH:-/}"'

  export PATH="$FAKE_BIN:/usr/bin:/bin:/usr/sbin:/sbin"
}

teardown_fixture() {
  rm -rf "$TEST_TMP"
}

run_install() {
  "$SCRIPT" install "$@"
}

test_script_syntax() {
  bash -n "$SCRIPT"
  pass "maintenance script has valid Bash syntax"
}

test_hourly_rotation_uses_collision_free_numeric_names() {
  if grep -Eq '^[[:space:]]*dateext([[:space:]]|$)' "$TEMPLATE_DIR/gaterank-logrotate.conf"; then
    fail "hourly rotation cannot use a date-only suffix"
  fi
  pass "hourly rotation uses collision-free numeric names"
}

test_dry_run_is_read_only() {
  setup_fixture
  run_install --dry-run >/dev/null
  assert_no_file "$TEST_TMP/systemd/gaterank-log-maintenance.service"
  assert_no_file "$TEST_TMP/compose/docker-compose.override.yml"
  assert_no_file "$TEST_TMP/install-bin/gaterank-log-maintenance"
  teardown_fixture
  pass "install --dry-run does not mutate targets"
}

test_root_disk_path_is_valid_for_read_only_checks() {
  setup_fixture
  unset GATERANK_DISK_PATH
  assert_exit 0 run_install --dry-run
  teardown_fixture
  pass "root filesystem is accepted as the read-only disk check path"
}

test_unknown_legacy_conflict_aborts() {
  setup_fixture
  cat >"$GATERANK_LEGACY_LOGROTATE" <<'CONF'
/var/log/unrelated.log {
  rotate 3
}
CONF
  assert_exit 1 run_install
  assert_file "$GATERANK_LEGACY_LOGROTATE"
  assert_no_file "$TEST_TMP/compose/docker-compose.override.yml"
  teardown_fixture
  pass "unknown legacy logrotate conflict aborts before writes"
}

test_unmanaged_installed_template_aborts() {
  setup_fixture
  mkdir -p "$GATERANK_CONFIG_DIR/templates"
  printf 'unmanaged template\n' >"$GATERANK_CONFIG_DIR/templates/gaterank-logrotate.conf"
  assert_exit 1 run_install
  assert_contains "$GATERANK_CONFIG_DIR/templates/gaterank-logrotate.conf" "unmanaged template"
  teardown_fixture
  pass "install refuses to overwrite an unmanaged installed template"
}

test_install_is_idempotent_and_migrates_known_legacy_rule() {
  setup_fixture
  cat >"$GATERANK_LEGACY_LOGROTATE" <<CONF
$GATERANK_LOG_DIR/access.log $GATERANK_LOG_DIR/error.log {
  daily
  rotate 14
}
CONF
  run_install >/dev/null
  assert_file "$TEST_TMP/systemd/gaterank-log-maintenance.service"
  assert_file "$TEST_TMP/systemd/gaterank-log-maintenance.timer"
  assert_file "$TEST_TMP/config/gaterank-logrotate.conf"
  assert_file "$TEST_TMP/compose/docker-compose.override.yml"
  assert_no_file "$GATERANK_LEGACY_LOGROTATE"
  assert_contains "$TEST_TMP/compose/docker-compose.override.yml" "gaterank-api:"
  first_up_count="$(grep -c 'docker compose .*up -d' "$FAKE_CALLS" || true)"
  run_install >/dev/null
  second_up_count="$(grep -c 'docker compose .*up -d' "$FAKE_CALLS" || true)"
  [[ "$first_up_count" -eq "$second_up_count" ]] || fail "idempotent install unexpectedly recreated containers"
  teardown_fixture
  pass "install is idempotent and migrates the known legacy rule"
}

test_run_handles_missing_logs_and_never_prunes() {
  setup_fixture
  mkdir -p "$GATERANK_CONFIG_DIR"
  sed "s|@@LOG_DIR@@|$GATERANK_LOG_DIR|g" \
    "$TEMPLATE_DIR/gaterank-logrotate.conf" \
    >"$GATERANK_CONFIG_DIR/gaterank-logrotate.conf"
  "$SCRIPT" run >/dev/null
  assert_contains "$FAKE_CALLS" "logrotate --state"
  if grep -Eiq 'prune|mysql|uploads' "$FAKE_CALLS"; then
    fail "run invoked an out-of-scope cleanup command"
  fi
  teardown_fixture
  pass "run tolerates missing logs and does not expand cleanup scope"
}

test_run_reports_disk_threshold() {
  setup_fixture
  mkdir -p "$GATERANK_CONFIG_DIR"
  sed "s|@@LOG_DIR@@|$GATERANK_LOG_DIR|g" \
    "$TEMPLATE_DIR/gaterank-logrotate.conf" \
    >"$GATERANK_CONFIG_DIR/gaterank-logrotate.conf"
  export FAKE_DISK_PERCENT=80
  assert_exit 2 "$SCRIPT" run
  teardown_fixture
  pass "run returns 2 when disk usage remains at threshold"
}

test_run_skips_when_lock_is_busy() {
  setup_fixture
  export FAKE_FLOCK_BUSY=1
  assert_exit 0 "$SCRIPT" run
  teardown_fixture
  pass "concurrent run skips cleanly"
}

test_check_detects_docker_drift() {
  setup_fixture
  run_install >/dev/null
  export FAKE_DOCKER_MAX_SIZE=1g
  assert_exit 2 "$SCRIPT" check
  teardown_fixture
  pass "check detects Docker logging drift"
}

test_health_failure_restores_previous_override() {
  setup_fixture
  cat >"$TEST_TMP/compose/docker-compose.override.yml" <<'YAML'
# Managed by GateRank log maintenance
services:
  gaterank-web:
    logging:
      driver: json-file
      options:
        max-size: "50m"
        max-file: "2"
YAML
  export FAKE_HEALTH_CODE=500
  assert_exit 2 run_install
  assert_contains "$TEST_TMP/compose/docker-compose.override.yml" 'max-size: "50m"'
  teardown_fixture
  pass "failed health verification restores the previous override"
}

test_uninstall_refuses_unmanaged_files() {
  setup_fixture
  cat >"$TEST_TMP/systemd/gaterank-log-maintenance.service" <<'UNIT'
[Unit]
Description=Unmanaged unit
UNIT
  assert_exit 1 "$SCRIPT" uninstall
  assert_file "$TEST_TMP/systemd/gaterank-log-maintenance.service"
  teardown_fixture
  pass "uninstall refuses to remove unmanaged files"
}

test_real_logrotate_template_when_available() {
  if ! command -v logrotate >/dev/null 2>&1; then
    SKIP_COUNT=$((SKIP_COUNT + 1))
    printf 'ok - real logrotate integration # SKIP logrotate is not installed\n'
    return
  fi

  local tmp
  tmp="$(mktemp -d)"
  mkdir -p "$tmp/logs"
  sed "s|@@LOG_DIR@@|$tmp/logs|g" \
    "$TEMPLATE_DIR/gaterank-logrotate.conf" \
    >"$tmp/logrotate.conf"
  truncate -s 101M "$tmp/logs/access.log"
  : >"$tmp/logs/error.log"
  logrotate --state "$tmp/state" --force "$tmp/logrotate.conf"
  assert_file "$tmp/logs/access.log.1"
  truncate -s 101M "$tmp/logs/access.log"
  logrotate --state "$tmp/state" --force "$tmp/logrotate.conf"
  assert_file "$tmp/logs/access.log.2.gz"
  rm -rf "$tmp"
  pass "real logrotate rotates and compresses a sparse 101MB log"
}

main() {
  [[ -f "$SCRIPT" ]] || fail "missing implementation: $SCRIPT"
  test_script_syntax
  test_hourly_rotation_uses_collision_free_numeric_names
  test_dry_run_is_read_only
  test_root_disk_path_is_valid_for_read_only_checks
  test_unknown_legacy_conflict_aborts
  test_unmanaged_installed_template_aborts
  test_install_is_idempotent_and_migrates_known_legacy_rule
  test_run_handles_missing_logs_and_never_prunes
  test_run_reports_disk_threshold
  test_run_skips_when_lock_is_busy
  test_check_detects_docker_drift
  test_health_failure_restores_previous_override
  test_uninstall_refuses_unmanaged_files
  test_real_logrotate_template_when_available
  printf '# passed=%d skipped=%d\n' "$TEST_COUNT" "$SKIP_COUNT"
}

main "$@"
