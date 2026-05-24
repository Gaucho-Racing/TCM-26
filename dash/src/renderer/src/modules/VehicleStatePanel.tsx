import { useSignal } from '../store/signals';
import { ECU_STATE, stateClassNames, stateLabel } from '../lib/state';
import { SectionTitle } from './SectionTitle';

/** Indicator badge (TS / RTD) with glow-on-active styling. */
function Indicator({ label, active }: { label: string; active: boolean }) {
  return (
    <div
      className={`rounded-lg border px-5 py-2 text-2xl font-black tracking-widest transition-colors ${
        active
          ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-300 shadow-[0_0_18px_-6px_rgb(52_211_153/0.7)]'
          : 'border-neutral-700 bg-neutral-900/60 text-neutral-600'
      }`}
    >
      {label}
    </div>
  );
}

export function VehicleStatePanel() {
  const ecuState = useSignal('ecu_ecu_state');
  const tsActive = ecuState === ECU_STATE.PRECHARGE_COMPLETE || ecuState === ECU_STATE.DRIVE_ACTIVE;
  const rtd = ecuState === ECU_STATE.DRIVE_ACTIVE;
  const c = stateClassNames(ecuState);

  return (
    <div
      className={`flex min-h-0 flex-col items-center justify-center gap-3 rounded-2xl border p-3 transition-colors ${c.bg} ${c.border} ${c.pulse}`}
    >
      <SectionTitle>Vehicle State</SectionTitle>
      <div className={`text-5xl font-black tracking-tight ${c.text}`}>{stateLabel(ecuState)}</div>
      <div className="flex gap-3">
        <Indicator label="TS" active={tsActive} />
        <Indicator label="RTD" active={rtd} />
      </div>
    </div>
  );
}
