"use client";

import { useState, useEffect } from "react";
import { TelemetryData } from "@/types/telemetry";
import { Speedometer } from "./speedometer";
import { StateOfCharge } from "./state-of-charge";
import { ECUState } from "./ecu-state";
import { MaxCellTemp } from "./max-cell-temp";
import { LeftPanel } from "./left-panel";
import { RightPanel } from "./right-panel";
import { DebugView } from "./debug-view";
import { DebugFDView } from "./debug-fd-view";

interface TelemetryDashboardProps {
  data: TelemetryData;
}

export function TelemetryDashboard({ data }: TelemetryDashboardProps) {
  const [showDetailedView, setShowDetailedView] = useState(false);
  const [showDebugView, setShowDebugView] = useState(false);
  const [showDebugFDView, setShowDebugFDView] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        setShowDetailedView(true);
      } else if (event.key === "ArrowLeft") {
        setShowDetailedView(false);
      } else if (event.key === "a" || event.key === "A") {
        setShowDebugView((prev) => !prev);
      } else if (event.key === "b" || event.key === "B") {
        setShowDebugFDView((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="bg-zinc-950 rounded-2xl p-6 w-full max-w-[1600px] min-h-[600px] mx-auto border border-zinc-800 flex flex-col justify-between">
      {/* Main Content Area */}
      <div className="grid grid-cols-[400px_minmax(0,1fr)_400px] items-start gap-4 flex-1">
        {/* Left Panel - only visible in detailed view */}
        <div className={`transition-opacity duration-300 self-start ${showDetailedView ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
          <LeftPanel
            motorTemp={data.motorTemp}
            inverterTemp={data.inverterTemp}
            ecuDelay={data.ecuDelay}
          />
        </div>

        {/* Center - Speedometer or Debug Views */}
        <div className="flex-1 flex justify-center items-center">
          {showDebugFDView ? (
            <DebugFDView
              speed={data.speed}
              ecuState={data.ecuState}
              debugFDMessage={data.debugFDMessage}
            />
          ) : showDebugView ? (
            <DebugView
              speed={data.speed}
              debugVersion={data.debugVersion}
              debugMessage={data.debugMessage}
            />
          ) : (
            <Speedometer speed={data.speed} maxSpeed={data.maxSpeed} />
          )}
        </div>

        {/* Right Panel - only visible in detailed view */}
        <div className={`transition-opacity duration-300 self-start justify-self-end ${showDetailedView ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
          <RightPanel
            glvVoltage={data.glvVoltage}
            brakeCheck={data.brakeCheck}
          />
        </div>
      </div>

      {/* Info Cards Row */}
      <div className="flex justify-center gap-6 flex-wrap mt-6">
        <StateOfCharge
          accumulator={data.stateOfCharge.accumulator}
          glv={data.stateOfCharge.glv}
        />
        <ECUState state={data.ecuState} />
        <MaxCellTemp temperature={data.maxCellTemp} />
      </div>

      {/* Page indicator dots */}
      <div className="flex justify-center gap-2 mt-4">
        <div className={`w-2 h-2 rounded-full transition-colors ${!showDetailedView ? "bg-white" : "bg-zinc-600"}`} />
        <div className={`w-2 h-2 rounded-full transition-colors ${showDetailedView ? "bg-white" : "bg-zinc-600"}`} />
      </div>
    </div>
  );
}
