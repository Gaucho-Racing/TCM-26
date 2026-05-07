import { contextBridge, ipcRenderer } from 'electron';

// Bridge a tiny config API to the renderer. The renderer reads/writes the
// dash's runtime config (vehicle id + WebSocket URL) via these calls;
// everything else stays direct over WebSocket.
export interface DashConfig {
  wsUrl: string;
  vehicleId: string;
}

contextBridge.exposeInMainWorld('dashConfig', {
  get: (): Promise<DashConfig> => ipcRenderer.invoke('dash-config:get'),
  set: (next: DashConfig): Promise<DashConfig> => ipcRenderer.invoke('dash-config:set', next),
});
