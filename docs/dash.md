# Dash

The on-vehicle driver display for the GR26 race car. Runs fullscreen
on the Jetson's 1600x600 panel in kiosk mode and shows live telemetry
from the local `gr26` ingest service.

## Stack

- **Electron** for the kiosk shell
- **React 19 + TypeScript** for the renderer
- **Tailwind CSS v4** for styling
- **Zustand** for signal state
- **electron-vite** for the dev/build pipeline
- **electron-builder** for packaging the `.deb` and `.AppImage`

## Architecture

Three Electron processes cooperate:

```
┌──────────────────┐                   ┌──────────────────────────┐
│   main process   │  contextBridge    │      renderer (React)    │
│  (Node, kiosk    │ ────(preload)──▶  │  Zustand store, panels   │
│   window mgmt)   │                   │  WebSocket → gr26 ingest │
└──────────────────┘                   └──────────────────────────┘
```

- `src/main/index.ts` — owns the `BrowserWindow`, kiosk/fullscreen
  config, and global shortcut blocking. Currently no IPC.
- `src/preload/index.ts` — no-op today. Add a `contextBridge` here
  if the renderer ever needs OS-level access.
- `src/renderer/` — React app. The renderer connects directly to the
  `gr26` ingest service over WebSocket (`ws://localhost:8001/gr26/live`)
  and pushes incoming signals into a Zustand store. Components read
  from the store via the `useSignal` selector hook.

Signal flow:

```
relay/icanspi  → MQTT → gr26 ingest → WebSocket → useSignals
                                                       │
                                                       ▼
                                               Zustand store
                                                       │
                              useSignal('ecu_speed') ──┼─▶ <SpeedPanel/>
                              useSignal('ecu_state') ──┴─▶ <VehicleStatePanel/>
```

## Project layout

```
dash/
├── src/
│   ├── main/index.ts           # Electron main — kiosk window
│   ├── preload/index.ts        # No-op for now
│   └── renderer/
│       ├── index.html
│       └── src/
│           ├── App.tsx         # Layout (3-col), subscribed signals list
│           ├── main.tsx        # React entrypoint
│           ├── hooks/useSignals.ts   # WebSocket connection
│           ├── lib/             # state machine + color helpers
│           ├── store/signals.ts # Zustand store + useSignal selector
│           └── views/DebugMatrix.tsx # Optional debug-only view
├── electron.vite.config.ts
├── electron-builder.yml
└── package.json
```

## Configuration

Build-time env vars (read by Vite during `npm run build`):

| Var | Default | Purpose |
|---|---|---|
| `VITE_GR26_WS_URL` | `ws://localhost:8001/gr26/live` | gr26 ingest WebSocket |
| `VITE_GR26_VEHICLE_ID` | `gr26` | Filters signals by vehicle id |

These are baked into the artifact at build time. Override with
`dash/.env` (gitignored) before running `npm run build` or
`npm run build:linux`. There is no runtime config file — the dash
ships with whatever was set when it was built. CI builds use the
defaults.

The vehicle id MUST match the relay's `VEHICLE_ID` env var. If the
relay publishes under `gr26-dev` and the dash subscribes to `gr26`,
the gr26 ingest hub keys subscribers by exact id and silently
delivers nothing. Symptom: dash connects (LOCAL pill blue) but no
signals update.

## Running locally for development

### Mac / Windows / Linux dev box

```bash
cd dash
npm install
npm run dev
```

A normal resizable window opens. Kiosk mode is off, so `Cmd+Q` /
`Ctrl+Q` / Devtools all work normally.

To point at a remote ingest (e.g. cloud Mapache, or another car):

```bash
VITE_GR26_WS_URL=wss://mapache.<host>/gr26/live npm run dev
```

### Jetson (dev iteration)

The packaged dev server needs `DISPLAY` and `XAUTHORITY` set when
launched from SSH. Use the wrapper:

```bash
./scripts/run-dash.sh
```

It auto-detects `DISPLAY` (probes `/tmp/.X11-unix/X*`) and
`XAUTHORITY` (tries `/run/user/$UID/gdm/Xauthority`, then
`~/.Xauthority`). Override either by exporting them first:

```bash
DISPLAY=:0 ./scripts/run-dash.sh
```

`run-dash.sh` runs `npm run dev`, so you get hot reload but **not**
kiosk mode (kiosk is gated on `app.isPackaged`).

### Jetson (packaged-build debug)

To exercise the actual production build (kiosk, fullscreen, blocked
shortcuts) without going through CI:

```bash
cd ~/TCM-26/dash
npm install
npm run build:linux                # ~2-5 min first time
chmod +x dist/GR26\ Dash-*.AppImage
./dist/GR26\ Dash-*-arm64.AppImage
```

If kiosk locks you out, SSH from another machine and `pkill -f
gr26-dash`, or temporarily change `kiosk: !isDev` to `kiosk: false`
in `src/main/index.ts` while iterating.

## Production deployment on the Jetson

One-time setup, run as the `tcm` user (the user that will own the
dash):

```bash
cd ~/TCM-26
git pull
./scripts/install-systemd.sh
```

`install-systemd.sh` is idempotent — re-run after a `git pull` to
pick up changes. It installs:

| File | Path |
|---|---|
| `scripts/gr26-dash-update.sh` | `/usr/local/bin/gr26-dash-update` |
| `systemd/gr26-dash-update.service` | `/etc/systemd/system/` |
| `systemd/gr26-dash-update.timer` | `/etc/systemd/system/` |
| `systemd/gr26-dash.service` | `~/.config/systemd/user/` |

Plus enables the timer + dash service and turns on lingering for the
`tcm` user (so user services keep running without an interactive
login).

### Boot sequence

1. Kernel + systemd
2. `network-online.target` — network is up (whenever)
3. `graphical-session.target` — Xorg/Wayland session up
4. **`gr26-dash.service`** (user) — dash launches in kiosk mode
5. Driver sees the dash within a few seconds of poweron
6. **1 min after boot**: `gr26-dash-update.timer` fires
7. `gr26-dash-update.service` (root, oneshot) — checks GitHub for a
   newer release, dpkg-installs it if there is one, exits 0
   regardless of outcome
8. Repeat step 7 every 15 min while the system stays on

Update check timing:

| Phase | Limit |
|---|---|
| TCP connect | 3s (`--connect-timeout`) |
| GitHub API call | 15s (`--max-time`) |
| Download `.deb` | 120s (`--max-time`) |
| Whole unit | 180s (`TimeoutStartSec`) |

If any of those fail, the script logs and exits 0 — never blocks
boot. Timer retries on its 15 min cadence.

### When does a new version actually take effect?

A `dpkg -i` while the dash is running replaces files in
`/opt/GR26 Dash/` but the running process keeps its mmap'd copy of
the old binary. The new version takes effect on the next boot
**or** on the next `systemctl --user restart gr26-dash` — never
mid-session, no driver-visible flicker.

## Operational commands

```bash
# tail logs
journalctl --user -u gr26-dash -f
sudo journalctl -u gr26-dash-update -f

# stop / start / restart the dash
systemctl --user stop gr26-dash.service
systemctl --user start gr26-dash.service
systemctl --user restart gr26-dash.service       # picks up a new version

# disable so it doesn't auto-start next boot
systemctl --user disable --now gr26-dash.service
systemctl --user enable --now gr26-dash.service  # re-enable

# force an update check right now (bypasses the 15-min wait)
sudo systemctl start gr26-dash-update.service
sudo journalctl -u gr26-dash-update -n 30

# next scheduled update fire
systemctl list-timers gr26-dash-update.timer

# pin to current version (skip auto-updates entirely)
sudo mkdir -p /etc/gr26-dash
sudo touch /etc/gr26-dash/updates-disabled

# resume auto-updates
sudo rm /etc/gr26-dash/updates-disabled

# nuke + reinstall the .deb manually
gh release download v1.0.4 -p '*_arm64.deb' -D /tmp/
sudo dpkg -i /tmp/gr26-dash_*_arm64.deb
systemctl --user restart gr26-dash
```

## Cutting a release

From the repo root on a clean main:

```bash
./scripts/release.sh 1.0.5
```

The script:

1. Bumps `dash/package.json` `version` and `mqtt/config/config.go`
   `Version` constant
2. Commits `release: tcm-26 v1.0.5` and pushes
3. Creates a GitHub Release with auto-generated notes

CI then:

- `dash.yml` builds `gr26-dash_1.0.5_arm64.deb` + `.AppImage` on a
  native arm64 runner and attaches them to the release
- `mqtt.yml` and `icanspi.yml` add `1.0.5` and `latest` tags to their
  Docker images on `ghcr.io/gaucho-racing/tcm-26/{mqtt,icanspi}`

After CI is green, every Jetson on the team picks up the new dash
within ~15 min via the auto-update timer (or immediately on next
boot).

## Troubleshooting

### WebSocket connects but no signals appear

Vehicle id mismatch. Confirm the dash and the relay agree:

```bash
# on the jetson, what's the relay using?
docker compose exec mqtt env | grep VEHICLE_ID

# what was the dash built with? open Devtools and run:
console.log(import.meta.env.VITE_GR26_VEHICLE_ID)
# (or check `dash/.env` if it was set at build time)
```

If they don't match, either change the relay env or rebuild the dash
with the right `VITE_GR26_VEHICLE_ID`.

### Dash starts then immediately exits

Check `journalctl --user -u gr26-dash -n 50`. Usually `DISPLAY` not
set (graphical session not up yet) or X server unreachable.

### Auto-update loop or "could not reach GitHub"

Expected on offline cars — script logs and exits 0, retries every
15 min. If the car *should* have internet but the updater keeps
failing, check `curl -v --connect-timeout 3 https://api.github.com/`
manually. Common causes: no DNS, firewall blocking outbound 443.

### Locked out of kiosk

SSH in from another machine: `systemctl --user stop gr26-dash` (as
the `tcm` user). Or in a pinch: `sudo pkill -f gr26-dash` —
`Restart=always` will respawn it unless the unit was stopped, so use
`stop` for clean shutdown.

### Clock shows 1969 in journal entries

Jetson's RTC battery is dead and NTP hasn't synced yet. Cosmetic in
most cases. Install `chrony` or ensure `systemd-timesyncd` is enabled
to fix on the next boot with internet.

## Why no auto-update via electron-updater?

`electron-updater` doesn't support `.deb` (would need `sudo dpkg -i`
and we don't want privilege escalation in the renderer process). The
custom script in `scripts/gr26-dash-update.sh` does the equivalent
out-of-process via the timer-driven systemd unit, which is the right
shape for this deployment anyway — root context for `dpkg`, separate
log stream, fail-open behavior.
