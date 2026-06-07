import { useEffect, useRef, useState } from 'react';
import { useSignal } from '../store/signals';

// ═══════════════════════════════════════════════════════════════════════
// When `ecu_power_level` changes, this component fades a full-screen
// WebP overlay for 2 seconds with the new power level displayed on top.
// ═══════════════════════════════════════════════════════════════════════

/** How long the overlay stays visible after the last power-level change. */
const VISIBLE_DURATION_MS = 2000;

/** Maps `ecu_power_level` (0–5) to the displayed kW value. */
const POWER_LEVEL_MAP: Record<number, number> = {
  0: 50,
  1: 100,
  2: 150,
  3: 200,
  4: 250,
  5: 275,
};

import powerImg from '../assets/powahhh.webp';

export function PowerOverlay() {
  const value = useSignal('ecu_power_level');
  const [visible, setVisible] = useState(false);
  const [displayValue, setDisplayValue] = useState(value);
  const prevRef = useRef(value);
  const mountedRef = useRef(false);
  const overlayUpRef = useRef(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Skip the initial mount so the overlay doesn't fire just because
    // the first signal arrived (fallback 0 → real value).
    if (!mountedRef.current) {
      mountedRef.current = true;
      prevRef.current = value;
      return;
    }

    if (value !== prevRef.current) {
      const mapped = POWER_LEVEL_MAP[value] ?? value;
      prevRef.current = value;

      // Always update the displayed value immediately — Zustand's
      // selector already suppresses re-renders when the raw value
      // hasn't changed, so there's no flicker from repeated signals.
      setDisplayValue(mapped);

      // Reset the hide timer — overlay stays up for 2 s from
      // *this* change. If it wasn't visible yet, show it now.
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => {
        setVisible(false);
        overlayUpRef.current = false;
      }, VISIBLE_DURATION_MS);

      if (!overlayUpRef.current) {
        setVisible(true);
        overlayUpRef.current = true;
      }
    }

    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [value]);

  if (!powerImg) return null;

  return (
    <div
      aria-hidden={!visible}
      className={`pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-black/80 transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="relative flex items-center justify-center">
        <img src={powerImg} alt="Power level" className="max-h-full max-w-full object-contain" />
        <span className="absolute text-9xl font-black text-white tabular-nums drop-shadow-[0_0_20px_rgba(0,0,0,0.8)]">
          {displayValue}
        </span>
      </div>
    </div>
  );
}
