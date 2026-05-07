import { useEffect, useRef } from 'react';
import { useSignalStore } from '../store/signals';
import { useConfigStore } from '../store/config';

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
//
// WS URL + vehicle id come from useConfigStore so they can be edited
// from the in-app Settings modal (or by hand in userData/config.json)
// without rebuilding the dash. The effect's deps include both, so a
// config change cleanly tears the old WS down and re-subscribes.
export function useSignals(signalNames: readonly string[]): void {
  const setSignal = useSignalStore((s) => s.setSignal);
  const setConnected = useSignalStore((s) => s.setConnected);
  const wsUrl = useConfigStore((s) => s.wsUrl);
  const vehicleId = useConfigStore((s) => s.vehicleId);
  const configLoaded = useConfigStore((s) => s.loaded);

  // join inside the effect deps so a re-arranged signal list re-subscribes.
  const namesKey = signalNames.join(',');
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Don't open a WS until the config is loaded — otherwise we'd connect
    // with whatever defaults are baked in, then immediately reconnect when
    // the real config arrives.
    if (!configLoaded) return;

    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (cancelled) return;
      const url = `${wsUrl}?vehicle_id=${vehicleId}&signals=${namesKey}`;
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
  }, [namesKey, wsUrl, vehicleId, configLoaded, setSignal, setConnected]);
}
