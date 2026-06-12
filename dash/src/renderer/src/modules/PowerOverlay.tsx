import { useCallback, useEffect, useRef, useState } from 'react';
import { useSignalStore } from '../store/signals';

// ═══════════════════════════════════════════════════════════════════════
// When `ecu_power_level` changes, this component fades a full-screen
// WebP overlay for 2 seconds with the new power level displayed on top.
//
// Detection uses Zustand's vanilla `subscribe` (NOT the React selector)
// so that every store mutation is seen, regardless of React's render
// batching.  A cooldown ref prevents re-triggering while the overlay
// is already up, which guards against signal bursts from the car's SSE
// relay that could otherwise fire the effect multiple times per tick.
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
  // ── React state (only for rendering) ────────────────────────────
  const [visible, setVisible] = useState(false);
  const [displayValue, setDisplayValue] = useState(0);

  // ── Refs ────────────────────────────────────────────────────────
  // Tracks the last *known* ecu_power_level so we can detect edges.
  const lastLevelRef = useRef<number | null>(null);
  // "Blocker": true while overlay is visible, suppressing re-triggers.
  const showingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable callback so the subscribe effect doesn't need it as a dep.
  const onPowerChange = useCallback((newLevel: number) => {
    const mapped = POWER_LEVEL_MAP[newLevel] ?? newLevel;

    // If the overlay is already up, just bump the displayed number and
    // reset the hide timer — no flash, no duplicate transition.
    if (showingRef.current) {
      setDisplayValue(mapped);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setVisible(false);
        showingRef.current = false;
      }, VISIBLE_DURATION_MS);
      return;
    }

    // Fresh trigger: show the overlay.
    setDisplayValue(mapped);
    setVisible(true);
    showingRef.current = true;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setVisible(false);
      showingRef.current = false;
    }, VISIBLE_DURATION_MS);
  }, []);

  // ── Subscribe to the Zustand store directly ─────────────────────
  // This runs on EVERY store mutation, not just when the React selector
  // would report a changed value.  We do our own edge detection here.
  useEffect(() => {
    // Seed the ref with whatever is already in the store on mount.
    const initial = useSignalStore.getState().signals['ecu_power_level']?.value ?? 0;
    lastLevelRef.current = initial;

    console.log('[PowerOverlay] mounted — initial ecu_power_level =', initial);

    // Vanilla Zustand subscribe — fires synchronously after every
    // setSignal call, before React has a chance to batch anything.
    const unsub = useSignalStore.subscribe((state, prevState) => {
      const newLevel = state.signals['ecu_power_level']?.value;
      const oldLevel = prevState.signals['ecu_power_level']?.value;

      // Not our signal, or value hasn't changed — skip.
      if (newLevel === undefined || newLevel === oldLevel) return;

      // Edge detected! Update our ref and fire the overlay logic.
      lastLevelRef.current = newLevel;
      onPowerChange(newLevel);
    });

    return () => {
      unsub();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [onPowerChange]);

  return (
    <div
      aria-hidden={!visible}
      className={`pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-black/80 transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="relative flex items-center justify-center">
        {powerImg && (
          <img src={powerImg} alt="Power level" className="max-h-full max-w-full object-contain" />
        )}
        <span className="absolute text-9xl font-black text-white tabular-nums drop-shadow-[0_0_20px_rgba(0,0,0,0.8)]">
          {displayValue}
        </span>
      </div>
    </div>
  );
}
