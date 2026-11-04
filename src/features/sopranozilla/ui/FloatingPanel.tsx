// A panel that floats next to the page's grid (the suit picker), instead of
// opening under it: under the grid it pushed the column down, the column got
// a scrollbar that shrank the grid, and the combos ended up out of view.
// Right of the grid if it fits, else left, else under the hand's cell.
// Escape closes it.

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const GAP = 12;
const MARGIN = 8;

type Props = {
  /** The hand whose cell anchors the panel. */
  hand: string;
  label: string;
  onClose: () => void;
  children: ReactNode;
};

export function FloatingPanel({ hand, label, onClose, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  const place = useCallback(() => {
    const panel = ref.current;
    const grid = document.querySelector<HTMLElement>('[data-sz-grid]');
    const cell = grid?.querySelector<HTMLElement>(`[data-hand="${hand}"]`);
    if (!panel || !grid || !cell) return;
    const g = grid.getBoundingClientRect();
    const c = cell.getBoundingClientRect();
    const w = panel.offsetWidth;
    const h = panel.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const clampTop = (t: number) => Math.max(MARGIN, Math.min(t, vh - h - MARGIN));
    let next: { left: number; top: number };
    if (g.right + GAP + w <= vw - MARGIN) {
      next = { left: g.right + GAP, top: clampTop(c.top - 40) };
    } else if (g.left - GAP - w >= MARGIN) {
      next = { left: g.left - GAP - w, top: clampTop(c.top - 40) };
    } else {
      // Narrow screens: under the cell, inside the viewport.
      const below = c.bottom + MARGIN;
      next = {
        left: Math.max(MARGIN, Math.min(c.left, vw - w - MARGIN)),
        top: below + h <= vh - MARGIN ? below : clampTop(c.top - h - MARGIN),
      };
    }
    setPos((p) => (p && p.left === next.left && p.top === next.top ? p : next));
  }, [hand]);

  useLayoutEffect(() => {
    place();
  });

  useEffect(() => {
    let frame = 0;
    const onMove = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(place);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('[role="dialog"]')) onClose();
    };
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
      window.removeEventListener('keydown', onKey);
    };
  }, [place, onClose]);

  return createPortal(
    <div
      ref={ref}
      role="region"
      aria-label={label}
      className="fixed z-40 w-[30rem] max-w-[calc(100vw-1rem)] rounded-xl border border-border bg-surface shadow-surface"
      // Measured first, shown once placed (no flash at 0,0).
      style={pos ? { left: pos.left, top: pos.top } : { left: 0, top: 0, visibility: 'hidden' }}
    >
      {children}
    </div>,
    document.body,
  );
}
