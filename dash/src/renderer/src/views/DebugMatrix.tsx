import { useSignalStore, type Signal } from '../store/signals';

// Groups of flag-style signals we care about while debugging state
// transitions on the car. Edit this list to add/remove rows — each entry
// is rendered live from the store, so anything subscribed by App.tsx
// shows up here automatically.
const GROUPS: { title: string; signals: string[] }[] = [
  {
    title: 'Dash Status — driver button flags',
    signals: ['dash_panel_ts_active', 'dash_panel_rtd', 'dash_panel_ts_off', 'dash_panel_rtd_off'],
  },
  {
    title: 'Dash Status — dash LED bits',
    signals: ['dash_panel_led_bms', 'dash_panel_led_imd'],
  },
  {
    title: 'Dash Config — ECU → dash LED commands',
    signals: [
      'ecu_led_bms',
      'ecu_led_imd',
      'ecu_led_bspd',
      'ecu_led_bms_latch',
      'ecu_led_imd_latch',
      'ecu_led_bspd_latch',
    ],
  },
  {
    title: 'ECU state machine',
    signals: ['ecu_ecu_state', 'ecu_power_level', 'ecu_torque_map'],
  },
  {
    title: 'TCM status bits',
    signals: [
      'tcm_connection_ok',
      'tcm_mqtt_ok',
      'tcm_epic_shelter_ok',
      'tcm_camera_ok',
      'tcm_mapache_ping',
      'tcm_cache_size',
    ],
  },
];

export function DebugMatrix({ onClose }: { onClose: () => void }) {
  const signals = useSignalStore((s) => s.signals);
  const messageCount = useSignalStore((s) => s.messageCount);
  const lastSignalName = useSignalStore((s) => s.lastSignalName);
  const connected = useSignalStore((s) => s.connected);

  return (
    <div className="flex h-screen w-screen flex-col gap-3 bg-neutral-950 p-4 font-mono text-sm">
      <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
        <div className="flex items-baseline gap-4">
          <span className="text-lg font-black tracking-widest text-neutral-100">FLAG MATRIX</span>
          <span className={connected ? 'text-emerald-400' : 'text-red-400'}>
            WS {connected ? 'OK' : 'DOWN'}
          </span>
          <span className="text-neutral-500">
            msgs <span className="text-neutral-200 tabular-nums">{messageCount}</span>
          </span>
          <span className="text-neutral-500">
            last <span className="text-neutral-300">{lastSignalName || '—'}</span>
          </span>
        </div>
        <button
          onClick={onClose}
          className="rounded border border-neutral-700 px-3 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
        >
          press D · close
        </button>
      </div>
      <div className="grid flex-1 grid-cols-3 gap-3 overflow-auto">
        {GROUPS.map((g) => (
          <FlagGroup key={g.title} title={g.title} names={g.signals} signals={signals} />
        ))}
      </div>
    </div>
  );
}

function FlagGroup({
  title,
  names,
  signals,
}: {
  title: string;
  names: string[];
  signals: Record<string, Signal>;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-neutral-800 bg-neutral-900/40 p-3">
      <div className="mb-1 text-[10px] font-bold tracking-[0.2em] text-neutral-400 uppercase">
        {title}
      </div>
      {names.map((name) => (
        <FlagRow key={name} name={name} signal={signals[name]} />
      ))}
    </div>
  );
}

function FlagRow({ name, signal }: { name: string; signal: Signal | undefined }) {
  if (!signal) {
    return (
      <div className="flex items-center justify-between gap-2 border-b border-neutral-900 py-1">
        <span className="truncate text-[11px] text-neutral-600">{name}</span>
        <span className="text-[11px] text-neutral-700">—</span>
      </div>
    );
  }

  const v = signal.value;
  const isBoolish = v === 0 || v === 1;
  const ageMs = Date.now() - new Date(signal.producedAt).getTime();

  return (
    <div className="flex items-center justify-between gap-2 border-b border-neutral-900 py-1">
      <span className="truncate text-[11px] text-neutral-300">{name}</span>
      <div className="flex shrink-0 items-baseline gap-2">
        <span className="text-[9px] tabular-nums text-neutral-600">
          {ageMs >= 0 && ageMs < 60_000 ? `${(ageMs / 1000).toFixed(1)}s` : ''}
        </span>
        <span
          className={
            isBoolish
              ? v === 1
                ? 'rounded bg-emerald-500/20 px-2 py-0.5 font-black text-emerald-300'
                : 'rounded bg-neutral-800/60 px-2 py-0.5 text-neutral-500'
              : 'rounded bg-neutral-800/60 px-2 py-0.5 font-black text-cyan-300 tabular-nums'
          }
        >
          {isBoolish ? (v === 1 ? '1' : '0') : formatValue(v, signal.rawValue)}
        </span>
      </div>
    </div>
  );
}

function formatValue(value: number, rawValue: number): string {
  // ECU state machine raw is the most useful as hex.
  if (Number.isInteger(rawValue) && rawValue > 0 && rawValue <= 0xff && value === rawValue) {
    return `0x${rawValue.toString(16).padStart(2, '0')}`;
  }
  if (Number.isInteger(value)) return value.toString();
  return value.toFixed(2);
}
