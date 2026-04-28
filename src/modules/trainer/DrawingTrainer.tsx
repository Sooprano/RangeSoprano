import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Eye, EyeOff, RotateCcw, Save, Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { RangeGrid } from '@/components/RangeGrid';
import type {
  ActionDef,
  HandNotation,
  Range,
  RangeCellData,
} from '@/types/poker';
import { buildActionDefMap } from '@/utils/actionMeta';
import { computeRangeDiff } from '@/utils/rangeDiff';
import { DiffGrid } from './DiffGrid';

type DrawingTrainerProps = {
  range: Range;
};

type SessionRound = {
  accuracyPct: number;
  matchCombos: number;
  truthCombos: number;
};

function firstAction(actions: ActionDef[]): ActionDef {
  return [...actions].sort((a, b) => a.order - b.order)[0]!;
}

export function DrawingTrainer({ range }: DrawingTrainerProps) {
  const [guess, setGuess] = useState<Record<HandNotation, RangeCellData>>({});
  const [revealed, setRevealed] = useState(false);
  const [selectedAction, setSelectedAction] = useState<ActionDef>(
    () => firstAction(range.actions),
  );
  const [sessionRounds, setSessionRounds] = useState<SessionRound[]>([]);
  const rangeIdRef = useRef(range.id);

  useEffect(() => {
    if (rangeIdRef.current !== range.id) {
      rangeIdRef.current = range.id;
      setSelectedAction(firstAction(range.actions));
      setGuess({});
      setRevealed(false);
      setSessionRounds([]);
    }
  }, [range]);

  const orderedActions = useMemo(
    () => [...range.actions].sort((a, b) => a.order - b.order),
    [range.actions],
  );

  const actionsMap = useMemo(() => buildActionDefMap(range.actions), [range.actions]);

  const onPaint = useCallback(
    (hand: HandNotation) => {
      setGuess((g) => {
        const next = { ...g };
        next[hand] = {
          hand,
          actions: [{ action: selectedAction.id, weight: 100 }],
        };
        return next;
      });
    },
    [selectedAction],
  );

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

  const saveRound = useCallback(() => {
    if (!diff) return;
    setSessionRounds((rs) => [
      ...rs,
      {
        accuracyPct: diff.accuracyPct,
        matchCombos: diff.matchCombos,
        truthCombos: diff.truthCombos,
      },
    ]);
    setGuess({});
    setRevealed(false);
  }, [diff]);

  const resetSession = useCallback(() => {
    setSessionRounds([]);
  }, []);

  const sessionStats = useMemo(() => {
    if (sessionRounds.length === 0) return null;
    const sum = sessionRounds.reduce((s, r) => s + r.accuracyPct, 0);
    const best = sessionRounds.reduce(
      (m, r) => (r.accuracyPct > m ? r.accuracyPct : m),
      0,
    );
    return {
      rounds: sessionRounds.length,
      avg: sum / sessionRounds.length,
      best,
      lastIsBest:
        sessionRounds[sessionRounds.length - 1]!.accuracyPct === best &&
        sessionRounds.length > 1,
    };
  }, [sessionRounds]);

  return (
    <div className="flex flex-col gap-4">
      {sessionStats && (
        <SessionBar stats={sessionStats} onReset={resetSession} />
      )}

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
          {revealed && diff && (
            <button
              type="button"
              onClick={saveRound}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-sm font-medium text-emerald-300 shadow-[inset_0_0_0_1px_rgb(16_185_129/0.4)] hover:bg-emerald-500/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
            >
              <Save className="h-3.5 w-3.5" strokeWidth={2.25} />
              Save round
            </button>
          )}
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

      <ActionPalette
        actions={orderedActions}
        selected={selectedAction}
        onSelect={setSelectedAction}
      />

      {revealed && diff ? (
        <div className="flex flex-col gap-4">
          <DiffStats diff={diff} />
          <DiffGrid diff={diff.cells} />
          <DiffLegend />
        </div>
      ) : (
        <RangeGrid
          cells={guess}
          actionsMap={actionsMap}
          editable
          onCellPaint={onPaint}
          onCellErase={onErase}
        />
      )}
    </div>
  );
}

function SessionBar({
  stats,
  onReset,
}: {
  stats: { rounds: number; avg: number; best: number; lastIsBest: boolean };
  onReset: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface/40 px-3 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-content-muted">
          Session
        </span>
        <span className="text-content">
          <span className="tabular-nums font-semibold">{stats.rounds}</span>{' '}
          <span className="text-content-muted">round{stats.rounds === 1 ? '' : 's'}</span>
        </span>
        <span className="text-content-muted">·</span>
        <span className="text-content">
          <span className="text-content-muted">Avg </span>
          <span className="tabular-nums font-semibold">{stats.avg.toFixed(0)}%</span>
        </span>
        <span className="text-content-muted">·</span>
        <span className={cn('text-content', stats.lastIsBest && 'text-emerald-300')}>
          <span className="text-content-muted">Best </span>
          <span className="tabular-nums font-semibold">{stats.best.toFixed(0)}%</span>
          {stats.lastIsBest && <span className="ml-1">★</span>}
        </span>
      </div>
      <button
        type="button"
        onClick={onReset}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-content-muted hover:bg-surface-hover hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
      >
        <Trash2 className="h-3 w-3" strokeWidth={2.25} />
        Reset session
      </button>
    </div>
  );
}

function ActionPalette({
  actions,
  selected,
  onSelect,
}: {
  actions: ActionDef[];
  selected: ActionDef;
  onSelect: (def: ActionDef) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Paint action">
      {actions.map((def) => {
        const isSelected = def.id === selected.id;
        return (
          <button
            key={def.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onSelect(def)}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium',
              'transition-colors duration-100',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light',
              isSelected
                ? 'border-transparent text-content shadow-[inset_0_0_0_2px_rgb(255_255_255/0.15)]'
                : 'border-border bg-surface/40 text-content-muted hover:bg-surface-hover hover:text-content',
            )}
            style={isSelected ? { backgroundColor: def.color + '33', borderColor: def.color } : undefined}
          >
            <span
              aria-hidden
              className="h-3 w-3 flex-none rounded-sm"
              style={{ backgroundColor: def.color }}
            />
            {def.label}
          </button>
        );
      })}
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
      <Legend dot="bg-emerald-500/70" label="Match (correct action)" />
      <Legend dot="bg-rose-500/70" label="False positive (wrong action or not in range)" />
      <Legend dot="bg-amber-500/70" label="False negative (range had it, you missed)" />
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
