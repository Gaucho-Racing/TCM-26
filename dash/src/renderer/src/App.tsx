import { useSignals } from './hooks/useSignals';
import { useSignal, useSignalStore } from './store/signals';
import { aggregateCells, CELL_SIGNALS } from './lib/cells';
import { socColor, voltageColor, tempColor, stateLabel, stateClassNames } from './lib/state';

const SUBSCRIBED_SIGNALS = [
  // ECU state machine + power/torque settings
  'ecu_ecu_state',
  'ecu_power_level',
  'ecu_torque_map',
  // Safety lights from Dash Config (ECU → dash). bit=1 means warning lit.
  'ecu_led_bms',
  'ecu_led_imd',
  'ecu_led_bspd',
  // Latch states for the same circuits — fault occurred and stayed latched.
  'ecu_led_bms_latch',
  'ecu_led_imd_latch',
  'ecu_led_bspd_latch',
  // Driver button state from Dash Status (dash_panel → ECU).
  'dash_panel_ts_active',
  'dash_panel_rtd',
  'dash_panel_ts_off',
  'dash_panel_rtd_off',
  // Primary readouts
  'ecu_vehicle_speed',
  'ecu_accumulator_soc',
  // TCM connectivity from the relay's TCM Status (0x029)
  'tcm_connection_ok',
  'tcm_mqtt_ok',
  'tcm_mapache_ping',
  // Per-cell voltages and temps — aggregated to max/min.
  ...CELL_SIGNALS,
] as const;

export default function App() {
  useSignals(SUBSCRIBED_SIGNALS);

  return (
    <div className="grid h-screen w-screen grid-rows-[160px_1fr_120px] gap-3 bg-neutral-950 p-4">
      <TopRow />
      <SpeedRow />
      <BottomRow />
    </div>
  );
}

// Top: ECU state badge + safety/latch grid + driver buttons + battery SoC.
function TopRow() {
  return (
    <div className="grid grid-cols-[260px_1fr_320px_360px] gap-3">
      <StateBadge />
      <SafetyAndLatch />
      <DriverButtons />
      <SocCard />
    </div>
  );
}

function StateBadge() {
  const ecuState = useSignal('ecu_ecu_state');
  const powerLevel = useSignal('ecu_power_level');
  const torqueMap = useSignal('ecu_torque_map');
  const c = stateClassNames(ecuState);

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border transition-colors ${c.bg} ${c.border} ${c.pulse}`}
    >
      <div className={`text-3xl font-black tracking-tight ${c.text}`}>{stateLabel(ecuState)}</div>
      <div className="mt-2 flex gap-3 text-xs tracking-widest text-neutral-400 uppercase">
        <span>
          P<span className="ml-1 font-bold text-neutral-200 tabular-nums">{powerLevel}</span>/15
        </span>
        <span>
          T<span className="ml-1 font-bold text-neutral-200 tabular-nums">{torqueMap}</span>/15
        </span>
      </div>
    </div>
  );
}

function SafetyAndLatch() {
  const bms = useSignal('ecu_led_bms') > 0;
  const imd = useSignal('ecu_led_imd') > 0;
  const bspd = useSignal('ecu_led_bspd') > 0;
  const bmsLatch = useSignal('ecu_led_bms_latch') > 0;
  const imdLatch = useSignal('ecu_led_imd_latch') > 0;
  const bspdLatch = useSignal('ecu_led_bspd_latch') > 0;

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-neutral-800 bg-gradient-to-b from-neutral-900/80 to-neutral-900/40 p-3">
      <SectionTitle>Safety</SectionTitle>
      <div className="grid flex-1 grid-cols-3 gap-2">
        <SafetyTile label="BMS" warn={bms} latched={bmsLatch} />
        <SafetyTile label="IMD" warn={imd} latched={imdLatch} />
        <SafetyTile label="BSPD" warn={bspd} latched={bspdLatch} />
      </div>
    </div>
  );
}

function SafetyTile({ label, warn, latched }: { label: string; warn: boolean; latched: boolean }) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border transition-colors ${
        warn
          ? 'animate-pulse border-red-500/60 bg-red-500/20 text-red-300 shadow-[0_0_24px_-4px_rgb(239_68_68/0.7)]'
          : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
      }`}
    >
      <div className="text-xl font-black tracking-widest">{label}</div>
      <div
        className={`mt-1 text-[9px] font-bold tracking-[0.2em] uppercase ${
          latched ? 'text-amber-300' : 'text-neutral-600'
        }`}
      >
        {latched ? '● LATCHED' : '○ no latch'}
      </div>
    </div>
  );
}

function DriverButtons() {
  const tsActive = useSignal('dash_panel_ts_active') > 0;
  const rtd = useSignal('dash_panel_rtd') > 0;
  const tsOff = useSignal('dash_panel_ts_off') > 0;
  const rtdOff = useSignal('dash_panel_rtd_off') > 0;

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-neutral-800 bg-gradient-to-b from-neutral-900/80 to-neutral-900/40 p-3">
      <SectionTitle>Driver</SectionTitle>
      <div className="grid flex-1 grid-cols-2 gap-2">
        <ButtonPill label="TS" pressed={tsActive} />
        <ButtonPill label="RTD" pressed={rtd} />
        <ButtonPill label="TS OFF" pressed={tsOff} />
        <ButtonPill label="RTD OFF" pressed={rtdOff} />
      </div>
    </div>
  );
}

function ButtonPill({ label, pressed }: { label: string; pressed: boolean }) {
  return (
    <div
      className={`flex items-center justify-center rounded-xl border text-base font-bold tracking-widest transition-colors ${
        pressed
          ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-200 shadow-[0_0_18px_-4px_rgb(34_211_238/0.6)]'
          : 'border-neutral-800 bg-neutral-900/60 text-neutral-600'
      }`}
    >
      {label}
    </div>
  );
}

function SocCard() {
  const soc = useSignal('ecu_accumulator_soc');
  const clamped = Math.max(0, Math.min(100, soc));
  return (
    <div className="flex flex-col justify-center gap-2 rounded-2xl border border-neutral-800 bg-gradient-to-b from-neutral-900/80 to-neutral-900/40 px-5 py-3">
      <div className="flex items-baseline justify-between">
        <SectionTitle>Battery</SectionTitle>
        <div className="text-4xl font-black text-neutral-100 tabular-nums">
          {clamped.toFixed(0)}
          <span className="ml-1 text-base text-neutral-500">%</span>
        </div>
      </div>
      <div className="h-4 overflow-hidden rounded-full bg-neutral-800">
        <div
          className={`h-full ${socColor(clamped)} transition-[width] duration-500 ease-out`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-bold tracking-[0.3em] text-neutral-500 uppercase">
      {children}
    </div>
  );
}

// Middle: just the speed, big.
function SpeedRow() {
  const speed = useSignal('ecu_vehicle_speed');

  return (
    <div className="relative flex items-center justify-center overflow-hidden rounded-2xl border border-neutral-800 bg-gradient-to-b from-neutral-900/80 to-neutral-900/40">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(34,211,238,0.08),transparent_70%)]" />
      <div className="relative flex flex-col items-center">
        <div className="text-[14rem] leading-none font-black text-neutral-50 tabular-nums">
          {Math.round(speed)}
        </div>
        <div className="-mt-3 text-3xl font-semibold tracking-[0.4em] text-neutral-500">MPH</div>
      </div>
    </div>
  );
}

// Bottom: cell extremes + connection pills.
function BottomRow() {
  const signals = useSignalStore((s) => s.signals);
  const { maxVoltage, minVoltage, maxTemp, minTemp } = aggregateCells(signals);
  const wsConnected = useSignalStore((s) => s.connected);
  const cloudConnOk = useSignal('tcm_connection_ok') > 0;
  const cloudMqttOk = useSignal('tcm_mqtt_ok') > 0;
  const cloudPing = useSignal('tcm_mapache_ping');
  const cloudOk = cloudConnOk && cloudMqttOk;

  return (
    <div className="grid grid-cols-[repeat(4,1fr)_auto] gap-3">
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
      <div className="flex gap-3">
        <ConnPill label="LOCAL" ok={wsConnected} />
        <ConnPill
          label="CLOUD"
          ok={cloudOk}
          subtitle={cloudOk ? `${Math.round(cloudPing)} MS` : undefined}
        />
      </div>
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
      <SectionTitle>{label}</SectionTitle>
      <div className={`text-4xl font-black tabular-nums ${colorClass}`}>
        {value}
        <span className="ml-1 text-base text-neutral-500">{unit}</span>
      </div>
    </div>
  );
}

function ConnPill({ label, ok, subtitle }: { label: string; ok: boolean; subtitle?: string }) {
  return (
    <div
      className={`flex w-32 flex-col items-center justify-center rounded-xl border tracking-widest transition-colors ${
        ok
          ? 'border-cyan-400/40 bg-cyan-500/10 text-cyan-300 shadow-[0_0_18px_-6px_rgb(34_211_238/0.6)]'
          : 'animate-pulse border-red-500/60 bg-red-500/20 text-red-300 shadow-[0_0_24px_-4px_rgb(239_68_68/0.7)]'
      }`}
    >
      <div className="text-base leading-none font-black">{label}</div>
      {subtitle && <div className="mt-0.5 text-[10px] font-semibold opacity-80">{subtitle}</div>}
    </div>
  );
}
