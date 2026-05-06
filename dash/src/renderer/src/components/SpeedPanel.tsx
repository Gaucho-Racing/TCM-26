import { useSignal } from '../store/signals';
import { tempColor, socColor } from '../lib/state';

// Center panel: the values the driver looks at constantly while driving.
// Speed dominates; SoC and max cell temp underneath.
export function SpeedPanel() {
  const speed = useSignal('ecu_vehicle_speed');
  const soc = useSignal('ecu_accumulator_soc');
  const maxCellTemp = useSignal('ecu_max_cell_temp');

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      {/* Big speed readout */}
      <div className="flex flex-1 items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900/60">
        <div className="flex flex-col items-center">
          <div className="text-[10rem] leading-none font-black text-neutral-50 tabular-nums">
            {Math.round(speed)}
          </div>
          <div className="-mt-2 text-2xl font-semibold tracking-widest text-neutral-500">MPH</div>
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
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3">
      <div className="mb-2 flex items-baseline justify-between">
        <div className="text-xs tracking-wider text-neutral-500 uppercase">BATTERY</div>
        <div className="text-2xl font-bold text-neutral-100">
          {clamped.toFixed(0)}
          <span className="text-sm text-neutral-500">%</span>
        </div>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-neutral-800">
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
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3">
      <div className="mb-1 text-xs tracking-wider text-neutral-500 uppercase">{label}</div>
      <div className={`text-3xl leading-none font-bold ${tempColor(value)}`}>
        {value.toFixed(1)}
        <span className="ml-1 text-base text-neutral-500">{unit}</span>
      </div>
    </div>
  );
}
