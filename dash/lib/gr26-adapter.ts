import { DEFAULT_MAX_SPEED_KMH, DEFAULT_TELEMETRY, type TelemetryData } from "@/types/telemetry";

export interface SignalSample {
  value: number;
  receivedAt: number;
}

export type SignalMap = Record<string, SignalSample>;

export interface TelemetryBuildInput {
  signals: SignalMap;
  connected: boolean;
  stale: boolean;
  lastMessageSummary: string;
  nowMs: number;
}

const MPH_TO_KMH = 1.60934;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const pickSignal = (signals: SignalMap, name: string): number | null => {
  const entry = signals[name];
  return entry ? entry.value : null;
};

const numberOr = (value: number | null, fallback: number): number =>
  value === null || Number.isNaN(value) ? fallback : value;

const decodeEcuState = (rawValue: number | null): TelemetryData["ecuState"] => {
  if (rawValue === null) return DEFAULT_TELEMETRY.ecuState;
  switch (Math.trunc(rawValue)) {
    case 0:
      return "IDLE";
    case 1:
      return "READY";
    case 2:
      return "RUNNING";
    case 3:
      return "CHARGING";
    default:
      return "ERROR";
  }
};

const toFaultLabel = (signals: SignalMap): string => {
  const bms = numberOr(pickSignal(signals, "ecu_led_bms"), 0) > 0;
  const imd = numberOr(pickSignal(signals, "ecu_led_imd"), 0) > 0;
  const bspd = numberOr(pickSignal(signals, "ecu_led_bspd"), 0) > 0;
  const bmsLatch = numberOr(pickSignal(signals, "ecu_led_bms_latch"), 0) > 0;
  const imdLatch = numberOr(pickSignal(signals, "ecu_led_imd_latch"), 0) > 0;
  const bspdLatch = numberOr(pickSignal(signals, "ecu_led_bspd_latch"), 0) > 0;

  const faults: string[] = [];
  if (bms || bmsLatch) faults.push("BMS");
  if (imd || imdLatch) faults.push("IMD");
  if (bspd || bspdLatch) faults.push("BSPD");

  if (faults.length === 0) return "OK";
  return `FAULT ${faults.join("/")}`;
};

export function buildTelemetryData(input: TelemetryBuildInput): TelemetryData {
  const { signals, connected, stale, lastMessageSummary, nowMs } = input;

  const speedMph = numberOr(pickSignal(signals, "ecu_vehicle_speed"), 0);
  const accumulatorSoc = clamp(numberOr(pickSignal(signals, "ecu_accumulator_soc"), 0), 0, 100);
  const glvSoc = clamp(numberOr(pickSignal(signals, "ecu_glv_soc"), 0), 0, 100);

  const maxCellTemp = numberOr(pickSignal(signals, "ecu_max_cell_temp"), 0);
  const motorTemp = numberOr(pickSignal(signals, "inverter_motor_temp"), maxCellTemp);
  const inverterTemp = numberOr(pickSignal(signals, "inverter_inverter_temp"), maxCellTemp - 5);
  const glvVoltage = numberOr(pickSignal(signals, "ecu_glv_voltage"), 11.0 + glvSoc * 0.02);

  const mostRecent = Object.values(signals).reduce<number>(
    (latest, sample) => Math.max(latest, sample.receivedAt),
    0,
  );
  const ecuDelay = mostRecent > 0 ? Math.max(0, (nowMs - mostRecent) / 1000) : 0;

  const connectionState = connected ? (stale ? "STALE" : "CONNECTED") : "RECONNECTING";
  const brakeCheck = !connected || stale ? "CHECK" : toFaultLabel(signals);

  return {
    speed: speedMph * MPH_TO_KMH,
    maxSpeed: DEFAULT_MAX_SPEED_KMH,
    stateOfCharge: {
      accumulator: accumulatorSoc,
      glv: glvSoc,
    },
    ecuState: decodeEcuState(pickSignal(signals, "ecu_ecu_state")),
    maxCellTemp,
    motorTemp,
    inverterTemp,
    ecuDelay: Number(ecuDelay.toFixed(1)),
    glvVoltage: Number(glvVoltage.toFixed(1)),
    brakeCheck,
    debugVersion: "live-ws-v1",
    debugMessage: `${connectionState} (${Object.keys(signals).length} signals)`,
    debugFDMessage: lastMessageSummary,
  };
}
