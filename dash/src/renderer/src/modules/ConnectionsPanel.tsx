import { useEffect, useRef } from 'react';
import { useSignal, useSignalStore } from '../store/signals';
import { useNow } from '../hooks/useNow';
import { SectionTitle } from './SectionTitle';

// ── Constants ────────────────────────────────────────────────────────

// LOCAL pill threshold. WS open + last signal under STALE_MS → green;
// past it → yellow ("stale Ns"). The WS being open already means the
// dash↔tcm-gr26 pipe is alive, so we never use red for "open but no
// fresh data" — that's the warn state. Red is reserved for WS actually
// closed. 6s leaves room for an idle car where only TCM Status (5s
// cadence) is flowing while still catching a real upstream outage fast.
const LOCAL_STALE_MS = 6000;

// CLOUD freshness — TCM Status publishes every 5s (currently). If we
// haven't seen one in 3× the interval, demote to yellow regardless of
// the cached bit values.
const TCM_STATUS_STALE_MS = 15000;

// Cloud latency above this gets a yellow pill instead of green.
const CLOUD_PING_WARN_MS = 500;

// How long the shelter status light flashes green after a busy→idle
// transition. After this window it falls back to gray idle.
const SHELTER_SUCCESS_FLASH_MS = 5000;

// tcm_shelter_state enum (TCMShelterHeartbeat 0x210).
const SHELTER_IDLE = 0;
const SHELTER_CLAIMING = 1;
const SHELTER_UPLOADING = 2;
const SHELTER_ERROR = 3;

// ── Types ────────────────────────────────────────────────────────────

type ConnStatus = 'ok' | 'warn' | 'down' | 'unknown';

// ── Styling ──────────────────────────────────────────────────────────

const STATUS_DOT: Record<ConnStatus, string> = {
  ok: 'bg-emerald-400 shadow-[0_0_10px_rgb(52_211_153/0.9)]',
  warn: 'bg-amber-400 shadow-[0_0_10px_rgb(251_191_36/0.9)]',
  down: 'bg-red-500 shadow-[0_0_10px_rgb(239_68_68/0.9)] animate-pulse',
  unknown: 'bg-neutral-600',
};

const STATUS_TEXT: Record<ConnStatus, string> = {
  ok: 'text-emerald-300',
  warn: 'text-amber-300',
  down: 'text-red-300',
  unknown: 'text-neutral-500',
};

// Backlit tile styling for the status-light row — icon foreground color
// + matching glow on the tile so each light reads as "lit" in its state
// color, like a physical dash warning light.
const LIGHT_TILE: Record<ConnStatus, string> = {
  ok: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 shadow-[0_0_12px_rgb(52_211_153/0.5)]',
  warn: 'border-amber-500/40 bg-amber-500/10 text-amber-300 shadow-[0_0_12px_rgb(251_191_36/0.5)]',
  down: 'border-red-500/50 bg-red-500/15 text-red-300 shadow-[0_0_14px_rgb(239_68_68/0.6)] animate-pulse',
  unknown: 'border-neutral-700 bg-neutral-800/40 text-neutral-600',
};

// ── Sub-components ───────────────────────────────────────────────────

/** Compact connection row — colored dot + label + value, all on one line. */
function ConnRow({ label, status, value }: { label: string; status: ConnStatus; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xl">
      <div className="flex items-center gap-2">
        <span className={`h-3.5 w-3.5 rounded-full ${STATUS_DOT[status]}`} />
        <span className="font-bold tracking-widest text-neutral-300">{label}</span>
      </div>
      <span className={`font-mono text-lg font-bold tabular-nums ${STATUS_TEXT[status]}`}>
        {value}
      </span>
    </div>
  );
}

/** Backlit status-light tile — icon glows in its state color. */
function StatusLight({ icon, status }: { icon: React.ReactNode; status: ConnStatus }) {
  return (
    <div
      className={`flex h-12 w-12 items-center justify-center rounded-xl border transition-colors ${LIGHT_TILE[status]}`}
    >
      {icon}
    </div>
  );
}

// Inline lucide SVGs — no icon dep.
const ICON_PROPS = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const WifiIcon = () => (
  <svg {...ICON_PROPS}>
    <path d="M12 20h.01" />
    <path d="M2 8.82a15 15 0 0 1 20 0" />
    <path d="M5 12.859a10 10 0 0 1 14 0" />
    <path d="M8.5 16.429a5 5 0 0 1 7 0" />
  </svg>
);

const RadioTowerIcon = () => (
  <svg {...ICON_PROPS}>
    <path d="M4.9 16.1C1 12.2 1 5.8 4.9 1.9" />
    <path d="M7.8 4.7a6.14 6.14 0 0 0-.8 7.5" />
    <circle cx="12" cy="9" r="2" />
    <path d="M16.2 4.8c2 2 2.26 5.11.8 7.47" />
    <path d="M19.1 1.9a9.96 9.96 0 0 1 0 14.1" />
    <path d="M9.5 18h5" />
    <path d="m8 22 4-11 4 11" />
  </svg>
);

const ClockIcon = () => (
  <svg {...ICON_PROPS}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const MountainIcon = () => (
  <svg {...ICON_PROPS}>
    {/* Two-peak range. */}
    <path d="M2 21 L9 5 L13 14 L18 9 L22 21 Z" />
    {/* Outlined snowcaps dropped most of the way down each peak (close
        to valley level) and drawn with a thinner stroke (1 vs the
        mountain's 2) so the snow line reads as a secondary feature
        rather than competing with the main outline. */}
    <path d="M6 12 L9 5 L12 12 Z" strokeWidth={1} />
    <path d="M14 13 L18 9 L19.5 13 Z" strokeWidth={1} />
  </svg>
);

// ── Panel ────────────────────────────────────────────────────────────

// tcmBitRow folds the shared staleness ladder for any single TCM
// Status bit: never-received → unknown, fresh + bit=1 → ok, fresh +
// bit=0 → down, stale TCM Status (>15s) → warn regardless of the
// cached bit value.
function tcmBitRow(
  tcmReceivedAt: number | undefined,
  tcmAge: number,
  bitOk: boolean,
  okValue: string,
  downValue: string,
): { status: ConnStatus; value: string } {
  if (tcmReceivedAt === undefined) return { status: 'unknown', value: 'no status' };
  if (tcmAge > TCM_STATUS_STALE_MS)
    return { status: 'warn', value: `stale ${(tcmAge / 1000).toFixed(0)}s` };
  if (!bitOk) return { status: 'down', value: downValue };
  return { status: 'ok', value: okValue };
}

export function ConnectionsPanel() {
  const wsConnected = useSignalStore((s) => s.connected);
  const lastSignalAt = useSignalStore((s) => s.lastSignalAt);
  const inetOk = useSignal('tcm_connection_ok') > 0;
  const mqttOk = useSignal('tcm_mqtt_ok') > 0;
  const mapacheOk = useSignal('tcm_mapache_ok') > 0;
  const clockOk = useSignal('tcm_clock_ok') > 0;
  const cloudPing = useSignal('tcm_mapache_ping');
  const shelterState = useSignal('tcm_shelter_state');
  // Any tcm_* signal's receivedAt is a proxy for "last TCM Status arrival" —
  // all bits + ping land in the same CAN frame with the same timestamp.
  const tcmReceivedAt = useSignalStore((s) => s.signals['tcm_mqtt_ok']?.receivedAt);
  const now = useNow();

  // ── LOCAL ──
  // `down` only when WS is closed; with WS open, age-driven ladder.
  const localAge = lastSignalAt ? now - lastSignalAt : Infinity;
  let localStatus: ConnStatus;
  let localValue: string;
  if (!wsConnected) {
    localStatus = 'down';
    localValue = 'down';
  } else if (!lastSignalAt) {
    localStatus = 'unknown';
    localValue = 'no data';
  } else if (localAge > LOCAL_STALE_MS) {
    localStatus = 'warn';
    localValue = `stale ${(localAge / 1000).toFixed(0)}s`;
  } else {
    localStatus = 'ok';
    localValue = 'connected';
  }

  // ── TCM Status bits ──
  const tcmAge = tcmReceivedAt === undefined ? Infinity : now - tcmReceivedAt;
  const inet = tcmBitRow(tcmReceivedAt, tcmAge, inetOk, 'reachable', 'no internet');
  const mqtt = tcmBitRow(tcmReceivedAt, tcmAge, mqttOk, 'connected', 'disconnected');
  const clock = tcmBitRow(tcmReceivedAt, tcmAge, clockOk, 'synced', 'unsynced');

  // MAPACHE is mapache_ok with the ping latency as its ok-state value;
  // ping over CLOUD_PING_WARN_MS demotes from ok to warn.
  let mapache = tcmBitRow(
    tcmReceivedAt,
    tcmAge,
    mapacheOk,
    `${Math.round(cloudPing)} ms`,
    'no pong',
  );
  if (mapache.status === 'ok' && cloudPing > CLOUD_PING_WARN_MS) {
    mapache = { status: 'warn', value: `${Math.round(cloudPing)} ms` };
  }

  // ── EPIC SHELTER ──
  // Track busy→idle transitions so the icon flashes green for a short
  // window after a successful backup, then falls back to gray idle.
  // Error state goes straight to red regardless.
  const shelterPrevRef = useRef<number>(SHELTER_IDLE);
  const shelterSuccessAtRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    const prev = shelterPrevRef.current;
    const wasBusy = prev === SHELTER_CLAIMING || prev === SHELTER_UPLOADING;
    if (wasBusy && shelterState === SHELTER_IDLE) {
      shelterSuccessAtRef.current = Date.now();
    }
    shelterPrevRef.current = shelterState;
  }, [shelterState]);

  let shelterStatus: ConnStatus;
  if (shelterState === SHELTER_CLAIMING || shelterState === SHELTER_UPLOADING) {
    shelterStatus = 'warn';
  } else if (shelterState === SHELTER_ERROR) {
    shelterStatus = 'down';
  } else if (
    shelterState === SHELTER_IDLE &&
    shelterSuccessAtRef.current !== undefined &&
    now - shelterSuccessAtRef.current < SHELTER_SUCCESS_FLASH_MS
  ) {
    shelterStatus = 'ok';
  } else {
    shelterStatus = 'unknown';
  }

  return (
    <div className="flex min-h-0 flex-col gap-2 rounded-2xl border border-neutral-800 bg-gradient-to-b from-neutral-900/80 to-neutral-900/40 px-3 py-2">
      <SectionTitle>Status</SectionTitle>
      <ConnRow label="LOCAL" status={localStatus} value={localValue} />
      <ConnRow label="MAPACHE" status={mapache.status} value={mapache.value} />
      <div className="flex items-center justify-evenly pt-1">
        <StatusLight icon={<WifiIcon />} status={inet.status} />
        <StatusLight icon={<RadioTowerIcon />} status={mqtt.status} />
        <StatusLight icon={<MountainIcon />} status={shelterStatus} />
        <StatusLight icon={<ClockIcon />} status={clock.status} />
      </div>
    </div>
  );
}
