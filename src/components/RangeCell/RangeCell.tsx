import { memo } from 'react';
import { cn } from '@/lib/cn';
import type { HandCategory, HandNotation } from '@/types/poker';

type RangeCellProps = {
  hand: HandNotation;
  category: HandCategory;
  className?: string;
};

const CATEGORY_BG: Record<HandCategory, string> = {
  pair: 'bg-surface-hover',
  suited: 'bg-surface',
  offsuit: 'bg-bg-subtle',
};

const CATEGORY_TEXT: Record<HandCategory, string> = {
  pair: 'text-content font-semibold',
  suited: 'text-content-muted',
  offsuit: 'text-content-muted',
};

function RangeCellBase({ hand, category, className }: RangeCellProps) {
  return (
    <div
      data-hand={hand}
      data-category={category}
      className={cn(
        'relative flex items-center justify-center select-none',
        'text-[11px] leading-none tracking-tight tabular-nums',
        CATEGORY_BG[category],
        CATEGORY_TEXT[category],
        className,
      )}
    >
      {category === 'pair' && (
        <span
          aria-hidden
          className="pointer-events-none absolute right-1 top-1 h-[3px] w-[3px] rounded-full bg-accent/60"
        />
      )}
      {hand}
    </div>
  );
}

export const RangeCell = memo(RangeCellBase);
