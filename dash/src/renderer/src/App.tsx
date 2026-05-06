import { useSignals } from './hooks/useSignals';
import { StatePanel } from './components/StatePanel';
import { SpeedPanel } from './components/SpeedPanel';
import { StatusPanel } from './components/StatusPanel';

// Signals the dashboard subscribes to. Names are prefixed with the source
// node ID (e.g., `ecu_*` for ECU Status messages) — the gr26 ingest service
// composes them as `{node_id}_{signal_name}` from the MQTT topic structure.
const SUBSCRIBED_SIGNALS = [
  'ecu_ecu_state',
  'ecu_power_level',
  'ecu_torque_map',
  'ecu_vehicle_speed',
  'ecu_accumulator_soc',
  'ecu_glv_soc',
  'ecu_max_cell_temp',
  'ecu_ts_voltage',
  'ecu_relay_states',
] as const;

export default function App() {
  useSignals(SUBSCRIBED_SIGNALS);

  // 1600x600 stripe, three columns. Left ~25% / center 50% / right ~25%.
  // Grid keeps panels aligned regardless of content height.
  return (
    <div className="w-screen h-screen bg-neutral-950 grid grid-cols-[400px_1fr_400px]">
      <StatePanel />
      <SpeedPanel />
      <StatusPanel />
    </div>
  );
}
