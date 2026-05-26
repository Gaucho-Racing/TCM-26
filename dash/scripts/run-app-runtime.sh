#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-prod}" # dev | prod
HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-3000}"

if [[ "$MODE" != "dev" && "$MODE" != "prod" ]]; then
  echo "Usage: $0 [dev|prod]"
  exit 1
fi

has_display="false"
if [[ -n "${DISPLAY:-}" || -n "${WAYLAND_DISPLAY:-}" ]]; then
  has_display="true"
fi

if [[ "${FORCE_HEADLESS:-0}" == "1" ]]; then
  has_display="false"
fi

start_next() {
  if [[ "$MODE" == "dev" ]]; then
    npm run dev -- --hostname "$HOST" --port "$PORT" &
  else
    npm run start -- --hostname "$HOST" --port "$PORT" &
  fi
  NEXT_PID=$!
}

wait_for_next() {
  npx wait-on "tcp:$HOST:$PORT"
}

cleanup() {
  if [[ -n "${NEXT_PID:-}" ]]; then
    kill "$NEXT_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

echo "Starting Next.js ($MODE) on $HOST:$PORT"
start_next
wait_for_next

if [[ "$has_display" == "true" || "${FORCE_ELECTRON:-0}" == "1" ]]; then
  echo "Display detected. Launching Electron."
  APP_URL="http://${HOST}:${PORT}" APP_HOST="$HOST" APP_PORT="$PORT" env -u ELECTRON_RUN_AS_NODE electron ./electron/main.cjs
elif command -v xvfb-run >/dev/null 2>&1; then
  echo "No display detected. Launching Electron with xvfb-run."
  APP_URL="http://${HOST}:${PORT}" APP_HOST="$HOST" APP_PORT="$PORT" xvfb-run -a env -u ELECTRON_RUN_AS_NODE electron ./electron/main.cjs
else
  echo "No display or xvfb-run found. Running in headless server mode."
  wait "$NEXT_PID"
fi
