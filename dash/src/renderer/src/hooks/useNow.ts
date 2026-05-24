import { useEffect, useState } from 'react';

/**
 * 4 Hz tick so staleness badges + age rows update even when no new
 * signals are arriving (otherwise they'd freeze at the moment of the
 * last incoming message).
 */
export function useNow(intervalMs: number = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
