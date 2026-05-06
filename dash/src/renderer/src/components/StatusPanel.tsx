import { useSignal, useSignalStore } from '../store/signals';
import { isSafetyOk, type SafetyKey } from '../lib/state';

// Right panel: safety circuit lights + auxiliary readouts. Drivers only
// glance here when something's off — keep the warnings unmissable.
export function StatusPanel() {
  const relayStates = useSignal('ecu_relay_states');
  const tsVoltage = useSignal('ecu_ts_voltage');
  const glvSoc = useSignal('ecu_glv_soc');
  const connected = useSignalStore((s) => s.connected);

  return (
    <div className="flex flex-col h-full p-6 gap-4">
      <SafetyLights relayStates={relayStates} />

      <div className="grid grid-cols-2 gap-3">
        <Stat label="TS VOLTS" value={tsVoltage.toFixed(0)} unit="V" />
        <Stat label="GLV" value={glvSoc.toFixed(0)} unit="%" />
      </div>

      <div className="flex-1 bg-neutral-900/60 border border-neutral-800 rounded-xl px-4 py-3 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div
            className={`w-3 h-3 rounded-full ${connected ? 'bg-emerald-400' : 'bg-red-500'}`}
          />
          <div className="text-sm text-neutral-400 uppercase tracking-wider">
            {connected ? 'TELEMETRY OK' : 'NO TELEMETRY'}
          </div>
        </div>
      </div>
    </div>
  );
}

function SafetyLights({ relayStates }: { relayStates: number }) {
  const items: { key: SafetyKey; label: string }[] = [
    { key: 'bms', label: 'BMS' },
    { key: 'imd', label: 'IMD' },
    { key: 'bspd', label: 'BSPD' },
    { key: 'software', label: 'SW' },
  ];

  return (
    <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-3">
      <div className="text-xs text-neutral-500 uppercase tracking-wider mb-2 text-center">
        Safety
      </div>
      <div className="grid grid-cols-4 gap-2">
        {items.map(({ key, label }) => {
          const ok = isSafetyOk(relayStates, key);
          return (
            <div
              key={key}
              className={`flex flex-col items-center justify-center rounded-lg py-2 border ${
                ok
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                  : 'bg-red-500/15 border-red-500/50 text-red-400'
              }`}
            >
              <div className="text-xs font-bold uppercase">{label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl px-4 py-3">
      <div className="text-xs text-neutral-500 uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className="text-3xl font-bold text-neutral-100 leading-none">
        {value}
        <span className="text-base text-neutral-500 ml-1">{unit}</span>
      </div>
    </div>
  );
}
