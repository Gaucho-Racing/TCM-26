"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { buildTelemetryData, type SignalMap } from "@/lib/gr26-adapter";
import { DEFAULT_TELEMETRY, type TelemetryData } from "@/types/telemetry";

const WS_URL = process.env.NEXT_PUBLIC_TELEMETRY_WS_URL ?? "ws://localhost:8001/gr26/live";
const VEHICLE_ID = process.env.NEXT_PUBLIC_GR26_VEHICLE_ID ?? "gr26";
const REFRESH_RATE_HZ = Number(process.env.NEXT_PUBLIC_GR26_REFRESH_RATE_HZ ?? "30");
const STALE_AFTER_MS = Number(process.env.NEXT_PUBLIC_GR26_STALE_AFTER_MS ?? "2500");
const RECONNECT_BASE_MS = Number(process.env.NEXT_PUBLIC_GR26_RECONNECT_MS ?? "1000");
const RECONNECT_MAX_MS = 8000;

const SUBSCRIBED_SIGNALS = [
  "ecu_ecu_state",
  "ecu_vehicle_speed",
  "ecu_accumulator_soc",
  "ecu_glv_soc",
  "ecu_max_cell_temp",
  "ecu_relay_states",
  "ecu_led_bms",
  "ecu_led_imd",
  "ecu_led_bspd",
  "ecu_led_bms_latch",
  "ecu_led_imd_latch",
  "ecu_led_bspd_latch",
  "ecu_glv_voltage",
  "inverter_motor_temp",
  "inverter_inverter_temp",
] as const;

interface IncomingSignal {
  name: string;
  value: number | string | boolean;
  timestamp?: number;
}

const toNumber = (value: IncomingSignal["value"]): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const parseMessage = (raw: string): IncomingSignal[] => {
  const parsed: unknown = JSON.parse(raw);

  if (Array.isArray(parsed)) {
    return parsed.filter(
      (entry): entry is IncomingSignal =>
        typeof entry === "object" &&
        entry !== null &&
        "name" in entry &&
        "value" in entry &&
        typeof (entry as { name: unknown }).name === "string",
    );
  }

  if (
    typeof parsed === "object" &&
    parsed !== null &&
    "name" in parsed &&
    "value" in parsed &&
    typeof (parsed as { name: unknown }).name === "string"
  ) {
    return [parsed as IncomingSignal];
  }

  return [];
};

export function useGr26Telemetry(): TelemetryData {
  const [signals, setSignals] = useState<SignalMap>({});
  const [connected, setConnected] = useState(false);
  const [lastRawSummary, setLastRawSummary] = useState(DEFAULT_TELEMETRY.debugFDMessage);
  const [lastMessageAt, setLastMessageAt] = useState(0);
  const [nowMs, setNowMs] = useState(Date.now());
  const reconnectAttemptRef = useRef(0);

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let socket: WebSocket | null = null;

    const namesKey = SUBSCRIBED_SIGNALS.join(",");

    const connect = () => {
      if (cancelled) return;

      const url = `${WS_URL}?vehicle_id=${VEHICLE_ID}&signals=${namesKey}&rate=${REFRESH_RATE_HZ}`;
      socket = new WebSocket(url);

      socket.addEventListener("open", () => {
        reconnectAttemptRef.current = 0;
        setConnected(true);
      });

      socket.addEventListener("message", (event) => {
        try {
          const receivedAt = Date.now();
          const decoded = parseMessage(event.data);
          if (decoded.length === 0) return;

          setSignals((previous) => {
            const next = { ...previous };
            for (const entry of decoded) {
              const numericValue = toNumber(entry.value);
              if (numericValue === null) continue;
              next[entry.name] = { value: numericValue, receivedAt };
            }
            return next;
          });

          setLastMessageAt(receivedAt);
          const compact = event.data.replace(/\s+/g, " ").slice(0, 140);
          setLastRawSummary(compact || DEFAULT_TELEMETRY.debugFDMessage);
        } catch {
          setLastRawSummary("Parse error from telemetry stream");
        }
      });

      const scheduleReconnect = () => {
        setConnected(false);
        if (cancelled) return;
        reconnectAttemptRef.current += 1;
        const delay = Math.min(
          RECONNECT_BASE_MS * reconnectAttemptRef.current,
          RECONNECT_MAX_MS,
        );
        reconnectTimer = window.setTimeout(connect, delay);
      };

      socket.addEventListener("close", scheduleReconnect);
      socket.addEventListener("error", () => {
        try {
          socket?.close();
        } catch {
          // Ignore close failure; close handler still handles reconnect.
        }
      });
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      try {
        socket?.close();
      } catch {
        // No-op: unmount cleanup path.
      }
    };
  }, []);

  const stale = lastMessageAt === 0 ? false : nowMs - lastMessageAt > STALE_AFTER_MS;

  return useMemo(
    () =>
      buildTelemetryData({
        signals,
        connected,
        stale,
        lastMessageSummary: lastRawSummary,
        nowMs,
      }),
    [connected, lastRawSummary, nowMs, signals, stale],
  );
}
