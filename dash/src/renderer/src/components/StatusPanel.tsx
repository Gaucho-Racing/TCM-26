import { useSignal, useSignalStore } from '../store/signals';
import { isSafetyOk, type SafetyKey } from '../lib/state';

const TCM_STATUS_CONNECTION = 1 << 0;
const TCM_STATUS_MQTT = 1 << 1;

// Right panel: safety circuit lights (pulse red on fault), four wheel
// speeds, and connection indicators. Driver should be able to glance here
// only when something needs attention.
export function StatusPanel() {
  const relayStates = useSignal('ecu_relay_states');
  const flRpm = useSignal('ecu_fl_wheel_rpm');
  const frRpm = useSignal('ecu_fr_wheel_rpm');
  const rlRpm = useSignal('ecu_rl_wheel_rpm');
  const rrRpm = useSignal('ecu_rr_wheel_rpm');
  const tcmStatus = useSignal('tcm_status_bits');
  const cloudPing = useSignal('tcm_mapache_ping');
  const connected = useSignalStore((s) => s.connected);

  const cloudOk = (tcmStatus & TCM_STATUS_MQTT) !== 0 && (tcmStatus & TCM_STATUS_CONNECTION) !== 0;

  return (
    <div className="flex h-full flex-col gap-3 p-5">
      <SafetyLights relayStates={relayStates} />

      <WheelGrid fl={flRpm} fr={frRpm} rl={rlRpm} rr={rrRpm} />

      <div className="flex flex-1 flex-col justify-end gap-2 rounded-xl border border-neutral-800 bg-gradient-to-b from-neutral-900/80 to-neutral-900/40 px-4 py-3">
        <ConnectionRow ok={connected} label={connected ? 'TELEMETRY OK' : 'NO TELEMETRY'} />
        <ConnectionRow
          ok={cloudOk}
          label={cloudOk ? `CLOUD ${cloudPing.toFixed(0)} MS` : 'CLOUD OFFLINE'}
        />
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
    <div className="rounded-xl border border-neutral-800 bg-gradient-to-b from-neutral-900/80 to-neutral-900/40 p-3">
      <div className="mb-2 text-center text-xs tracking-wider text-neutral-500 uppercase">
        Safety
      </div>
      <div className="grid grid-cols-4 gap-2">
        {items.map(({ key, label }) => {
          const ok = isSafetyOk(relayStates, key);
          return (
            <div
              key={key}
              className={`flex items-center justify-center rounded-lg border py-3 transition-colors ${
                ok
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                  : 'animate-pulse border-red-500/60 bg-red-500/20 text-red-300 shadow-[0_0_18px_-4px_rgb(239_68_68/0.6)]'
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

function WheelGrid({ fl, fr, rl, rr }: { fl: number; fr: number; rl: number; rr: number }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-gradient-to-b from-neutral-900/80 to-neutral-900/40 p-3">
      <div className="mb-2 text-center text-xs tracking-wider text-neutral-500 uppercase">
        Wheel RPM
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Wheel label="FL" rpm={fl} />
        <Wheel label="FR" rpm={fr} />
        <Wheel label="RL" rpm={rl} />
        <Wheel label="RR" rpm={rr} />
      </div>
    </div>
  );
}

function Wheel({ label, rpm }: { label: string; rpm: number }) {
  // Spinning intensity hint via opacity on the label — barely noticeable but
  // pulls the eye to wheels that are actually moving. Cap at 1500 rpm.
  const intensity = Math.min(1, Math.abs(rpm) / 1500);
  return (
    <div className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900/40 px-3 py-2">
      <div
        className="text-xs font-bold tracking-widest text-neutral-500 uppercase"
        style={{ opacity: 0.3 + 0.7 * intensity }}
      >
        {label}
      </div>
      <div className="text-lg font-bold text-neutral-100 tabular-nums">{Math.round(rpm)}</div>
    </div>
  );
}

function ConnectionRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`h-2.5 w-2.5 rounded-full transition-colors ${
          ok ? 'bg-emerald-400 shadow-[0_0_8px_2px_rgb(52_211_153/0.6)]' : 'bg-red-500'
        }`}
      />
      <div className="text-sm tracking-wider text-neutral-400 uppercase">{label}</div>
    </div>
  );
}
