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
    <div className="flex flex-col h-full p-6 gap-4">
      <div
        className={`flex-1 flex items-center justify-center rounded-2xl border ${c.bg} ${c.border}`}
      >
        <div className={`text-5xl font-black tracking-tight ${c.text}`}>
          {label}
        </div>
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
    <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl px-4 py-3">
      <div className="text-xs text-neutral-500 uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className="text-3xl font-bold text-neutral-100 leading-none">
        {value}
        {unit && <span className="text-base text-neutral-500 ml-1">{unit}</span>}
      </div>
    </div>
  );
}
