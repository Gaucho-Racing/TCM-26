import { useEffect, useState } from 'react';
import { useSignals } from './hooks/useSignals';
import { useSignal, useSignalStore } from './store/signals';
import { useConfigStore } from './store/config';
import { aggregateCells, CELL_SIGNALS } from './lib/cells';
import {
  socColor,
  voltageColor,
  tempColor,
  stateLabel,
  stateClassNames,
  ECU_STATE,
} from './lib/state';
import { Settings, SettingsTrigger } from './views/Settings';

const SUBSCRIBED_SIGNALS = [
  // ECU state machine — drives Vehicle State + derived TS/RTD indicators.
  'ecu_ecu_state',
  // Power/torque settings — only shown in the debug matrix, but cheap to keep.
  'ecu_power_level',
  'ecu_torque_map',
  // Safety lights from Dash Config (ECU → dash).
  'ecu_led_bms',
  'ecu_led_imd',
  'ecu_led_bspd',
  'ecu_led_bms_latch',
  'ecu_led_imd_latch',
  'ecu_led_bspd_latch',
  // Driver button state from Dash Status (visible in the debug matrix).
  'dash_panel_ts_active',
  'dash_panel_rtd',
  'dash_panel_ts_off',
  'dash_panel_rtd_off',
  'dash_panel_led_bms',
  'dash_panel_led_imd',
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
  // Per-cell voltages and temps — aggregated to max/min.
  ...CELL_SIGNALS,
] as const;

export default function App() {
  const loadConfig = useConfigStore((s) => s.load);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Load runtime config (vehicleId, wsUrl) before useSignals tries to
  // connect. The hook itself waits on `loaded` so we don't race.
  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  useSignals(SUBSCRIBED_SIGNALS);

  return (
    <div className="relative grid h-screen w-screen grid-cols-[1fr_1.6fr_1fr] gap-3 bg-neutral-950 p-4">
      <LeftColumn />
      <SpeedPanel />
      <RightColumn />
      <SettingsTrigger onClick={() => setSettingsOpen(true)} />
      {settingsOpen && <Settings onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}

function LeftColumn() {
  return (
    <div className="grid grid-rows-3 gap-3">
      <VehicleStatePanel />
      <SafetyPanel />
      <BatteryPanel />
    </div>
  );
}

function RightColumn() {
  return (
    <div className="grid grid-rows-[1.4fr_1fr_1fr] gap-3">
      <CellExtremesPanel />
      <ConnectionsPanel />
      <DebugPanel />
    </div>
  );
}

// ───────────────────────── LEFT ─────────────────────────

function VehicleStatePanel() {
  const ecuState = useSignal('ecu_ecu_state');
  const tsActive = ecuState === ECU_STATE.PRECHARGE_COMPLETE || ecuState === ECU_STATE.DRIVE_ACTIVE;
  const rtd = ecuState === ECU_STATE.DRIVE_ACTIVE;
  const c = stateClassNames(ecuState);

  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 rounded-2xl border p-3 transition-colors ${c.bg} ${c.border} ${c.pulse}`}
    >
      <SectionTitle>Vehicle State</SectionTitle>
      <div className={`text-3xl font-black tracking-tight ${c.text}`}>{stateLabel(ecuState)}</div>
      <div className="flex gap-3">
        <Indicator label="TS" active={tsActive} />
        <Indicator label="RTD" active={rtd} />
      </div>
    </div>
  );
}

function Indicator({ label, active }: { label: string; active: boolean }) {
  return (
    <div
      className={`rounded-lg border px-4 py-1 text-base font-black tracking-widest transition-colors ${
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

function BatteryPanel() {
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

// ───────────────────────── MIDDLE ─────────────────────────

// Hardcoded RPM ceiling for the bar visual. The GR motor redlines around
// 6000 mechanical RPM; tweak if/when we wire `inverter_rpm_limit`.
const RPM_MAX = 6000;

function SpeedPanel() {
  const speed = useSignal('ecu_vehicle_speed');
  const rpm = useSignal('inverter_motor_rpm');
  const rpmPct = Math.max(0, Math.min(100, (Math.abs(rpm) / RPM_MAX) * 100));

  return (
    <div className="relative flex flex-col items-center justify-center gap-6 overflow-hidden rounded-2xl border border-neutral-800 bg-gradient-to-b from-neutral-900/80 to-neutral-900/40 px-6 py-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(34,211,238,0.08),transparent_70%)]" />
      <div className="relative flex flex-1 flex-col items-center justify-center">
        <div className="text-[14rem] leading-none font-black text-neutral-50 tabular-nums">
          {Math.round(speed)}
        </div>
        <div className="-mt-3 text-3xl font-semibold tracking-[0.4em] text-neutral-500">MPH</div>
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

function CellExtremesPanel() {
  const signals = useSignalStore((s) => s.signals);
  const { maxVoltage, minVoltage, maxTemp, minTemp } = aggregateCells(signals);
  return (
    <div className="grid grid-cols-2 grid-rows-2 gap-2">
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
    <div className="flex flex-col items-center justify-center rounded-xl border border-neutral-800 bg-gradient-to-b from-neutral-900/80 to-neutral-900/40 px-2 py-2">
      <SectionTitle>{label}</SectionTitle>
      <div className={`text-3xl font-black tabular-nums ${colorClass}`}>
        {value}
        <span className="ml-1 text-sm text-neutral-500">{unit}</span>
      </div>
    </div>
  );
}

function ConnectionsPanel() {
  const wsConnected = useSignalStore((s) => s.connected);
  const cloudConnOk = useSignal('tcm_connection_ok') > 0;
  const cloudMqttOk = useSignal('tcm_mqtt_ok') > 0;
  const cloudPing = useSignal('tcm_mapache_ping');
  const cloudOk = cloudConnOk && cloudMqttOk;

  return (
    <div className="grid grid-cols-2 gap-2">
      <ConnPill label="LOCAL" ok={wsConnected} subtitle={wsConnected ? 'WS' : 'down'} />
      <ConnPill
        label="CLOUD"
        ok={cloudOk}
        subtitle={cloudOk ? `${Math.round(cloudPing)} ms` : 'down'}
      />
    </div>
  );
}

function ConnPill({ label, ok, subtitle }: { label: string; ok: boolean; subtitle?: string }) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border transition-colors ${
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
  const ageMs = lastSignalAt ? Date.now() - lastSignalAt : -1;

  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-neutral-800 bg-gradient-to-b from-neutral-900/80 to-neutral-900/40 p-3">
      <SectionTitle>Debug</SectionTitle>
      <DebugRow label="msgs" value={messageCount.toLocaleString()} />
      <DebugRow label="last" value={lastSignalName || '—'} mono />
      <DebugRow label="age" value={ageMs >= 0 ? `${(ageMs / 1000).toFixed(1)}s` : '—'} />
    </div>
  );
}

function DebugRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-xs">
      <span className="tracking-widest text-neutral-500 uppercase">{label}</span>
      <span
        className={`text-neutral-200 tabular-nums ${mono ? 'truncate font-mono text-[10px]' : ''}`}
      >
        {value}
      </span>
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
