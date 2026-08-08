#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
INSTALL_ROOT="/opt/gaterank-probe"
STATE_ROOT="/var/lib/gaterank-probe"
SERVICE_USER="gaterank-probe"
SING_BOX_VERSION="1.13.12"
SING_BOX_ARCHIVE="sing-box-${SING_BOX_VERSION}-linux-amd64-glibc.tar.gz"
SING_BOX_SHA256="11cf6d5fb93c60525771bc5652b46b734ee033ef72831056735fc658243e1fdb"
SING_BOX_URL="https://github.com/SagerNet/sing-box/releases/download/v${SING_BOX_VERSION}/${SING_BOX_ARCHIVE}"

fail() {
  printf '[gaterank-probe] %s\n' "$1" >&2
  exit 1
}

[[ "$(id -u)" -eq 0 ]] || fail 'run install.sh as root'
[[ -r /etc/os-release ]] || fail '/etc/os-release is required'

# shellcheck disable=SC1091
source /etc/os-release
[[ "${ID:-}" == "debian" && "${VERSION_ID:-}" == "12" ]] || fail 'Debian 12 is required'
[[ -f "$SOURCE_ROOT/scripts/performance_probe_runner.py" ]] || fail 'performance_probe_runner.py not found'
[[ -f "$SOURCE_ROOT/scripts/monitor_performance.py" ]] || fail 'monitor_performance.py not found'

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y --no-install-recommends ca-certificates curl python3 python3-venv tar

if ! getent passwd "$SERVICE_USER" >/dev/null; then
  useradd --system --home-dir "$STATE_ROOT" --shell /usr/sbin/nologin "$SERVICE_USER"
fi

install -d -o root -g root -m 0755 "$INSTALL_ROOT" "$INSTALL_ROOT/bin" "$INSTALL_ROOT/scripts"
install -d -o "$SERVICE_USER" -g "$SERVICE_USER" -m 0700 "$STATE_ROOT"

python3 -m venv "$INSTALL_ROOT/venv"
install -o root -g root -m 0644 "$SOURCE_ROOT/scripts/performance_probe_runner.py" "$INSTALL_ROOT/scripts/performance_probe_runner.py"
install -o root -g root -m 0644 "$SOURCE_ROOT/scripts/monitor_performance.py" "$INSTALL_ROOT/scripts/monitor_performance.py"

TEMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf -- "$TEMP_DIR"
}
trap cleanup EXIT

curl --fail --location --proto '=https' --tlsv1.2 --output "$TEMP_DIR/$SING_BOX_ARCHIVE" "$SING_BOX_URL"
printf '%s  %s\n' "$SING_BOX_SHA256" "$TEMP_DIR/$SING_BOX_ARCHIVE" | sha256sum --check --status
tar -xzf "$TEMP_DIR/$SING_BOX_ARCHIVE" -C "$TEMP_DIR"
install -o root -g root -m 0755 \
  "$TEMP_DIR/sing-box-${SING_BOX_VERSION}-linux-amd64-glibc/sing-box" \
  "$INSTALL_ROOT/bin/sing-box"

install -o root -g root -m 0644 "$SCRIPT_DIR/gaterank-probe.service" /etc/systemd/system/gaterank-probe.service
install -o root -g root -m 0644 "$SCRIPT_DIR/gaterank-probe.timer" /etc/systemd/system/gaterank-probe.timer
install -o root -g root -m 0644 "$SCRIPT_DIR/gaterank-probe.env.example" /etc/gaterank-probe.env.example
systemctl daemon-reload

printf '%s\n' '[gaterank-probe] installed; timer remains disabled until explicitly enabled'
