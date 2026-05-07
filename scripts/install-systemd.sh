#!/usr/bin/env bash
# One-shot installer for the gr26-dash systemd units on the Jetson.
#
#   ./scripts/install-systemd.sh
#
# Run as the user that will own the dash (e.g. `tcm`), NOT root. The
# script will sudo where it needs to (system service + updater binary).
# Idempotent — safe to re-run after a git pull to pick up changes.

set -euo pipefail

REPO_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
USER_NAME=$(whoami)
SYSTEMD_USER_DIR="${HOME}/.config/systemd/user"

if [ "${USER_NAME}" = "root" ]; then
    echo "Don't run this as root — run it as the user that will run the dash."
    exit 1
fi

echo "[install] installing /usr/local/bin/gr26-dash-update"
sudo install -m 0755 \
    "${REPO_ROOT}/scripts/gr26-dash-update.sh" \
    /usr/local/bin/gr26-dash-update

echo "[install] installing /etc/systemd/system/gr26-dash-update.service"
sudo install -m 0644 \
    "${REPO_ROOT}/systemd/gr26-dash-update.service" \
    /etc/systemd/system/gr26-dash-update.service

echo "[install] installing /etc/systemd/system/gr26-dash-update.timer"
sudo install -m 0644 \
    "${REPO_ROOT}/systemd/gr26-dash-update.timer" \
    /etc/systemd/system/gr26-dash-update.timer

echo "[install] installing ${SYSTEMD_USER_DIR}/gr26-dash.service"
mkdir -p "${SYSTEMD_USER_DIR}"
install -m 0644 \
    "${REPO_ROOT}/systemd/gr26-dash.service" \
    "${SYSTEMD_USER_DIR}/gr26-dash.service"

echo "[install] reloading systemd"
sudo systemctl daemon-reload
systemctl --user daemon-reload

echo "[install] enabling units"
# Timer (not the .service) is what gets enabled — the timer triggers
# the service on its schedule. Enabling the .service directly would
# tie it to a target's startup, which is exactly what we don't want.
sudo systemctl enable gr26-dash-update.timer
systemctl --user enable gr26-dash.service

# Linger keeps user services running without an interactive login —
# necessary on a kiosk Jetson that auto-logs in once and stays there.
echo "[install] enabling lingering for ${USER_NAME}"
sudo loginctl enable-linger "${USER_NAME}"

cat <<EOF

[install] done.

The dash will now:
  - Launch on the graphical session (gr26-dash.service, ${USER_NAME})
  - Auto-update on a timer: 5 min after boot, then every 6h
    (gr26-dash-update.timer + gr26-dash-update.service, root)

A new release is dpkg-installed but doesn't kick the running dash —
the new version takes effect on the next boot or the next time the
dash service is restarted. No mid-session blip.

Reboot to exercise the full flow, or kick things off without rebooting:
  systemctl --user start gr26-dash.service          # launch the dash now
  sudo systemctl start gr26-dash-update.service     # force an update check now

Tail logs:
  sudo journalctl -u gr26-dash-update -f
  journalctl --user -u gr26-dash -f

When the next update fires:
  systemctl list-timers gr26-dash-update.timer

Pin to current version (disable auto-update temporarily):
  sudo mkdir -p /etc/gr26-dash
  sudo touch /etc/gr26-dash/updates-disabled

Re-enable auto-update:
  sudo rm /etc/gr26-dash/updates-disabled
EOF
