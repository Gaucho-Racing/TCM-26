import { useSignal } from '../store/signals';

const MAX_SPEED = 70;

// ── Gauge geometry ──────────────────────────────────────────────────

/** Scale factor — bump this to make the entire gauge bigger on screen. */
const S: number = 2;

const CX = 200; // gauge center x
const CY = 220; // gauge center y
const R = 160; // arc radius
const START_DEG = 240; // bottom-left
const SWEEP_DEG = 240; // sweep through top

function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number,
): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const s = polarToCartesian(cx, cy, r, startDeg);
  const e = polarToCartesian(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  // sweep-flag = 1 → clockwise in SVG coords
  return `M ${s.x.toFixed(1)} ${s.y.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(1)} ${e.y.toFixed(1)}`;
}

// ── Tick helpers ────────────────────────────────────────────────────

interface Tick {
  angle: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  labelX: number;
  labelY: number;
}

function computeTick(deg: number): Tick {
  const inner = polarToCartesian(CX, CY, R - 12, deg);
  const outer = polarToCartesian(CX, CY, R, deg);
  const labelPos = polarToCartesian(CX, CY, R - 26, deg);
  return {
    angle: deg,
    x1: inner.x,
    y1: inner.y,
    x2: outer.x,
    y2: outer.y,
    labelX: labelPos.x,
    labelY: labelPos.y,
  };
}

const MAJOR_TICKS: Tick[] = [];
const MINOR_TICKS: Tick[] = [];
for (let mph = 0; mph <= MAX_SPEED; mph += 5) {
  const frac = mph / MAX_SPEED;
  const deg = START_DEG + frac * SWEEP_DEG;
  const t = computeTick(deg);
  if (mph % 10 === 0) {
    MAJOR_TICKS.push(t);
  } else {
    MINOR_TICKS.push(t);
  }
}

// ── Component ───────────────────────────────────────────────────────

export function SpeedPanel() {
  const speed = useSignal('dti_erpm');
  const mph = speed * 0.00121429 * 10;
  const clamped = Math.max(0, Math.min(MAX_SPEED, mph));
  const frac = clamped / MAX_SPEED;
  const needleDeg = START_DEG + frac * SWEEP_DEG;

  // Background arc (full track) and foreground arc (filled portion)
  const bgArc = describeArc(CX, CY, R, START_DEG, START_DEG + SWEEP_DEG);
  const fgArc = frac > 0 ? describeArc(CX, CY, R, START_DEG, needleDeg) : '';

  const needleInnerR = 48;
  const needleOuterR = R - 35;
  const needleInner = polarToCartesian(CX, CY, needleInnerR, needleDeg);
  const needleOuter = polarToCartesian(CX, CY, needleOuterR, needleDeg);

  return (
    <div className="relative flex flex-col items-center justify-center gap-1 rounded-2xl border border-neutral-800 bg-gradient-to-b from-neutral-900/80 to-neutral-900/40 px-4 py-3">
      {/* Wrapper that scales the gauge visually, independent of column layout */}
      <div
        className="flex flex-col items-center gap-1"
        style={{ transform: `scale(${S})`, transformOrigin: 'center center' }}
      >
        <svg viewBox="0 0 400 400" className="w-full max-w-[400px]">
          {/* Background arc */}
          <path
            d={bgArc}
            fill="none"
            stroke="rgb(39 39 42)"
            strokeWidth={10}
            strokeLinecap="round"
          />

          {/* Foreground arc */}
          {fgArc && (
            <path
              d={fgArc}
              fill="none"
              stroke="rgb(161 161 170)"
              strokeWidth={10}
              strokeLinecap="round"
              className="transition-all duration-150 ease-out"
            />
          )}

          {/* Minor ticks */}
          {MINOR_TICKS.map((t) => (
            <line
              key={`mi${t.angle.toFixed(0)}`}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              stroke="rgb(63 63 70)"
              strokeWidth={2}
              strokeLinecap="round"
            />
          ))}

          {/* Major ticks + labels */}
          {MAJOR_TICKS.map((t, i) => (
            <g key={`ma${i}`}>
              <line
                x1={t.x1}
                y1={t.y1}
                x2={t.x2}
                y2={t.y2}
                stroke="rgb(113 113 122)"
                strokeWidth={3}
                strokeLinecap="round"
              />
              <text
                x={t.labelX}
                y={t.labelY + 4}
                fill="rgb(113 113 122)"
                fontSize={12}
                fontFamily="ui-sans-serif, system-ui, sans-serif"
                textAnchor="middle"
                dominantBaseline="central"
                className="font-bold tabular-nums"
              >
                {i * 10}
              </text>
            </g>
          ))}

          {/* Needle */}
          <line
            x1={needleInner.x}
            y1={needleInner.y}
            x2={needleOuter.x}
            y2={needleOuter.y}
            stroke="rgb(239 68 68)"
            strokeWidth={3}
            strokeLinecap="round"
            className="transition-all duration-150 ease-out"
          />

          {/* Speed in center */}
          <text
            x={CX}
            y={CY - 6}
            fill="rgb(250 250 250)"
            fontSize={56}
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            textAnchor="middle"
            dominantBaseline="central"
            className="font-black tabular-nums"
          >
            {Math.round(mph)}
          </text>
          <text
            x={CX}
            y={CY + 34}
            fill="rgb(113 113 122)"
            fontSize={14}
            fontFamily="ui-sans-serif, system-ui, sans-serif"
            textAnchor="middle"
            dominantBaseline="central"
            className="font-semibold tracking-[0.5em]"
          >
            MPH
          </text>
        </svg>
      </div>
    </div>
  );
}
