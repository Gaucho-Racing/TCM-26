import { useSignalStore } from '../store/signals';
import { TOTAL_CELLS, cellVoltageColor } from '../lib/cells';

// Bottom strip showing every cell as a vertical bar — width fills the full
// 1600px display, ~10px per cell. Bar height encodes voltage (mapped 2.5–4.2V
// to the strip height); color encodes the same value so faults pop.
export function CellStrip() {
  // Subscribe to the whole signals object — bars need to update together.
  const signals = useSignalStore((s) => s.signals);

  const cells: number[] = [];
  let activeCount = 0;
  for (let i = 0; i < TOTAL_CELLS; i++) {
    const v = signals[`bcu_cell_${i}_voltage`]?.value ?? 0;
    cells.push(v);
    if (v > 0) activeCount = i + 1;
  }
  const visible = cells.slice(0, Math.max(activeCount, 1));

  return (
    <div className="bg-neutral-925 flex h-full items-end gap-[2px] overflow-hidden border-t border-neutral-900 px-3 py-2">
      {visible.map((v, i) => (
        <CellBar key={i} v={v} />
      ))}
    </div>
  );
}

function CellBar({ v }: { v: number }) {
  // Map 2.5–4.2V to 10–100% bar height. Anything below 2.5V renders as a
  // minimum stub so empty cells are visible as gaps.
  const min = 2.5;
  const max = 4.2;
  const pct = v <= 0 ? 0 : Math.max(10, Math.min(100, ((v - min) / (max - min)) * 100));
  return (
    <div className="flex h-full flex-1 items-end">
      <div
        className={`w-full rounded-sm transition-all duration-300 ease-out ${cellVoltageColor(v)}`}
        style={{ height: `${pct}%` }}
        title={v > 0 ? `${v.toFixed(2)}V` : 'inactive'}
      />
    </div>
  );
}
