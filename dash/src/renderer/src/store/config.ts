import { create } from 'zustand';

// Runtime dash config. Loaded from `userData/config.json` via the preload
// bridge (`window.dashConfig`) at App mount. While loading we hold the
// Vite-baked defaults so other hooks have something sane to render with.
//
// Saving updates both the in-memory store and the JSON file. useSignals
// re-subscribes automatically because wsUrl/vehicleId are in its effect
// deps.

const DEFAULT_WS_URL = import.meta.env.VITE_GR26_WS_URL ?? 'ws://localhost:8001/gr26/live';
const DEFAULT_VEHICLE_ID = import.meta.env.VITE_GR26_VEHICLE_ID ?? 'gr26';

export interface ConfigStore {
  wsUrl: string;
  vehicleId: string;
  // false until the first load() resolves. useSignals waits on this so it
  // doesn't fire a connect with the wrong vehicle id and immediately
  // tear it down a tick later.
  loaded: boolean;

  load: () => Promise<void>;
  save: (next: { wsUrl: string; vehicleId: string }) => Promise<void>;
}

export const useConfigStore = create<ConfigStore>((set) => ({
  wsUrl: DEFAULT_WS_URL,
  vehicleId: DEFAULT_VEHICLE_ID,
  loaded: false,

  load: async () => {
    if (!window.dashConfig) {
      // Running outside Electron (e.g., raw vite preview) — fall back to
      // baked defaults so the renderer is still usable.
      set({ loaded: true });
      return;
    }
    const c = await window.dashConfig.get();
    set({ wsUrl: c.wsUrl, vehicleId: c.vehicleId, loaded: true });
  },

  save: async (next) => {
    if (!window.dashConfig) {
      set({ wsUrl: next.wsUrl, vehicleId: next.vehicleId });
      return;
    }
    const persisted = await window.dashConfig.set(next);
    set({ wsUrl: persisted.wsUrl, vehicleId: persisted.vehicleId });
  },
}));
