import { useSignal } from '../store/signals';
import { useNow } from '../hooks/useNow';
import { SectionTitle } from './SectionTitle';

// ── Signal definitions ──────────────────────────────────────────────

export const APPS_SIGNALS = ['ecu_apps_1_signal', 'ecu_apps_2_signal'] as const;

// ── Constants ───────────────────────────────────────────────────────

/** Width of the visible history window, in milliseconds. */
const WINDOW_MS = 10_000;

/** How often to sample (and re-render), in milliseconds. */
const SAMPLE_INTERVAL_MS = 80; // ~12.5 Hz → ~125 points per 10s window

/** Dimensions of the plot area inside the SVG. */
const PLOT_PAD = { top: 20, right: 8, bottom: 28, left: 38 };
const SVG_W = 360;
const SVG_H = 280;
const PLOT_W = SVG_W - PLOT_PAD.left - PLOT_PAD.right;
const PLOT_H = SVG_H - PLOT_PAD.top - PLOT_PAD.bottom;

// ── Sampling ────────────────────────────────────────────────────────

interface Sample {
  t: number; // millis since epoch
  a1: number; // APPS 1 (%, 0–100)
  a2: number; // APPS 2 (%, 0–100)
}

// We keep samples in a module-level array so they persist across renders
// without forcing a ref on every component instance. Safe because there's
// only one APPSPanel ever mounted.
const samples: Sample[] = [];
let lastSampleAt = 0;

function collect(s1: number, s2: number): void {
  const now = Date.now();
  if (now - lastSampleAt < SAMPLE_INTERVAL_MS && samples.length > 0) return;

  samples.push({ t: now, a1: s1, a2: s2 });
  lastSampleAt = now;

  const cutoff = now - WINDOW_MS;
  while (samples.length > 0 && samples[0]!.t < cutoff) {
    samples.shift();
  }
}

// ── SVG helpers ─────────────────────────────────────────────────────

/** Map a data value (0–100) to SVG y coordinate (bottom = 0). */
function yVal(v: number): number {
  return PLOT_PAD.top + PLOT_H - (Math.max(0, Math.min(100, v)) / 100) * PLOT_H;
}

/** Map a timestamp to SVG x coordinate. Latest time = right edge. */
function xTime(t: number, now: number): number {
  const age = now - t; // 0 = now, WINDOW_MS = oldest
  const frac = 1 - Math.max(0, Math.min(1, age / WINDOW_MS));
  return PLOT_PAD.left + frac * PLOT_W;
}

/** Build a polyline points string from the sample buffer. */
function points(samples: Sample[], now: number, accessor: (s: Sample) => number): string {
  // At least two points so the line always stretches across the full width
  const pts = samples.map((s) => `${xTime(s.t, now).toFixed(1)},${yVal(accessor(s)).toFixed(1)}`);
  // Extend to edges so the line doesn't gap when data is sparse
  if (pts.length > 0) {
    const lastX = PLOT_PAD.left + PLOT_W;
    const lastY = pts[pts.length - 1]!.split(',')[1]!;
    pts.push(`${lastX.toFixed(1)},${lastY}`);
  }
  return pts.join(' ');
}

// ── Grid ────────────────────────────────────────────────────────────

function Grid() {
  const lines: React.ReactNode[] = [];

  // Horizontal grid lines at 0%, 25%, 50%, 75%, 100%
  for (let pct = 0; pct <= 100; pct += 25) {
    const y = yVal(pct);
    const isAxis = pct === 0;
    lines.push(
      <line
        key={`h${pct}`}
        x1={PLOT_PAD.left}
        y1={y}
        x2={PLOT_PAD.left + PLOT_W}
        y2={y}
        stroke={isAxis ? 'rgb(82 82 91)' : 'rgb(39 39 42)'}
        strokeWidth={isAxis ? 1 : 0.5}
      />,
      <text
        key={`hl${pct}`}
        x={PLOT_PAD.left + PLOT_W + 6}
        y={y + 4}
        fill="rgb(113 113 122)"
        fontSize={11}
        textAnchor="start"
        className="tabular-nums"
      >
        {pct}
      </text>,
    );
  }

  // Vertical grid lines every 2 seconds
  for (let sec = 0; sec <= 10; sec += 2) {
    const x = PLOT_PAD.left + (sec / 10) * PLOT_W;
    const isAxis = sec === 10;
    lines.push(
      <line
        key={`v${sec}`}
        x1={x}
        y1={PLOT_PAD.top}
        x2={x}
        y2={PLOT_PAD.top + PLOT_H}
        stroke={isAxis ? 'rgb(82 82 91)' : 'rgb(39 39 42)'}
        strokeWidth={isAxis ? 1 : 0.5}
      />,
    );
  }

  // Time labels: -10s, -8s, -6s, -4s, -2s, now
  for (let sec = 0; sec <= 10; sec += 2) {
    const x = PLOT_PAD.left + (sec / 10) * PLOT_W;
    const label = sec === 10 ? 'now' : `-${10 - sec}s`;
    lines.push(
      <text
        key={`tl${sec}`}
        x={x}
        y={PLOT_PAD.top + PLOT_H + 16}
        fill="rgb(113 113 122)"
        fontSize={9}
        textAnchor="middle"
      >
        {label}
      </text>,
    );
  }

  return <>{lines}</>;
}

// ── Panel ───────────────────────────────────────────────────────────

export function APPSPanel() {
  // Read signals at the top level (hook rules require this).
  const apps1 = useSignal('ecu_apps_1_signal');
  const apps2 = useSignal('ecu_apps_2_signal');

  // Drive sampling by calling useNow() so the component re-renders
  // frequently enough to both collect samples and update the X axis.
  const now = useNow(SAMPLE_INTERVAL_MS);

  // Collect a new sample on every render.
  collect(apps1, apps2);

  const snapshots = samples;

  // Build the two polylines.
  const p1 = snapshots.length > 0 ? points(snapshots, now, (s) => s.a1) : '';
  const p2 = snapshots.length > 0 ? points(snapshots, now, (s) => s.a2) : '';

  return (
    <div className="flex min-h-0 flex-col gap-2 rounded-2xl border border-neutral-800 bg-gradient-to-b from-neutral-900/80 to-neutral-900/40 p-3">
      <SectionTitle>APPS</SectionTitle>

      {/* Graph */}
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        className="w-full overflow-visible"
        style={{ maxWidth: SVG_W }}
      >
        <Grid />

        {p1 && (
          <polyline
            points={p1}
            fill="none"
            stroke="rgb(34 211 238)"
            strokeWidth={2}
            strokeLinejoin="round"
          />
        )}
        {p2 && (
          <polyline
            points={p2}
            fill="none"
            stroke="rgb(232 121 249)"
            strokeWidth={2}
            strokeLinejoin="round"
          />
        )}
      </svg>
    </div>
  );
}
