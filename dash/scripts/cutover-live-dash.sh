#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-staging}" # staging | production
SERVICE_NAME="${SERVICE_NAME:-gr-screen}"
LEGACY_SERVICE_NAME="${LEGACY_SERVICE_NAME:-gr26-dash}"
DEPLOY_DIR="${DEPLOY_DIR:-/opt/gr-screen}"
SYSTEMD_USER_DIR="${SYSTEMD_USER_DIR:-$HOME/.config/systemd/user}"
SERVICE_FILE_SOURCE="${SERVICE_FILE_SOURCE:-./deploy/gr-screen.service}"
PRECHECK_ONLY="${PRECHECK_ONLY:-false}"

if [[ "$MODE" != "staging" && "$MODE" != "production" ]]; then
  echo "Usage: $0 [staging|production]"
  exit 1
fi

echo "== GR-Screen cutover ($MODE) =="
echo "Service: $SERVICE_NAME"
echo "Legacy service: $LEGACY_SERVICE_NAME"
echo "Deploy dir: $DEPLOY_DIR"

npm run build
npm run preflight:live

if [[ "$PRECHECK_ONLY" == "true" ]]; then
  echo "Precheck mode complete."
  exit 0
fi

timestamp="$(date +%Y%m%d-%H%M%S)"
release_dir="$DEPLOY_DIR/releases/$timestamp"

mkdir -p "$release_dir"
mkdir -p "$SYSTEMD_USER_DIR"

echo "Copying release into $release_dir"
rsync -a --delete \
  --exclude ".git" \
  --exclude "node_modules" \
  --exclude ".next/cache" \
  ./ "$release_dir/"

pushd "$release_dir" >/dev/null
npm ci
npm run build
popd >/dev/null

ln -sfn "$release_dir" "$DEPLOY_DIR/current"

cp "$SERVICE_FILE_SOURCE" "$SYSTEMD_USER_DIR/$SERVICE_NAME.service"

systemctl --user daemon-reload
systemctl --user enable --now "$SERVICE_NAME.service"

if [[ "$MODE" == "production" ]]; then
  systemctl --user disable --now "$LEGACY_SERVICE_NAME.service" || true
fi

echo "Cutover complete. Verify with:"
echo "  systemctl --user status $SERVICE_NAME.service"
echo "  journalctl --user -u $SERVICE_NAME.service -n 200 --no-pager"
