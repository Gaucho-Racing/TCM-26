#!/usr/bin/env bash
set -euo pipefail

# Cuts a tcm-26 release.
#
#   ./scripts/release.sh 0.2.0       # release as v0.2.0
#   ./scripts/release.sh             # interactive — shows current, prompts
#
# A release in tcm-26 means a single tag (vX.Y.Z) that:
#   - tags the mqtt and icanspi Docker images (their workflows pick up the
#     release and add a <version> tag alongside `latest`)
#   - kicks the dash release matrix (dash.yml builds linux/arm64, mac
#     universal, windows x64 installers and attaches them to the
#     GitHub Release)
#
# Bumps the version baked into:
#   - mqtt/config/config.go  (Version constant; surfaces in the relay banner)
#   - dash/package.json      (drives electron-builder artifact filenames)
#
# Mirrors Mapache's scripts/release.sh in shape so both repos feel the
# same to release.

usage() {
    cat <<EOF
Usage: $0 [version]

Examples:
  $0 0.2.0       # release v0.2.0
  $0             # prompt interactively, showing current release
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    usage
    exit 0
fi

INPUT="${1:-}"

for cmd in gh git; do
    if ! command -v "$cmd" &>/dev/null; then
        echo "Error: $cmd is required"
        exit 1
    fi
done

BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$BRANCH" != "main" ]]; then
    echo "Error: must be on main branch (currently on $BRANCH)"
    exit 1
fi

git fetch origin main --tags --quiet
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)
if [[ "$LOCAL" != "$REMOTE" ]]; then
    echo "Error: local main is not up to date with origin/main"
    echo "  local:  $LOCAL"
    echo "  remote: $REMOTE"
    exit 1
fi

PREV=$(git tag -l 'v*' | sort -V | tail -n1)

if [[ -z "$INPUT" ]]; then
    echo ""
    if [[ -n "$PREV" ]]; then
        echo "Current tcm-26 release: ${PREV}"
    else
        echo "Current tcm-26 release: (none)"
    fi
    echo ""
    read -rp "Enter new version: " INPUT
fi

if [[ -z "$INPUT" ]]; then
    echo "Error: version cannot be empty"
    exit 1
fi
INPUT="${INPUT#v}"
if [[ ! "$INPUT" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "Error: version must be a valid semver (e.g. 0.2.0)"
    exit 1
fi
SEMVER="$INPUT"
VERSION="v${INPUT}"
TAG="${VERSION}"

if git tag -l "$TAG" | grep -q "^${TAG}$"; then
    echo "Error: tag $TAG already exists"
    exit 1
fi

REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT"

SERVICES=("mqtt" "icanspi")

echo ""
echo "=== Release Summary ==="
echo "  Version: ${VERSION}"
echo "  Tag:     ${TAG}"
echo "  Commit:  $(git rev-parse --short HEAD)"
echo "  Branch:  main"
echo ""
echo "  Files to update:"
echo "    mqtt/config/config.go"
echo "    dash/package.json"
echo ""
echo "  Docker images that will be tagged:"
for svc in "${SERVICES[@]}"; do
    echo "    ghcr.io/gaucho-racing/tcm-26/${svc}:${SEMVER}"
done
echo ""
echo "  Dash artifacts that will be attached to the GitHub Release:"
echo "    gr26-dash_${SEMVER}_arm64.deb"
echo "    gr26-dash_${SEMVER}_arm64.AppImage"
echo "    gr26-dash-${SEMVER}-universal.dmg"
echo "    gr26-dash-${SEMVER}-universal-mac.zip"
echo "    GR26 Dash Setup ${SEMVER}.exe"
echo "    gr26-dash-${SEMVER}-win.zip"
echo ""
read -rp "Proceed? (y/N) " CONFIRM
if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
    echo "Aborted."
    exit 0
fi

# BSD sed (-i '') so this stays mac-friendly; the Mapache release script
# uses the same form, so anyone who's run that one already has the muscle
# memory.
sed -i '' "s/^var Version = \".*\"/var Version = \"${SEMVER}\"/" mqtt/config/config.go
sed -i '' "s/\"version\": \"[^\"]*\"/\"version\": \"${SEMVER}\"/" dash/package.json

git add mqtt/config/config.go dash/package.json
git commit -m "release: tcm-26 ${VERSION}"
git push origin main

gh release create "$TAG" \
    --target main \
    --title "${VERSION}" \
    --generate-notes

echo ""
echo "Done. ${TAG} released."
echo "  - mqtt + icanspi workflows will publish ${SEMVER}-tagged images"
echo "  - dash workflow will attach installers to the release"
echo ""
echo "Watch progress:"
echo "  gh run list --limit 5"
