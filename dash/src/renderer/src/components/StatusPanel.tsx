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
    <div className="flex h-full flex-col gap-4 p-6">
      <SafetyLights relayStates={relayStates} />

      <div className="grid grid-cols-2 gap-3">
        <Stat label="TS VOLTS" value={tsVoltage.toFixed(0)} unit="V" />
        <Stat label="GLV" value={glvSoc.toFixed(0)} unit="%" />
      </div>

      <div className="flex flex-1 items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className={`h-3 w-3 rounded-full ${connected ? 'bg-emerald-400' : 'bg-red-500'}`} />
          <div className="text-sm tracking-wider text-neutral-400 uppercase">
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
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-3">
      <div className="mb-2 text-center text-xs tracking-wider text-neutral-500 uppercase">
        Safety
      </div>
      <div className="grid grid-cols-4 gap-2">
        {items.map(({ key, label }) => {
          const ok = isSafetyOk(relayStates, key);
          return (
            <div
              key={key}
              className={`flex flex-col items-center justify-center rounded-lg border py-2 ${
                ok
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                  : 'border-red-500/50 bg-red-500/15 text-red-400'
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
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-3">
      <div className="mb-1 text-xs tracking-wider text-neutral-500 uppercase">{label}</div>
      <div className="text-3xl leading-none font-bold text-neutral-100">
        {value}
        <span className="ml-1 text-base text-neutral-500">{unit}</span>
      </div>
    </div>
  );
}
