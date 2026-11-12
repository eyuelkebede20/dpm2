#!/usr/bin/env bash
# ============================================================
#  deploy/install-watcher.sh
#  Self-healing update watcher installer for DPM2
#
#  Installs the dpm-watcher daemon as an auto-restarting
#  system service (systemd) and/or cron watchdog so the
#  system updates reliably in the background without
#  requiring Docker socket exposure.
# ============================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/.." && pwd)"
cd "$ROOT"

SILENT="${1:-}"

if [ "$SILENT" != "silent" ]; then
  echo "=========================================================="
  echo "  Installing DPM2 Update Watcher Daemon"
  echo "=========================================================="
fi

mkdir -p "$ROOT/run" "$ROOT/backups" "$ROOT/logs"
chmod 777 "$ROOT/run" 2>/dev/null || true
chmod +x "$ROOT/update.sh" "$ROOT/start.sh" "$ROOT/deploy/"*.sh "$ROOT"/*.sh 2>/dev/null || true

install_cron_watchdog() {
  if ! command -v crontab >/dev/null 2>&1; then
    return 0
  fi

  local current_cron
  current_cron=$(crontab -l 2>/dev/null || true)
  local marker="# DPM2 Update Watcher"
  local reboot_cmd="@reboot /bin/bash $ROOT/deploy/dpm-watcher.sh --daemon >/dev/null 2>&1"
  local check_cmd="*/5 * * * * /bin/bash $ROOT/deploy/dpm-watcher.sh --watchdog >/dev/null 2>&1"

  local filtered_cron
  filtered_cron=$(echo "$current_cron" | grep -v "dpm-watcher.sh" | grep -v "$marker" || true)

  {
    if [ -n "$filtered_cron" ]; then
      echo "$filtered_cron"
    fi
    echo "$marker"
    echo "$reboot_cmd"
    echo "$check_cmd"
  } | crontab - 2>/dev/null || true

  if [ "$SILENT" != "silent" ]; then
    echo "  [OK] Crontab watchdog registered (@reboot and 5-min healthcheck)."
  fi
}

HAS_SYSTEMD=0
if command -v systemctl >/dev/null 2>&1 && [ -d /run/systemd/system ]; then
  HAS_SYSTEMD=1
fi

CAN_SUDO=0
if [ "$EUID" -eq 0 ]; then
  CAN_SUDO=1
elif command -v sudo >/dev/null 2>&1; then
  if sudo -n true 2>/dev/null || sudo -v 2>/dev/null; then
    CAN_SUDO=1
  fi
fi

RUN_USER="${SUDO_USER:-$(id -un)}"
SYSTEMD_INSTALLED=0

if [ "$HAS_SYSTEMD" -eq 1 ] && [ "$CAN_SUDO" -eq 1 ]; then
  if [ "$SILENT" != "silent" ]; then
    echo "  [..] Configuring systemd dpm-watcher.service with auto-restart..."
  fi

  sudo systemctl stop dpm-update.path dpm-update.service 2>/dev/null || true
  sudo systemctl disable dpm-update.path dpm-update.service 2>/dev/null || true
  sudo rm -f /etc/systemd/system/dpm-update.path /etc/systemd/system/dpm-update.service 2>/dev/null || true

  tmp=$(mktemp -d 2>/dev/null || echo "/tmp/dpm-tmp")
  mkdir -p "$tmp"

  cat > "$tmp/dpm-watcher.service" <<UNIT
[Unit]
Description=DPM2 Update Watcher Daemon
After=network.target docker.service
Wants=docker.service

[Service]
Type=simple
User=$RUN_USER
WorkingDirectory=$ROOT
SupplementaryGroups=docker
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/snap/bin:$PATH
ExecStart=/bin/bash $ROOT/deploy/dpm-watcher.sh
Restart=always
RestartSec=5s
KillMode=process
TimeoutStopSec=15
StandardOutput=append:$ROOT/run/watcher.log
StandardError=append:$ROOT/run/watcher.log

[Install]
WantedBy=multi-user.target
UNIT

  if sudo install -m 644 "$tmp/dpm-watcher.service" /etc/systemd/system/dpm-watcher.service 2>/dev/null; then
    sudo systemctl daemon-reload 2>/dev/null || true
    sudo systemctl enable --now dpm-watcher.service >/dev/null 2>&1 || true
    loginctl enable-linger "$RUN_USER" 2>/dev/null || true
    
    sleep 1
    if systemctl is-active --quiet dpm-watcher.service 2>/dev/null; then
      SYSTEMD_INSTALLED=1
      echo "  [OK] dpm-watcher.service is active and managed by systemd."
      echo "       Auto-restart on failure: ENABLED (RestartSec=5s)"
      echo "       Starts automatically on boot: ENABLED"
    fi
  fi
  rm -rf "$tmp" 2>/dev/null || true
fi

if [ "$SYSTEMD_INSTALLED" -eq 0 ]; then
  if [ "$SILENT" != "silent" ]; then
    echo "  [!] Systemd service not applicable (WSL / non-systemd / non-sudo environment)."
    echo "  [..] Activating persistent background daemon and cron watchdog..."
  fi

  "$ROOT/deploy/dpm-watcher.sh" --daemon
  install_cron_watchdog
else
  install_cron_watchdog
fi

if [ "$SILENT" != "silent" ]; then
  echo ""
  echo "  Status:"
  "$ROOT/deploy/dpm-watcher.sh" --status || true
  echo ""
  echo "  Management commands:"
  echo "    Check status:  ./deploy/dpm-watcher.sh --status"
  echo "    Restart:       ./deploy/dpm-watcher.sh --restart"
  echo "    Stop:          ./deploy/dpm-watcher.sh --stop"
  echo "    View logs:     tail -f run/watcher.log"
  echo "=========================================================="
fi

exit 0
