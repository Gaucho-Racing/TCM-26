// Color tier helpers reused across the simple dash.

// Battery SoC bar color: red <=15%, amber <=30%, otherwise green.
export function socColor(pct: number): string {
  if (pct <= 15) return 'bg-red-500';
  if (pct <= 30) return 'bg-amber-500';
  return 'bg-emerald-500';
}

// Cell voltage thresholds (Volts). Values outside the typical operating
// window get warning colors so the driver notices.
export function voltageColor(v: number): string {
  if (v <= 0) return 'text-neutral-500';
  if (v < 3.0) return 'text-red-400';
  if (v < 3.4) return 'text-amber-400';
  if (v > 4.15) return 'text-orange-400';
  return 'text-emerald-400';
}

// Cell temp thresholds (Celsius). Tune to actual operating bounds.
export function tempColor(c: number): string {
  if (c <= 0) return 'text-neutral-500';
  if (c >= 55) return 'text-red-400';
  if (c >= 45) return 'text-amber-400';
  return 'text-emerald-400';
}
