import { useState } from 'react';
import { useConfigStore } from '../store/config';

// Modal for editing the dash's runtime config (WebSocket URL + vehicle ID).
// Opened by clicking the gear in the corner of the dash; saving persists
// to userData/config.json via the preload bridge and the Zustand store
// updates trigger useSignals to reconnect with the new values.
export function Settings({ onClose }: { onClose: () => void }) {
  const wsUrl = useConfigStore((s) => s.wsUrl);
  const vehicleId = useConfigStore((s) => s.vehicleId);
  const save = useConfigStore((s) => s.save);

  const [draftUrl, setDraftUrl] = useState(wsUrl);
  const [draftVehicleId, setDraftVehicleId] = useState(vehicleId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = draftUrl !== wsUrl || draftVehicleId !== vehicleId;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await save({ wsUrl: draftUrl, vehicleId: draftVehicleId });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  };

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-[480px] rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-lg font-black tracking-widest text-neutral-100 uppercase">
            Settings
          </h2>
          <button
            onClick={onClose}
            className="text-xs tracking-widest text-neutral-500 uppercase hover:text-neutral-300"
          >
            close
          </button>
        </div>

        <Field
          label="Vehicle ID"
          hint="Must match the relay's VEHICLE_ID env (e.g., gr26, gr26-dev)"
        >
          <input
            value={draftVehicleId}
            onChange={(e) => setDraftVehicleId(e.target.value)}
            className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono text-sm text-neutral-100 outline-none focus:border-cyan-400"
            placeholder="gr26"
          />
        </Field>

        <Field
          label="WebSocket URL"
          hint="Local gr26 ingest. Default: ws://localhost:8001/gr26/live"
        >
          <input
            value={draftUrl}
            onChange={(e) => setDraftUrl(e.target.value)}
            className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono text-sm text-neutral-100 outline-none focus:border-cyan-400"
            placeholder="ws://localhost:8001/gr26/live"
          />
        </Field>

        {error && (
          <div className="mt-3 rounded-md border border-red-500/50 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="rounded-md bg-cyan-500 px-4 py-2 text-sm font-bold text-neutral-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <label className="mb-1 block text-[10px] font-bold tracking-[0.3em] text-neutral-400 uppercase">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-neutral-500">{hint}</p>}
    </div>
  );
}

// Floating gear button. Small, low-contrast — the driver isn't supposed to
// notice it, but it's there for a tech with a mouse plugged in.
export function SettingsTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="absolute top-2 right-2 z-40 rounded-full border border-neutral-800 bg-neutral-900/60 px-2 py-1 text-[10px] tracking-widest text-neutral-500 uppercase transition-colors hover:border-neutral-700 hover:text-neutral-300"
      aria-label="Settings"
    >
      ⚙ Settings
    </button>
  );
}
