# GR26 Dash

Electron + React + TypeScript driver display for the GR26 race car. Runs on
the Jetson, fullscreen kiosk on the 1600x600 mounted display, subscribes to
the local `gr26` ingest service over WebSocket for real-time telemetry.

## Stack

- **Electron** for the kiosk shell
- **electron-vite** for the dev/build pipeline
- **React 19 + TypeScript**
- **Tailwind CSS v4** for styling
- **Zustand** for signal state
- **electron-builder** for packaging .deb / AppImage

## Develop

```bash
cd dash
npm install
npm run dev
```

Opens a windowed, resizable instance for iteration. The renderer connects
to `ws://localhost:8001/gr26/live` by default — bring up the tcm-26 stack
(`docker compose up`) so the gr26 ingest is reachable.

To point at a different WebSocket (e.g., a remote dev box):

```bash
VITE_GR26_WS_URL=ws://192.168.1.50:8001/gr26/live npm run dev
```

## Build

```bash
npm run build              # transpile only — outputs ./out
npm run build:linux        # full package for Jetson (arm64 .deb + AppImage)
npm run build:linux-x64    # x64 build for testing on a regular linux box
```

Artifacts land in `dist/`.

## Type check

```bash
npm run typecheck
```

Runs against both the main-process tsconfig and the renderer tsconfig.

## Signals

The dash subscribes to the signal names emitted by `gr26` ingest, which are
composed as `{source_node}_{field_name}` from the MQTT topic structure.
Currently:

| Signal                                | Source       | Field                             |
| ------------------------------------- | ------------ | --------------------------------- |
| `ecu_ecu_state`                       | ECU Status 1 | state machine bitfield            |
| `ecu_power_level` / `ecu_torque_map`  | ECU Status 1 | u4 nibbles                        |
| `ecu_max_cell_temp`                   | ECU Status 1 | hottest cell, °C                  |
| `ecu_accumulator_soc` / `ecu_glv_soc` | ECU Status 1 | percent                           |
| `ecu_vehicle_speed`                   | ECU Status 2 | absolute speed, MPH               |
| `ecu_ts_voltage`                      | ECU Status 2 | tractive system voltage           |
| `ecu_relay_states`                    | ECU Status 3 | safety bitfield (BMS/IMD/BSPD/SW) |

To add a signal: append to `SUBSCRIBED_SIGNALS` in `src/renderer/src/App.tsx`,
then read it in any component with `useSignal('signal_name')`.

## Project layout

```
dash/
├── src/
│   ├── main/index.ts          # Electron main — kiosk window
│   ├── preload/index.ts       # No-op for now (reserved for IPC)
│   └── renderer/
│       ├── index.html
│       └── src/
│           ├── App.tsx
│           ├── components/   # StatePanel, SpeedPanel, StatusPanel
│           ├── hooks/        # useSignals (WebSocket)
│           ├── lib/          # state machine + color helpers
│           └── store/        # Zustand signal store
├── electron.vite.config.ts
├── electron-builder.yml
└── package.json
```

## Layout

The display is **1600x600** (16:6 aspect, very wide). Three-column grid:

```
┌─────────────┬───────────────────────────┬─────────────┐
│   STATE     │       SPEED + SoC         │   STATUS    │
│   POWER     │        + TEMPS            │   LIGHTS    │
│   TORQUE    │                           │   AUX       │
│  (~400px)   │       (flexible ~800px)   │  (~400px)   │
└─────────────┴───────────────────────────┴─────────────┘
```

Tailwind handles all the styling — no separate CSS files beyond
`src/renderer/src/index.css` (just the `@import "tailwindcss"` + a few global
resets).

## Deploying to the Jetson

Build on the Jetson (cross-build fpm doesn't run on arm64, so the `.deb`
target will fail — use the AppImage instead):

```bash
cd dash
npm run build:linux
```

The arm64 AppImage lands at `dist/GR26 Dash-<ver>-arm64.AppImage`. Move it
into place and set up the systemd service:

```bash
# Move the AppImage to the expected path
sudo mkdir -p "/opt/GR26 Dash"
sudo mv dist/"GR26 Dash-1.3.0-arm64.AppImage" "/opt/GR26 Dash/gr26-dash"
```

> **FUSE note**: AppImages require FUSE to run. If missing, install it:
> `sudo apt update && sudo apt install -y fuse`.
> Without FUSE you can extract the contents with
> `"/opt/GR26 Dash/gr26-dash" --appimage-extract` and run the binary inside
> `squashfs-root/` directly, but installing FUSE is simpler.

## Deployment

### Option A: systemd user service (recommended)

Drop this unit at `~/.config/systemd/user/gr26-dash.service` on the Jetson:

```ini
[Unit]
Description=GR26 Driver Dashboard
After=graphical-session.target

[Service]
Type=simple
ExecStart=/opt/GR26 Dash/gr26-dash
Restart=always
RestartSec=3
Environment=ELECTRON_DISABLE_SECURITY_WARNINGS=1

[Install]
WantedBy=graphical-session.target
```

Enable:

```bash
systemctl --user daemon-reload
systemctl --user enable --now gr26-dash
loginctl enable-linger $USER   # so the service stays up without a login session
```

Logs: `journalctl --user -u gr26-dash`.

### Option B: xdg-autostart desktop entry

If you'd rather just have it launch as part of the GUI session:

`~/.config/autostart/gr26-dash.desktop`:

```ini
[Desktop Entry]
Type=Application
Name=GR26 Dash
Exec=/opt/GR26 Dash/gr26-dash
X-GNOME-Autostart-enabled=true
```

systemd is more robust (auto-restart on crash, proper logging),
so prefer that for the deployed car.

## Code signing

Linux apps don't require code signing for kiosk-style use. We're not
distributing through any store and the Jetson installs `.deb` packages
locally, so no GPG/notarization step is needed.

If you ever want to sign the `.deb` for repo distribution, configure
`debSign` via `electron-builder` — but for the on-vehicle case it's overkill.
