import { memo } from 'react';
import { cn } from '@/lib/cn';
import { RangeCell } from '@/components/RangeCell';
import { ALL_HANDS, categoryOf, handToGridCoords } from '@/utils/handUtils';
import type { HandNotation, RangeCellData } from '@/types/poker';

type RangeGridProps = {
  cells?: Record<HandNotation, RangeCellData>;
  className?: string;
};

function RangeGridBase({ cells, className }: RangeGridProps) {
  return (
    <div
      className={cn(
        'relative mx-auto grid aspect-square w-full max-w-[640px]',
        'grid-cols-[repeat(13,minmax(0,1fr))] gap-px',
        'rounded-xl border border-border bg-border/60 shadow-surface',
        className,
      )}
    >
      {ALL_HANDS.map((hand) => {
        const { row } = handToGridCoords(hand);
        const cell = cells?.[hand];
        const commonProps = {
          hand,
          category: categoryOf(hand),
          tooltipSide: (row === 0 ? 'bottom' : 'top') as 'bottom' | 'top',
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
