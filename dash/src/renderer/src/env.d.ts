/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LIVE_SSE_URL?: string;
  readonly VITE_GR26_VEHICLE_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
