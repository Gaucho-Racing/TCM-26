#!/usr/bin/env bash
set -euo pipefail

DESKTOP_FILE_NAME="${DESKTOP_FILE_NAME:-gr-screen.desktop}"
DESKTOP_FILE="${HOME}/.local/share/applications/${DESKTOP_FILE_NAME}"

if [[ -f "${DESKTOP_FILE}" ]]; then
  rm -f "${DESKTOP_FILE}"
  echo "Removed desktop entry: ${DESKTOP_FILE}"
else
  echo "Desktop entry not found: ${DESKTOP_FILE}"
fi
