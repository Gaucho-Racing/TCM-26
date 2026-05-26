"use client";

interface SpeedometerProps {
  speed: number;
  maxSpeed: number;
}

export function Speedometer({ speed, maxSpeed }: SpeedometerProps) {
  // Calculate the angle for the speed indicator (180 degrees = full arc)
  const percentage = Math.min(speed / maxSpeed, 1);
  const angle = -90 + percentage * 180; // -90 is start (left), 90 is end (right)

  // Generate tick marks - evenly spaced at intervals of 14
  const ticks = [0, 14, 28, 42, 56, 70];

  return (
    <div className="relative w-full max-w-[400px] aspect-[2/1]">
      <svg viewBox="0 0 200 110" className="w-full h-full">
        {/* Background arc */}
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="#374151"
          strokeWidth="16"
          strokeLinecap="round"
        />

        {/* Speed arc (orange/red gradient effect) */}
        <defs>
          <linearGradient id="speedGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
        </defs>
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="url(#speedGradient)"
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={`${percentage * 251.2} 251.2`}
        />

        {/* Tick marks and labels */}
        {ticks.map((tick, index) => {
          const tickAngle = -180 + (tick / maxSpeed) * 180;
          const radians = (tickAngle * Math.PI) / 180;
          const innerRadius = 62;
          const outerRadius = 70;
          const labelRadius = 52;

          const x1 = 100 + innerRadius * Math.cos(radians);
          const y1 = 100 + innerRadius * Math.sin(radians);
          const x2 = 100 + outerRadius * Math.cos(radians);
          const y2 = 100 + outerRadius * Math.sin(radians);
          const labelX = 100 + labelRadius * Math.cos(radians);
          const labelY = 100 + labelRadius * Math.sin(radians);

          return (
            <g key={index}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#9ca3af"
                strokeWidth="2"
              />
              <text
                x={labelX}
                y={labelY}
                fill="#9ca3af"
                fontSize="8"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {tick}
              </text>
            </g>
          );
        })}

        {/* Speed value */}
        <text
          x="100"
          y="85"
          fill="white"
          fontSize="24"
          fontWeight="bold"
          textAnchor="middle"
        >
          {speed.toFixed(1)}
        </text>

        {/* Unit */}
        <text
          x="100"
          y="100"
          fill="#9ca3af"
          fontSize="10"
          textAnchor="middle"
        >
          km/h
        </text>
      </svg>
    </div>
  );
}
