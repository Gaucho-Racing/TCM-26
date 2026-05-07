import { useEffect, useRef } from 'react';
import { useSignalStore } from '../store/signals';

const WS_URL = import.meta.env.VITE_GR26_WS_URL ?? 'ws://localhost:8001/gr26/live';
const VEHICLE_ID = import.meta.env.VITE_GR26_VEHICLE_ID ?? 'gr26';

// Cap the per-signal update rate at the gr26 ingest layer so the dash
// doesn't drown in cell signal updates. Without this, ~5 BCU cell data
// CAN IDs at 50Hz × 32 cells × 2 (volt+temp) = ~16k signal events per
// second, far more than React + Zustand can absorb. Buffers (gr26 send
// chan, kernel TCP, browser WS recv) fill up and drain slowly when the
// source stops — symptom: dash keeps "updating" for ~20s after the CAN
// bus goes quiet.
//
// The gr26 ingest's `rate` query param coalesces per signal-name on a
// ticker, so we only get the latest value per signal at the chosen
// frequency. 30 Hz is faster than the eye can really tell on a 1600x600
// panel and small enough to keep the renderer caught up.
const REFRESH_RATE_HZ = 30;

interface IncomingSignal {
  name: string;
  value: number;
  raw_value: number;
  timestamp: number;
  produced_at: string;
}

// Connects to the local gr26 ingest WebSocket and pushes every incoming
// signal into the Zustand store. Auto-reconnects on disconnect with simple
// linear backoff. Drop the hook into App once and let components read
// signals from the store via `useSignal`.
export function useSignals(signalNames: readonly string[]): void {
  const setSignal = useSignalStore((s) => s.setSignal);
  const setConnected = useSignalStore((s) => s.setConnected);

  // join inside the effect deps so a re-arranged signal list re-subscribes.
  const namesKey = signalNames.join(',');
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (cancelled) return;
      const url = `${WS_URL}?vehicle_id=${VEHICLE_ID}&signals=${namesKey}&rate=${REFRESH_RATE_HZ}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.addEventListener('open', () => {
        console.log('[gr26] connected to', url);
        setConnected(true);
      });

      ws.addEventListener('message', (e) => {
        try {
          const sig = JSON.parse(e.data) as IncomingSignal;
          setSignal(sig.name, {
            value: sig.value,
            rawValue: sig.raw_value,
            timestamp: sig.timestamp,
            producedAt: sig.produced_at,
            // Stamp dash-local receive time here so freshness checks
            // don't depend on clock sync between dash and relay.
            receivedAt: Date.now(),
          });
        } catch (err) {
          console.warn('[gr26] bad message', err, e.data);
        }
      });

      const scheduleReconnect = () => {
        setConnected(false);
        if (cancelled) return;
        reconnectTimer = setTimeout(connect, 2000);
      };

      ws.addEventListener('close', scheduleReconnect);
      ws.addEventListener('error', () => {
        // close will fire after error; let it handle reconnect
        try {
          ws.close();
        } catch {
          /* ignore */
        }
      });
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try {
        wsRef.current?.close();
      } catch {
        /* ignore */
      }
    };
  }, [namesKey, setSignal, setConnected]);
}
