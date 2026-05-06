// Mirrors the bitfield enum in Lib/GlobalShare/StateMachine.h on the firmware
// side. The ECU broadcasts its current state as a single byte where exactly
// one of these bits is set.
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

// Color theming per state — green when actively driving, yellow during the
// precharge dance, red on the discharge / fault state.
export function stateClassNames(raw: number): { bg: string; text: string; border: string } {
  switch (raw) {
    case ECU_STATE.DRIVE_ACTIVE:
      return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/40' };
    case ECU_STATE.PRECHARGE_COMPLETE:
      return { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/40' };
    case ECU_STATE.PRECHARGE_ENGAGED:
      return { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/40' };
    case ECU_STATE.TS_DISCHARGE:
      return { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/40' };
    case ECU_STATE.GLV_ON:
      return { bg: 'bg-neutral-700/30', text: 'text-neutral-300', border: 'border-neutral-700' };
    default:
      return { bg: 'bg-neutral-800/50', text: 'text-neutral-500', border: 'border-neutral-800' };
  }
}

// ECU Status 3 byte 4: bit 0 BMS OK, bit 1 IMD OK, bit 2 BSPD OK, bit 3 SW OK.
// "OK" means the safety circuit is healthy — light up red when NOT ok.
export type SafetyKey = 'bms' | 'imd' | 'bspd' | 'software';
export const SAFETY_BITS: Record<SafetyKey, number> = {
  bms: 0x01,
  imd: 0x02,
  bspd: 0x04,
  software: 0x08,
};

export function isSafetyOk(relayStates: number, key: SafetyKey): boolean {
  return (relayStates & SAFETY_BITS[key]) !== 0;
}

// Cell temp thresholds in Celsius. Tune to actual operating bounds.
export function tempColor(c: number): string {
  if (c >= 55) return 'text-red-400';
  if (c >= 45) return 'text-amber-400';
  return 'text-emerald-400';
}

// SoC color tiers for the battery bar.
export function socColor(pct: number): string {
  if (pct <= 15) return 'bg-red-500';
  if (pct <= 30) return 'bg-amber-500';
  return 'bg-emerald-500';
}
