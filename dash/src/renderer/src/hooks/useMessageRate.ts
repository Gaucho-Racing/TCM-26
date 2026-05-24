import { useRef } from 'react';
import { useSignalStore } from '../store/signals';
import { useNow } from './useNow';

/**
 * Rolling messages-per-second counter. Updates once per second from the
 * useNow tick, so it's cheap and stable on screen.
 */
export function useMessageRate(): number {
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
