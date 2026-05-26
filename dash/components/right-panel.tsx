"use client";

interface RightPanelProps {
  glvVoltage: number;
  brakeCheck: string;
}

export function RightPanel({ glvVoltage, brakeCheck }: RightPanelProps) {
  return (
    <div className="flex flex-col gap-3 text-right">
      <div>
        <div className="text-zinc-400 text-xs uppercase tracking-wide">GLV Voltage</div>
        <div className="text-yellow-400 text-2xl font-bold">{glvVoltage}V</div>
      </div>
      <div>
        <div className="text-zinc-400 text-xs uppercase tracking-wide">Brake Check</div>
        <div className="text-red-500 text-lg font-bold leading-tight">{brakeCheck}</div>
      </div>
    </div>
  );
}
