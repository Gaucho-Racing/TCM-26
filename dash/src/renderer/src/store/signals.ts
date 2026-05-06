import { create } from 'zustand';

export interface Signal {
  value: number;
  rawValue: number;
  timestamp: number;
  producedAt: string;
}

interface SignalStore {
  // Map of signal name -> latest value. Updated on every WS message.
  signals: Record<string, Signal>;
  setSignal: (name: string, signal: Signal) => void;

  // WebSocket connection status.
  connected: boolean;
  setConnected: (c: boolean) => void;

  // Selector helper: returns the value or `fallback` if the signal hasn't
  // arrived yet. Use this in components to avoid undefined checks everywhere.
  get: (name: string, fallback?: number) => number;
}

export const useSignalStore = create<SignalStore>((set, getState) => ({
  signals: {},
  setSignal: (name, signal) =>
    set((state) => ({
      signals: { ...state.signals, [name]: signal },
    })),

  connected: false,
  setConnected: (c) => set({ connected: c }),

  get: (name, fallback = 0) => getState().signals[name]?.value ?? fallback,
}));

// Selector hook — subscribe to one signal by name. The component re-renders
// only when that specific signal changes (not on every store update).
export function useSignal(name: string, fallback = 0): number {
  return useSignalStore((s) => s.signals[name]?.value ?? fallback);
}
