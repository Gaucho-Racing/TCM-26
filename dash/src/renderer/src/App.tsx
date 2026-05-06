import { useSignals } from './hooks/useSignals';
import { StatePanel } from './components/StatePanel';
import { SpeedPanel } from './components/SpeedPanel';
import { StatusPanel } from './components/StatusPanel';
import { CellStrip } from './components/CellStrip';
import { CELL_SIGNALS } from './lib/cells';

const ECU_SIGNALS = [
  'ecu_ecu_state',
  'ecu_power_level',
  'ecu_torque_map',
  'ecu_vehicle_speed',
  'ecu_accumulator_soc',
  'ecu_glv_soc',
  'ecu_max_cell_temp',
  'ecu_ts_voltage',
  'ecu_relay_states',
  'ecu_fl_wheel_rpm',
  'ecu_fr_wheel_rpm',
  'ecu_rl_wheel_rpm',
  'ecu_rr_wheel_rpm',
  // dash buttons (from dash_panel)
  'dash_panel_ts_active',
  'dash_panel_rtd',
  // TCM cloud connectivity
  'tcm_status_bits',
  'tcm_mapache_ping',
];

const SUBSCRIBED_SIGNALS = [...ECU_SIGNALS, ...CELL_SIGNALS] as const;

export default function App() {
  useSignals(SUBSCRIBED_SIGNALS);

  // 1600x600 layout: top stripe is the three-column dashboard, bottom row is
  // a full-width per-cell voltage strip.
  return (
    <div className="grid h-screen w-screen grid-rows-[1fr_92px] bg-neutral-950">
      <div className="grid grid-cols-[400px_1fr_400px]">
        <StatePanel />
        <SpeedPanel />
        <StatusPanel />
      </div>
      <CellStrip />
    </div>
  );
}
