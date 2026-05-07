import { useEffect, useRef, useState } from 'react';
import { useSignals } from './hooks/useSignals';
import { useSignal, useSignalStore } from './store/signals';
import { socColor, stateLabel, stateClassNames, ECU_STATE } from './lib/state';

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
] as const;

// LOCAL pill thresholds. WS open + last signal under STALE_MS → green.
// Between STALE_MS and DOWN_MS → yellow. Past DOWN_MS or WS closed → red.
// 6s/15s leaves room for an idle car where only TCM Status (5s cadence)
// is flowing, while still catching a real outage within ~6s.
const LOCAL_STALE_MS = 6000;
const LOCAL_DOWN_MS = 15000;
// CLOUD freshness — TCM Status publishes every 5s (currently). If we
// haven't seen one in 3× the interval, demote to yellow regardless of
// the cached bit values.
const TCM_STATUS_STALE_MS = 15000;
// Cloud latency above this gets a yellow pill instead of green.
const CLOUD_PING_WARN_MS = 500;

// ─────────────────────── App ───────────────────────

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

function LeftColumn() {
  return (
    <div className="grid min-h-0 grid-rows-3 gap-3">
      <VehicleStatePanel />
      <SafetyPanel />
      <BatteryPanel />
    </div>
  );
}

function RightColumn() {
  // Connections shrinks to ~1/3, debug expands to ~2/3 — bigger text
  // there + room for the extra rows.
  return (
    <div className="grid min-h-0 grid-rows-[auto_1fr] gap-3">
      <ConnectionsPanel />
      <DebugPanel />
    </div>
  );
}

// ───────────────────────── LEFT ─────────────────────────

function VehicleStatePanel() {
  const ecuState = useSignal('ecu_ecu_state');
  const tsActive = ecuState === ECU_STATE.PRECHARGE_COMPLETE || ecuState === ECU_STATE.DRIVE_ACTIVE;
  const rtd = ecuState === ECU_STATE.DRIVE_ACTIVE;
  const c = stateClassNames(ecuState);

  return (
    <div
      className={`flex min-h-0 flex-col items-center justify-center gap-3 rounded-2xl border p-3 transition-colors ${c.bg} ${c.border} ${c.pulse}`}
    >
      <SectionTitle>Vehicle State</SectionTitle>
      <div className={`text-3xl font-black tracking-tight ${c.text}`}>{stateLabel(ecuState)}</div>
      <div className="flex gap-3">
        <Indicator label="TS" active={tsActive} />
        <Indicator label="RTD" active={rtd} />
      </div>
    </div>
  );
}

function Indicator({ label, active }: { label: string; active: boolean }) {
  return (
    <div
      className={`rounded-lg border px-4 py-1 text-base font-black tracking-widest transition-colors ${
        active
          ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-300 shadow-[0_0_18px_-6px_rgb(52_211_153/0.7)]'
          : 'border-neutral-700 bg-neutral-900/60 text-neutral-600'
      }`}
    >
      {label}
    </div>
  );
}

type SafetyStatus = 'ok' | 'latched' | 'warn';

function safetyStatus(warn: boolean, latched: boolean): SafetyStatus {
  if (warn) return 'warn';
  if (latched) return 'latched';
  return 'ok';
}

function SafetyPanel() {
  const bms = useSignal('ecu_led_bms') > 0;
  const imd = useSignal('ecu_led_imd') > 0;
  const bspd = useSignal('ecu_led_bspd') > 0;
  const bmsLatch = useSignal('ecu_led_bms_latch') > 0;
  const imdLatch = useSignal('ecu_led_imd_latch') > 0;
  const bspdLatch = useSignal('ecu_led_bspd_latch') > 0;

  return (
    <div className="flex min-h-0 flex-col gap-2 rounded-2xl border border-neutral-800 bg-gradient-to-b from-neutral-900/80 to-neutral-900/40 p-3">
      <SectionTitle>Safety</SectionTitle>
      <div className="grid flex-1 grid-cols-3 gap-2">
        <SafetyTile label="BMS" status={safetyStatus(bms, bmsLatch)} latched={bmsLatch} />
        <SafetyTile label="IMD" status={safetyStatus(imd, imdLatch)} latched={imdLatch} />
        <SafetyTile label="BSPD" status={safetyStatus(bspd, bspdLatch)} latched={bspdLatch} />
      </div>
    </div>
  );
}

function SafetyTile({
  label,
  status,
  latched,
}: {
  label: string;
  status: SafetyStatus;
  latched: boolean;
}) {
  const styles =
    status === 'warn'
      ? 'animate-pulse border-red-500/60 bg-red-500/20 text-red-300 shadow-[0_0_24px_-4px_rgb(239_68_68/0.7)]'
      : status === 'latched'
        ? 'border-amber-400/60 bg-amber-500/15 text-amber-300 shadow-[0_0_22px_-6px_rgb(251_191_36/0.6)]'
        : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400';

  return (
    <div className={`flex flex-col items-center justify-center rounded-xl border ${styles}`}>
      <div className="text-xl font-black tracking-widest">{label}</div>
      <div
        className={`mt-1 text-[9px] font-bold tracking-[0.2em] uppercase ${
          latched ? 'text-amber-300' : 'text-neutral-600'
        }`}
      >
        {latched ? '● LATCHED' : '○ no latch'}
      </div>
    </div>
  );
}

function BatteryPanel() {
  const soc = useSignal('ecu_accumulator_soc');
  const clamped = Math.max(0, Math.min(100, soc));
  return (
    <div className="flex min-h-0 flex-col justify-center gap-2 rounded-2xl border border-neutral-800 bg-gradient-to-b from-neutral-900/80 to-neutral-900/40 px-5 py-3">
      <div className="flex items-baseline justify-between">
        <SectionTitle>Battery</SectionTitle>
        <div className="text-4xl font-black text-neutral-100 tabular-nums">
          {clamped.toFixed(0)}
          <span className="ml-1 text-base text-neutral-500">%</span>
        </div>
      </div>
      <div className="h-4 overflow-hidden rounded-full bg-neutral-800">
        <div
          className={`h-full ${socColor(clamped)} transition-[width] duration-500 ease-out`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

// ───────────────────────── MIDDLE ─────────────────────────

const RPM_MAX = 6000;

function SpeedPanel() {
  const speed = useSignal('ecu_vehicle_speed');
  const rpm = useSignal('inverter_motor_rpm');
  const rpmPct = Math.max(0, Math.min(100, (Math.abs(rpm) / RPM_MAX) * 100));

  return (
    <div className="relative flex flex-col items-center justify-center gap-6 overflow-hidden rounded-2xl border border-neutral-800 bg-gradient-to-b from-neutral-900/80 to-neutral-900/40 px-6 py-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(34,211,238,0.08),transparent_70%)]" />
      <div className="relative flex flex-1 flex-col items-center justify-center">
        <div className="text-[14rem] leading-none font-black text-neutral-50 tabular-nums">
          {Math.round(speed)}
        </div>
        <div className="-mt-3 text-3xl font-semibold tracking-[0.4em] text-neutral-500">MPH</div>
      </div>
      <div className="relative w-full">
        <div className="flex items-baseline justify-between text-[10px] font-bold tracking-[0.3em] text-neutral-500 uppercase">
          <span>RPM</span>
          <span className="text-base text-neutral-200 tabular-nums">{Math.round(rpm)}</span>
        </div>
        <div className="mt-1 h-3 overflow-hidden rounded-full bg-neutral-800">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500 transition-[width] duration-150 ease-out"
            style={{ width: `${rpmPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── RIGHT ─────────────────────────

type ConnStatus = 'ok' | 'warn' | 'down' | 'unknown';

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

// Compact connection row — colored dot + label + value, all on one line.
// Replaces the old tile-style pills so the panel can shrink.
function ConnRow({ label, status, value }: { label: string; status: ConnStatus; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-base">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT[status]}`} />
        <span className="font-bold tracking-widest text-neutral-300">{label}</span>
      </div>
      <span className={`font-mono text-sm font-bold tabular-nums ${STATUS_TEXT[status]}`}>
        {value}
      </span>
    </div>
  );
}

function ConnectionsPanel() {
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

  // LOCAL: WS state + freshness of any signal. WS open with no data is
  // a partial outage; we want to surface it.
  const localAge = lastSignalAt ? now - lastSignalAt : Infinity;
  const localStatus: ConnStatus = !wsConnected
    ? 'down'
    : localAge > LOCAL_DOWN_MS
      ? 'down'
      : localAge > LOCAL_STALE_MS
        ? 'warn'
        : 'ok';
  const localValue = !wsConnected
    ? 'down'
    : localAge > LOCAL_STALE_MS
      ? `stale ${(localAge / 1000).toFixed(0)}s`
      : 'connected';

  // CLOUD: never-received → unknown. Recent TCM Status with healthy
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

function DebugPanel() {
  const messageCount = useSignalStore((s) => s.messageCount);
  const lastSignalName = useSignalStore((s) => s.lastSignalName);
  const lastSignalAt = useSignalStore((s) => s.lastSignalAt);
  const signalCount = useSignalStore((s) => Object.keys(s.signals).length);
  const epicShelterOk = useSignal('tcm_epic_shelter_ok');
  const cameraOk = useSignal('tcm_camera_ok');
  const cacheSize = useSignal('tcm_cache_size');
  const ping = useSignal('tcm_mapache_ping');
  const now = useNow();
  const ageMs = lastSignalAt ? now - lastSignalAt : -1;
  const rate = useMessageRate();

  return (
    <div className="flex min-h-0 flex-col gap-1.5 overflow-hidden rounded-2xl border border-neutral-800 bg-gradient-to-b from-neutral-900/80 to-neutral-900/40 p-3">
      <SectionTitle>Debug</SectionTitle>
      <DebugRow label="msgs" value={messageCount.toLocaleString()} />
      <DebugRow label="rate" value={`${rate.toFixed(1)} /s`} />
      <DebugRow label="signals" value={signalCount.toString()} />
      <DebugRow label="age" value={ageMs >= 0 ? `${(ageMs / 1000).toFixed(1)}s` : '—'} />
      <DebugRow label="last" value={lastSignalName || '—'} mono />
      <DebugRow label="ping" value={`${Math.round(ping)} ms`} />
      <DebugRow label="cache" value={cacheSize.toString()} />
      <DebugRow label="shelter" value={epicShelterOk ? 'ok' : '—'} />
      <DebugRow label="camera" value={cameraOk ? 'ok' : '—'} />
    </div>
  );
}

function DebugRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-base">
      <span className="text-sm tracking-widest text-neutral-500 uppercase">{label}</span>
      <span
        className={`text-neutral-100 tabular-nums ${mono ? 'truncate font-mono text-xs' : 'font-bold'}`}
      >
        {value}
      </span>
    </div>
  );
}

// ─────────────────────── shared ───────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs font-bold tracking-[0.3em] text-neutral-500 uppercase">{children}</div>
  );
}

// 4 Hz tick so the staleness badge + age row update even when no new
// signals are arriving (otherwise they'd freeze at the moment of the
// last incoming message).
function useNow(intervalMs: number = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

// Rolling messages-per-second counter. Updates once per second from the
// useNow tick, so it's cheap and stable on screen.
function useMessageRate(): number {
  const messageCount = useSignalStore((s) => s.messageCount);
  const now = useNow();
  const last = useRef({ count: messageCount, time: now, rate: 0 });

  if (now - last.current.time >= 1000) {
    const dt = (now - last.current.time) / 1000;
    last.current = {
      count: messageCount,
      time: now,
      rate: (messageCount - last.current.count) / dt,
    };
  }
  return last.current.rate;
}
