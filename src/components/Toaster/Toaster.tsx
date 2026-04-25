import { useEffect, useMemo, useRef } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useToastStore, type Toast, type ToastKind } from '@/store/toastStore';

const ICONS: Record<ToastKind, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

const STYLES: Record<ToastKind, string> = {
  success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100',
  error: 'border-red-500/40 bg-red-500/10 text-red-100',
  info: 'border-sky-500/40 bg-sky-500/10 text-sky-100',
};

const ICON_TINT: Record<ToastKind, string> = {
  success: 'text-emerald-400',
  error: 'text-red-400',
  info: 'text-sky-400',
};

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);

  const polite = useMemo(
    () => toasts.filter((t) => t.kind !== 'error'),
    [toasts],
  );
  const assertive = useMemo(
    () => toasts.filter((t) => t.kind === 'error'),
    [toasts],
  );

  if (toasts.length === 0) return null;

  return (
    <div
      aria-label="Notifications"
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2"
    >
      <ToastRegion items={polite} liveness="polite" />
      <ToastRegion items={assertive} liveness="assertive" />
    </div>
  );
}

type ToastRegionProps = {
  items: Toast[];
  liveness: 'polite' | 'assertive';
};

function ToastRegion({ items, liveness }: ToastRegionProps) {
  return (
    <div
      role={liveness === 'assertive' ? 'alert' : 'status'}
      aria-live={liveness}
      aria-atomic="false"
      className="flex flex-col gap-2"
    >
      {items.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}

function ToastItem({ toast }: { toast: Toast }) {
  const dismissToast = useToastStore((s) => s.dismissToast);
  const timerRef = useRef<number | null>(null);
  const Icon = ICONS[toast.kind];

  useEffect(() => {
    if (toast.duration <= 0) return;
    timerRef.current = window.setTimeout(() => {
      dismissToast(toast.id);
    }, toast.duration);
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [toast.id, toast.duration, dismissToast]);

  const cancelTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  return (
    <div
      onMouseEnter={cancelTimer}
      onFocus={cancelTimer}
      className={cn(
        'pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2 text-sm shadow-surface backdrop-blur',
        STYLES[toast.kind],
      )}
    >
      <Icon
        aria-hidden
        className={cn('mt-0.5 h-4 w-4 shrink-0', ICON_TINT[toast.kind])}
        strokeWidth={2.25}
      />
      <span className="flex-1 text-content">{toast.message}</span>
      <button
        type="button"
        onClick={() => dismissToast(toast.id)}
        aria-label="Dismiss notification"
        className="shrink-0 rounded p-0.5 text-content-muted hover:bg-white/5 hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-light"
      >
        <X className="h-3.5 w-3.5" strokeWidth={2.25} />
      </button>
    </div>
  );
}
