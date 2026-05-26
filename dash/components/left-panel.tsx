"use client";

interface LeftPanelProps {
  motorTemp: number;
  inverterTemp: number;
  ecuDelay: number;
}

export function LeftPanel({ motorTemp, inverterTemp, ecuDelay }: LeftPanelProps) {
  return (
    <div className="flex flex-col gap-3 text-left">
      <div>
        <div className="text-zinc-400 text-xs uppercase tracking-wide">Motor Temp</div>
        <div className="text-yellow-400 text-2xl font-bold">{motorTemp}°C</div>
      </div>
      <div>
        <div className="text-zinc-400 text-xs uppercase tracking-wide">Inverter Temp</div>
        <div className="text-blue-400 text-2xl font-bold">{inverterTemp}°C</div>
      </div>
      <div>
        <div className="text-zinc-400 text-xs uppercase tracking-wide">ECU Delay</div>
        <div className="text-green-400 text-2xl font-bold">{ecuDelay}s</div>
      </div>
    </div>
  );
}
