import { InfoCard } from "./info-card";

interface MaxCellTempProps {
  temperature: number;
}

export function MaxCellTemp({ temperature }: MaxCellTempProps) {
  // Color based on temperature thresholds
  const getColor = (temp: number) => {
    if (temp >= 50) return "text-red-500";
    if (temp >= 40) return "text-red-400";
    if (temp >= 30) return "text-yellow-400";
    return "text-green-400";
  };

  return (
    <InfoCard title="Max Cell Temp">
      <span className={`text-2xl font-bold ${getColor(temperature)}`}>
        {temperature.toFixed(1)}°C
      </span>
    </InfoCard>
  );
}
