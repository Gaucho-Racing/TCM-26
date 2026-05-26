#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="${SERVICE_NAME:-gr-screen}"
LEGACY_SERVICE_NAME="${LEGACY_SERVICE_NAME:-gr26-dash}"
DEPLOY_DIR="${DEPLOY_DIR:-/opt/gr-screen}"
RESTORE_LEGACY="${RESTORE_LEGACY:-true}"

current_link="$DEPLOY_DIR/current"
releases_dir="$DEPLOY_DIR/releases"

if [[ ! -d "$releases_dir" ]]; then
  echo "No releases directory at $releases_dir"
  exit 1
fi

mapfile -t releases < <(ls -1 "$releases_dir" | sort)
if (( ${#releases[@]} < 2 )); then
  echo "Need at least 2 releases to rollback."
  exit 1
fi

previous_release="${releases[-2]}"
target_dir="$releases_dir/$previous_release"

echo "Rolling back to $target_dir"
ln -sfn "$target_dir" "$current_link"

systemctl --user restart "$SERVICE_NAME.service" || true

if [[ "$RESTORE_LEGACY" == "true" ]]; then
  systemctl --user enable --now "$LEGACY_SERVICE_NAME.service" || true
  systemctl --user disable --now "$SERVICE_NAME.service" || true
fi

echo "Rollback complete."
echo "Check services:"
echo "  systemctl --user status $SERVICE_NAME.service"
echo "  systemctl --user status $LEGACY_SERVICE_NAME.service"
