#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${APP_NAME:-GR Screen}"
DESKTOP_FILE_NAME="${DESKTOP_FILE_NAME:-gr-screen.desktop}"
PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
DESKTOP_DIR="${HOME}/.local/share/applications"
DESKTOP_FILE="${DESKTOP_DIR}/${DESKTOP_FILE_NAME}"

mkdir -p "${DESKTOP_DIR}"

cat >"${DESKTOP_FILE}" <<EOF
[Desktop Entry]
Type=Application
Version=1.0
Name=${APP_NAME}
Comment=GR26 live telemetry dashboard
Exec=/usr/bin/env bash -lc 'cd "${PROJECT_DIR}" && npm run start:app'
Path=${PROJECT_DIR}
Terminal=false
Categories=Utility;
StartupNotify=true
EOF

chmod +x "${DESKTOP_FILE}"
echo "Installed desktop entry at: ${DESKTOP_FILE}"
