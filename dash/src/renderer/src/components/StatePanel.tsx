import { useSignal } from '../store/signals';
import { stateLabel, stateClassNames, ECU_STATE } from '../lib/state';

// Left panel: ECU state machine, power level, torque map. The big driver-
// readable status badge so they always know what mode the car is in.
// Active states pulse for visual confirmation; discharge state pulses red.
export function StatePanel() {
  const ecuState = useSignal('ecu_ecu_state');
  const powerLevel = useSignal('ecu_power_level');
  const torqueMap = useSignal('ecu_torque_map');
  const tsActive = useSignal('dash_panel_ts_active');
  const rtd = useSignal('dash_panel_rtd');

  const label = stateLabel(ecuState);
  const c = stateClassNames(ecuState);

  const animate =
    ecuState === ECU_STATE.DRIVE_ACTIVE
      ? 'animate-pulse-slow shadow-[0_0_40px_-10px_currentColor]'
      : ecuState === ECU_STATE.TS_DISCHARGE
        ? 'animate-pulse'
        : '';

  return (
    <div className="flex h-full flex-col gap-3 p-5">
      <div
        className={`flex flex-1 items-center justify-center rounded-2xl border bg-gradient-to-br ${c.bg} ${c.border} ${animate}`}
      >
        <div className={`text-5xl font-black tracking-tight ${c.text}`}>{label}</div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Tile label="POWER" value={`${powerLevel}`} unit="/15" />
        <Tile label="TORQUE" value={`${torqueMap}`} unit="/15" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Pill label="TS" pressed={tsActive > 0} />
        <Pill label="RTD" pressed={rtd > 0} />
      </div>
    </div>
  );
}

function Tile({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-gradient-to-b from-neutral-900/80 to-neutral-900/40 px-4 py-3">
      <div className="mb-1 text-xs tracking-wider text-neutral-500 uppercase">{label}</div>
      <div className="text-3xl leading-none font-bold text-neutral-100 tabular-nums">
        {value}
        {unit && <span className="ml-1 text-base text-neutral-500">{unit}</span>}
      </div>
    </div>
  );
}

// Driver-button pill — lights up cyan when the dash panel reports the button
// is currently pressed. Useful for visual confirmation without looking down.
function Pill({ label, pressed }: { label: string; pressed: boolean }) {
  return (
    <div
      className={`flex items-center justify-center rounded-xl border py-2 text-sm font-bold tracking-widest transition-colors ${
        pressed
          ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-200 shadow-[0_0_20px_-5px_rgb(34_211_238/0.6)]'
          : 'border-neutral-800 bg-neutral-900/60 text-neutral-600'
      }`}
    >
      {label}
    </div>
  );
}
