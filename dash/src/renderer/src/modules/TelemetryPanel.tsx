import { useSignal, useSignalStore } from '../store/signals';
import { useNow } from '../hooks/useNow';
import { SectionTitle } from './SectionTitle';

/** If a signal hasn't been seen in this many ms, force tile to gray-black. */
const STALE_MS = 5000;

// ── Signal definitions ──────────────────────────────────────────────

/**
 * Signal names this panel needs. Spread into `SUBSCRIBED_SIGNALS` in
 * App.tsx so the ingest actually sends them.
 *
 * | Requested metric   | Ingest signal                     | DBC source | Unit |
 * |--------------------|-----------------------------------|------------|------|
 * | TS voltage         | `bcu_ts_voltage`                  | —          | V    |
 * | GLV voltage        | `bcu_12v_voltage`                  | —          | V    |
 * | AC current         | `bcu_accumulator_soc`          | —          | A    |
 * | DTI AC limit       | `bcu_glv_soc`| —          | A    |
 * | TS current         | `bcu_accumulator_current`         | —          | A    |
 * | DC-DC current      | `acu_hv_input_current`            | —          | A    |
 * | Battery temp       | `bcu_max_cell_temp`               | —          | °C   |
 * | Motor temp         | `dti_inv_motor_temp`              | —          | °C   |
 * | Inverter temp      | `dti_inv_ctrl_temp`               | —          | °C   |
 * | Brake pressure     | `ecu_brake_pedal`                 | —          | %    |
 */
export const TELEMETRY_SIGNALS = [
  'bcu_ts_voltage',
  'bcu_12v_voltage',
  'bcu_accumulator_soc',
  'bcu_glv_soc',
  'bcu_accumulator_current',
  'acu_hv_input_current',
  'bcu_max_cell_temp',
  'dti_inv_motor_temp',
  'dti_inv_ctrl_temp',
  'ecu_brake_pedal',
] as const;

// ── Tile config ─────────────────────────────────────────────────────

type Threshold = { warnAt: number; critAt: number };
type ColorTier = 'ok' | 'warn' | 'crit' | 'unknown' | 'stale';

/** Returns the color tier for a given value and its thresholds.
 *  Lower values are worse by default. Set `invert: true` on a tile
 *  when higher values are worse (e.g. temperature). */
function tier(value: number | undefined, t: Threshold, invert?: boolean): ColorTier {
  if (value === undefined) return 'unknown';
  if (invert) {
    if (value >= t.critAt) return 'crit';
    if (value >= t.warnAt) return 'warn';
    return 'ok';
  }
  if (value <= t.critAt) return 'crit';
  if (value <= t.warnAt) return 'warn';
  return 'ok';
}

interface TileDef {
  /** Ingest signal name. */
  signal: string;
  /** Human-readable label. */
  label: string;
  /** Unit suffix displayed after the value. */
  unit: string;
  /** How many decimal places to show. */
  decimals: number;
  /** Thresholds for background colouring. warnAt → yellow, critAt → red.
   *  Lower values are worse by default, so critAt should be the smaller
   *  number. Set `invert: true` when higher values are worse. */
  threshold: Threshold;
  invert?: boolean;
}

const TILES: TileDef[] = [
  {
    signal: 'bcu_ts_voltage',
    label: 'TS VOLT',
    unit: 'V',
    decimals: 0,
    threshold: { warnAt: 1, critAt: 1 },
  },
  {
    signal: 'bcu_12v_voltage',
    label: 'GLV',
    unit: 'V',
    decimals: 1,
    threshold: { warnAt: 15, critAt: 12 },
  },
  {
    signal: 'bcu_accumulator_soc',
    label: 'TS SOC',
    unit: '%',
    decimals: 0,
    threshold: { warnAt: 20, critAt: 10 },
  },
  {
    signal: 'bcu_glv_soc',
    label: 'GLV SOC',
    unit: '%',
    decimals: 0,
    threshold: { warnAt: 20, critAt: 10 },
  },
  {
    signal: 'bcu_accumulator_current',
    label: 'TS CURR',
    unit: 'A',
    decimals: 1,
    threshold: { warnAt: 200, critAt: 100 },
  },
  {
    signal: 'acu_hv_input_current',
    label: 'DC-DC CURR',
    unit: 'A',
    decimals: 1,
    threshold: { warnAt: 40, critAt: 15 },
  },
  {
    signal: 'bcu_max_cell_temp',
    label: 'BATT TEMP',
    unit: '°C',
    decimals: 1,
    threshold: { warnAt: 50, critAt: 60 },
    invert: true,
  },
  {
    signal: 'dti_inv_motor_temp',
    label: 'MOTOR TEMP',
    unit: '°C',
    decimals: 1,
    threshold: { warnAt: 60, critAt: 85 },
    invert: true,
  },
  {
    signal: 'dti_inv_ctrl_temp',
    label: 'INV TEMP',
    unit: '°C',
    decimals: 1,
    threshold: { warnAt: 60, critAt: 75 },
    invert: true,
  },
  {
    signal: 'ecu_brake_pedal',
    label: 'BRAKE',
    unit: '%',
    decimals: 0,
    threshold: { warnAt: 60, critAt: 25 },
  },
];

// ── Helpers ─────────────────────────────────────────────────────────

function tierClasses(t: ColorTier): string {
  switch (t) {
    case 'ok':
      return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300';
    case 'warn':
      return 'border-amber-400/60 bg-amber-500/15 text-amber-200 shadow-[0_0_20px_-6px_rgb(251_191_36/0.6)]';
    case 'crit':
      return 'animate-pulse border-red-500/70 bg-red-500/25 text-red-200 shadow-[0_0_24px_-4px_rgb(239_68_68/0.8)]';
    case 'unknown':
      return 'border-neutral-800 bg-neutral-900/40 text-neutral-600';
    case 'stale':
      return 'border-neutral-925 bg-neutral-950 text-neutral-700';
  }
}

/** Compute voltage tier for TS: we want 300–600V band. */
function tsVoltageTier(v: number | undefined): ColorTier {
  if (v === undefined) return 'unknown';
  if (v >= 300 && v <= 600) return 'ok';
  if ((v >= 200 && v < 300) || (v > 600 && v <= 650)) return 'warn';
  return 'crit';
}

// ── Tile component ──────────────────────────────────────────────────

function TelemetryTile({ def, value }: { def: TileDef; value: number | undefined }) {
  // Staleness check — if the signal hasn't been seen in STALE_MS, show
  // a gray-black tile regardless of the last-known value.
  const now = useNow();
  const receivedAt = useSignalStore((s) => s.signals[def.signal]?.receivedAt);
  const stale = receivedAt === undefined || now - receivedAt > STALE_MS;

  let t: ColorTier;
  if (stale) {
    t = 'stale';
  } else if (def.signal === 'bcu_ts_voltage') {
    t = tsVoltageTier(value);
  } else {
    t = tier(value, def.threshold, def.invert);
  }

  const display = value !== undefined ? value.toFixed(def.decimals) : '—';

  return (
    <div
      className={`flex h-full flex-col items-center justify-center gap-0.5 rounded-2xl border-2 px-2 py-1.5 transition-all ${tierClasses(t)}`}
    >
      <div className="text-[10px] font-bold tracking-[0.25em] uppercase opacity-70">
        {def.label}
      </div>
      <div className="flex items-baseline gap-0.5">
        <span className="text-2xl leading-none font-black tabular-nums">{display}</span>
        {value !== undefined && <span className="text-sm font-bold opacity-60">{def.unit}</span>}
      </div>
    </div>
  );
}

// ── Panel ───────────────────────────────────────────────────────────

export function TelemetryPanel() {
  // Read each signal explicitly so ESLint can verify hook rules statically.
  const v00 = useSignal('bcu_ts_voltage');
  const v01 = useSignal('bcu_12v_voltage');
  const v02 = useSignal('bcu_accumulator_soc');
  const v03 = useSignal('bcu_glv_soc');
  const v04 = useSignal('bcu_accumulator_current');
  const v05 = useSignal('acu_hv_input_current');
  const v06 = useSignal('bcu_max_cell_temp');
  const v07 = useSignal('dti_inv_motor_temp');
  const v08 = useSignal('dti_inv_ctrl_temp');
  const v09 = useSignal('ecu_brake_pedal');
  const values = [v00, v01, v02, v03, v04, v05, v06, v07, v08, v09];

  return (
    <div className="flex min-h-0 flex-col gap-2 overflow-y-auto rounded-2xl border border-neutral-800 bg-gradient-to-b from-neutral-900/80 to-neutral-900/40 p-3">
      <SectionTitle>Telemetry</SectionTitle>
      <div className="auto-rows-1fr grid flex-1 grid-cols-2 gap-1.5">
        {TILES.map((def, i) => (
          <TelemetryTile key={def.signal} def={def} value={values[i]} />
        ))}
      </div>
    </div>
  );
}
