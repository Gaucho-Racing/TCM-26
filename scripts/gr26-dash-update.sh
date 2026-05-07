#!/usr/bin/env bash
# Best-effort auto-updater for the gr26-dash .deb on the Jetson. Runs at
# boot (via gr26-dash-update.service) before the graphical session comes
# up, so any new version is in place before the dash launches.
#
# Failure modes — every one of these exits 0 so the dash still starts on
# whatever's currently installed:
#   - no network / GitHub unreachable
#   - couldn't parse latest release
#   - no arm64 .deb attached to that release
#   - download interrupted
#   - dpkg install failed
#
# Pin a specific version (skip updates entirely):
#   sudo mkdir -p /etc/gr26-dash && sudo touch /etc/gr26-dash/updates-disabled

set -uo pipefail

REPO="Gaucho-Racing/TCM-26"
PACKAGE="gr26-dash"
DISABLED_FLAG="/etc/gr26-dash/updates-disabled"
LOG_PREFIX="[gr26-dash-update]"
API_TIMEOUT=20
DOWNLOAD_TIMEOUT=120

log() { echo "${LOG_PREFIX} $*"; }

if [ -e "${DISABLED_FLAG}" ]; then
    log "${DISABLED_FLAG} present — updates disabled"
    exit 0
fi

if [ "$(id -u)" -ne 0 ]; then
    log "must run as root (need dpkg -i)"
    exit 0
fi

CURRENT=$(dpkg-query -W -f='${Version}' "${PACKAGE}" 2>/dev/null || echo "")

RESP=$(curl --max-time "${API_TIMEOUT}" -fsSL \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/${REPO}/releases/latest" 2>/dev/null) || {
    log "could not reach GitHub, skipping"
    exit 0
}

LATEST_TAG=$(printf '%s' "${RESP}" | grep -m1 '"tag_name"' | sed -E 's/.*"v?([^"]+)".*/\1/')
if [ -z "${LATEST_TAG}" ]; then
    log "could not parse latest tag, skipping"
    exit 0
fi

log "current: ${CURRENT:-(none)}, latest: ${LATEST_TAG}"

if [ "${CURRENT}" = "${LATEST_TAG}" ]; then
    log "already up to date"
    exit 0
fi

DEB_URL=$(printf '%s' "${RESP}" \
    | grep -E '"browser_download_url".*_arm64\.deb"' \
    | head -n1 \
    | sed -E 's/.*"(https[^"]+)".*/\1/')

if [ -z "${DEB_URL}" ]; then
    log "no arm64.deb attached to latest release, skipping"
    exit 0
fi

TMP=$(mktemp /tmp/gr26-dash.XXXXXX.deb)
trap 'rm -f "${TMP}"' EXIT

log "downloading ${DEB_URL}"
if ! curl --max-time "${DOWNLOAD_TIMEOUT}" -fsSL -o "${TMP}" "${DEB_URL}"; then
    log "download failed, keeping current version"
    exit 0
fi

log "installing ${TMP}"
if dpkg -i "${TMP}"; then
    log "installed ${LATEST_TAG}"
else
    log "dpkg install failed, keeping previous version"
fi

exit 0
