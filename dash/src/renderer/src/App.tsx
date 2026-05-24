import { useSignals } from './hooks/useSignals';
import {
  VehicleStatePanel,
  SafetyPanel,
  BatteryPanel,
  SpeedPanel,
  ConnectionsPanel,
  DebugPanel,
  TelemetryPanel,
  TELEMETRY_SIGNALS,
  APPS_SIGNALS,
  CurrentPanel,
} from './modules';

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
  // Telemetry panel signals
  ...TELEMETRY_SIGNALS,
  // APPS panel signals
  ...APPS_SIGNALS,
] as const;

// ─────────────────────── Layout ───────────────────────

export default function App() {
  useSignals(SUBSCRIBED_SIGNALS);

  return (
    <div className="relative grid h-screen w-screen grid-cols-[1fr_1.6fr_1fr] gap-3 overflow-hidden bg-neutral-950 p-4">
      <LeftColumn />
      <SpeedPanel />
      <RightColumn />
    </div>
  );
}

/** Left third: vehicle state, safety, battery. */
function LeftColumn() {
  return (
    <div className="grid min-h-0 grid-rows-[1fr_2fr] gap-3">
      {/*<VehicleStatePanel />*/}
      {/*<SafetyPanel />*/}
      {/*<BatteryPanel />*/}
      <ConnectionsPanel />
      <CurrentPanel />
    </div>
  );
}

/** Right third: connections + debug info. */
function RightColumn() {
  return (
    <div className="grid min-h-0 grid-rows-[auto_1fr] gap-3">
      {/*<DebugPanel />*/}
      <TelemetryPanel />
    </div>
  );
}
