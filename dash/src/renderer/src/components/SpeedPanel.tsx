import { useSignal } from '../store/signals';
import { tempColor, socColor } from '../lib/state';

// Center panel: the values the driver looks at constantly while driving.
// Speed dominates; SoC and max cell temp underneath.
export function SpeedPanel() {
  const speed = useSignal('ecu_vehicle_speed');
  const soc = useSignal('ecu_accumulator_soc');
  const maxCellTemp = useSignal('ecu_max_cell_temp');

  return (
    <div className="flex flex-col h-full p-6 gap-4">
      {/* Big speed readout */}
      <div className="flex-1 flex items-center justify-center bg-neutral-900/60 border border-neutral-800 rounded-2xl">
        <div className="flex flex-col items-center">
          <div className="text-[10rem] font-black leading-none tabular-nums text-neutral-50">
            {Math.round(speed)}
          </div>
          <div className="text-2xl text-neutral-500 font-semibold tracking-widest -mt-2">
            MPH
          </div>
        </div>
      </div>

      {/* SoC bar + max cell temp side by side */}
      <div className="grid grid-cols-2 gap-3">
        <SocCard pct={soc} />
        <TempCard label="MAX CELL" value={maxCellTemp} unit="°C" />
      </div>
    </div>
  );
}

function SocCard({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl px-4 py-3">
      <div className="flex justify-between items-baseline mb-2">
        <div className="text-xs text-neutral-500 uppercase tracking-wider">
          BATTERY
        </div>
        <div className="text-2xl font-bold text-neutral-100">
          {clamped.toFixed(0)}
          <span className="text-sm text-neutral-500">%</span>
        </div>
      </div>
      <div className="w-full h-3 bg-neutral-800 rounded-full overflow-hidden">
        <div
          className={`h-full ${socColor(clamped)} transition-all`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

function TempCard({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl px-4 py-3">
      <div className="text-xs text-neutral-500 uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className={`text-3xl font-bold leading-none ${tempColor(value)}`}>
        {value.toFixed(1)}
        <span className="text-base text-neutral-500 ml-1">{unit}</span>
      </div>
    </div>
  );
}
