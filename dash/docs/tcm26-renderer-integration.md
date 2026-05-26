# TCM-26 Renderer Integration Guide

This guide describes how to drop GR-Screen into the existing `TCM-26/dash` Electron runtime without changing the main-process, AppImage packaging, or systemd behavior.

## Goal

Replace only renderer UI logic while keeping:

- existing Electron shell
- existing `electron-builder` packaging flow
- existing `gr26-dash` systemd user service
- existing ingest WebSocket endpoint (`ws://localhost:8001/gr26/live`)

## Files to Port From GR-Screen

Copy these folders into `TCM-26/dash/src/renderer/src/`:

- `components/` (GR-Screen dashboard components)
- `hooks/use-gr26-telemetry.ts`
- `lib/gr26-adapter.ts`
- `types/telemetry.ts`

Then replace renderer app entry (`TCM-26/dash/src/renderer/src/App.tsx`) with GR-Screen composition:

```tsx
import { TelemetryDashboard } from "./components/telemetry-dashboard";
import { useGr26Telemetry } from "./hooks/use-gr26-telemetry";

export default function App() {
  const data = useGr26Telemetry();

  return (
    <main className="min-h-screen bg-zinc-950 flex items-center justify-center p-2">
      <TelemetryDashboard data={data} />
    </main>
  );
}
```

## Environment Variables (renderer)

Add to dash `.env` or service environment:

- `VITE_GR26_WS_URL=ws://localhost:8001/gr26/live`
- `VITE_GR26_VEHICLE_ID=gr26`
- `VITE_GR26_REFRESH_RATE_HZ=30`
- `VITE_GR26_STALE_AFTER_MS=2500`
- `VITE_GR26_RECONNECT_MS=1000`

If you keep this logic in Next.js (outside dash), use `NEXT_PUBLIC_*` names instead.

## Runtime Expectations

- Kiosk layout constrained to 1600x600.
- Keyboard shortcuts retained:
  - `ArrowRight` / `ArrowLeft`: detail pages
  - `A`: debug page
  - `B`: debug FD page
- Stale telemetry drives debug status and `brakeCheck` fallback.

## Verify in Renderer Dev

1. Start ingest stack (`docker compose up`) in `TCM-26`.
2. Start dash renderer (`npm run dev` in `TCM-26/dash`).
3. Confirm updates on:
   - speed
   - SoC fields
   - ECU state
   - max cell temperature
4. Stop ingest and verify stale/reconnect behavior recovers automatically.
