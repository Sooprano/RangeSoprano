// Modal shell for Sopranozilla: dark overlay, focus trapped inside, Escape and
// a click outside close it, focus goes back where it was. Same behavior as
// the range library dialog.

import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type Props = {
  /** Accessible name (the visible title lives in `children`). */
  label: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  /** False for dialogs with work in progress (the filter builder). */
  closeOnOutsideClick?: boolean;
};

export function SzDialog({
  label,
  onClose,
  children,
  className,
  closeOnOutsideClick = true,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const el = ref.current;
    // First field, or the dialog itself.
    (el?.querySelector<HTMLElement>('input, textarea') ?? el)?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeRef.current();
        return;
      }
      if (e.key !== 'Tab' || !ref.current) return;
      const els = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (x) => x.offsetParent !== null,
      );
      const first = els[0];
      const last = els[els.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      previous?.focus?.();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4"
      onClick={closeOnOutsideClick ? onClose : undefined}
      role="presentation"
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'my-auto w-full rounded-xl border border-border bg-surface p-4 shadow-surface outline-none',
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
