import { useEffect } from 'react';
import { useSignalStore } from '../store/signals';

const SSE_URL = import.meta.env.VITE_LIVE_SSE_URL ?? 'http://localhost:7015/live/sse';
export const VEHICLE_ID = import.meta.env.VITE_GR26_VEHICLE_ID ?? 'gr26';

interface IncomingSignal {
  name: string;
  value: number;
  raw_value: number;
  timestamp: number;
  produced_at: string;
}

// Connects to the live service's SSE endpoint and pushes every incoming
// signal into the Zustand store. EventSource handles reconnection
// automatically (~3s linear backoff per the browser default), so we
// don't need our own retry loop.
//
// The endpoint emits two event types:
//   - `backfill` (sent once at connect): cached signals as a JSON array.
//     We intentionally ignore these — on-car the live service has just
//     started up, so there's nothing meaningful to backfill from anyway.
//   - `signal`  (per live update): one Signal object.
//
// We only listen for `signal`. The `?backfill=...` query param is
// omitted so the initial backfill event is empty anyway.
export function useSignals(signalNames: readonly string[]): void {
  const setSignal = useSignalStore((s) => s.setSignal);
  const setConnected = useSignalStore((s) => s.setConnected);

  // join inside the effect deps so a re-arranged signal list re-subscribes.
  const namesKey = signalNames.join(',');

  useEffect(() => {
    const params = new URLSearchParams({
      vehicle_id: VEHICLE_ID,
      signals: namesKey,
    });
    const url = `${SSE_URL}?${params.toString()}`;
    const es = new EventSource(url);

    es.addEventListener('open', () => {
      console.log('[live] connected to', url);
      setConnected(true);
    });

    es.addEventListener('signal', (e) => {
      try {
        const sig = JSON.parse((e as MessageEvent).data) as IncomingSignal;
        setSignal(sig.name, {
          value: sig.value,
          rawValue: sig.raw_value,
          timestamp: sig.timestamp,
          producedAt: sig.produced_at,
          // Stamp dash-local receive time here so freshness checks don't
          // depend on clock sync between dash and live service.
          receivedAt: Date.now(),
        });
      } catch (err) {
        console.warn('[live] bad signal payload', err, (e as MessageEvent).data);
      }
    });

    // We don't subscribe to `backfill` — the live service will have just
    // started up on-car, so there's nothing to retro-fill the dash with.

    es.addEventListener('error', () => {
      // EventSource auto-retries with backoff; we just reflect the
      // disconnect in the store so the LOCAL row drops to "down".
      setConnected(false);
    });

    return () => {
      es.close();
    };
  }, [namesKey, setSignal, setConnected]);
}
