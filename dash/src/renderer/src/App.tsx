import { useSignals } from './hooks/useSignals';
import { useSignal, useSignalStore, type Signal } from './store/signals';
import { aggregateCells, CELL_SIGNALS } from './lib/cells';

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
  useSignals(SUBSCRIBED_SIGNALS);
  return (
    <div className="grid h-screen w-screen grid-cols-[1fr_1.6fr_1fr] gap-3 bg-neutral-950 p-4">
      <LeftColumn />
      <SpeedPanel />
      <RightColumn />
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
  const powerLevel = useSignal('ecu_power_level');
  const torqueMap = useSignal('ecu_torque_map');
  return (
    <Panel title="Vehicle State">
      <SignalRow name="ecu_ecu_state" value={ecuState} />
      <SignalRow name="ecu_power_level" value={powerLevel} />
      <SignalRow name="ecu_torque_map" value={torqueMap} />
    </Panel>
  );
}

function SafetyPanel() {
  const bms = useSignal('ecu_led_bms');
  const imd = useSignal('ecu_led_imd');
  const bspd = useSignal('ecu_led_bspd');
  const bmsLatch = useSignal('ecu_led_bms_latch');
  const imdLatch = useSignal('ecu_led_imd_latch');
  const bspdLatch = useSignal('ecu_led_bspd_latch');
  const tsActive = useSignal('dash_panel_ts_active');
  const rtd = useSignal('dash_panel_rtd');
  const tsOff = useSignal('dash_panel_ts_off');
  const rtdOff = useSignal('dash_panel_rtd_off');
  return (
    <Panel title="Safety">
      <SignalRow name="ecu_led_bms" value={bms} />
      <SignalRow name="ecu_led_imd" value={imd} />
      <SignalRow name="ecu_led_bspd" value={bspd} />
      <SignalRow name="ecu_led_bms_latch" value={bmsLatch} />
      <SignalRow name="ecu_led_imd_latch" value={imdLatch} />
      <SignalRow name="ecu_led_bspd_latch" value={bspdLatch} />
      <SignalRow name="dash_panel_ts_active" value={tsActive} />
      <SignalRow name="dash_panel_rtd" value={rtd} />
      <SignalRow name="dash_panel_ts_off" value={tsOff} />
      <SignalRow name="dash_panel_rtd_off" value={rtdOff} />
    </Panel>
  );
}

function BatteryPanel() {
  const soc = useSignal('ecu_accumulator_soc');
  return (
    <Panel title="Battery">
      <SignalRow name="ecu_accumulator_soc" value={soc} />
    </Panel>
  );
}

// ───────────────────────── MIDDLE ─────────────────────────

function SpeedPanel() {
  const speed = useSignal('ecu_vehicle_speed');
  const rpm = useSignal('inverter_motor_rpm');
  return (
    <Panel title="Speed / RPM">
      <SignalRow name="ecu_vehicle_speed" value={speed} />
      <SignalRow name="inverter_motor_rpm" value={rpm} />
    </Panel>
  );
}

// ───────────────────────── RIGHT ─────────────────────────

function CellExtremesPanel() {
  const signals = useSignalStore((s) => s.signals);
  const { maxVoltage, minVoltage, maxTemp, minTemp } = aggregateCells(signals);
  return (
    <Panel title="Cell Extremes (aggregated)">
      <SignalRow name="maxVoltage" value={maxVoltage.toFixed(2)} />
      <SignalRow name="minVoltage" value={minVoltage.toFixed(2)} />
      <SignalRow name="maxTemp" value={maxTemp.toFixed(0)} />
      <SignalRow name="minTemp" value={minTemp.toFixed(0)} />
    </Panel>
  );
}

function ConnectionsPanel() {
  const wsConnected = useSignalStore((s) => s.connected);
  const cloudConnOk = useSignal('tcm_connection_ok');
  const cloudMqttOk = useSignal('tcm_mqtt_ok');
  const epicShelterOk = useSignal('tcm_epic_shelter_ok');
  const cameraOk = useSignal('tcm_camera_ok');
  const cloudPing = useSignal('tcm_mapache_ping');
  const cacheSize = useSignal('tcm_cache_size');
  return (
    <Panel title="Connections">
      <SignalRow name="ws_connected" value={String(wsConnected)} />
      <SignalRow name="tcm_connection_ok" value={cloudConnOk} />
      <SignalRow name="tcm_mqtt_ok" value={cloudMqttOk} />
      <SignalRow name="tcm_epic_shelter_ok" value={epicShelterOk} />
      <SignalRow name="tcm_camera_ok" value={cameraOk} />
      <SignalRow name="tcm_mapache_ping" value={cloudPing} />
      <SignalRow name="tcm_cache_size" value={cacheSize} />
    </Panel>
  );
}

function DebugPanel() {
  const messageCount = useSignalStore((s) => s.messageCount);
  const lastSignalName = useSignalStore((s) => s.lastSignalName);
  const lastSignalAt = useSignalStore((s) => s.lastSignalAt);
  const ageMs = lastSignalAt ? Date.now() - lastSignalAt : -1;
  return (
    <Panel title="Debug">
      <SignalRow name="msgs" value={messageCount} />
      <SignalRow name="last" value={lastSignalName || '—'} />
      <SignalRow name="age" value={ageMs >= 0 ? `${(ageMs / 1000).toFixed(1)}s` : '—'} />
    </Panel>
  );
}

// ─────────────────────── shared ───────────────────────

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 overflow-auto rounded-2xl border border-neutral-800 bg-neutral-900/40 p-3">
      <div className="mb-1 text-[10px] font-bold tracking-[0.3em] text-neutral-500 uppercase">
        {title}
      </div>
      {children}
    </div>
  );
}

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
  return (
    <div className="flex items-baseline justify-between gap-2 font-mono text-xs">
      <span className="truncate text-neutral-400">{name}</span>
      <span className="text-neutral-100 tabular-nums">{display}</span>
    </div>
  );
}
