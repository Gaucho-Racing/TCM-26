// Number of cells in the accumulator. The GRCAN spec defines five 64-byte
// Cell Data messages, each carrying 32 cells (voltage + temp pairs), for a
// theoretical max of 160 cells. Most packs use far fewer — show as many as
// have non-zero readings.
export const TOTAL_CELLS = 160;

// Pre-compose the signal names so we can spread them into the subscribe list.
export const CELL_SIGNALS: string[] = (() => {
  const names: string[] = [];
  for (let i = 0; i < TOTAL_CELLS; i++) {
    names.push(`bcu_cell_${i}_voltage`);
    names.push(`bcu_cell_${i}_temp`);
  }
  return names;
})();

// Color tier for a cell voltage (Volts). Tune to actual operating range.
export function cellVoltageColor(v: number): string {
  if (v <= 0) return 'bg-neutral-800';
  if (v < 3.0) return 'bg-red-500';
  if (v < 3.4) return 'bg-amber-500';
  if (v > 4.15) return 'bg-orange-500';
  return 'bg-emerald-500';
}
