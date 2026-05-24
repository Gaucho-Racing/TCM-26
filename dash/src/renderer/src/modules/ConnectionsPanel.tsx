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

// ── Panel ────────────────────────────────────────────────────────────

export function ConnectionsPanel() {
  const wsConnected = useSignalStore((s) => s.connected);
  const lastSignalAt = useSignalStore((s) => s.lastSignalAt);
  const cloudConnOk = useSignal('tcm_connection_ok') > 0;
  const cloudMqttOk = useSignal('tcm_mqtt_ok') > 0;
  const cloudPing = useSignal('tcm_mapache_ping');
  // We use any tcm_* signal's receivedAt as a proxy for "when did the
  // last TCM Status arrive". TCM Status publishes all of its bits +
  // ping in one CAN frame, so any of them stamp the same instant.
  const tcmReceivedAt = useSignalStore((s) => s.signals['tcm_mqtt_ok']?.receivedAt);
  const now = useNow();

  // ── LOCAL ──
  // Only `down` when the WS is actually closed. With WS open,
  // four-state ladder driven by signal freshness:
  //   - no signal seen yet → unknown ('no data')
  //   - stale (>6s)        → warn   ('stale Ns')
  //   - fresh              → ok     ('connected')
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

  // ── CLOUD ──
  // Never-received → unknown. Recent TCM Status with healthy
  // bits → ok (or yellow if ping > 500ms). Recent TCM Status but bits
  // say down → down. TCM Status itself stale → yellow regardless of
  // cached bit values (we don't trust them once they age out).
  const cloudUp = cloudConnOk && cloudMqttOk;
  const tcmAge = tcmReceivedAt === undefined ? Infinity : now - tcmReceivedAt;
  let cloudStatus: ConnStatus;
  let cloudValue: string;
  if (tcmReceivedAt === undefined) {
    cloudStatus = 'unknown';
    cloudValue = 'no status';
  } else if (tcmAge > TCM_STATUS_STALE_MS) {
    cloudStatus = 'warn';
    cloudValue = `stale ${(tcmAge / 1000).toFixed(0)}s`;
  } else if (!cloudUp) {
    cloudStatus = 'down';
    cloudValue = 'down';
  } else if (cloudPing > CLOUD_PING_WARN_MS) {
    cloudStatus = 'warn';
    cloudValue = `${Math.round(cloudPing)} ms`;
  } else {
    cloudStatus = 'ok';
    cloudValue = `${Math.round(cloudPing)} ms`;
  }

  return (
    <div className="flex min-h-0 flex-col gap-2 rounded-2xl border border-neutral-800 bg-gradient-to-b from-neutral-900/80 to-neutral-900/40 px-3 py-2">
      <SectionTitle>Connections</SectionTitle>
      <ConnRow label="LOCAL" status={localStatus} value={localValue} />
      <ConnRow label="CLOUD" status={cloudStatus} value={cloudValue} />
    </div>
  );
}
