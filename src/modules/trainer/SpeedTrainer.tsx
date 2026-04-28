import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Crown,
  Play,
  RotateCcw,
  Settings2,
  Square,
  Trophy,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { RangeGrid } from '@/components/RangeGrid';
import type {
  ActionDef,
  ActionId,
  HandNotation,
  Range,
  RangeCellData,
} from '@/types/poker';
import { buildActionDefMap } from '@/utils/actionMeta';
import { sampleTrainerHand, type TrainerHand } from '@/utils/trainerSampler';
import { computeRangeDiff } from '@/utils/rangeDiff';
import { PokerTable } from './PokerTable';
import {
  useLeaderboardStore,
  useRangeLeaderboard,
} from '@/store/leaderboardStore';
import type {
  RangeLeaderboard,
  SpeedClassicEntry,
  SpeedDrawingEntry,
  SpeedEntry,
} from '@/store/schemas';

type Phase = 'config' | 'running' | 'finished';
type SpeedStyle = 'classic' | 'drawing';

const CLASSIC_DURATIONS = [5, 10, 15, 30] as const;
const DRAWING_DURATIONS = [30, 45, 60] as const;
const DEFAULT_CLASSIC = 15;
const DEFAULT_DRAWING = 45;
const FEEDBACK_FLASH_MS = 220;

type ClassicResult = Pick<
  SpeedClassicEntry,
  'correct' | 'total' | 'hpm' | 'accuracyPct'
>;
type DrawingResult = Pick<
  SpeedDrawingEntry,
  'matchCombos' | 'truthCombos' | 'guessCombos' | 'accuracyPct'
>;

type SpeedTrainerProps = { range: Range };

export function SpeedTrainer({ range }: SpeedTrainerProps) {
  const [phase, setPhase] = useState<Phase>('config');
  const [style, setStyle] = useState<SpeedStyle>('classic');
  const [duration, setDuration] = useState<number>(DEFAULT_CLASSIC);
  const [runId, setRunId] = useState(0);
  const [lastEntry, setLastEntry] = useState<SpeedEntry | null>(null);
  const [madeTop, setMadeTop] = useState(false);

  const addEntry = useLeaderboardStore((s) => s.addEntry);
  const clearForRange = useLeaderboardStore((s) => s.clearForRange);
  const board = useRangeLeaderboard(range.id);

  const rangeIdRef = useRef(range.id);
  useEffect(() => {
    if (rangeIdRef.current !== range.id) {
      rangeIdRef.current = range.id;
      setPhase('config');
      setLastEntry(null);
      setMadeTop(false);
    }
  }, [range]);

  const onStyleChange = useCallback((s: SpeedStyle) => {
    setStyle(s);
    setDuration(s === 'classic' ? DEFAULT_CLASSIC : DEFAULT_DRAWING);
  }, []);

  const start = useCallback(() => {
    setRunId((n) => n + 1);
    setPhase('running');
  }, []);

  const finishClassic = useCallback(
    (r: ClassicResult) => {
      const entry: SpeedClassicEntry = {
        style: 'classic',
        durationSec: duration,
        dateIso: new Date().toISOString(),
        ...r,
      };
      const top = addEntry(range.id, entry);
      setLastEntry(entry);
      setMadeTop(top);
      setPhase('finished');
    },
    [addEntry, duration, range.id],
  );

  const finishDrawing = useCallback(
    (r: DrawingResult) => {
      const entry: SpeedDrawingEntry = {
        style: 'drawing',
        durationSec: duration,
        dateIso: new Date().toISOString(),
        ...r,
      };
      const top = addEntry(range.id, entry);
      setLastEntry(entry);
      setMadeTop(top);
      setPhase('finished');
    },
    [addEntry, duration, range.id],
  );

  const cancel = useCallback(() => setPhase('config'), []);

  if (phase === 'config') {
    return (
      <ConfigScreen
        style={style}
        duration={duration}
        board={board}
        onStyleChange={onStyleChange}
        onDurationChange={setDuration}
        onStart={start}
        onClearBoard={() => clearForRange(range.id)}
      />
    );
  }

  if (phase === 'running') {
    return style === 'classic' ? (
      <SpeedClassicRun
        key={runId}
        range={range}
        duration={duration}
        onFinish={finishClassic}
        onCancel={cancel}
      />
    ) : (
      <SpeedDrawingRun
        key={runId}
        range={range}
        duration={duration}
        onFinish={finishDrawing}
        onCancel={cancel}
      />
    );
  }

  return (
    <FinishedScreen
      entry={lastEntry}
      madeTop={madeTop}
      board={board}
      onPlayAgain={start}
      onChangeConfig={() => setPhase('config')}
    />
  );
}

/* ------------------------------- CONFIG -------------------------------- */

function ConfigScreen({
  style,
  duration,
  board,
  onStyleChange,
  onDurationChange,
  onStart,
  onClearBoard,
}: {
  style: SpeedStyle;
  duration: number;
  board: RangeLeaderboard;
  onStyleChange: (s: SpeedStyle) => void;
  onDurationChange: (n: number) => void;
  onStart: () => void;
  onClearBoard: () => void;
}) {
  const durations = style === 'classic' ? CLASSIC_DURATIONS : DRAWING_DURATIONS;

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-border bg-surface/60 p-5 shadow-surface">
        <div className="flex items-center gap-2 text-sm font-semibold text-content">
          <Zap className="h-4 w-4 text-accent" strokeWidth={2.5} />
          Speed mode
        </div>
        <p className="mt-1 text-xs text-content-muted">
          Race the clock against your range. Top 5 runs per style are saved locally.
        </p>

        <div className="mt-4 flex flex-col gap-3">
          <Field label="Style">
            <ToggleGroup
              options={[
                { value: 'classic', label: 'Classic' },
                { value: 'drawing', label: 'Drawing' },
              ]}
              value={style}
              onChange={onStyleChange}
            />
          </Field>

          <Field label="Duration">
            <div className="flex flex-wrap gap-2">
              {durations.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => onDurationChange(d)}
                  className={cn(
                    'rounded-lg border px-3 py-1.5 text-sm font-medium tabular-nums',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light',
                    duration === d
                      ? 'border-accent bg-accent/10 text-content'
                      : 'border-border bg-surface/40 text-content-muted hover:bg-surface-hover hover:text-content',
                  )}
                >
                  {d}s
                </button>
              ))}
            </div>
          </Field>
        </div>

        <button
          type="button"
          onClick={onStart}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-accent-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
        >
          <Play className="h-4 w-4" strokeWidth={2.5} />
          Start {duration}s {style}
        </button>
      </div>

      <Leaderboard board={board} highlightDateIso={null} onClear={onClearBoard} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-content-muted">{label}</span>
      {children}
    </div>
  );
}

function ToggleGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      className="inline-flex w-fit items-center gap-1 rounded-lg border border-border bg-surface/60 p-1"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'rounded-md px-3 py-1 text-sm font-medium',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light',
              active
                ? 'bg-surface text-content shadow-[inset_0_0_0_1px_rgb(var(--color-accent)/0.6)]'
                : 'text-content-muted hover:bg-surface-hover hover:text-content',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ----------------------------- CLASSIC RUN ----------------------------- */

function SpeedClassicRun({
  range,
  duration,
  onFinish,
  onCancel,
}: {
  range: Range;
  duration: number;
  onFinish: (r: ClassicResult) => void;
  onCancel: () => void;
}) {
  const orderedActions = useMemo(
    () => [...range.actions].sort((a, b) => a.order - b.order),
    [range.actions],
  );

  const [hand, setHand] = useState<TrainerHand>(() => sampleTrainerHand(range));
  const [feedback, setFeedback] = useState<{ picked: ActionId; correct: boolean } | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [remaining, setRemaining] = useState<number>(duration);

  const scoreRef = useRef(score);
  scoreRef.current = score;
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  const doneRef = useRef(false);

  useEffect(() => {
    const start = performance.now();
    const id = setInterval(() => {
      const elapsed = (performance.now() - start) / 1000;
      const r = Math.max(0, duration - elapsed);
      setRemaining(r);
      if (r <= 0 && !doneRef.current) {
        doneRef.current = true;
        clearInterval(id);
        const s = scoreRef.current;
        onFinishRef.current({
          correct: s.correct,
          total: s.total,
          accuracyPct: s.total > 0 ? (s.correct / s.total) * 100 : 0,
          hpm: s.total > 0 ? (s.total / duration) * 60 : 0,
        });
      }
    }, 100);
    return () => clearInterval(id);
  }, [duration]);

  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
  }, []);

  const answer = useCallback(
    (picked: ActionId) => {
      if (feedback || doneRef.current) return;
      const correct = picked === hand.expectedAction;
      setFeedback({ picked, correct });
      setScore((s) => ({
        correct: s.correct + (correct ? 1 : 0),
        total: s.total + 1,
      }));
      flashTimer.current = setTimeout(() => {
        setFeedback(null);
        setHand(sampleTrainerHand(range));
      }, FEEDBACK_FLASH_MS);
    },
    [feedback, hand, range],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      const idx = '123456789'.indexOf(e.key);
      if (idx >= 0 && idx < orderedActions.length) {
        e.preventDefault();
        answer(orderedActions[idx]!.id);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [answer, orderedActions]);

  const accuracy = score.total === 0 ? 0 : (score.correct / score.total) * 100;

  return (
    <div className="flex flex-col gap-4">
      <RunHeader
        remaining={remaining}
        duration={duration}
        onCancel={onCancel}
        rightStats={[
          { label: 'Correct', value: `${score.correct} / ${score.total}` },
          { label: 'Accuracy', value: `${accuracy.toFixed(0)}%` },
        ]}
      />

      <div className="flex flex-col items-center gap-5 rounded-xl border border-border bg-surface/60 p-5 shadow-surface">
        <PokerTable
          heroPosition={range.position}
          hand={hand.hand}
          tableFormat={range.tableFormat}
          {...(range.villainPosition !== undefined && { villainPosition: range.villainPosition })}
        />

        <div className="grid w-full max-w-md grid-cols-2 gap-2 sm:grid-cols-5">
          {orderedActions.map((def, i) => {
            const isPicked = feedback?.picked === def.id;
            const flashCorrect = feedback && isPicked && feedback.correct;
            const flashWrong = feedback && isPicked && !feedback.correct;
            return (
              <button
                key={def.id}
                type="button"
                disabled={feedback !== null}
                onClick={() => answer(def.id)}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-lg border px-3 py-3 text-sm font-medium',
                  'transition-colors duration-100',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light',
                  flashCorrect
                    ? 'border-emerald-500/70 bg-emerald-500/15 text-content'
                    : flashWrong
                      ? 'border-rose-500/70 bg-rose-500/15 text-content'
                      : 'border-border bg-surface/40 text-content hover:bg-surface-hover',
                )}
              >
                <span aria-hidden className="h-3 w-3 rounded-sm" style={{ backgroundColor: def.color }} />
                <span>{def.label}</span>
                <span className="text-[10px] uppercase tracking-wider text-content-muted">{i + 1}</span>
              </button>
            );
          })}
        </div>

        <p className="text-center text-xs text-content-muted">
          Pick fast · keys 1-{orderedActions.length} · {duration}s total
        </p>
      </div>
    </div>
  );
}

/* ----------------------------- DRAWING RUN ----------------------------- */

function SpeedDrawingRun({
  range,
  duration,
  onFinish,
  onCancel,
}: {
  range: Range;
  duration: number;
  onFinish: (r: DrawingResult) => void;
  onCancel: () => void;
}) {
  const orderedActions = useMemo(
    () => [...range.actions].sort((a, b) => a.order - b.order),
    [range.actions],
  );
  const actionsMap = useMemo(() => buildActionDefMap(range.actions), [range.actions]);

  const [guess, setGuess] = useState<Record<HandNotation, RangeCellData>>({});
  const [selectedAction, setSelectedAction] = useState<ActionDef>(() => orderedActions[0]!);
  const [remaining, setRemaining] = useState<number>(duration);

  const guessRef = useRef(guess);
  guessRef.current = guess;
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  const doneRef = useRef(false);

  useEffect(() => {
    const start = performance.now();
    const id = setInterval(() => {
      const elapsed = (performance.now() - start) / 1000;
      const r = Math.max(0, duration - elapsed);
      setRemaining(r);
      if (r <= 0 && !doneRef.current) {
        doneRef.current = true;
        clearInterval(id);
        const diff = computeRangeDiff(guessRef.current, range.cells);
        onFinishRef.current({
          matchCombos: diff.matchCombos,
          truthCombos: diff.truthCombos,
          guessCombos: diff.guessCombos,
          accuracyPct: diff.accuracyPct,
        });
      }
    }, 100);
    return () => clearInterval(id);
  }, [duration, range.cells]);

  const onPaint = useCallback(
    (h: HandNotation) => {
      if (doneRef.current) return;
      setGuess((g) => {
        const next = { ...g };
        next[h] = { hand: h, actions: [{ action: selectedAction.id, weight: 100 }] };
        return next;
      });
    },
    [selectedAction],
  );

  const onErase = useCallback((h: HandNotation) => {
    if (doneRef.current) return;
    setGuess((g) => {
      if (!(h in g)) return g;
      const next = { ...g };
      delete next[h];
      return next;
    });
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <RunHeader
        remaining={remaining}
        duration={duration}
        onCancel={onCancel}
        rightStats={[{ label: 'Painted', value: `${Object.keys(guess).length} hands` }]}
      />

      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Paint action">
        {orderedActions.map((def) => {
          const isSelected = def.id === selectedAction.id;
          return (
            <button
              key={def.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => setSelectedAction(def)}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light',
                isSelected
                  ? 'border-transparent text-content shadow-[inset_0_0_0_2px_rgb(255_255_255/0.15)]'
                  : 'border-border bg-surface/40 text-content-muted hover:bg-surface-hover hover:text-content',
              )}
              style={isSelected ? { backgroundColor: def.color + '33', borderColor: def.color } : undefined}
            >
              <span aria-hidden className="h-3 w-3 flex-none rounded-sm" style={{ backgroundColor: def.color }} />
              {def.label}
            </button>
          );
        })}
      </div>

      <RangeGrid
        cells={guess}
        actionsMap={actionsMap}
        editable
        onCellPaint={onPaint}
        onCellErase={onErase}
      />
    </div>
  );
}

/* ----------------------------- RUN HEADER ------------------------------ */

function RunHeader({
  remaining,
  duration,
  onCancel,
  rightStats,
}: {
  remaining: number;
  duration: number;
  onCancel: () => void;
  rightStats: ReadonlyArray<{ label: string; value: string }>;
}) {
  const pct = Math.max(0, Math.min(1, remaining / duration));
  const danger = remaining <= 5;
  return (
    <div className="rounded-xl border border-border bg-surface/60 p-3 shadow-surface">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <span
            className={cn(
              'font-mono text-3xl font-bold tabular-nums',
              danger ? 'text-rose-400' : 'text-content',
            )}
          >
            {formatTime(remaining)}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-content-muted">
            of {duration}s
          </span>
        </div>
        <div className="flex items-center gap-3">
          {rightStats.map((s) => (
            <div key={s.label} className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-content-muted">{s.label}</div>
              <div className="text-sm font-semibold tabular-nums text-content">{s.value}</div>
            </div>
          ))}
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-content-muted hover:bg-surface-hover hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
            aria-label="End run"
          >
            <Square className="h-3 w-3" strokeWidth={2.5} />
            End
          </button>
        </div>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface">
        <div
          className={cn('h-full transition-all duration-100', danger ? 'bg-rose-500' : 'bg-accent')}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  );
}

function formatTime(secs: number): string {
  const ceiled = Math.ceil(secs);
  const m = Math.floor(ceiled / 60);
  const s = ceiled % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/* ----------------------------- FINISHED -------------------------------- */

function FinishedScreen({
  entry,
  madeTop,
  board,
  onPlayAgain,
  onChangeConfig,
}: {
  entry: SpeedEntry | null;
  madeTop: boolean;
  board: RangeLeaderboard;
  onPlayAgain: () => void;
  onChangeConfig: () => void;
}) {
  if (!entry) {
    return (
      <div className="rounded-xl border border-border bg-surface/40 p-6 text-center text-sm text-content-muted">
        No result.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-border bg-surface/60 p-5 shadow-surface">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-content">
            <Zap className="h-4 w-4 text-accent" strokeWidth={2.5} />
            {entry.style === 'classic' ? 'Classic' : 'Drawing'} · {entry.durationSec}s · finished
          </div>
          {madeTop && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-300">
              <Trophy className="h-3.5 w-3.5" strokeWidth={2.5} />
              New top 5!
            </span>
          )}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Accuracy" value={`${entry.accuracyPct.toFixed(0)}%`} />
          {entry.style === 'classic' ? (
            <>
              <Stat label="Correct" value={`${entry.correct} / ${entry.total}`} />
              <Stat label="Hands/min" value={entry.hpm.toFixed(1)} />
              <Stat label="Total hands" value={String(entry.total)} />
            </>
          ) : (
            <>
              <Stat label="Match" value={`${Math.round(entry.matchCombos)} combos`} />
              <Stat label="Painted" value={`${Math.round(entry.guessCombos)} combos`} />
              <Stat label="Range size" value={`${Math.round(entry.truthCombos)} combos`} />
            </>
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onPlayAgain}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-accent-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
          >
            <RotateCcw className="h-4 w-4" strokeWidth={2.5} />
            Play again
          </button>
          <button
            type="button"
            onClick={onChangeConfig}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-content-muted hover:bg-surface-hover hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
          >
            <Settings2 className="h-4 w-4" strokeWidth={2.25} />
            Change config
          </button>
        </div>
      </div>

      <Leaderboard board={board} highlightDateIso={entry.dateIso} onClear={null} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface/40 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-content-muted">{label}</p>
      <p className="text-lg font-semibold tabular-nums text-content">{value}</p>
    </div>
  );
}

/* ---------------------------- LEADERBOARD ------------------------------ */

function Leaderboard({
  board,
  highlightDateIso,
  onClear,
}: {
  board: RangeLeaderboard;
  highlightDateIso: string | null;
  onClear: (() => void) | null;
}) {
  const hasAny = board.classic.length > 0 || board.drawing.length > 0;
  return (
    <div className="rounded-xl border border-border bg-surface/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-content">
          <Crown className="h-4 w-4 text-amber-400" strokeWidth={2.5} />
          Leaderboard
        </div>
        {onClear && hasAny && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-content-muted hover:text-content"
          >
            Clear
          </button>
        )}
      </div>

      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <BoardSection title="Classic" entries={board.classic} highlightDateIso={highlightDateIso} />
        <BoardSection title="Drawing" entries={board.drawing} highlightDateIso={highlightDateIso} />
      </div>
    </div>
  );
}

function BoardSection({
  title,
  entries,
  highlightDateIso,
}: {
  title: string;
  entries: ReadonlyArray<SpeedClassicEntry | SpeedDrawingEntry>;
  highlightDateIso: string | null;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-content-muted">{title}</div>
      {entries.length === 0 ? (
        <p className="mt-2 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-content-muted">
          No runs yet — set the first record.
        </p>
      ) : (
        <ol className="mt-2 flex flex-col gap-1">
          {entries.map((e, i) => {
            const highlight = e.dateIso === highlightDateIso;
            return (
              <li
                key={e.dateIso}
                className={cn(
                  'flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-xs tabular-nums',
                  highlight
                    ? 'border-amber-500/60 bg-amber-500/10 text-content'
                    : 'border-border bg-surface/60 text-content',
                )}
              >
                <span className="flex items-center gap-2">
                  <span className="w-4 text-content-muted">{i + 1}</span>
                  <span className="font-semibold">{e.accuracyPct.toFixed(0)}%</span>
                  <span className="text-content-muted">·</span>
                  <span className="text-content-muted">{e.durationSec}s</span>
                  <span className="text-content-muted">·</span>
                  <span>
                    {e.style === 'classic'
                      ? `${e.correct}/${e.total} · ${e.hpm.toFixed(0)} hpm`
                      : `${Math.round(e.matchCombos)} combos`}
                  </span>
                </span>
                <span className="text-content-muted">{formatRelativeDate(e.dateIso)}</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const ms = now.getTime() - d.getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return d.toISOString().slice(0, 10);
}
