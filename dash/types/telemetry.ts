export interface TelemetryData {
  speed: number; // km/h
  maxSpeed: number;
  stateOfCharge: {
    accumulator: number; // percentage
    glv: number; // percentage
  };
  ecuState: "IDLE" | "READY" | "RUNNING" | "ERROR" | "CHARGING";
  maxCellTemp: number; // Celsius
  // Extended data for detailed view
  motorTemp: number; // Celsius
  inverterTemp: number; // Celsius
  ecuDelay: number; // seconds
  glvVoltage: number; // Volts
  brakeCheck: string; // Status message
  // Debug data
  debugVersion: string;
  debugMessage: string;
  // Debug FD data
  debugFDMessage: string;
}

export const DEFAULT_MAX_SPEED_KMH = 70;

export const DEFAULT_TELEMETRY: TelemetryData = {
  speed: 0,
  maxSpeed: DEFAULT_MAX_SPEED_KMH,
  stateOfCharge: {
    accumulator: 0,
    glv: 0,
  },
  ecuState: "IDLE",
  maxCellTemp: 0,
  // Extended data
  motorTemp: 0,
  inverterTemp: 0,
  ecuDelay: 0,
  glvVoltage: 12.0,
  brakeCheck: "CHECK",
  // Debug data
  debugVersion: "live-ws-v1",
  debugMessage: "Waiting for telemetry",
  // Debug FD data
  debugFDMessage: "No message",
};

export const DUMMY_TELEMETRY: TelemetryData = {
  speed: 34.6,
  maxSpeed: 70,
  stateOfCharge: {
    accumulator: 75,
    glv: 52,
  },
  ecuState: "IDLE",
  maxCellTemp: 47.2,
  // Extended data
  motorTemp: 42,
  inverterTemp: 26,
  ecuDelay: 3.1,
  glvVoltage: 8.1,
  brakeCheck: "No pressure on left",
  // Debug data
  debugVersion: "2.0",
  debugMessage: "Hello GR!",
  // Debug FD data
  debugFDMessage: "P* Brake fluid\nmay be low",
};
