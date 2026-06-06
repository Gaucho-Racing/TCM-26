import { useEffect, useState } from 'react';
import { useToastStore, TOAST_TTL_MS, type Toast, type ToastLevel } from '../store/toasts';

// Color palette per level — colored border + tinted fill + glow, matching
// the status-light vocabulary used on ConnectionsPanel.
const LEVEL_STYLES: Record<ToastLevel, string> = {
  info: 'border-sky-500/40 bg-sky-500/15 text-sky-200 shadow-[0_0_14px_rgb(56_189_248/0.4)]',
  success:
    'border-emerald-500/40 bg-emerald-500/15 text-emerald-200 shadow-[0_0_14px_rgb(52_211_153/0.4)]',
  warn: 'border-amber-500/40 bg-amber-500/15 text-amber-200 shadow-[0_0_14px_rgb(251_191_36/0.4)]',
  error: 'border-red-500/50 bg-red-500/20 text-red-200 shadow-[0_0_16px_rgb(239_68_68/0.5)]',
};

// Tick after mount before flipping enterPhase so the browser applies
// the initial offscreen styles and the transition actually fires.
const ENTER_DELAY_MS = 10;

function ToastItem({ toast, dismiss }: { toast: Toast; dismiss: (id: string) => void }) {
  const [hasEntered, setHasEntered] = useState(false);

  useEffect(() => {
    const enter = setTimeout(() => setHasEntered(true), ENTER_DELAY_MS);
    // Persistent toasts skip the TTL — caller dismisses via dismissToast(id).
    if (toast.persistent) {
      return () => clearTimeout(enter);
    }
    const ttl = setTimeout(() => dismiss(toast.id), TOAST_TTL_MS);
    return () => {
      clearTimeout(enter);
      clearTimeout(ttl);
    };
  }, [toast.id, toast.persistent, dismiss]);

  const isVisible = hasEntered && !toast.isExiting;
  const positionClasses = isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8';
  // Decelerate on enter, accelerate away on exit so motion feels grounded.
  const easingClass = toast.isExiting ? 'ease-in' : 'ease-out';

  // Rich layout when an icon or body is provided — bigger padding, icon
  // on the left, title + subtitle stacked on the right.
  const isRich = toast.icon !== undefined || toast.body !== undefined;
  const paddingClasses = isRich ? 'p-5' : 'px-6 py-4';

  return (
    <div
      onClick={() => dismiss(toast.id)}
      role="alert"
      className={`pointer-events-auto cursor-pointer rounded-2xl border-2 backdrop-blur transition-all duration-[250ms] ${easingClass} ${LEVEL_STYLES[toast.level]} ${positionClasses} ${paddingClasses}`}
    >
      {isRich ? (
        <div className="flex items-center gap-4">
          {toast.icon !== undefined && <div className="shrink-0">{toast.icon}</div>}
          <div className="flex min-w-0 flex-col gap-1">
            <div className="text-2xl leading-tight font-bold">{toast.message}</div>
            {toast.body !== undefined && (
              <div className="text-base leading-tight font-medium opacity-90">{toast.body}</div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-xl font-bold">{toast.message}</div>
      )}
    </div>
  );
}

// Fixed top-left stack. Newer toasts stack downward.
export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-50 flex w-[28rem] flex-col gap-3">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} dismiss={dismiss} />
      ))}
    </div>
  );
}
