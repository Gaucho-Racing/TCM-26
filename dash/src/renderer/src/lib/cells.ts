// Number of cells in the accumulator. The GRCAN spec defines five 64-byte
// Cell Data messages, each carrying 32 cells (voltage + temp pairs), for a
// theoretical max of 160 cells. We subscribe to all of them and aggregate.
export const TOTAL_CELLS = 160;

// Pre-compose the per-cell signal names so we can spread them into the
// subscribe list in App.
export const CELL_SIGNALS: string[] = (() => {
  const names: string[] = [];
  for (let i = 0; i < TOTAL_CELLS; i++) {
    names.push(`bcu_cell_${i}_voltage`);
    names.push(`bcu_cell_${i}_temp`);
  }
  return names;
})();

export interface CellAggregates {
  maxVoltage: number;
  minVoltage: number;
  maxTemp: number;
  minTemp: number;
  active: boolean;
}

// Aggregate the cell signals into max/min voltage and temp. Inactive cells
// (raw 0) are ignored so empty slots don't drag the min down to zero.
export function aggregateCells(signals: Record<string, { value: number }>): CellAggregates {
  let maxV = 0;
  let minV = Infinity;
  let maxT = 0;
  let minT = Infinity;
  let any = false;

  for (let i = 0; i < TOTAL_CELLS; i++) {
    const v = signals[`bcu_cell_${i}_voltage`]?.value ?? 0;
    const t = signals[`bcu_cell_${i}_temp`]?.value ?? 0;
    if (v > 0) {
      any = true;
      if (v > maxV) maxV = v;
      if (v < minV) minV = v;
    }
    if (t > 0) {
      if (t > maxT) maxT = t;
      if (t < minT) minT = t;
    }
  }

  return {
    maxVoltage: any ? maxV : 0,
    minVoltage: any && minV !== Infinity ? minV : 0,
    maxTemp: maxT,
    minTemp: minT === Infinity ? 0 : minT,
    active: any,
  };
}
