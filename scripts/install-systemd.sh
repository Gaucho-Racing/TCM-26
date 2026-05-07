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

echo "[install] installing ${SYSTEMD_USER_DIR}/gr26-dash.service"
mkdir -p "${SYSTEMD_USER_DIR}"
install -m 0644 \
    "${REPO_ROOT}/systemd/gr26-dash.service" \
    "${SYSTEMD_USER_DIR}/gr26-dash.service"

echo "[install] reloading systemd"
sudo systemctl daemon-reload
systemctl --user daemon-reload

echo "[install] enabling units"
sudo systemctl enable gr26-dash-update.service
systemctl --user enable gr26-dash.service

# Linger keeps user services running without an interactive login —
# necessary on a kiosk Jetson that auto-logs in once and stays there.
echo "[install] enabling lingering for ${USER_NAME}"
sudo loginctl enable-linger "${USER_NAME}"

cat <<EOF

[install] done.

The dash will now:
  - Run an auto-update check at boot (gr26-dash-update.service, root)
  - Launch on the graphical session (gr26-dash.service, ${USER_NAME})

Reboot to exercise the full flow, or kick things off without rebooting:
  sudo systemctl start gr26-dash-update.service     # check for updates now
  systemctl --user start gr26-dash.service          # launch the dash now

Tail logs:
  sudo journalctl -u gr26-dash-update -f
  journalctl --user -u gr26-dash -f

Pin to current version (disable auto-update temporarily):
  sudo mkdir -p /etc/gr26-dash
  sudo touch /etc/gr26-dash/updates-disabled

Re-enable auto-update:
  sudo rm /etc/gr26-dash/updates-disabled
EOF
