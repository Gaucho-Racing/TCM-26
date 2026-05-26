"use client";

import { TelemetryDashboard } from "@/components/telemetry-dashboard";
import { useGr26Telemetry } from "@/hooks/use-gr26-telemetry";

export default function Home() {
  const data = useGr26Telemetry();

  return (
    <main className="min-h-screen bg-zinc-950 flex items-center justify-center p-2">
      <TelemetryDashboard data={data} />
    </main>
  );
}
