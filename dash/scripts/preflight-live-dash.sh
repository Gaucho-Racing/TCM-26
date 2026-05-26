#!/usr/bin/env bash
set -euo pipefail

WS_URL="${NEXT_PUBLIC_TELEMETRY_WS_URL:-ws://localhost:8001/gr26/live}"
VEHICLE_ID="${NEXT_PUBLIC_GR26_VEHICLE_ID:-gr26}"
REFRESH_HZ="${NEXT_PUBLIC_GR26_REFRESH_RATE_HZ:-30}"
STALE_MS="${NEXT_PUBLIC_GR26_STALE_AFTER_MS:-2500}"
RECONNECT_MS="${NEXT_PUBLIC_GR26_RECONNECT_MS:-1000}"

echo "== GR-Screen live preflight =="
echo "WS_URL=$WS_URL"
echo "VEHICLE_ID=$VEHICLE_ID"
echo "REFRESH_HZ=$REFRESH_HZ"
echo "STALE_MS=$STALE_MS"
echo "RECONNECT_MS=$RECONNECT_MS"

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node is required."
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "WARN: docker is not installed; skipping compose checks."
else
  if docker compose version >/dev/null 2>&1; then
    echo "docker compose detected."
    if docker compose ps --services --status running >/dev/null 2>&1; then
      running_services="$(docker compose ps --services --status running | tr '\n' ' ' | sed 's/[[:space:]]\+$//')"
      if [[ -n "$running_services" ]]; then
        echo "Running compose services: $running_services"
      else
        echo "WARN: no running compose services detected in current directory."
      fi
    else
      echo "WARN: unable to query docker compose status in current directory."
    fi
  else
    echo "WARN: docker compose plugin unavailable; skipping compose checks."
  fi
fi

echo "Checking WebSocket reachability..."
TELEMETRY_WS_URL="$WS_URL" node ./scripts/check-ws.mjs

if command -v systemctl >/dev/null 2>&1; then
  if systemctl --user show --property=Id gr26-dash.service >/dev/null 2>&1; then
    echo "Detected user unit: gr26-dash.service"
  else
    echo "WARN: gr26-dash.service not found in user units."
  fi
else
  echo "WARN: systemctl unavailable; skipping service checks."
fi

echo "Preflight passed."
