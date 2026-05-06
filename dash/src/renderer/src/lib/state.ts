// Color tier helpers reused across the dash.

// Battery SoC bar color: red <=15%, amber <=30%, otherwise green.
export function socColor(pct: number): string {
  if (pct <= 15) return 'bg-red-500';
  if (pct <= 30) return 'bg-amber-500';
  return 'bg-emerald-500';
}

// Cell voltage thresholds (Volts).
export function voltageColor(v: number): string {
  if (v <= 0) return 'text-neutral-500';
  if (v < 3.0) return 'text-red-400';
  if (v < 3.4) return 'text-amber-400';
  if (v > 4.15) return 'text-orange-400';
  return 'text-emerald-400';
}

// Cell temp thresholds (Celsius).
export function tempColor(c: number): string {
  if (c <= 0) return 'text-neutral-500';
  if (c >= 55) return 'text-red-400';
  if (c >= 45) return 'text-amber-400';
  return 'text-emerald-400';
}

// ECU state machine bitfield enum (mirrors Lib/GlobalShare/StateMachine.h).
export const ECU_STATE = {
  GLV_OFF: 0x01,
  GLV_ON: 0x02,
  PRECHARGE_ENGAGED: 0x04,
  PRECHARGE_COMPLETE: 0x08,
  DRIVE_ACTIVE: 0x10,
  TS_DISCHARGE: 0x20,
} as const;

export function stateLabel(raw: number): string {
  switch (raw) {
    case ECU_STATE.GLV_OFF:
      return 'GLV OFF';
    case ECU_STATE.GLV_ON:
      return 'GLV ON';
    case ECU_STATE.PRECHARGE_ENGAGED:
      return 'PRECHARGE';
    case ECU_STATE.PRECHARGE_COMPLETE:
      return 'READY';
    case ECU_STATE.DRIVE_ACTIVE:
      return 'DRIVE';
    case ECU_STATE.TS_DISCHARGE:
      return 'TS DISCHARGE';
    default:
      return '—';
  }
}

// Tailwind color classes for the state badge.
export function stateClassNames(raw: number): {
  bg: string;
  text: string;
  border: string;
  pulse: string;
} {
  switch (raw) {
    case ECU_STATE.DRIVE_ACTIVE:
      return {
        bg: 'bg-emerald-500/15',
        text: 'text-emerald-300',
        border: 'border-emerald-400/50',
        pulse: 'shadow-[0_0_30px_-8px_rgb(52_211_153/0.7)]',
      };
    case ECU_STATE.PRECHARGE_COMPLETE:
      return {
        bg: 'bg-cyan-500/15',
        text: 'text-cyan-300',
        border: 'border-cyan-400/50',
        pulse: '',
      };
    case ECU_STATE.PRECHARGE_ENGAGED:
      return {
        bg: 'bg-amber-500/15',
        text: 'text-amber-300',
        border: 'border-amber-400/50',
        pulse: 'animate-pulse',
      };
    case ECU_STATE.TS_DISCHARGE:
      return {
        bg: 'bg-red-500/20',
        text: 'text-red-300',
        border: 'border-red-500/60',
        pulse: 'animate-pulse shadow-[0_0_30px_-6px_rgb(239_68_68/0.8)]',
      };
    case ECU_STATE.GLV_ON:
      return {
        bg: 'bg-neutral-800/50',
        text: 'text-neutral-200',
        border: 'border-neutral-700',
        pulse: '',
      };
    default:
      return {
        bg: 'bg-neutral-900/60',
        text: 'text-neutral-500',
        border: 'border-neutral-800',
        pulse: '',
      };
  }
}
