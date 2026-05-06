import { useSignal } from '../store/signals';
import { tempColor, socColor } from '../lib/state';

// Center panel: the values the driver looks at constantly while driving.
// Speed dominates; SoC, max cell temp, and TS voltage underneath.
export function SpeedPanel() {
  const speed = useSignal('ecu_vehicle_speed');
  const soc = useSignal('ecu_accumulator_soc');
  const maxCellTemp = useSignal('ecu_max_cell_temp');
  const tsVoltage = useSignal('ecu_ts_voltage');

  // Speed gradient: cool blue at low speed, electric cyan in normal range,
  // hot orange near 80+ MPH. Driver sees a visual hint of how hard they're going.
  const speedGradient =
    speed >= 60
      ? 'from-orange-300 to-amber-500'
      : speed >= 30
        ? 'from-cyan-200 to-cyan-400'
        : 'from-neutral-100 to-neutral-300';

  return (
    <div className="flex h-full flex-col gap-3 p-5">
      {/* Big speed readout with gradient text + subtle glow */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-2xl border border-neutral-800 bg-gradient-to-b from-neutral-900/80 to-neutral-900/40">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(34,211,238,0.08),transparent_70%)]" />
        <div className="relative flex flex-col items-center">
          <div
            className={`bg-gradient-to-b bg-clip-text text-[10rem] leading-none font-black text-transparent tabular-nums ${speedGradient} transition-[background-image] duration-300`}
          >
            {Math.round(speed)}
          </div>
          <div className="-mt-2 text-2xl font-semibold tracking-[0.3em] text-neutral-500">MPH</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <SocCard pct={soc} />
        <TempCard label="MAX CELL" value={maxCellTemp} unit="°C" />
        <Tile label="TS VOLTS" value={tsVoltage.toFixed(0)} unit="V" />
      </div>
    </div>
  );
}

function Tile({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-gradient-to-b from-neutral-900/80 to-neutral-900/40 px-4 py-3">
      <div className="mb-1 text-xs tracking-wider text-neutral-500 uppercase">{label}</div>
      <div className="text-3xl leading-none font-bold text-neutral-100 tabular-nums">
        {value}
        <span className="ml-1 text-base text-neutral-500">{unit}</span>
      </div>
    </div>
  );
}

function SocCard({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="rounded-xl border border-neutral-800 bg-gradient-to-b from-neutral-900/80 to-neutral-900/40 px-4 py-3">
      <div className="mb-2 flex items-baseline justify-between">
        <div className="text-xs tracking-wider text-neutral-500 uppercase">BATTERY</div>
        <div className="text-2xl font-bold text-neutral-100 tabular-nums">
          {clamped.toFixed(0)}
          <span className="text-sm text-neutral-500">%</span>
        </div>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-neutral-800">
        <div
          className={`h-full ${socColor(clamped)} transition-[width] duration-500 ease-out`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

function TempCard({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-gradient-to-b from-neutral-900/80 to-neutral-900/40 px-4 py-3">
      <div className="mb-1 text-xs tracking-wider text-neutral-500 uppercase">{label}</div>
      <div className={`text-3xl leading-none font-bold tabular-nums ${tempColor(value)}`}>
        {value.toFixed(0)}
        <span className="ml-1 text-base text-neutral-500">{unit}</span>
      </div>
    </div>
  );
}
