import { useNow } from '../hooks/useNow';
import { VEHICLE_ID } from '../hooks/useSignals';

// 24h clock so a driver glancing at the bar isn't squinting at AM/PM.
function formatLocalTime(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour12: false });
}

// UTC HH:MM:SS sliced from the ISO string; cheaper than going through
// toLocaleTimeString with the UTC timezone every tick.
function formatUTCTime(d: Date): string {
  return d.toISOString().slice(11, 19);
}

function TimeBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-xs font-bold tracking-widest text-neutral-500">{label}</span>
      <span className="font-mono text-2xl font-bold text-neutral-200 tabular-nums">{value}</span>
    </div>
  );
}

// Reference info pinned at the bottom of the middle column: which car
// this dash belongs to + the wall clock in both local and UTC. Ticks
// once a second.
export function StatusBar() {
  const now = useNow(1000);
  const d = new Date(now);
  return (
    <div className="flex items-center justify-between gap-6 rounded-2xl border border-neutral-800 bg-gradient-to-b from-neutral-900/80 to-neutral-900/40 px-5 py-3">
      <span className="text-2xl font-black tracking-[0.3em] text-neutral-200">
        {VEHICLE_ID.toUpperCase()}
      </span>
      <div className="flex items-center gap-6">
        <TimeBlock label="LOCAL" value={formatLocalTime(d)} />
        <TimeBlock label="UTC" value={formatUTCTime(d)} />
      </div>
    </div>
  );
}
