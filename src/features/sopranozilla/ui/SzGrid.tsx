// 13×13 grid for Sopranozilla (D2: own component, RangeGrid/RangeCell are not
// touched). Amber = share of the class that continues, grey = in range but
// not continuing, dark = out of range. A selected table row highlights its
// hands and dims the rest; hand-painted cells get a blue border.

import { memo, useEffect, useRef, type PointerEvent } from 'react';
import { cn } from '@/lib/cn';
import { categoryOf } from '@/utils/handUtils';
import type { HandCategory, HandNotation } from '@/types/poker';
import type { GridCell } from './viewModel';

const AMBER = 'rgb(245 158 11)';
const GREY = 'rgb(148 163 184 / 0.45)';

const EMPTY_BG: Record<HandCategory, string> = {
  pair: 'bg-cell-empty-pair',
  suited: 'bg-cell-empty-suited',
  offsuit: 'bg-cell-empty-offsuit',
};

type CellProps = {
  hand: HandNotation;
  live: number;
  inRange: number;
  follows: number;
  highlighted: boolean | null;
  /** Part of the class in the selected table row (null = no row selected). */
  categoryShare: number | null;
  overridden: boolean;
  /** Its 4×4 suit picker is open. */
  open: boolean;
};

const Cell = memo(function Cell({
  hand,
  live,
  inRange,
  follows,
  highlighted,
  categoryShare,
  overridden,
  open,
}: CellProps) {
  const f = Math.round(follows * 1000) / 10;
  const r = Math.round(inRange * 1000) / 10;
  const background =
    live > 0 && r > 0
      ? `linear-gradient(to right, ${AMBER} 0 ${f}%, ${GREY} ${f}% ${r}%, transparent ${r}% 100%)`
      : undefined;
  return (
    <button
      type="button"
      data-hand={hand}
      disabled={live === 0}
      aria-label={`${hand}: ${(inRange * 100).toFixed(0)}% en rango, ${(follows * 100).toFixed(0)}% sigue`}
      className={cn(
        'relative flex aspect-square min-w-0 items-center justify-center rounded-[3px] text-[10px] font-medium leading-none transition-opacity sm:text-[11px]',
        EMPTY_BG[categoryOf(hand)],
        // Dark text on amber (white on amber is hard to read); white on the grey
        // "in range" part; muted on empty cells.
        follows >= 0.5
          ? 'font-semibold text-slate-950'
          : inRange > 0
            ? 'text-white'
            : 'text-content-muted',
        // Selected table row: its hands get a violet frame, the rest fade out.
        highlighted === false && 'opacity-15',
        highlighted === true && 'ring-2 ring-inset ring-violet-400',
        live === 0 && 'cursor-not-allowed opacity-20 line-through',
        overridden && 'ring-2 ring-inset ring-sky-400',
        open && 'outline outline-2 outline-offset-1 outline-amber-400',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-light',
      )}
      style={background ? { backgroundImage: background } : undefined}
    >
      <span
        className={cn(
          'pointer-events-none',
          follows < 0.5 && inRange > 0 && 'drop-shadow-[0_1px_1px_rgb(0_0_0/0.6)]',
        )}
      >
        {hand}
      </span>
      {highlighted === true && categoryShare !== null && (
        // How much of the class the category explains (e.g. 2 of 4 combos).
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-[2px] left-[2px] h-[3px] rounded-full bg-violet-400"
          style={{ width: `calc(${Math.round(categoryShare * 100)}% - 4px)` }}
        />
      )}
    </button>
  );
});

/** Left click / drag paints, right click removes (weight 0), Alt restores. */
export type PaintStroke = 'paint' | 'remove' | 'restore';

type SzGridProps = {
  cells: GridCell[];
  /** Read-only grid (the filter builder preview). */
  readOnly?: boolean;
  onPaint: (hand: HandNotation, stroke: PaintStroke) => void;
  /** Before the first cell of a stroke (a click, a drag, a key): one undo step. */
  onStrokeStart?: () => void;
  onHover: (hand: HandNotation | null) => void;
  /** Shift + click: open that class's 4×4 suit picker. */
  onOpen: (hand: HandNotation) => void;
  openHand: HandNotation | null;
};

function handAt(e: PointerEvent<HTMLDivElement>): HandNotation | null {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-hand]');
  return el?.dataset.hand ?? null;
}

function strokeOf(e: { button?: number; altKey: boolean }): PaintStroke {
  if (e.button === 2) return 'remove';
  return e.altKey ? 'restore' : 'paint';
}

export function SzGrid({
  cells,
  readOnly = false,
  onPaint,
  onStrokeStart,
  onHover,
  onOpen,
  openHand,
}: SzGridProps) {
  const painting = useRef<{ stroke: PaintStroke } | null>(null);

  useEffect(() => {
    const stop = () => {
      painting.current = null;
    };
    window.addEventListener('pointerup', stop);
    return () => window.removeEventListener('pointerup', stop);
  }, []);

  return (
    <div
      role="group"
      aria-label="Rango del villano, 13 por 13"
      // The page grid (anchors the floating suit picker); not the builder preview.
      data-sz-grid={readOnly ? undefined : ''}
      className={cn('grid gap-[2px] select-none', !readOnly && 'cursor-crosshair')}
      style={{ gridTemplateColumns: 'repeat(13, minmax(0, 1fr))' }}
      onPointerDown={(e) => {
        const hand = handAt(e);
        if (readOnly || !hand) return;
        if (e.shiftKey && e.button === 0) {
          onOpen(hand);
          return;
        }
        const stroke = strokeOf(e);
        painting.current = { stroke };
        onStrokeStart?.();
        onPaint(hand, stroke);
      }}
      onPointerOver={(e) => {
        const hand = handAt(e);
        // Over the 2px gaps there is no hand: keep the last one (clearing it
        // made the panels under the grid jump). Leaving the grid clears it.
        if (!hand) return;
        onHover(hand);
        if (painting.current) onPaint(hand, painting.current.stroke);
      }}
      onPointerLeave={() => onHover(null)}
      onContextMenu={(e) => {
        if (!readOnly) e.preventDefault();
      }}
      onKeyDown={(e) => {
        if (readOnly || (e.key !== 'Enter' && e.key !== ' ')) return;
        const hand = (e.target as HTMLElement).dataset.hand;
        if (!hand) return;
        e.preventDefault();
        if (e.shiftKey) {
          onOpen(hand);
          return;
        }
        onStrokeStart?.();
        onPaint(hand, e.altKey ? 'restore' : 'paint');
      }}
    >
      {cells.map((c) => (
        <Cell
          key={c.hand}
          hand={c.hand}
          live={c.live}
          inRange={c.inRange}
          follows={c.follows}
          highlighted={c.highlighted}
          categoryShare={c.categoryShare}
          overridden={c.overridden}
          open={c.hand === openHand}
        />
      ))}
    </div>
  );
}
