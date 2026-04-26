import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { cn } from '@/lib/cn';
import { RangeCell } from '@/components/RangeCell';
import { ALL_HANDS, categoryOf, handToGridCoords } from '@/utils/handUtils';
import type { HandNotation, RangeCellData } from '@/types/poker';
import { useRangePainter } from './useRangePainter';

type RangeGridProps = {
  cells?: Record<HandNotation, RangeCellData>;
  className?: string;
  /** When true the grid responds to mouse paint/erase and exposes paint shortcuts. */
  editable?: boolean;
  onCellPaint?: (hand: HandNotation) => void;
  onCellErase?: (hand: HandNotation) => void;
  /** Ctrl/Meta + right-click on a cell: paint the "hand+" expansion. */
  onCellPaintPlus?: (hand: HandNotation) => void;
  /** Fired once at the start of a discrete paint/erase session for history checkpoints. */
  onSessionStart?: () => void;
};

const SIZE = 13;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function RangeGridBase({
  cells,
  className,
  editable = false,
  onCellPaint,
  onCellErase,
  onCellPaintPlus,
  onSessionStart,
}: RangeGridProps) {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const cellRefs = useRef<(HTMLDivElement | null)[]>([]);
  const shouldFocusRef = useRef(false);

  const painter = useRangePainter({
    enabled: editable,
    ...(onCellPaint && { onPaint: onCellPaint }),
    ...(onCellErase && { onErase: onCellErase }),
    ...(onCellPaintPlus && { onPaintPlus: onCellPaintPlus }),
    ...(onSessionStart && { onSessionStart }),
  });

  // Stable per-index ref setters so RangeCell memo isn't invalidated each render.
  const refSetters = useMemo(
    () =>
      ALL_HANDS.map(
        (_hand, i) => (el: HTMLDivElement | null) => {
          cellRefs.current[i] = el;
        },
      ),
    [],
  );

  useEffect(() => {
    if (!shouldFocusRef.current) return;
    shouldFocusRef.current = false;
    cellRefs.current[focusedIndex]?.focus();
  }, [focusedIndex]);

  const moveFocus = useCallback((nextIndex: number) => {
    shouldFocusRef.current = true;
    setFocusedIndex(nextIndex);
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const row = Math.floor(focusedIndex / SIZE);
      const col = focusedIndex % SIZE;
      let nextRow = row;
      let nextCol = col;

      switch (e.key) {
        case 'ArrowRight':
          nextCol = clamp(col + 1, 0, SIZE - 1);
          break;
        case 'ArrowLeft':
          nextCol = clamp(col - 1, 0, SIZE - 1);
          break;
        case 'ArrowDown':
          nextRow = clamp(row + 1, 0, SIZE - 1);
          break;
        case 'ArrowUp':
          nextRow = clamp(row - 1, 0, SIZE - 1);
          break;
        case 'Home':
          nextRow = 0;
          nextCol = 0;
          break;
        case 'End':
          nextRow = SIZE - 1;
          nextCol = SIZE - 1;
          break;
        case 'PageUp':
          nextCol = 0;
          break;
        case 'PageDown':
          nextCol = SIZE - 1;
          break;
        default:
          if (editable) painter.onKeyDown(e);
          return;
      }

      e.preventDefault();
      const next = nextRow * SIZE + nextCol;
      if (next !== focusedIndex) moveFocus(next);
    },
    [focusedIndex, moveFocus, editable, painter],
  );

  const handleFocus = useCallback(
    (e: React.FocusEvent<HTMLDivElement>) => {
      // If focus enters the grid on a non-roving cell (e.g. via click),
      // sync focusedIndex so arrow keys continue from there.
      const target = e.target as HTMLDivElement;
      const hand = target.getAttribute?.('data-hand');
      if (!hand) return;
      const idx = ALL_HANDS.indexOf(hand as HandNotation);
      if (idx >= 0 && idx !== focusedIndex) setFocusedIndex(idx);
    },
    [focusedIndex],
  );

  return (
    <div
      role="grid"
      aria-label={
        editable
          ? 'Editable poker range grid, 13 by 13. Click or drag to paint, right-click to erase. Use arrow keys to navigate.'
          : 'Poker range grid, 13 by 13. Use arrow keys to navigate.'
      }
      aria-rowcount={SIZE}
      aria-colcount={SIZE}
      data-editable={editable || undefined}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
      onMouseDown={editable ? painter.onMouseDown : undefined}
      onMouseOver={editable ? painter.onMouseOver : undefined}
      onContextMenu={editable ? painter.onContextMenu : undefined}
      className={cn(
        'relative mx-auto grid aspect-square w-full max-w-[min(640px,92vw)]',
        'grid-cols-[repeat(13,minmax(0,1fr))] gap-px',
        'rounded-xl border border-border bg-border/60 shadow-surface',
        editable && 'cursor-crosshair touch-none select-none',
        className,
      )}
    >
      {ALL_HANDS.map((hand, i) => {
        const { row, col } = handToGridCoords(hand);
        const cell = cells?.[hand];
        const isFocused = i === focusedIndex;
        const commonProps = {
          hand,
          category: categoryOf(hand),
          tooltipSide: (row === 0 ? 'bottom' : 'top') as 'bottom' | 'top',
          rowIndex: row + 1,
          colIndex: col + 1,
          tabIndex: (isFocused ? 0 : -1) as 0 | -1,
          cellRef: refSetters[i]!,
        };
        return cell ? (
          <RangeCell key={hand} {...commonProps} actions={cell.actions} />
        ) : (
          <RangeCell key={hand} {...commonProps} />
        );
      })}
    </div>
  );
}

export const RangeGrid = memo(RangeGridBase);
