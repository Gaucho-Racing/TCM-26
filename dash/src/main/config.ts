import { app } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';

// Runtime-editable dash config. Lives at app.getPath('userData')/config.json
// so it survives upgrades and is per-machine. Edit by hand on the Jetson
// over SSH, or via the in-app Settings modal on a desktop.
//   macOS:   ~/Library/Application Support/GR26 Dash/config.json
//   Linux:   ~/.config/GR26 Dash/config.json
//   Windows: %APPDATA%\GR26 Dash\config.json

export interface DashConfig {
  wsUrl: string;
  vehicleId: string;
}

// Defaults match what's baked in via Vite — used when config.json doesn't
// exist yet, or when a field is missing/blank.
const DEFAULTS: DashConfig = {
  wsUrl: 'ws://localhost:8001/gr26/live',
  vehicleId: 'gr26',
};

function configPath(): string {
  return path.join(app.getPath('userData'), 'config.json');
}

export async function loadConfig(): Promise<DashConfig> {
  try {
    const raw = await fs.readFile(configPath(), 'utf8');
    const parsed = JSON.parse(raw) as Partial<DashConfig>;
    return {
      wsUrl: typeof parsed.wsUrl === 'string' && parsed.wsUrl ? parsed.wsUrl : DEFAULTS.wsUrl,
      vehicleId:
        typeof parsed.vehicleId === 'string' && parsed.vehicleId
          ? parsed.vehicleId
          : DEFAULTS.vehicleId,
    };
  } catch (err) {
    // Fresh install / no config file yet — that's fine, fall back to
    // defaults. Anything else (corrupt JSON, perms) we log so it's
    // visible without crashing the dash.
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn('[config] failed to read config.json:', err);
    }
    return { ...DEFAULTS };
  }
}

export async function saveConfig(next: DashConfig): Promise<DashConfig> {
  const merged: DashConfig = {
    wsUrl: next.wsUrl?.trim() || DEFAULTS.wsUrl,
    vehicleId: next.vehicleId?.trim() || DEFAULTS.vehicleId,
  };
  const file = configPath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(merged, null, 2) + '\n', 'utf8');
  return merged;
}
