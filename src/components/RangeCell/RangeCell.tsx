import { memo, useId, useMemo, type Ref } from 'react';
import { cn } from '@/lib/cn';
import type { HandAction, HandCategory, HandNotation } from '@/types/poker';
import {
  actionColor,
  actionLabel,
  sortByActionOrder,
  type ActionDefMap,
} from '@/utils/actionMeta';

type TooltipSide = 'top' | 'bottom';
type TooltipAlign = 'left' | 'right';

type RangeCellProps = {
  hand: HandNotation;
  category: HandCategory;
  actions?: HandAction[];
  /** Per-range action defs lookup (color + label + order). Falls back to the action id when missing. */
  actionsMap?: ActionDefMap;
  tooltipSide?: TooltipSide;
  /** Horizontal corner the tooltip flies toward. Flips near the grid's right edge. */
  tooltipAlign?: TooltipAlign;
  className?: string;
  /** 1-based row index for ARIA. */
  rowIndex: number;
  /** 1-based column index for ARIA. */
  colIndex: number;
  /** Roving tabindex: 0 only for the currently focused cell. */
  tabIndex: 0 | -1;
  /** Ref setter injected by parent so it can focus the cell imperatively. */
  cellRef?: Ref<HTMLDivElement>;
  /** Compact mode skips the tooltip DOM (used by Overview tiles to reduce node count). */
  compact?: boolean;
};

const CATEGORY_BG: Record<HandCategory, string> = {
  pair: 'bg-cell-empty-pair',
  suited: 'bg-cell-empty-suited',
  offsuit: 'bg-cell-empty-offsuit',
};

const CATEGORY_TEXT: Record<HandCategory, string> = {
  pair: 'text-content font-semibold',
  suited: 'text-content-muted',
  offsuit: 'text-content-muted',
};

const CATEGORY_LABEL: Record<HandCategory, string> = {
  pair: 'pair',
  suited: 'suited',
  offsuit: 'offsuit',
};

const EMPTY_MAP: ActionDefMap = new Map();

function buildBackground(actions: HandAction[], defs: ActionDefMap): string | undefined {
  const sorted = sortByActionOrder(defs, actions);
  const stops: string[] = [];
  let cursor = 0;
  for (const a of sorted) {
    const w = Math.max(0, Math.min(100 - cursor, a.weight));
    if (w <= 0) continue;
    const start = cursor;
    const end = cursor + w;
    stops.push(`${actionColor(defs, a.action)} ${start}% ${end}%`);
    cursor = end;
    if (cursor >= 100) break;
  }
  if (stops.length === 0) return undefined;
  if (cursor < 100) {
    stops.push(`transparent ${cursor}% 100%`);
  }
  return `linear-gradient(to right, ${stops.join(', ')})`;
}

function buildAriaLabel(
  hand: HandNotation,
  category: HandCategory,
  sorted: HandAction[],
  defs: ActionDefMap,
): string {
  const base = `${hand}, ${CATEGORY_LABEL[category]}`;
  if (sorted.length === 0) return `${base}, no action`;
  const parts = sorted.map(
    (a) => `${actionLabel(defs, a.action)} ${Math.round(a.weight)}%`,
  );
  return `${base}, ${parts.join(', ')}`;
}

function RangeCellBase({
  hand,
  category,
  actions,
  actionsMap,
  tooltipSide = 'top',
  tooltipAlign = 'right',
  className,
  rowIndex,
  colIndex,
  tabIndex,
  cellRef,
  compact = false,
}: RangeCellProps) {
  const tooltipId = useId();
  const hasActions = !!actions && actions.length > 0;
  const defs = actionsMap ?? EMPTY_MAP;

  const background = useMemo(
    () => (hasActions ? buildBackground(actions!, defs) : undefined),
    [hasActions, actions, defs],
  );

  const sortedForTooltip = useMemo(() => {
    if (!hasActions) return [];
    return sortByActionOrder(defs, actions!);
  }, [hasActions, actions, defs]);

  const ariaLabel = useMemo(
    () => buildAriaLabel(hand, category, sortedForTooltip, defs),
    [hand, category, sortedForTooltip, defs],
  );

  return (
    <div
      ref={cellRef}
      role="gridcell"
      aria-rowindex={rowIndex}
      aria-colindex={colIndex}
      aria-label={ariaLabel}
      aria-describedby={hasActions && !compact ? tooltipId : undefined}
      tabIndex={tabIndex}
      data-hand={hand}
      data-category={category}
      className={cn(
        'group relative flex items-center justify-center select-none',
        'text-[11px] leading-none tracking-tight tabular-nums',
        'outline-none',
        'focus-visible:z-30 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-surface',
        'motion-safe:transition-transform motion-safe:duration-150 motion-safe:ease-out-soft',
        hasActions &&
          'hover:z-30 motion-safe:hover:scale-[1.04] motion-safe:focus-visible:scale-[1.04]',
        CATEGORY_BG[category],
        !hasActions && 'hover:brightness-110',
        hasActions ? 'text-white/95' : CATEGORY_TEXT[category],
        className,
      )}
      style={background ? { backgroundImage: background } : undefined}
    >
      {category === 'pair' && (
        <span
          aria-hidden
          className="pointer-events-none absolute right-1 top-1 h-[3px] w-[3px] rounded-full bg-accent/60"
        />
      )}
      <span
        className={cn(
          'relative',
          hasActions && 'drop-shadow-[0_1px_1px_rgb(0_0_0/0.55)]',
        )}
      >
        {hand}
      </span>

      {hasActions && !compact && (
        <div
          id={tooltipId}
          role="tooltip"
          className={cn(
            'pointer-events-none absolute z-20',
            'min-w-[140px] whitespace-nowrap rounded-lg px-3 py-2',
            'bg-surface/95 backdrop-blur-sm',
            'border border-accent/30 shadow-surface',
            'text-xs text-content',
            'opacity-0 motion-safe:translate-y-0.5',
            'motion-safe:transition motion-safe:duration-150 motion-safe:ease-out-soft',
            'group-hover:opacity-100 group-hover:translate-y-0',
            'group-focus-within:opacity-100 group-focus-within:translate-y-0',
            // Vertical corner: above the cell, or below it on the top row.
            tooltipSide === 'top' ? 'bottom-full' : 'top-full',
            // Horizontal corner: fly right by default, flip left near the right edge.
            tooltipAlign === 'right' ? 'left-full ml-1' : 'right-full mr-1',
          )}
        >
          <div className="mb-1.5 flex items-baseline justify-between gap-3 border-b border-border pb-1">
            <span className="font-semibold text-content">{hand}</span>
            <span className="text-[10px] uppercase tracking-wider text-content-muted">
              {CATEGORY_LABEL[category]}
            </span>
          </div>
          <ul className="flex flex-col gap-1">
            {sortedForTooltip.map((a) => (
              <li
                key={a.action}
                className="flex items-center justify-between gap-3"
              >
                <span className="flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="inline-block h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: actionColor(defs, a.action) }}
                  />
                  <span className="text-content">
                    {actionLabel(defs, a.action)}
                  </span>
                </span>
                <span className="tabular-nums text-content-muted">
                  {Math.round(a.weight)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export const RangeCell = memo(RangeCellBase);
