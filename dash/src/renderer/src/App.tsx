import { useSignals } from './hooks/useSignals';
import { useSignal, useSignalStore } from './store/signals';
import { aggregateCells, CELL_SIGNALS } from './lib/cells';
import { socColor, voltageColor, tempColor } from './lib/state';

const SUBSCRIBED_SIGNALS = [
  // safety lights driven by Dash Config (ECU → dash). bit=1 means warning lit.
  'ecu_led_bms',
  'ecu_led_imd',
  'ecu_led_bspd',
  // primary readouts
  'ecu_vehicle_speed',
  'ecu_accumulator_soc',
  // per-cell voltages and temps — aggregated on the dash to max/min.
  ...CELL_SIGNALS,
] as const;

export default function App() {
  useSignals(SUBSCRIBED_SIGNALS);

  return (
    <div className="grid h-screen w-screen grid-rows-[80px_1fr_140px] gap-3 bg-neutral-950 p-4">
      <TopRow />
      <SpeedRow />
      <CellRow />
    </div>
  );
}

// Top: 3 safety lights on the left, SoC bar on the right.
function TopRow() {
  const bmsWarn = useSignal('ecu_led_bms') > 0;
  const imdWarn = useSignal('ecu_led_imd') > 0;
  const bspdWarn = useSignal('ecu_led_bspd') > 0;
  const soc = useSignal('ecu_accumulator_soc');

  return (
    <div className="grid grid-cols-[auto_1fr] gap-4">
      <div className="flex gap-3">
        <SafetyLight label="BMS" warn={bmsWarn} />
        <SafetyLight label="IMD" warn={imdWarn} />
        <SafetyLight label="BSPD" warn={bspdWarn} />
      </div>
      <SocBar pct={soc} />
    </div>
  );
}

function SafetyLight({ label, warn }: { label: string; warn: boolean }) {
  return (
    <div
      className={`flex w-32 items-center justify-center rounded-xl border text-2xl font-black tracking-widest transition-colors ${
        warn
          ? 'animate-pulse border-red-500/60 bg-red-500/20 text-red-300 shadow-[0_0_24px_-4px_rgb(239_68_68/0.7)]'
          : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
      }`}
    >
      {label}
    </div>
  );
}

function SocBar({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="flex items-center gap-4 rounded-xl border border-neutral-800 bg-gradient-to-b from-neutral-900/80 to-neutral-900/40 px-5">
      <div className="text-xs tracking-widest text-neutral-500 uppercase">Battery</div>
      <div className="h-4 flex-1 overflow-hidden rounded-full bg-neutral-800">
        <div
          className={`h-full ${socColor(clamped)} transition-[width] duration-500 ease-out`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <div className="w-20 text-right text-3xl font-black text-neutral-100 tabular-nums">
        {clamped.toFixed(0)}
        <span className="ml-1 text-base text-neutral-500">%</span>
      </div>
    </div>
  );
}

// Middle: just the speed, big.
function SpeedRow() {
  const speed = useSignal('ecu_vehicle_speed');
  const connected = useSignalStore((s) => s.connected);

  return (
    <div className="relative flex items-center justify-center overflow-hidden rounded-2xl border border-neutral-800 bg-gradient-to-b from-neutral-900/80 to-neutral-900/40">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(34,211,238,0.08),transparent_70%)]" />
      <div className="relative flex flex-col items-center">
        <div className="text-[16rem] leading-none font-black text-neutral-50 tabular-nums">
          {Math.round(speed)}
        </div>
        <div className="-mt-4 text-3xl font-semibold tracking-[0.4em] text-neutral-500">MPH</div>
      </div>
      <div className="absolute right-4 bottom-3 flex items-center gap-2">
        <div className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-red-500'}`} />
        <div className="text-[10px] tracking-widest text-neutral-500 uppercase">
          {connected ? 'Live' : 'No data'}
        </div>
      </div>
    </div>
  );
}

// Bottom: max/min cell voltage and temp aggregated from the cell signals.
function CellRow() {
  const signals = useSignalStore((s) => s.signals);
  const { maxVoltage, minVoltage, maxTemp, minTemp } = aggregateCells(signals);

  return (
    <div className="grid grid-cols-4 gap-3">
      <Tile
        label="MAX V"
        value={maxVoltage.toFixed(2)}
        unit="V"
        colorClass={voltageColor(maxVoltage)}
      />
      <Tile
        label="MIN V"
        value={minVoltage.toFixed(2)}
        unit="V"
        colorClass={voltageColor(minVoltage)}
      />
      <Tile label="MAX T" value={maxTemp.toFixed(0)} unit="°C" colorClass={tempColor(maxTemp)} />
      <Tile label="MIN T" value={minTemp.toFixed(0)} unit="°C" colorClass={tempColor(minTemp)} />
    </div>
  );
}

function Tile({
  label,
  value,
  unit,
  colorClass,
}: {
  label: string;
  value: string;
  unit: string;
  colorClass: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-neutral-800 bg-gradient-to-b from-neutral-900/80 to-neutral-900/40 px-4 py-3">
      <div className="mb-1 text-xs tracking-widest text-neutral-500 uppercase">{label}</div>
      <div className={`text-5xl font-black tabular-nums ${colorClass}`}>
        {value}
        <span className="ml-1 text-xl text-neutral-500">{unit}</span>
      </div>
    </div>
  );
}
