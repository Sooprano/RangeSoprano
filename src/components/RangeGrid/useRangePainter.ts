import { useCallback, useEffect, useMemo, useRef } from 'react';
import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
} from 'react';
import type { HandNotation } from '@/types/poker';

type PaintMode = 'paint' | null;

export type RangePainterOptions = {
  enabled: boolean;
  onPaint?: (hand: HandNotation) => void;
  onErase?: (hand: HandNotation) => void;
  /** Ctrl/Meta + right-click: paint the "hand+" expansion (A5o → A5o..AKo, 44 → 44..AA). */
  onPaintPlus?: (hand: HandNotation) => void;
  /**
   * Invoked once at the start of a discrete paint/erase session so the
   * caller can checkpoint for undo. Fired on mousedown, right-click, and
   * each qualifying keydown (Space/Enter/Delete/Backspace). Drag moves
   * do NOT fire it — they belong to the same session as the mousedown.
   */
  onSessionStart?: () => void;
};

export type RangePainterHandlers = {
  onMouseDown: (e: ReactMouseEvent<HTMLDivElement>) => void;
  onMouseOver: (e: ReactMouseEvent<HTMLDivElement>) => void;
  onContextMenu: (e: ReactMouseEvent<HTMLDivElement>) => void;
  onKeyDown: (e: ReactKeyboardEvent<HTMLDivElement>) => void;
};

function handFromTarget(target: EventTarget | null): HandNotation | null {
  if (!(target instanceof HTMLElement)) return null;
  const el = target.closest<HTMLElement>('[data-hand]');
  if (!el) return null;
  const hand = el.dataset.hand;
  return hand && hand.length > 0 ? hand : null;
}

// 4A: mouse-only. Touch / pointer support is a 4B follow-up.
export function useRangePainter({
  enabled,
  onPaint,
  onErase,
  onPaintPlus,
  onSessionStart,
}: RangePainterOptions): RangePainterHandlers {
  const modeRef = useRef<PaintMode>(null);
  const visitedRef = useRef<Set<HandNotation>>(new Set());

  // Keep the latest callbacks in refs so the handlers we expose stay stable
  // and don't bust RangeGrid's React.memo on every parent render.
  const onPaintRef = useRef(onPaint);
  const onEraseRef = useRef(onErase);
  const onPaintPlusRef = useRef(onPaintPlus);
  const onSessionStartRef = useRef(onSessionStart);
  useEffect(() => {
    onPaintRef.current = onPaint;
    onEraseRef.current = onErase;
    onPaintPlusRef.current = onPaintPlus;
    onSessionStartRef.current = onSessionStart;
  }, [onPaint, onErase, onPaintPlus, onSessionStart]);

  const reset = useCallback(() => {
    modeRef.current = null;
    visitedRef.current.clear();
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const handleMouseUp = () => reset();
    const handleBlur = () => reset();
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('blur', handleBlur);
      reset();
    };
  }, [enabled, reset]);

  const onMouseDown = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      if (!enabled) return;
      if (e.button !== 0) return;
      const hand = handFromTarget(e.target);
      if (!hand) return;
      e.preventDefault();
      modeRef.current = 'paint';
      visitedRef.current.clear();
      visitedRef.current.add(hand);
      onSessionStartRef.current?.();
      onPaintRef.current?.(hand);
    },
    [enabled],
  );

  const onMouseOver = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      if (!enabled || modeRef.current !== 'paint') return;
      // If the user lifted the mouse outside the window we may miss the
      // mouseup; bail out cleanly when no left button is held anymore.
      if ((e.buttons & 1) === 0) {
        reset();
        return;
      }
      const hand = handFromTarget(e.target);
      if (!hand || visitedRef.current.has(hand)) return;
      visitedRef.current.add(hand);
      onPaintRef.current?.(hand);
    },
    [enabled, reset],
  );

  const onContextMenu = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      if (!enabled) return;
      const hand = handFromTarget(e.target);
      if (!hand) return;
      e.preventDefault();
      onSessionStartRef.current?.();
      if ((e.ctrlKey || e.metaKey) && onPaintPlusRef.current) {
        onPaintPlusRef.current(hand);
        return;
      }
      onEraseRef.current?.(hand);
    },
    [enabled],
  );

  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      if (!enabled) return;
      const target = e.target as HTMLElement | null;
      const hand = target?.getAttribute?.('data-hand');
      if (!hand) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        onSessionStartRef.current?.();
        onPaintRef.current?.(hand);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        onSessionStartRef.current?.();
        onEraseRef.current?.(hand);
      }
    },
    [enabled],
  );

  return useMemo(
    () => ({ onMouseDown, onMouseOver, onContextMenu, onKeyDown }),
    [onMouseDown, onMouseOver, onContextMenu, onKeyDown],
  );
}
