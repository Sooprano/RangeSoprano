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

type RangeGridProps = {
  cells?: Record<HandNotation, RangeCellData>;
  className?: string;
};

const SIZE = 13;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function RangeGridBase({ cells, className }: RangeGridProps) {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const cellRefs = useRef<(HTMLDivElement | null)[]>([]);
  const shouldFocusRef = useRef(false);

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
          return;
      }

      e.preventDefault();
      const next = nextRow * SIZE + nextCol;
      if (next !== focusedIndex) moveFocus(next);
    },
    [focusedIndex, moveFocus],
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
      aria-label="Poker range grid, 13 by 13. Use arrow keys to navigate."
      aria-rowcount={SIZE}
      aria-colcount={SIZE}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
      className={cn(
        'relative mx-auto grid aspect-square w-full max-w-[min(640px,92vw)]',
        'grid-cols-[repeat(13,minmax(0,1fr))] gap-px',
        'rounded-xl border border-border bg-border/60 shadow-surface',
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
