#!/bin/bash
# Launch the dash in dev mode on the Jetson. Wired up so it works whether
# you're on the Jetson directly or SSH'd in (X11 needs DISPLAY +
# XAUTHORITY when the Electron process can't infer them).
#
# Usage: ./scripts/run-dash.sh

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DASH_DIR="$REPO_ROOT/dash"

# Pick a sensible DISPLAY if one isn't already set in the environment.
# Most Jetson installs end up on :1 under the gdm user; fall back to :0
# for vanilla X.org desktops. Override by exporting DISPLAY before calling.
if [ -z "$DISPLAY" ]; then
  if [ -e /tmp/.X11-unix/X1 ]; then
    export DISPLAY=:1
  else
    export DISPLAY=:0
  fi
fi

# Same idea for XAUTHORITY — Electron will silently fail to open a window
# without the right cookie file when launched from a non-graphical session.
if [ -z "$XAUTHORITY" ]; then
  for candidate in \
    "/run/user/$(id -u)/gdm/Xauthority" \
    "/run/user/1000/gdm/Xauthority" \
    "$HOME/.Xauthority"; do
    if [ -r "$candidate" ]; then
      export XAUTHORITY="$candidate"
      break
    fi
  done
fi

echo "[dash] DISPLAY=$DISPLAY XAUTHORITY=$XAUTHORITY"

cd "$DASH_DIR"

# `npm ci` instead of `npm install` — strict install from the committed
# package-lock.json. Reproducible, faster (skips dep resolution), and
# fails loudly if package.json/package-lock.json have drifted instead of
# silently rewriting the lockfile on the Jetson.
echo "[dash] npm ci"
npm ci

if [ ! -f .env ]; then
  echo "[dash] WARN: no .env found. If signals don't show up, the"
  echo "[dash]       most likely cause is a vehicle_id mismatch with the"
  echo "[dash]       relay. Create dash/.env with:"
  echo "[dash]         VITE_GR26_VEHICLE_ID=<id matching tcm-26/.env VEHICLE_ID>"
fi

exec npm run dev
