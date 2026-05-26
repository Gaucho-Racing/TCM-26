import { InfoCard } from "./info-card";

interface StateOfChargeProps {
  accumulator: number;
  glv: number;
}

export function StateOfCharge({ accumulator, glv }: StateOfChargeProps) {
  return (
    <InfoCard title="State of Charge">
      <div className="space-y-1 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-zinc-400">Accumulator</span>
          <span className="text-yellow-400 font-bold">{accumulator}%</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-zinc-400">GLV</span>
          <span className="text-green-400 font-bold">{glv}%</span>
        </div>
      </div>
    </InfoCard>
  );
}
