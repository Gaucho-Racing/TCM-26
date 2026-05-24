import { useSignal, useSignalStore } from '../store/signals';
import { VEHICLE_ID } from '../hooks/useSignals';
import { useNow } from '../hooks/useNow';
import { useMessageRate } from '../hooks/useMessageRate';
import { SectionTitle } from './SectionTitle';

// ── Sub-components ───────────────────────────────────────────────────

function DebugRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-lg">
      <span className="text-base tracking-widest text-neutral-500 uppercase">{label}</span>
      <span
        className={`text-neutral-100 tabular-nums ${mono ? 'truncate font-mono text-sm' : 'font-bold'}`}
      >
        {value}
      </span>
    </div>
  );
}

// ── Panel ────────────────────────────────────────────────────────────

export function DebugPanel() {
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
      <div className="flex items-baseline justify-between gap-2 text-lg">
        <span className="text-base tracking-widest text-neutral-500 uppercase">vehicle</span>
        <span className="from-gr-pink to-gr-purple bg-gradient-to-r bg-clip-text font-black tracking-widest text-transparent tabular-nums">
          {VEHICLE_ID.toUpperCase()}
        </span>
      </div>
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
