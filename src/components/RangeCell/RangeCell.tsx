import { memo, useId, useMemo, type Ref } from 'react';
import { cn } from '@/lib/cn';
import type { HandAction, HandCategory, HandNotation } from '@/types/poker';
import { ACTION_META } from '@/utils/actionMeta';

type TooltipSide = 'top' | 'bottom';

type RangeCellProps = {
  hand: HandNotation;
  category: HandCategory;
  actions?: HandAction[];
  tooltipSide?: TooltipSide;
  className?: string;
  /** 1-based row index for ARIA. */
  rowIndex: number;
  /** 1-based column index for ARIA. */
  colIndex: number;
  /** Roving tabindex: 0 only for the currently focused cell. */
  tabIndex: 0 | -1;
  /** Ref setter injected by parent so it can focus the cell imperatively. */
  cellRef?: Ref<HTMLDivElement>;
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

function buildBackground(actions: HandAction[]): string | undefined {
  const sorted = [...actions].sort(
    (a, b) => ACTION_META[a.action].order - ACTION_META[b.action].order,
  );
  const total = sorted.reduce((acc, a) => acc + a.weight, 0);
  if (total <= 0) return undefined;

  if (sorted.length === 1) return ACTION_META[sorted[0]!.action].cssColor;

  const stops: string[] = [];
  let cursor = 0;
  for (const a of sorted) {
    const start = cursor;
    const end = cursor + (a.weight / total) * 100;
    stops.push(`${ACTION_META[a.action].cssColor} ${start}% ${end}%`);
    cursor = end;
  }
  return `linear-gradient(to right, ${stops.join(', ')})`;
}

function buildAriaLabel(
  hand: HandNotation,
  category: HandCategory,
  sorted: HandAction[],
): string {
  const base = `${hand}, ${CATEGORY_LABEL[category]}`;
  if (sorted.length === 0) return `${base}, no action`;
  const parts = sorted.map(
    (a) => `${ACTION_META[a.action].label} ${Math.round(a.weight)}%`,
  );
  return `${base}, ${parts.join(', ')}`;
}

function RangeCellBase({
  hand,
  category,
  actions,
  tooltipSide = 'top',
  className,
  rowIndex,
  colIndex,
  tabIndex,
  cellRef,
}: RangeCellProps) {
  const tooltipId = useId();
  const hasActions = !!actions && actions.length > 0;

  const background = useMemo(
    () => (hasActions ? buildBackground(actions!) : undefined),
    [hasActions, actions],
  );

  const sortedForTooltip = useMemo(() => {
    if (!hasActions) return [];
    return [...actions!].sort(
      (a, b) => ACTION_META[a.action].order - ACTION_META[b.action].order,
    );
  }, [hasActions, actions]);

  const ariaLabel = useMemo(
    () => buildAriaLabel(hand, category, sortedForTooltip),
    [hand, category, sortedForTooltip],
  );

  return (
    <div
      ref={cellRef}
      role="gridcell"
      aria-rowindex={rowIndex}
      aria-colindex={colIndex}
      aria-label={ariaLabel}
      aria-describedby={hasActions ? tooltipId : undefined}
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
        !hasActions && CATEGORY_BG[category],
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

      {hasActions && (
        <div
          id={tooltipId}
          role="tooltip"
          className={cn(
            'pointer-events-none absolute left-1/2 z-20 -translate-x-1/2',
            'min-w-[140px] whitespace-nowrap rounded-lg px-3 py-2',
            'bg-surface/95 backdrop-blur-sm',
            'border border-accent/30 shadow-surface',
            'text-xs text-content',
            'opacity-0 motion-safe:translate-y-0.5',
            'motion-safe:transition motion-safe:duration-150 motion-safe:ease-out-soft',
            'group-hover:opacity-100 group-hover:translate-y-0',
            'group-focus-within:opacity-100 group-focus-within:translate-y-0',
            tooltipSide === 'top'
              ? 'bottom-full mb-1.5'
              : 'top-full mt-1.5',
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
                    className={cn(
                      'inline-block h-2.5 w-2.5 rounded-sm',
                      ACTION_META[a.action].swatchClass,
                    )}
                  />
                  <span className="text-content">
                    {ACTION_META[a.action].label}
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
