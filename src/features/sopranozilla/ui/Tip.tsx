// Small styled tooltip (spec §10: definition of each category), to the right
// of the trigger and linked with aria-describedby. Opens on hover after a
// short delay, or on keyboard focus. Closes when the pointer leaves, on a
// click and on blur (D101): with CSS :focus-within a click left it open,
// because the clicked button keeps the focus.

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

const DELAY_MS = 300;

export function Tip({
  text,
  children,
  className,
}: {
  text: string;
  children: (describedBy: string) => ReactNode;
  className?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const timer = useRef<number | null>(null);
  const clear = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => clear, []);

  return (
    <span
      className={cn('relative block', className)}
      onMouseEnter={() => {
        clear();
        timer.current = window.setTimeout(() => setOpen(true), DELAY_MS);
      }}
      onMouseLeave={() => {
        clear();
        setOpen(false);
      }}
      onPointerDown={() => {
        clear();
        setOpen(false);
      }}
      onFocus={(e) => {
        // Keyboard focus only: a click focuses too, and must not open it.
        let keyboard = true;
        try {
          keyboard = e.target.matches(':focus-visible');
        } catch {
          // Old engines without :focus-visible: treat it as keyboard focus.
        }
        if (keyboard) setOpen(true);
      }}
      onBlur={() => {
        clear();
        setOpen(false);
      }}
    >
      {children(id)}
      <span
        id={id}
        role="tooltip"
        className={cn(
          'pointer-events-none absolute left-full top-1/2 z-30 ml-2 w-64 -translate-y-1/2 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-normal leading-snug text-content shadow-lg transition-opacity',
          open ? 'visible opacity-100' : 'invisible opacity-0',
        )}
      >
        {text}
      </span>
    </span>
  );
}
