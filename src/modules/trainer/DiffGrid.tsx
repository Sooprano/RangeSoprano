import { cn } from '@/lib/cn';
import { ALL_HANDS } from '@/utils/handUtils';
import type { DiffCellState } from '@/utils/rangeDiff';

const STATE_CLASS: Record<DiffCellState, string> = {
  match: 'bg-emerald-500/45 text-content',
  fp: 'bg-rose-500/45 text-content',
  fn: 'bg-amber-500/45 text-content',
  none: 'bg-surface/40 text-content-muted',
};

type DiffGridProps = {
  diff: Record<string, DiffCellState>;
  className?: string;
};

export function DiffGrid({ diff, className }: DiffGridProps) {
  return (
    <div
      role="img"
      aria-label="Range diff grid: green match, red false positive, amber false negative."
      className={cn(
        'mx-auto grid aspect-square w-full max-w-[min(640px,92vw)]',
        'grid-cols-[repeat(13,minmax(0,1fr))] gap-px rounded-xl border border-border bg-border/60 shadow-surface',
        className,
      )}
    >
      {ALL_HANDS.map((hand) => {
        const state = diff[hand] ?? 'none';
        return (
          <div
            key={hand}
            className={cn(
              'flex items-center justify-center text-[10px] font-medium tabular-nums',
              STATE_CLASS[state],
            )}
          >
            {hand}
          </div>
        );
      })}
    </div>
  );
}
