/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GR26_WS_URL?: string;
  readonly VITE_GR26_VEHICLE_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Bridge exposed by src/preload/index.ts. Available on the renderer's
// `window` once the preload script has loaded.
interface DashConfigBridge {
  get: () => Promise<{ wsUrl: string; vehicleId: string }>;
  set: (next: {
    wsUrl: string;
    vehicleId: string;
  }) => Promise<{ wsUrl: string; vehicleId: string }>;
}

interface Window {
  dashConfig?: DashConfigBridge;
}
