import { useSignal } from '../store/signals';
import { stateLabel, stateClassNames } from '../lib/state';

// Left panel: ECU state machine, power level, torque map. The big driver-
// readable status badge so they always know what mode the car is in.
export function StatePanel() {
  const ecuState = useSignal('ecu_ecu_state');
  const powerLevel = useSignal('ecu_power_level');
  const torqueMap = useSignal('ecu_torque_map');

  const label = stateLabel(ecuState);
  const c = stateClassNames(ecuState);

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div
        className={`flex flex-1 items-center justify-center rounded-2xl border ${c.bg} ${c.border}`}
      >
        <div className={`text-5xl font-black tracking-tight ${c.text}`}>{label}</div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Tile label="POWER" value={`${powerLevel}`} unit="/15" />
        <Tile label="TORQUE" value={`${torqueMap}`} unit="/15" />
      </div>
    </div>
  );
}

function Tile({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3">
      <div className="mb-1 text-xs tracking-wider text-neutral-500 uppercase">{label}</div>
      <div className="text-3xl leading-none font-bold text-neutral-100">
        {value}
        {unit && <span className="ml-1 text-base text-neutral-500">{unit}</span>}
      </div>
    </div>
  );
}
