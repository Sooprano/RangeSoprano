import { memo } from 'react';
import { cn } from '@/lib/cn';
import { RangeCell } from '@/components/RangeCell';
import { ALL_HANDS, categoryOf } from '@/utils/handUtils';

type RangeGridProps = {
  className?: string;
};

function RangeGridBase({ className }: RangeGridProps) {
  return (
    <div
      className={cn(
        'mx-auto grid aspect-square w-full max-w-[640px]',
        'grid-cols-[repeat(13,minmax(0,1fr))] gap-px',
        'overflow-hidden rounded-xl border border-border bg-border/60 shadow-surface',
        className,
      )}
    >
      {ALL_HANDS.map((hand) => (
        <RangeCell key={hand} hand={hand} category={categoryOf(hand)} />
      ))}
    </div>
  );
}

export const RangeGrid = memo(RangeGridBase);
