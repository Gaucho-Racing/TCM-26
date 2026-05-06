import { useSignalStore, type Signal } from '../store/signals';

// Polarity says how to color a flag: which value is "good" or "alarming".
// `positive`  — 1=good (green),    0=bad (red)        e.g. tcm_connection_ok
// `negative`  — 1=warn (red),      0=ok (dim green)   e.g. ecu_led_bms
// `neutral`   — 1=active (cyan),   0=idle (dim)       e.g. dash_panel_ts_active
// `latch`     — 1=sticky (amber),  0=clean (dim)      e.g. ecu_led_bms_latch
// `metric`    — numeric, just colored by value bucket  e.g. mapache_ping
// `state`     — special render (hex + label)          e.g. ecu_ecu_state
type Polarity = 'positive' | 'negative' | 'neutral' | 'latch' | 'metric' | 'state';

const POLARITY: Record<string, Polarity> = {
  'ecu_led_bms': 'negative',
  'ecu_led_imd': 'negative',
  'ecu_led_bspd': 'negative',
  'ecu_led_bms_latch': 'latch',
  'ecu_led_imd_latch': 'latch',
  'ecu_led_bspd_latch': 'latch',
  'dash_panel_ts_active': 'neutral',
  'dash_panel_rtd': 'neutral',
  'dash_panel_ts_off': 'neutral',
  'dash_panel_rtd_off': 'neutral',
  'dash_panel_led_bms': 'negative',
  'dash_panel_led_imd': 'negative',
  'tcm_connection_ok': 'positive',
  'tcm_mqtt_ok': 'positive',
  'tcm_epic_shelter_ok': 'positive',
  'tcm_camera_ok': 'positive',
  'tcm_mapache_ping': 'metric',
  'tcm_cache_size': 'metric',
  'ecu_ecu_state': 'state',
  'ecu_power_level': 'metric',
  'ecu_torque_map': 'metric',
};

// Layout: each entry is a section with a title and a flat list of signals.
// The grid auto-sizes columns so longer sections wrap naturally.
const SECTIONS: { title: string; signals: string[] }[] = [
  {
    title: 'Driver Buttons',
    signals: ['dash_panel_ts_active', 'dash_panel_rtd', 'dash_panel_ts_off', 'dash_panel_rtd_off'],
  },
  {
    title: 'Safety LEDs (ECU → Dash)',
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
    title: 'Dash Mirror LEDs',
    signals: ['dash_panel_led_bms', 'dash_panel_led_imd'],
  },
  {
    title: 'ECU State',
    signals: ['ecu_ecu_state', 'ecu_power_level', 'ecu_torque_map'],
  },
  {
    title: 'TCM Status',
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

export function DebugMatrix() {
  const signals = useSignalStore((s) => s.signals);
  const messageCount = useSignalStore((s) => s.messageCount);
  const lastSignalName = useSignalStore((s) => s.lastSignalName);
  const connected = useSignalStore((s) => s.connected);

  return (
    <div className="flex h-screen w-screen flex-col gap-3 bg-neutral-950 p-4">
      <Header connected={connected} messageCount={messageCount} lastSignalName={lastSignalName} />
      <div className="flex flex-1 flex-col gap-3 overflow-auto">
        {SECTIONS.map((section) => (
          <Section
            key={section.title}
            title={section.title}
            names={section.signals}
            signals={signals}
          />
        ))}
      </div>
    </div>
  );
}

function Header({
  connected,
  messageCount,
  lastSignalName,
}: {
  connected: boolean;
  messageCount: number;
  lastSignalName: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-neutral-800 bg-neutral-900/60 px-4 py-2">
      <span className="text-xl font-black tracking-[0.3em] text-neutral-100">FLAGS</span>
      <div
        className={`rounded-full border-2 px-3 py-0.5 text-sm font-black tracking-widest ${
          connected
            ? 'border-emerald-400/70 bg-emerald-500/20 text-emerald-300 shadow-[0_0_18px_-6px_rgb(52_211_153/0.7)]'
            : 'animate-pulse border-red-500/70 bg-red-500/20 text-red-300'
        }`}
      >
        WS · {connected ? 'OK' : 'DOWN'}
      </div>
      <div className="text-sm text-neutral-400">
        msgs <span className="text-base font-black text-neutral-100 tabular-nums">{messageCount.toLocaleString()}</span>
      </div>
      <div className="truncate text-sm text-neutral-400">
        last <span className="font-mono text-xs text-cyan-300">{lastSignalName || '—'}</span>
      </div>
    </div>
  );
}

function Section({
  title,
  names,
  signals,
}: {
  title: string;
  names: string[];
  signals: Record<string, Signal>;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-[11px] font-black tracking-[0.3em] text-neutral-500 uppercase">
        {title}
      </div>
      <div className="grid grid-cols-6 gap-2">
        {names.map((name) => (
          <FlagTile key={name} name={name} signal={signals[name]} />
        ))}
      </div>
    </div>
  );
}

function FlagTile({ name, signal }: { name: string; signal: Signal | undefined }) {
  const polarity = POLARITY[name] ?? 'neutral';
  const v = signal?.value;
  const display = renderValue(name, signal, polarity);
  const tone = toneFor(polarity, v);
  const label = prettyName(name);

  return (
    <div
      className={`flex min-h-[88px] flex-col justify-between rounded-2xl border-2 px-3 py-2 transition-all ${tone.container}`}
    >
      <div className={`text-[10px] font-bold tracking-[0.2em] uppercase ${tone.label}`}>
        {label}
      </div>
      <div className={`text-4xl leading-none font-black tabular-nums ${tone.value}`}>
        {display}
      </div>
    </div>
  );
}

function renderValue(name: string, signal: Signal | undefined, polarity: Polarity): string {
  if (!signal) return '—';
  const v = signal.value;

  if (polarity === 'state') {
    return `0x${signal.rawValue.toString(16).padStart(2, '0').toUpperCase()}`;
  }
  if (polarity === 'metric') {
    if (name === 'tcm_mapache_ping') return `${Math.round(v)} ms`;
    if (Number.isInteger(v)) return v.toString();
    return v.toFixed(1);
  }
  return v === 1 ? 'ON' : 'OFF';
}

function toneFor(
  polarity: Polarity,
  v: number | undefined,
): { container: string; label: string; value: string } {
  if (v === undefined) {
    return {
      container: 'border-neutral-800 bg-neutral-900/40',
      label: 'text-neutral-700',
      value: 'text-neutral-700',
    };
  }

  const on = v === 1;

  switch (polarity) {
    case 'positive':
      return on
        ? {
            container:
              'border-emerald-400/70 bg-emerald-500/20 shadow-[0_0_18px_-6px_rgb(52_211_153/0.6)]',
            label: 'text-emerald-300',
            value: 'text-emerald-300',
          }
        : {
            container:
              'animate-pulse border-red-500/70 bg-red-500/20 shadow-[0_0_22px_-6px_rgb(239_68_68/0.7)]',
            label: 'text-red-300',
            value: 'text-red-300',
          };
    case 'negative':
      return on
        ? {
            container:
              'animate-pulse border-red-500/70 bg-red-500/25 shadow-[0_0_24px_-4px_rgb(239_68_68/0.8)]',
            label: 'text-red-200',
            value: 'text-red-200',
          }
        : {
            container: 'border-emerald-500/40 bg-emerald-500/10',
            label: 'text-emerald-300',
            value: 'text-emerald-400',
          };
    case 'neutral':
      return on
        ? {
            container:
              'border-cyan-400/70 bg-cyan-500/20 shadow-[0_0_22px_-4px_rgb(34_211_238/0.7)]',
            label: 'text-cyan-200',
            value: 'text-cyan-200',
          }
        : {
            container: 'border-neutral-700 bg-neutral-900/60',
            label: 'text-neutral-500',
            value: 'text-neutral-600',
          };
    case 'latch':
      return on
        ? {
            container:
              'border-amber-400/70 bg-amber-500/20 shadow-[0_0_22px_-4px_rgb(251_191_36/0.7)]',
            label: 'text-amber-200',
            value: 'text-amber-200',
          }
        : {
            container: 'border-neutral-700 bg-neutral-900/60',
            label: 'text-neutral-500',
            value: 'text-neutral-600',
          };
    case 'metric':
      return {
        container: 'border-cyan-500/40 bg-cyan-500/10',
        label: 'text-cyan-300',
        value: 'text-cyan-200',
      };
    case 'state':
      return {
        container:
          'border-violet-400/60 bg-violet-500/20 shadow-[0_0_22px_-4px_rgb(167_139_250/0.6)]',
        label: 'text-violet-200',
        value: 'text-violet-100',
      };
  }
}

function prettyName(name: string): string {
  return name
    .replace(/^(dash_panel|ecu|tcm|inverter|bcu|dti)_/, '')
    .replace(/_/g, ' ')
    .toUpperCase();
}
