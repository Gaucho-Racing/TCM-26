# GR-Screen

Live dashboard UI for GR26 with direct WebSocket telemetry ingestion.

## Quick start

```bash
npm install
npm run dev
```

## Desktop app mode (Electron)

Run in an Electron window (instead of a browser tab):

```bash
npm install
npm run dev:electron
```

Production-like local run:

```bash
npm run build
npm run start:electron
```

Headless-safe runtime (for SSH sessions or Ubuntu without X/Wayland):

- If display is available, launches Electron.
- If no display but `xvfb-run` is installed, launches Electron in virtual display.
- If no display and no `xvfb-run`, runs Next.js in server mode and keeps service alive.

```bash
npm run start:app
```

## Live telemetry configuration

Copy `.env.example` to `.env.local` and adjust if needed:

- `NEXT_PUBLIC_TELEMETRY_WS_URL` (default `ws://localhost:8001/gr26/live`)
- `NEXT_PUBLIC_GR26_VEHICLE_ID` (default `gr26`)
- `NEXT_PUBLIC_GR26_REFRESH_RATE_HZ` (default `30`)
- `NEXT_PUBLIC_GR26_STALE_AFTER_MS` (default `2500`)
- `NEXT_PUBLIC_GR26_RECONNECT_MS` (default `1000`)

## Preflight checks

Before service restart/cutover:

```bash
npm run preflight:live
```

This validates runtime config, compose visibility, and WebSocket reachability.

## Cutover and rollback

- Staging/production deployment script: `scripts/cutover-live-dash.sh`
- Rollback script: `scripts/rollback-live-dash.sh`
- Runbook: `docs/cutover-runbook.md`

## Integration docs

- Telemetry contract map: `docs/telemetry-mapping.md`
- TCM-26 renderer integration: `docs/tcm26-renderer-integration.md`
