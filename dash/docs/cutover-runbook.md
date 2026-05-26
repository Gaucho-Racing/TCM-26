# GR-Screen Staging + Production Cutover Runbook

This runbook executes staged rollout first, then production cutover, with a fast rollback path.

## 1) Staging Validation

On staging Jetson:

1. Deploy code to host.
2. Export telemetry env values (or copy `.env.example`).
3. Run preflight:
   - `npm run preflight:live`
4. Start staging cutover:
   - `bash ./scripts/cutover-live-dash.sh staging`

Validation checklist:

- Dash opens in kiosk flow and fills 1600x600 viewport.
- Live values update for speed, SoC, ECU state, and max cell temperature.
- Stop ingest (`docker compose stop`) and verify stale/reconnect behavior.
- Restart ingest (`docker compose start`) and verify auto-recovery.
- Confirm systemd restart behavior by restarting service:
  - `systemctl --user restart gr-screen.service`

## 2) Production Cutover

During approved cutover window:

1. Ensure staging checklist is signed off.
2. Run production cutover:
   - `bash ./scripts/cutover-live-dash.sh production`
3. Verify:
   - `systemctl --user status gr-screen.service`
   - `journalctl --user -u gr-screen.service -n 200 --no-pager`
4. Confirm operator controls:
   - `ArrowLeft` / `ArrowRight`
   - `A` / `B`

## 3) Rollback (<2 minute target)

If telemetry or UX regression is found:

1. Trigger rollback script:
   - `bash ./scripts/rollback-live-dash.sh`
2. Verify legacy service restored:
   - `systemctl --user status gr26-dash.service`
3. Confirm old dashboard data flow recovered.

## 4) Post-Cutover Capture

- Record release timestamp and active symlink target (`/opt/gr-screen/current`).
- Capture journal logs from both services for the deployment record.
- Attach telemetry validation notes to the race ops checklist.
