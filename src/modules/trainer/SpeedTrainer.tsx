import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ChevronDown,
  ChevronUp,
  Crown,
  Flag,
  Play,
  RotateCcw,
  Settings2,
  Square,
  Trophy,
  X,
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
import {
  actionColor,
  actionLabel,
  buildActionDefMap,
  trainerAnswerActions,
} from '@/utils/actionMeta';
import { expandPlus } from '@/utils/handRangeParser';
import { sampleTrainerHand, type TrainerHand } from '@/utils/trainerSampler';
import { useActionHotkeys } from '@/hooks/useActionHotkeys';
import { computeRangeDiff, type RangeDiff } from '@/utils/rangeDiff';
import { DiffGrid } from './DiffGrid';
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

const CLASSIC_DURATIONS = [30, 60, 300, 600] as const;
const DRAWING_DURATIONS = [30, 45, 60, 90] as const;
const DEFAULT_CLASSIC = 60;
const DEFAULT_DRAWING = 60;
const FEEDBACK_FLASH_MS = 220;

function formatDurationLabel(secs: number): string {
  if (secs < 60) return `${secs}s`;
  if (secs % 60 === 0) return `${secs / 60}min`;
  return `${secs}s`;
}

export type ClassicMistake = { trainerHand: TrainerHand; picked: ActionId };

type ClassicResult = Pick<
  SpeedClassicEntry,
  'correct' | 'total' | 'hpm' | 'accuracyPct'
> & { mistakes: ClassicMistake[] };

type DrawingResult = Pick<
  SpeedDrawingEntry,
  'matchCombos' | 'truthCombos' | 'guessCombos' | 'accuracyPct'
> & { diff: RangeDiff };

type SpeedTrainerProps = { range: Range };

export function SpeedTrainer({ range }: SpeedTrainerProps) {
  const [phase, setPhase] = useState<Phase>('config');
  const [style, setStyle] = useState<SpeedStyle>('classic');
  const [duration, setDuration] = useState<number>(DEFAULT_CLASSIC);
  const [runId, setRunId] = useState(0);
  const [lastEntry, setLastEntry] = useState<SpeedEntry | null>(null);
  const [madeTop, setMadeTop] = useState(false);
  const [sessionMistakes, setSessionMistakes] = useState<ClassicMistake[] | null>(null);
  const [sessionDiff, setSessionDiff] = useState<RangeDiff | null>(null);

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
      setSessionMistakes(null);
      setSessionDiff(null);
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
      const { mistakes, ...entryFields } = r;
      const entry: SpeedClassicEntry = {
        style: 'classic',
        durationSec: duration,
        dateIso: new Date().toISOString(),
        ...entryFields,
      };
      const top = addEntry(range.id, entry);
      setLastEntry(entry);
      setMadeTop(top);
      setSessionMistakes(mistakes);
      setSessionDiff(null);
      setPhase('finished');
    },
    [addEntry, duration, range.id],
  );

  const finishDrawing = useCallback(
    (r: DrawingResult) => {
      const { diff, ...entryFields } = r;
      const entry: SpeedDrawingEntry = {
        style: 'drawing',
        durationSec: duration,
        dateIso: new Date().toISOString(),
        ...entryFields,
      };
      const top = addEntry(range.id, entry);
      setLastEntry(entry);
      setMadeTop(top);
      setSessionMistakes(null);
      setSessionDiff(diff);
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
      />
    );
  }

  return (
    <FinishedScreen
      entry={lastEntry}
      madeTop={madeTop}
      board={board}
      rangeActions={trainerAnswerActions(range.actions)}
      sessionMistakes={sessionMistakes}
      sessionDiff={sessionDiff}
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
          Modo velocidad
        </div>
        <p className="mt-1 text-xs text-content-muted">
          Corre contra el reloj con tu rango. Los 5 mejores resultados por modo se guardan localmente.
        </p>

        <div className="mt-4 flex flex-col gap-3">
          <Field label="Modo">
            <ToggleGroup
              options={[
                { value: 'classic', label: 'Clásico' },
                { value: 'drawing', label: 'Dibujo' },
              ]}
              value={style}
              onChange={onStyleChange}
            />
          </Field>

          <Field label="Duración">
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
                  {formatDurationLabel(d)}
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
          Iniciar {formatDurationLabel(duration)} {style === 'classic' ? 'clásico' : 'dibujo'}
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
    () => trainerAnswerActions(range.actions),
    [range.actions],
  );
  const hk = useActionHotkeys(orderedActions);

  const [hand, setHand] = useState<TrainerHand>(() => sampleTrainerHand(range));
  const [feedback, setFeedback] = useState<{ picked: ActionId; correct: boolean } | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [remaining, setRemaining] = useState<number>(duration);

  const scoreRef = useRef(score);
  scoreRef.current = score;
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  const doneRef = useRef(false);
  const mistakesRef = useRef<ClassicMistake[]>([]);

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
          mistakes: mistakesRef.current,
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
      if (!correct) {
        mistakesRef.current = [...mistakesRef.current, { trainerHand: hand, picked }];
      }
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
      const actionId = hk.actionForKey(e.key);
      if (actionId) {
        e.preventDefault();
        answer(actionId);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [answer, hk.actionForKey]);

  const accuracy = score.total === 0 ? 0 : (score.correct / score.total) * 100;

  return (
    <div className="flex flex-col gap-4">
      <RunHeader
        remaining={remaining}
        duration={duration}
        onEnd={onCancel}
        endLabel="End"
        rightStats={[
          { label: 'Correctas', value: `${score.correct} / ${score.total}` },
          { label: 'Precisión', value: `${accuracy.toFixed(0)}%` },
        ]}
      />

      <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-surface/60 p-4 shadow-surface sm:p-5">
        <PokerTable
          heroPosition={range.position}
          hand={hand.hand}
          tableFormat={range.tableFormat}
          {...(range.villainPosition !== undefined && { villainPosition: range.villainPosition })}
        />

        <div className="grid w-full max-w-md grid-cols-2 gap-1.5 sm:grid-cols-3">
          {orderedActions.map((def) => {
            const isPicked = feedback?.picked === def.id;
            const flashCorrect = feedback && isPicked && feedback.correct;
            const flashWrong = feedback && isPicked && !feedback.correct;
            const isAssigning = hk.assigningId === def.id;
            const key = hk.effectiveKey(def.id);
            return (
              <button
                key={def.id}
                type="button"
                disabled={feedback !== null}
                onClick={() => answer(def.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  hk.beginAssign(def.id);
                }}
                title="Clic derecho para asignar tu tecla"
                className={cn(
                  'flex flex-row items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium',
                  'transition-colors duration-100',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light',
                  isAssigning
                    ? 'border-accent bg-accent/10 text-content ring-1 ring-accent'
                    : flashCorrect
                      ? 'border-emerald-500/70 bg-emerald-500/15 text-content'
                      : flashWrong
                        ? 'border-rose-500/70 bg-rose-500/15 text-content'
                        : 'border-border bg-surface/40 text-content hover:bg-surface-hover',
                )}
              >
                <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: def.color }} />
                <span className="flex-1 truncate text-left">{def.label}</span>
                <span
                  className={cn(
                    'shrink-0 rounded px-1 py-px text-[10px] font-semibold uppercase tracking-wider tabular-nums',
                    isAssigning ? 'bg-accent/20 text-accent-light' : 'bg-surface text-content-muted',
                  )}
                >
                  {isAssigning ? '…' : key || '·'}
                </span>
              </button>
            );
          })}
        </div>

        <p className="text-center text-xs text-content-muted">
          {hk.assigningId
            ? 'Presioná una tecla para asignarla · Esc cancela · ⌫ borra'
            : `Elige rápido · ${formatDurationLabel(duration)} total · clic derecho en un botón para asignar tu tecla`}
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
}: {
  range: Range;
  duration: number;
  onFinish: (r: DrawingResult) => void;
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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const start = performance.now();
    intervalRef.current = setInterval(() => {
      const elapsed = (performance.now() - start) / 1000;
      const r = Math.max(0, duration - elapsed);
      setRemaining(r);
      if (r <= 0 && !doneRef.current) {
        doneRef.current = true;
        if (intervalRef.current) clearInterval(intervalRef.current);
        const diff = computeRangeDiff(guessRef.current, range.cells);
        onFinishRef.current({
          matchCombos: diff.matchCombos,
          truthCombos: diff.truthCombos,
          guessCombos: diff.guessCombos,
          accuracyPct: diff.accuracyPct,
          diff,
        });
      }
    }, 100);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [duration, range.cells]);

  const handleFinishEarly = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    if (intervalRef.current) clearInterval(intervalRef.current);
    const diff = computeRangeDiff(guessRef.current, range.cells);
    onFinishRef.current({
      matchCombos: diff.matchCombos,
      truthCombos: diff.truthCombos,
      guessCombos: diff.guessCombos,
      accuracyPct: diff.accuracyPct,
      diff,
    });
  }, [range.cells]);

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

  const onPaintPlus = useCallback(
    (h: HandNotation) => {
      if (doneRef.current) return;
      const hands = expandPlus(h);
      setGuess((g) => {
        const next = { ...g };
        for (const hh of hands) {
          next[hh] = { hand: hh, actions: [{ action: selectedAction.id, weight: 100 }] };
        }
        return next;
      });
    },
    [selectedAction],
  );

  return (
    <div className="flex flex-col gap-4">
      <RunHeader
        remaining={remaining}
        duration={duration}
        onEnd={handleFinishEarly}
        endLabel="Finish"
        rightStats={[{ label: 'Pintadas', value: `${Object.keys(guess).length} manos` }]}
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
        onCellPaintPlus={onPaintPlus}
      />

      <p className="text-center text-xs text-content-muted">
        Clic o arrastre para pintar · clic derecho o doble toque para borrar · Ctrl+clic derecho para mano+
      </p>
    </div>
  );
}

/* ----------------------------- RUN HEADER ------------------------------ */

function RunHeader({
  remaining,
  duration,
  onEnd,
  endLabel = 'End',
  rightStats,
}: {
  remaining: number;
  duration: number;
  onEnd: () => void;
  endLabel?: string;
  rightStats: ReadonlyArray<{ label: string; value: string }>;
}) {
  const pct = Math.max(0, Math.min(1, remaining / duration));
  const danger = remaining <= 5;
  const isFinish = endLabel === 'Finish';
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
            of {formatDurationLabel(duration)}
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
            onClick={onEnd}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light',
              isFinish
                ? 'border-accent/60 bg-accent/10 text-accent-light hover:bg-accent/20'
                : 'border-border text-content-muted hover:bg-surface-hover hover:text-content',
            )}
            aria-label={isFinish ? 'Finish run and save' : 'End run'}
          >
            {isFinish
              ? <Flag className="h-3 w-3" strokeWidth={2.5} />
              : <Square className="h-3 w-3" strokeWidth={2.5} />}
            {endLabel}
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
  rangeActions,
  sessionMistakes,
  sessionDiff,
  onPlayAgain,
  onChangeConfig,
}: {
  entry: SpeedEntry | null;
  madeTop: boolean;
  board: RangeLeaderboard;
  rangeActions: ActionDef[];
  sessionMistakes: ClassicMistake[] | null;
  sessionDiff: RangeDiff | null;
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
            {entry.style === 'classic' ? 'Clásico' : 'Dibujo'} · {formatDurationLabel(entry.durationSec)} · finalizado
          </div>
          {madeTop && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-300">
              <Trophy className="h-3.5 w-3.5" strokeWidth={2.5} />
              ¡Top 5 nuevo!
            </span>
          )}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Precisión" value={`${entry.accuracyPct.toFixed(0)}%`} />
          {entry.style === 'classic' ? (
            <>
              <Stat label="Correctas" value={`${entry.correct} / ${entry.total}`} />
              <Stat label="Manos/min" value={entry.hpm.toFixed(1)} />
              <Stat label="Manos totales" value={String(entry.total)} />
            </>
          ) : (
            <>
              <Stat label="Acierto" value={`${Math.round(entry.matchCombos)} combos`} />
              <Stat label="Pintadas" value={`${Math.round(entry.guessCombos)} combos`} />
              <Stat label="Tamaño del rango" value={`${Math.round(entry.truthCombos)} combos`} />
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
            Jugar de nuevo
          </button>
          <button
            type="button"
            onClick={onChangeConfig}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-content-muted hover:bg-surface-hover hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
          >
            <Settings2 className="h-4 w-4" strokeWidth={2.25} />
            Cambiar config
          </button>
        </div>
      </div>

      {entry.style === 'classic' && sessionMistakes !== null && sessionMistakes.length > 0 && (
        <ErrorsPanel mistakes={sessionMistakes} rangeActions={rangeActions} />
      )}

      {entry.style === 'drawing' && sessionDiff !== null && (
        <DiffReviewPanel diff={sessionDiff} />
      )}

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

/* -------------------------- SESSION ERRORS ----------------------------- */

function ErrorsPanel({
  mistakes,
  rangeActions,
}: {
  mistakes: ClassicMistake[];
  rangeActions: ActionDef[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface/40">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-content hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-accent-light"
      >
        <span className="flex items-center gap-2">
          <X className="h-4 w-4 text-rose-400" strokeWidth={2.5} />
          Errores de sesión
          <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-rose-300">
            {mistakes.length}
          </span>
        </span>
        {open
          ? <ChevronUp className="h-4 w-4 text-content-muted" strokeWidth={2} />
          : <ChevronDown className="h-4 w-4 text-content-muted" strokeWidth={2} />}
      </button>

      {open && (
        <div className="border-t border-border px-4 py-3">
          <div className="flex flex-col gap-2">
            {mistakes.map(({ trainerHand, picked }, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg border border-border bg-surface/60 px-3 py-2 text-sm"
              >
                <span className="w-8 shrink-0 font-mono font-semibold text-content">
                  {trainerHand.hand}
                </span>
                <span className="flex items-center gap-1.5 text-rose-400">
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: actionColor(rangeActions, picked) }}
                  />
                  {actionLabel(rangeActions, picked)}
                </span>
                <span className="text-content-muted">→</span>
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: actionColor(rangeActions, trainerHand.expectedAction) }}
                  />
                  {actionLabel(rangeActions, trainerHand.expectedAction)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------- DIFF REVIEW -------------------------------- */

function DiffReviewPanel({ diff }: { diff: RangeDiff }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface/40">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-content hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-accent-light"
      >
        <span className="flex items-center gap-3">
          <span className="font-medium">Revisión de sesión</span>
          <span className="flex items-center gap-2 text-[11px] text-content-muted">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm bg-emerald-500/60" />
              {Math.round(diff.matchCombos)} match
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm bg-rose-500/60" />
              {Math.round(diff.fpCombos)} fp
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm bg-amber-500/60" />
              {Math.round(diff.fnCombos)} fn
            </span>
          </span>
        </span>
        {open
          ? <ChevronUp className="h-4 w-4 text-content-muted" strokeWidth={2} />
          : <ChevronDown className="h-4 w-4 text-content-muted" strokeWidth={2} />}
      </button>

      {open && (
        <div className="border-t border-border px-4 py-4">
          <DiffGrid diff={diff.cells} />
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-content-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500/45" />
              Acierto
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-rose-500/45" />
              Falso positivo (pintó de más)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-amber-500/45" />
              Falso negativo (mano perdida)
            </span>
          </div>
        </div>
      )}
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
          Tabla de líderes
        </div>
        {onClear && hasAny && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-content-muted hover:text-content"
          >
            Limpiar
          </button>
        )}
      </div>

      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <BoardSection title="Clásico" entries={board.classic} highlightDateIso={highlightDateIso} />
        <BoardSection title="Dibujo" entries={board.drawing} highlightDateIso={highlightDateIso} />
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
          Sin partidas todavía — ¡establecé el primer récord!
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
                  <span className="text-content-muted">{formatDurationLabel(e.durationSec)}</span>
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
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h}h`;
  const days = Math.floor(h / 24);
  if (days < 30) return `hace ${days}d`;
  return d.toISOString().slice(0, 10);
}
