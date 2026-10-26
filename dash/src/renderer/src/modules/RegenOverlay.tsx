import { useCallback, useEffect, useRef, useState } from 'react';
import { useSignalStore } from '../store/signals';

// ═══════════════════════════════════════════════════════════════════════
// When  `REGEN_SIGNAL` changes, this component fades a full-screen
// WebP overlay for 2 seconds with the new regen level displayed on top.
//
// Detection uses Zustand's vanilla `subscribe` (NOT the React selector)
// so that every store mutation is seen, regardless of React's render
// batching.  A cooldown ref prevents re-triggering while the overlay
// is already up, which guards against signal bursts from the car's SSE
// relay that could otherwise fire the effect multiple times per tick.
// ═══════════════════════════════════════════════════════════════════════

const REGEN_SIGNAL = 'ecu_regen_ac_i_code';
/** How long the overlay stays visible after the last regen-level change. */
const VISIBLE_DURATION_MS = 2000;

import powerImg from '../assets/powahhh.webp';

export function RegenOverlay() {
  // ── React state (only for rendering) ────────────────────────────
  const [visible, setVisible] = useState(false);
  const [displayValue, setDisplayValue] = useState(0);

  // ── Refs ────────────────────────────────────────────────────────
  // Tracks the last *known* REGEN_SIGNAL so we can detect edges.
  const lastLevelRef = useRef<number | null>(null);
  // "Blocker": true while overlay is visible, suppressing re-triggers.
  const showingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable callback so the subscribe effect doesn't need it as a dep.
  const onRegenChange = useCallback((newLevel: number) => {
    // If the overlay is already up, just bump the displayed number and
    // reset the hide timer — no flash, no duplicate transition.
    if (showingRef.current) {
      setDisplayValue(newLevel);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setVisible(false);
        showingRef.current = false;
      }, VISIBLE_DURATION_MS);
      return;
    }

    // Fresh trigger: show the overlay.
    setDisplayValue(newLevel);
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
    const initial = useSignalStore.getState().signals[REGEN_SIGNAL]?.value ?? 0;
    lastLevelRef.current = initial;

    console.log('[RegenOverlay] mounted — initial ecu_regen_ac_i_code =', initial);

    // Vanilla Zustand subscribe — fires synchronously after every
    // setSignal call, before React has a chance to batch anything.
    const unsub = useSignalStore.subscribe((state, prevState) => {
      const newLevel = state.signals[REGEN_SIGNAL]?.value;
      const oldLevel = prevState.signals[REGEN_SIGNAL]?.value;

      // Not our signal, or value hasn't changed — skip.
      if (newLevel === undefined || newLevel === oldLevel) return;

      // Edge detected! Update our ref and fire the overlay logic.
      lastLevelRef.current = newLevel;
      onRegenChange(newLevel);
    });

    return () => {
      unsub();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [onRegenChange]);

  return (
    <div
      aria-hidden={!visible}
      className={`pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-black/80 transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="relative flex items-center justify-center">
        {powerImg && (
          <img src={powerImg} alt="Regen level" className="max-h-full max-w-full object-contain" />
        )}
        <span className="absolute text-9xl font-black text-white tabular-nums drop-shadow-[0_0_20px_rgba(0,0,0,0.8)]">
          {displayValue}
        </span>
      </div>
    </div>
  );
}
