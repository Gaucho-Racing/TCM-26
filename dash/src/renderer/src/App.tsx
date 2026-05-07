import { useSignals } from './hooks/useSignals';
import { useSignal, useSignalStore, type Signal } from './store/signals';
import { socColor, stateLabel, stateClassNames, ECU_STATE } from './lib/state';

const SUBSCRIBED_SIGNALS = [
  // ECU state machine
  'ecu_ecu_state',
  'ecu_power_level',
  'ecu_torque_map',
  // Safety lights from Dash Config (ECU → dash).
  'ecu_led_bms',
  'ecu_led_imd',
  'ecu_led_bspd',
  'ecu_led_bms_latch',
  'ecu_led_imd_latch',
  'ecu_led_bspd_latch',
  // Driver button state from Dash Status.
  'dash_panel_ts_active',
  'dash_panel_rtd',
  'dash_panel_ts_off',
  'dash_panel_rtd_off',
  // Primary readouts
  'ecu_vehicle_speed',
  'ecu_accumulator_soc',
  // Motor RPM from the GR Inverter (Inverter Status 1 → 0x013).
  'inverter_motor_rpm',
  // TCM connectivity from the relay's TCM Status (0x029).
  'tcm_connection_ok',
  'tcm_mqtt_ok',
  'tcm_epic_shelter_ok',
  'tcm_camera_ok',
  'tcm_mapache_ping',
  'tcm_cache_size',
] as const;

// 1600x600 fixed display. Layout has to fit without scrolling; tune
// row heights here, not inside child panels.
export default function App() {
  useSignals(SUBSCRIBED_SIGNALS);
  return (
    <div className="grid h-screen w-screen grid-cols-[1fr_1.6fr_1fr] gap-3 overflow-hidden bg-neutral-950 p-4">
      <LeftColumn />
      <SpeedPanel />
      <RightColumn />
    </div>
  );
}

function LeftColumn() {
  return (
    <div className="grid min-h-0 grid-rows-3 gap-3">
      <VehicleStatePanel />
      <SafetyPanel />
      <BatteryPanel />
    </div>
  );
}

function RightColumn() {
  return (
    <div className="grid min-h-0 grid-rows-2 gap-3">
      <ConnectionsPanel />
      <DebugPanel />
    </div>
  );
}

// ───────────────────────── LEFT ─────────────────────────

function VehicleStatePanel() {
  const ecuState = useSignal('ecu_ecu_state');
  const powerLevel = useSignal('ecu_power_level');
  const torqueMap = useSignal('ecu_torque_map');
  const tsActive = ecuState === ECU_STATE.PRECHARGE_COMPLETE || ecuState === ECU_STATE.DRIVE_ACTIVE;
  const rtd = ecuState === ECU_STATE.DRIVE_ACTIVE;
  const c = stateClassNames(ecuState);

  return (
    <div
      className={`flex min-h-0 flex-col items-center justify-between rounded-2xl border p-3 transition-colors ${c.bg} ${c.border} ${c.pulse}`}
    >
      <SectionTitle>Vehicle State</SectionTitle>
      <div className={`text-3xl font-black tracking-tight ${c.text}`}>{stateLabel(ecuState)}</div>
      <div className="flex gap-3">
        <Indicator label="TS" active={tsActive} />
        <Indicator label="RTD" active={rtd} />
      </div>
      <div className="w-full self-stretch">
        <SignalRow name="ecu_ecu_state" value={ecuState} />
        <SignalRow name="ecu_power_level" value={powerLevel} />
        <SignalRow name="ecu_torque_map" value={torqueMap} />
      </div>
    </div>
  );
}

function Indicator({ label, active }: { label: string; active: boolean }) {
  return (
    <div
      className={`rounded-lg border px-3 py-0.5 text-sm font-black tracking-widest transition-colors ${
        active
          ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-300 shadow-[0_0_18px_-6px_rgb(52_211_153/0.7)]'
          : 'border-neutral-700 bg-neutral-900/60 text-neutral-600'
      }`}
    >
      {label}
    </div>
  );
}

function SafetyPanel() {
  const bms = useSignal('ecu_led_bms');
  const imd = useSignal('ecu_led_imd');
  const bspd = useSignal('ecu_led_bspd');
  const bmsLatch = useSignal('ecu_led_bms_latch');
  const imdLatch = useSignal('ecu_led_imd_latch');
  const bspdLatch = useSignal('ecu_led_bspd_latch');

  return (
    <div className="flex min-h-0 flex-col gap-2 rounded-2xl border border-neutral-800 bg-neutral-900/40 p-3">
      <SectionTitle>Safety</SectionTitle>
      <div className="grid grid-cols-3 gap-2">
        <SafetyTile label="BMS" warn={bms > 0} latched={bmsLatch > 0} />
        <SafetyTile label="IMD" warn={imd > 0} latched={imdLatch > 0} />
        <SafetyTile label="BSPD" warn={bspd > 0} latched={bspdLatch > 0} />
      </div>
      <div>
        <SignalRow name="ecu_led_bms" value={bms} />
        <SignalRow name="ecu_led_imd" value={imd} />
        <SignalRow name="ecu_led_bspd" value={bspd} />
        <SignalRow name="ecu_led_bms_latch" value={bmsLatch} />
        <SignalRow name="ecu_led_imd_latch" value={imdLatch} />
        <SignalRow name="ecu_led_bspd_latch" value={bspdLatch} />
      </div>
    </div>
  );
}

function SafetyTile({ label, warn, latched }: { label: string; warn: boolean; latched: boolean }) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border py-1 transition-colors ${
        warn
          ? 'animate-pulse border-red-500/60 bg-red-500/20 text-red-300 shadow-[0_0_24px_-4px_rgb(239_68_68/0.7)]'
          : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
      }`}
    >
      <div className="text-base font-black tracking-widest">{label}</div>
      <div
        className={`text-[9px] font-bold tracking-[0.2em] uppercase ${latched ? 'text-amber-300' : 'text-neutral-600'}`}
      >
        {latched ? '● LATCHED' : '○ no latch'}
      </div>
    </div>
  );
}

function BatteryPanel() {
  const soc = useSignal('ecu_accumulator_soc');
  const clamped = Math.max(0, Math.min(100, soc));
  return (
    <div className="flex min-h-0 flex-col justify-between rounded-2xl border border-neutral-800 bg-neutral-900/40 p-3">
      <div className="flex items-baseline justify-between">
        <SectionTitle>Battery</SectionTitle>
        <div className="text-3xl font-black text-neutral-100 tabular-nums">
          {clamped.toFixed(0)}
          <span className="ml-1 text-base text-neutral-500">%</span>
        </div>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-neutral-800">
        <div
          className={`h-full ${socColor(clamped)} transition-[width] duration-500 ease-out`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <div>
        <SignalRow name="ecu_accumulator_soc" value={soc} />
      </div>
    </div>
  );
}

// ───────────────────────── MIDDLE ─────────────────────────

const RPM_MAX = 6000;

function SpeedPanel() {
  const speed = useSignal('ecu_vehicle_speed');
  const rpm = useSignal('inverter_motor_rpm');
  const rpmPct = Math.max(0, Math.min(100, (Math.abs(rpm) / RPM_MAX) * 100));

  return (
    <div className="relative flex flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl border border-neutral-800 bg-gradient-to-b from-neutral-900/80 to-neutral-900/40 px-6 py-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(34,211,238,0.08),transparent_70%)]" />
      <div className="relative flex flex-1 flex-col items-center justify-center">
        <div className="text-[12rem] leading-none font-black text-neutral-50 tabular-nums">
          {Math.round(speed)}
        </div>
        <div className="-mt-2 text-2xl font-semibold tracking-[0.4em] text-neutral-500">MPH</div>
      </div>
      <div className="relative w-full">
        <div className="flex items-baseline justify-between text-[10px] font-bold tracking-[0.3em] text-neutral-500 uppercase">
          <span>RPM</span>
          <span className="text-base text-neutral-200 tabular-nums">{Math.round(rpm)}</span>
        </div>
        <div className="mt-1 h-3 overflow-hidden rounded-full bg-neutral-800">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500 transition-[width] duration-150 ease-out"
            style={{ width: `${rpmPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── RIGHT ─────────────────────────

function ConnectionsPanel() {
  const wsConnected = useSignalStore((s) => s.connected);
  const cloudConnOk = useSignal('tcm_connection_ok');
  const cloudMqttOk = useSignal('tcm_mqtt_ok');
  const cloudPing = useSignal('tcm_mapache_ping');
  const cacheSize = useSignal('tcm_cache_size');
  const epicShelterOk = useSignal('tcm_epic_shelter_ok');
  const cameraOk = useSignal('tcm_camera_ok');
  const cloudOk = cloudConnOk > 0 && cloudMqttOk > 0;

  return (
    <div className="flex min-h-0 flex-col gap-2 rounded-2xl border border-neutral-800 bg-neutral-900/40 p-3">
      <SectionTitle>Connections</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        <ConnPill label="LOCAL" ok={wsConnected} subtitle={wsConnected ? 'WS' : 'down'} />
        <ConnPill
          label="CLOUD"
          ok={cloudOk}
          subtitle={cloudOk ? `${Math.round(cloudPing)} ms` : 'down'}
        />
      </div>
      <div>
        <SignalRow name="tcm_connection_ok" value={cloudConnOk} />
        <SignalRow name="tcm_mqtt_ok" value={cloudMqttOk} />
        <SignalRow name="tcm_epic_shelter_ok" value={epicShelterOk} />
        <SignalRow name="tcm_camera_ok" value={cameraOk} />
        <SignalRow name="tcm_mapache_ping" value={cloudPing} />
        <SignalRow name="tcm_cache_size" value={cacheSize} />
      </div>
    </div>
  );
}

function ConnPill({ label, ok, subtitle }: { label: string; ok: boolean; subtitle?: string }) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border py-1 transition-colors ${
        ok
          ? 'border-cyan-400/40 bg-cyan-500/10 text-cyan-300 shadow-[0_0_18px_-6px_rgb(34_211_238/0.6)]'
          : 'animate-pulse border-red-500/60 bg-red-500/20 text-red-300 shadow-[0_0_24px_-4px_rgb(239_68_68/0.7)]'
      }`}
    >
      <div className="text-base leading-none font-black tracking-widest">{label}</div>
      {subtitle && (
        <div className="mt-1 text-[10px] font-semibold tracking-widest uppercase opacity-80">
          {subtitle}
        </div>
      )}
    </div>
  );
}

function DebugPanel() {
  const messageCount = useSignalStore((s) => s.messageCount);
  const lastSignalName = useSignalStore((s) => s.lastSignalName);
  const lastSignalAt = useSignalStore((s) => s.lastSignalAt);
  const wsConnected = useSignalStore((s) => s.connected);
  const ageMs = lastSignalAt ? Date.now() - lastSignalAt : -1;
  return (
    <div className="flex min-h-0 flex-col gap-1 rounded-2xl border border-neutral-800 bg-neutral-900/40 p-3">
      <SectionTitle>Debug</SectionTitle>
      <SignalRow name="ws_connected" value={String(wsConnected)} />
      <SignalRow name="msgs" value={messageCount} />
      <SignalRow name="last" value={lastSignalName || '—'} />
      <SignalRow name="age" value={ageMs >= 0 ? `${(ageMs / 1000).toFixed(1)}s` : '—'} />
    </div>
  );
}

// ─────────────────────── shared ───────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-bold tracking-[0.3em] text-neutral-500 uppercase">
      {children}
    </div>
  );
}

// Compact mono row showing the underlying signal name + value. Sized to
// sit at the bottom of a panel without dominating the visualization.
// 0 / "false" rendered dim, 1 / "true" rendered bright green so booleans
// stand out at a glance. Other numeric values render in cyan so they
// read as live data.
function SignalRow({ name, value }: { name: string; value: number | string | Signal | undefined }) {
  let display: string;
  if (value === undefined || value === null) {
    display = '—';
  } else if (typeof value === 'number') {
    display = Number.isInteger(value) ? value.toString() : value.toFixed(2);
  } else if (typeof value === 'string') {
    display = value;
  } else {
    display = String(value);
  }

  const isOn = display === '1' || display === 'true';
  const isOff = display === '0' || display === 'false';
  const valueClass = isOn
    ? 'text-emerald-400 font-black'
    : isOff
      ? 'text-neutral-600'
      : 'text-cyan-300 font-bold';

  return (
    <div className="flex items-baseline justify-between gap-2 font-mono text-[11px] leading-snug">
      <span className="truncate text-neutral-500">{name}</span>
      <span className={`tabular-nums ${valueClass}`}>{display}</span>
    </div>
  );
}
