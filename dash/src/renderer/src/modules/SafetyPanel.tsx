import { useSignal } from '../store/signals';
import { SectionTitle } from './SectionTitle';

// ── Types ────────────────────────────────────────────────────────────

/**
 * Safety latch tri-state. The ECU exposes two bits per system: an
 * active-fault bit (`ecu_led_X`) and an armed-latch bit
 * (`ecu_led_X_latch`). The latch bit is 1 in the safe/armed state and
 * drops to 0 when a fault trips it; it must be manually reset back to
 * 1. Active fault wins regardless of latch. No fault + armed latch →
 * green 'latched' (safe). No fault + tripped latch → yellow
 * 'unlatched' (fault cleared, manual reset required).
 */
type SafetyStatus = 'latched' | 'unlatched' | 'warn';

function safetyStatus(warn: boolean, latched: boolean): SafetyStatus {
  if (warn) return 'warn';
  if (latched) return 'latched';
  return 'unlatched';
}

// ── Styling ──────────────────────────────────────────────────────────

const SAFETY_TILE_STYLES: Record<SafetyStatus, string> = {
  warn: 'animate-pulse border-red-500/60 bg-red-500/20 text-red-300 shadow-[0_0_24px_-4px_rgb(239_68_68/0.7)]',
  unlatched:
    'border-amber-400/60 bg-amber-500/15 text-amber-300 shadow-[0_0_22px_-6px_rgb(251_191_36/0.6)]',
  latched: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
};

const SAFETY_TILE_SUBLABEL: Record<SafetyStatus, string> = {
  warn: '● FAULT',
  unlatched: '● UNLATCHED',
  latched: '○ LATCHED',
};

// ── Sub-components ───────────────────────────────────────────────────

function SafetyTile({ label, status }: { label: string; status: SafetyStatus }) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border ${SAFETY_TILE_STYLES[status]}`}
    >
      <div className="text-3xl font-black tracking-widest">{label}</div>
      <div className="mt-1 text-sm font-bold tracking-[0.2em] uppercase">
        {SAFETY_TILE_SUBLABEL[status]}
      </div>
    </div>
  );
}

// ── Panel ────────────────────────────────────────────────────────────

export function SafetyPanel() {
  const bms = useSignal('ecu_led_bms') > 0;
  const imd = useSignal('ecu_led_imd') > 0;
  const bspd = useSignal('ecu_led_bspd') > 0;
  const bmsLatch = useSignal('ecu_led_bms_latch') > 0;
  const imdLatch = useSignal('ecu_led_imd_latch') > 0;
  const bspdLatch = useSignal('ecu_led_bspd_latch') > 0;

  return (
    <div className="flex min-h-0 flex-col gap-2 rounded-2xl border border-neutral-800 bg-gradient-to-b from-neutral-900/80 to-neutral-900/40 p-3">
      <SectionTitle>Safety</SectionTitle>
      <div className="grid flex-1 grid-cols-3 gap-2">
        <SafetyTile label="BMS" status={safetyStatus(bms, bmsLatch)} />
        <SafetyTile label="IMD" status={safetyStatus(imd, imdLatch)} />
        <SafetyTile label="BSPD" status={safetyStatus(bspd, bspdLatch)} />
      </div>
    </div>
  );
}
