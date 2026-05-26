import { InfoCard } from "./info-card";
import { TelemetryData } from "@/types/telemetry";

interface ECUStateProps {
  state: TelemetryData["ecuState"];
}

export function ECUState({ state }: ECUStateProps) {
  const stateColors: Record<TelemetryData["ecuState"], string> = {
    IDLE: "text-blue-400",
    READY: "text-green-400",
    RUNNING: "text-emerald-400",
    ERROR: "text-red-400",
    CHARGING: "text-yellow-400",
  };

  return (
    <InfoCard title="ECU State">
      <span className={`text-xl font-bold ${stateColors[state]}`}>{state}</span>
    </InfoCard>
  );
}
