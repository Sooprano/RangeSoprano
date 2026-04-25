import { useCallback, useMemo, useState } from 'react';
import { Eye, EyeOff, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/cn';
import { RangeGrid } from '@/components/RangeGrid';
import type {
  Action,
  HandNotation,
  Range,
  RangeCellData,
} from '@/types/poker';
import { computeRangeDiff } from '@/utils/rangeDiff';
import { DiffGrid } from './DiffGrid';

type DrawingTrainerProps = {
  range: Range;
};

const PAINT_ACTION: Action = 'CALL';
const PAINT_WEIGHT = 100;

export function DrawingTrainer({ range }: DrawingTrainerProps) {
  const [guess, setGuess] = useState<Record<HandNotation, RangeCellData>>({});
  const [revealed, setRevealed] = useState(false);

  const onPaint = useCallback((hand: HandNotation) => {
    setGuess((g) => {
      const next = { ...g };
      next[hand] = {
        hand,
        actions: [{ action: PAINT_ACTION, weight: PAINT_WEIGHT }],
      };
      return next;
    });
  }, []);

  const onErase = useCallback((hand: HandNotation) => {
    setGuess((g) => {
      if (!(hand in g)) return g;
      const next = { ...g };
      delete next[hand];
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setGuess({});
    setRevealed(false);
  }, []);

  const diff = useMemo(
    () => (revealed ? computeRangeDiff(guess, range.cells) : null),
    [revealed, guess, range.cells],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-content-muted">
          Paint the hands you think belong to <span className="text-content">{range.name}</span>{' '}
          · click or drag to add · right-click to remove · then reveal to compare.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light',
              revealed
                ? 'bg-surface text-content shadow-[inset_0_0_0_1px_rgb(var(--color-accent)/0.6)]'
                : 'bg-accent text-white shadow-sm hover:bg-accent-deep',
            )}
          >
            {revealed ? (
              <>
                <EyeOff className="h-3.5 w-3.5" strokeWidth={2.25} />
                Hide diff
              </>
            ) : (
              <>
                <Eye className="h-3.5 w-3.5" strokeWidth={2.25} />
                Reveal
              </>
            )}
          </button>
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-content-muted hover:bg-surface-hover hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
          >
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={2.25} />
            Reset
          </button>
        </div>
      </div>

      {revealed && diff ? (
        <div className="flex flex-col gap-4">
          <DiffStats diff={diff} />
          <DiffGrid diff={diff.cells} />
          <DiffLegend />
        </div>
      ) : (
        <RangeGrid
          cells={guess}
          editable
          onCellPaint={onPaint}
          onCellErase={onErase}
        />
      )}
    </div>
  );
}

function DiffStats({
  diff,
}: {
  diff: ReturnType<typeof computeRangeDiff>;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat label="Accuracy" value={`${diff.accuracyPct.toFixed(0)}%`} />
      <Stat
        label="Match"
        value={`${Math.round(diff.matchCombos)} combos`}
        accent="emerald"
      />
      <Stat
        label="False positive"
        value={`${Math.round(diff.fpCombos)} combos`}
        accent="rose"
      />
      <Stat
        label="False negative"
        value={`${Math.round(diff.fnCombos)} combos`}
        accent="amber"
      />
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: 'emerald' | 'rose' | 'amber';
}) {
  const dot =
    accent === 'emerald'
      ? 'bg-emerald-500'
      : accent === 'rose'
        ? 'bg-rose-500'
        : accent === 'amber'
          ? 'bg-amber-500'
          : null;
  return (
    <div className="rounded-xl border border-border bg-surface/40 px-3 py-2">
      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-content-muted">
        {dot && <span aria-hidden className={cn('inline-block h-2 w-2 rounded-sm', dot)} />}
        {label}
      </p>
      <p className="text-lg font-semibold tabular-nums text-content">{value}</p>
    </div>
  );
}

function DiffLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-content-muted">
      <Legend dot="bg-emerald-500/70" label="Match" />
      <Legend dot="bg-rose-500/70" label="False positive (you painted, range did not)" />
      <Legend dot="bg-amber-500/70" label="False negative (range had, you missed)" />
    </ul>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <li className="inline-flex items-center gap-1.5">
      <span aria-hidden className={cn('inline-block h-2.5 w-2.5 rounded-sm', dot)} />
      {label}
    </li>
  );
}
