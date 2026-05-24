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
 * | Requested metric   | Ingest signal                | DBC source              | Unit |
 * |--------------------|------------------------------|-------------------------|------|
 * | Battery temp       | `ecu_max_cell_temp`          | ECU_Status_1 Max_Cell_Temp | °C |
 * | GLV voltage        | `acu_12v_voltage`            | ACU_Status_2 _12v_Voltage | V  |
 * | TS voltage         | `ecu_tractive_system_voltage`| ECU_Status_2 Tractive_System_Voltage | V |
 * | TS current         | `acu_accumulator_current`    | ACU_Status_1 Accumulator_Current | A |
 * | DTI AC current lim | `placeholder_dti_ac_current_limit` | — no exact DBC match | A |
 * | Brake pressure     | `ecu_brake_pedal_travel`     | ECU_Analog_Data Brake_Pedal_Travel | % |
 * | Motor temp         | `gr_inv_motor_temp`          | Inv_Status_3 Motor_Temp | °C |
 * | Battery temp (ACU) | `acu_max_cell_temp`          | ACU_Status_2 Max_Cell_Temp | °C |
 * | Inverter temp      | `gr_inv_u_mosfet_temp`       | Inv_Status_2 U_MOSFET_Temp | °C |
 * | DC-DC current      | `acu_hv_input_current`       | ACU_Status_3 HV_Input_Current | A |
 */
export const TELEMETRY_SIGNALS = [
  'ecu_max_cell_temp',
  'acu_12v_voltage',
  'ecu_tractive_system_voltage',
  'acu_accumulator_current',
  'placeholder_dti_ac_current_limit',
  'ecu_brake_pedal_travel',
  'gr_inv_motor_temp',
  'acu_max_cell_temp',
  'gr_inv_u_mosfet_temp',
  'acu_hv_input_current',
] as const;

// ── Tile config ─────────────────────────────────────────────────────

type Threshold = { warnAt: number; critAt: number };
type ColorTier = 'ok' | 'warn' | 'crit' | 'unknown' | 'stale';

/** Returns the color tier for a given value and its thresholds. */
function tier(value: number | undefined, t: Threshold): ColorTier {
  if (value === undefined) return 'unknown';
  const abs = Math.abs(value);
  if (abs >= t.critAt) return 'crit';
  if (abs >= t.warnAt) return 'warn';
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
  /** Thresholds for background colouring. warnAt → yellow, critAt → red. */
  threshold: Threshold;
  /** Factor to multiply the raw signal by before display. */
  scale?: number;
}

const TILES: TileDef[] = [
  {
    signal: 'ecu_max_cell_temp',
    label: 'BATT TEMP',
    unit: '°C',
    decimals: 1,
    threshold: { warnAt: 45, critAt: 55 },
  },
  {
    signal: 'acu_12v_voltage',
    label: 'GLV',
    unit: 'V',
    decimals: 1,
    // 12V rail: green 11.5–14.5, warning below 11.5 or above 14.5, critical below 10.5 or above 15.5
    threshold: { warnAt: 1.5, critAt: 2.5 },
    // Deviations from 13V nominal — we compute distance from ideal
  },
  {
    signal: 'ecu_tractive_system_voltage',
    label: 'TS VOLT',
    unit: 'V',
    decimals: 0,
    threshold: { warnAt: 1, critAt: 1 },
  },
  {
    signal: 'acu_accumulator_current',
    label: 'TS CURR',
    unit: 'A',
    decimals: 1,
    threshold: { warnAt: 100, critAt: 200 },
  },
  {
    signal: 'placeholder_dti_ac_current_limit',
    label: 'DTI AC LIM',
    unit: 'A',
    decimals: 0,
    threshold: { warnAt: 999, critAt: 9999 },
  },
  {
    signal: 'ecu_brake_pedal_travel',
    label: 'BRAKE',
    unit: '%',
    decimals: 0,
    threshold: { warnAt: 25, critAt: 60 },
  },
  {
    signal: 'gr_inv_motor_temp',
    label: 'MOTOR',
    unit: '°C',
    decimals: 1,
    threshold: { warnAt: 60, critAt: 85 },
  },
  {
    signal: 'acu_max_cell_temp',
    label: 'CELL TEMP',
    unit: '°C',
    decimals: 1,
    threshold: { warnAt: 45, critAt: 55 },
  },
  {
    signal: 'gr_inv_u_mosfet_temp',
    label: 'INV MOSFET',
    unit: '°C',
    decimals: 1,
    threshold: { warnAt: 50, critAt: 75 },
  },
  {
    signal: 'acu_hv_input_current',
    label: 'DC-DC CURR',
    unit: 'A',
    decimals: 1,
    threshold: { warnAt: 15, critAt: 40 },
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

/** Compute voltage deviation tier for GLV: we want ~13V nominal. */
function glvTier(v: number | undefined): ColorTier {
  if (v === undefined) return 'unknown';
  const d = Math.abs(v - 13);
  if (d > 2.5) return 'crit';
  if (d > 1.5) return 'warn';
  return 'ok';
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
  } else if (def.signal === 'acu_12v_voltage') {
    t = glvTier(value);
  } else if (def.signal === 'ecu_tractive_system_voltage') {
    t = tsVoltageTier(value);
  } else {
    t = tier(value, def.threshold);
  }

  const display = value !== undefined ? value.toFixed(def.decimals) : '—';

  return (
    <div
      className={`flex min-h-[90px] flex-col items-center justify-center gap-1 rounded-2xl border-2 px-3 py-2 transition-all ${tierClasses(t)}`}
    >
      <div className="text-[10px] font-bold tracking-[0.25em] uppercase opacity-70">
        {def.label}
      </div>
      <div className="flex items-baseline gap-0.5">
        <span className="text-4xl leading-none font-black tabular-nums">{display}</span>
        {value !== undefined && <span className="text-sm font-bold opacity-60">{def.unit}</span>}
      </div>
    </div>
  );
}

// ── Panel ───────────────────────────────────────────────────────────

export function TelemetryPanel() {
  // Read each signal explicitly so ESLint can verify hook rules statically.
  const v00 = useSignal('ecu_max_cell_temp');
  const v01 = useSignal('acu_12v_voltage');
  const v02 = useSignal('ecu_tractive_system_voltage');
  const v03 = useSignal('acu_accumulator_current');
  const v04 = useSignal('placeholder_dti_ac_current_limit');
  const v05 = useSignal('ecu_brake_pedal_travel');
  const v06 = useSignal('gr_inv_motor_temp');
  const v07 = useSignal('acu_max_cell_temp');
  const v08 = useSignal('gr_inv_u_mosfet_temp');
  const v09 = useSignal('acu_hv_input_current');
  const values = [v00, v01, v02, v03, v04, v05, v06, v07, v08, v09];

  return (
    <div className="flex min-h-0 flex-col gap-2 rounded-2xl border border-neutral-800 bg-gradient-to-b from-neutral-900/80 to-neutral-900/40 p-3">
      <SectionTitle>Telemetry</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        {TILES.map((def, i) => (
          <TelemetryTile key={def.signal} def={def} value={values[i]} />
        ))}
      </div>
    </div>
  );
}
