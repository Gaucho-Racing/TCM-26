import type { ReactNode } from 'react';
import { create } from 'zustand';

export type ToastLevel = 'info' | 'success' | 'warn' | 'error';

export interface Toast {
  id: string;
  message: string;
  level: ToastLevel;
  persistent: boolean;
  // Optional second line shown under message. Triggers the richer
  // two-line layout in ToastContainer.
  body?: string;
  // Optional icon rendered to the left. ReactNode so callers can pass
  // an inline SVG or any custom element. Triggers the richer layout.
  icon?: ReactNode;
  // Set true when dismiss() is called; the renderer plays its exit
  // animation while this is true, then the toast is filtered out of the
  // store TOAST_EXIT_MS later. Lets tap-dismiss, TTL-dismiss, and
  // programmatic dismissToast(id) all animate consistently.
  isExiting: boolean;
}

export interface PushOptions {
  level?: ToastLevel;
  persistent?: boolean;
  body?: string;
  icon?: ReactNode;
}

export interface UpdateOptions {
  message?: string;
  level?: ToastLevel;
  persistent?: boolean;
  // Pass `undefined` explicitly to clear an existing body/icon on a
  // morphing toast (e.g., flipping the rich shelter warning down to a
  // plain "backup done" line).
  body?: string;
  icon?: ReactNode;
}

interface ToastStore {
  toasts: Toast[];
  push: (message: string, options?: PushOptions) => string;
  update: (id: string, options: UpdateOptions) => void;
  dismiss: (id: string) => void;
}

// Visible-phase TTL for non-persistent toasts. Real on-screen time is
// this plus the enter/exit transition.
export const TOAST_TTL_MS = 4000;

// Must match the duration class on ToastItem. Centralised here so the
// two-phase dismiss flow can wait the right amount before pruning.
export const TOAST_EXIT_MS = 250;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (message, options = {}) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const toast: Toast = {
      id,
      message,
      level: options.level ?? 'info',
      persistent: options.persistent ?? false,
      body: options.body,
      icon: options.icon,
      isExiting: false,
    };
    set((s) => ({ toasts: [...s.toasts, toast] }));
    return id;
  },
  // Spread-merge so any explicitly-set key in `options` overwrites,
  // including explicit `undefined` (used to clear body/icon when
  // morphing a rich toast back to a plain one).
  update: (id, options) => {
    set((s) => ({
      toasts: s.toasts.map((t) => (t.id !== id ? t : { ...t, ...options })),
    }));
  },
  // Two-phase: mark isExiting → wait TOAST_EXIT_MS → filter out. Every
  // dismissal path (TTL, tap, programmatic) funnels through here so the
  // exit animation always plays.
  dismiss: (id) => {
    set((s) => ({
      toasts: s.toasts.map((t) => (t.id === id ? { ...t, isExiting: true } : t)),
    }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, TOAST_EXIT_MS);
  },
}));

// Convenience for non-React callers (effects, ad-hoc code paths).
export function pushToast(message: string, options?: PushOptions): string {
  return useToastStore.getState().push(message, options);
}

export function updateToast(id: string, options: UpdateOptions) {
  useToastStore.getState().update(id, options);
}

export function dismissToast(id: string) {
  useToastStore.getState().dismiss(id);
}
