import { TelemetryData } from "@/types/telemetry";

interface DebugFDViewProps {
  speed: number;
  ecuState: TelemetryData["ecuState"];
  debugFDMessage: string;
}

export function DebugFDView({ speed, ecuState, debugFDMessage }: DebugFDViewProps) {
  return (
    <div className="flex flex-col items-center">
      {/* Top row with Speed and ECU State */}
      <div className="flex justify-center gap-8 mb-4">
        <div className="text-center">
          <span className="text-zinc-400 text-sm">Speed</span>
          <div className="text-yellow-400 text-lg font-bold">{speed} km/hr</div>
        </div>
        <div className="text-center">
          <span className="text-zinc-400 text-sm">ECU State</span>
          <div className="text-blue-400 text-lg font-bold">{ecuState}</div>
        </div>
      </div>

      {/* Debug FD Console */}
      <div className="border-2 border-blue-600 rounded-lg p-4 min-w-[180px] min-h-[100px]">
        <div className="text-purple-500 font-bold text-lg mb-2">Debug FD</div>
        <div className="text-yellow-400 text-sm whitespace-pre-line">{debugFDMessage}</div>
      </div>
    </div>
  );
}
