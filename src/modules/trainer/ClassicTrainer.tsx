import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

const AUTO_ADVANCE_MS = 1500;
import { Check, RotateCcw, SkipForward, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { ActionDef, ActionId, Range } from '@/types/poker';
import { actionColor, actionDefOf, actionLabel } from '@/utils/actionMeta';
import {
  sampleTrainerHand,
  type TrainerHand,
} from '@/utils/trainerSampler';
import { PokerTable } from './PokerTable';
import { CountdownBar } from './CountdownBar';

const FOLD_ID: ActionId = 'FOLD';

function foldDefOrFallback(actions: ActionDef[]): ActionDef {
  return (
    actions.find((a) => a.id === FOLD_ID) ?? {
      id: FOLD_ID,
      label: 'Fold',
      color: '#3f3a5c',
      order: Number.POSITIVE_INFINITY,
    }
  );
}

type ClassicTrainerProps = {
  range: Range;
};

type Feedback = {
  picked: ActionId;
  expected: ActionId;
  wasCorrect: boolean;
  hand: TrainerHand;
};

type Score = {
  correct: number;
  total: number;
  streak: number;
  bestStreak: number;
};

const INITIAL_SCORE: Score = {
  correct: 0,
  total: 0,
  streak: 0,
  bestStreak: 0,
};

export function ClassicTrainer({ range }: ClassicTrainerProps) {
  const [current, setCurrent] = useState<TrainerHand | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [score, setScore] = useState<Score>(INITIAL_SCORE);
  const rangeIdRef = useRef(range.id);

  const drawNext = useCallback(() => {
    setCurrent(sampleTrainerHand(range));
    setFeedback(null);
  }, [range]);

  // Reset session when the range changes.
  useEffect(() => {
    if (rangeIdRef.current !== range.id) {
      rangeIdRef.current = range.id;
      setScore(INITIAL_SCORE);
    }
    setFeedback(null);
    setCurrent(sampleTrainerHand(range));
  }, [range]);

  // Auto-advance to next hand after 1.5s when feedback is shown
  useEffect(() => {
    if (!feedback) return;
    const id = setTimeout(drawNext, AUTO_ADVANCE_MS);
    return () => clearTimeout(id);
  }, [feedback, drawNext]);

  const orderedActions = useMemo(
    () => [...range.actions].sort((a, b) => a.order - b.order),
    [range.actions],
  );

  const answer = useCallback(
    (picked: ActionId) => {
      if (!current || feedback) return;
      const wasCorrect = picked === current.expectedAction;
      setFeedback({
        picked,
        expected: current.expectedAction,
        wasCorrect,
        hand: current,
      });
      setScore((s) => {
        const streak = wasCorrect ? s.streak + 1 : 0;
        return {
          correct: s.correct + (wasCorrect ? 1 : 0),
          total: s.total + 1,
          streak,
          bestStreak: Math.max(s.bestStreak, streak),
        };
      });
    },
    [current, feedback],
  );

  const skip = useCallback(() => {
    if (!current) return;
    drawNext();
  }, [current, drawNext]);

  const reset = useCallback(() => {
    setScore(INITIAL_SCORE);
    drawNext();
  }, [drawNext]);

  // Keyboard: 1-5 to answer, Enter/Space/N to advance, S to skip.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target?.closest(
          'input, textarea, select, [contenteditable="true"], [role="grid"]',
        )
      ) {
        return;
      }
      const idx = '123456789'.indexOf(e.key);
      if (idx >= 0 && idx < orderedActions.length) {
        e.preventDefault();
        if (!feedback) answer(orderedActions[idx]!.id);
        return;
      }
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        if (feedback) drawNext();
        return;
      }
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        if (!feedback) skip();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [feedback, answer, drawNext, skip, orderedActions]);

  const accuracy = useMemo(
    () => (score.total === 0 ? 0 : (score.correct / score.total) * 100),
    [score],
  );

  if (!current) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center rounded-xl border border-dashed border-border p-6 text-center text-sm text-content-muted">
        Cargando sesión…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ScoreBar score={score} accuracy={accuracy} />

      <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-surface/60 p-4 shadow-surface sm:p-5">
        <PokerTable
            heroPosition={range.position}
            hand={current.hand}
            tableFormat={range.tableFormat}
            {...(range.villainPosition !== undefined && { villainPosition: range.villainPosition })}
          />

        <ActionGrid
          actions={orderedActions}
          feedback={feedback}
          onAnswer={answer}
        />

        <div className="min-h-[3.5rem] w-full flex flex-col gap-2">
          {feedback ? (
            <>
              <FeedbackPanel feedback={feedback} actions={range.actions} />
              <CountdownBar key={score.total} durationMs={AUTO_ADVANCE_MS} />
            </>
          ) : (
            <p className="text-center text-xs text-content-muted">
              Elige una acción · teclas 1-5 · S para omitir
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={feedback ? drawNext : skip}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-accent-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
          >
            {feedback ? (
              <>
                Siguiente mano
                <span className="text-[10px] uppercase tracking-wider text-white/70">
                  ↵ / auto
                </span>
              </>
            ) : (
              <>
                <SkipForward className="h-3.5 w-3.5" strokeWidth={2.25} />
                Omitir
              </>
            )}
          </button>
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-content-muted hover:bg-surface-hover hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
          >
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={2.25} />
            Reiniciar puntaje
          </button>
        </div>
      </div>
    </div>
  );
}

function ScoreBar({ score, accuracy }: { score: Score; accuracy: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat label="Precisión" value={`${accuracy.toFixed(0)}%`} />
      <Stat label="Correctas" value={`${score.correct} / ${score.total}`} />
      <Stat label="Racha" value={String(score.streak)} />
      <Stat label="Mejor racha" value={String(score.bestStreak)} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface/40 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-content-muted">
        {label}
      </p>
      <p className="text-lg font-semibold tabular-nums text-content">{value}</p>
    </div>
  );
}


type ActionGridProps = {
  actions: ActionDef[];
  feedback: Feedback | null;
  onAnswer: (action: ActionId) => void;
};

function ActionGrid({ actions, feedback, onAnswer }: ActionGridProps) {
  return (
    <div className="grid w-full max-w-md grid-cols-2 gap-1.5 sm:grid-cols-3">
      {actions.map((def, i) => {
        const isExpected = feedback?.expected === def.id;
        const isPicked = feedback?.picked === def.id;
        return (
          <button
            key={def.id}
            type="button"
            disabled={feedback !== null}
            onClick={() => onAnswer(def.id)}
            className={cn(
              'flex flex-row items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium',
              'transition-colors duration-150 ease-out-soft',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light',
              feedback
                ? isExpected
                  ? 'border-emerald-500/60 bg-emerald-500/10 text-content'
                  : isPicked
                    ? 'border-rose-500/60 bg-rose-500/10 text-content'
                    : 'border-border bg-surface/40 text-content-muted opacity-60'
                : 'border-border bg-surface/40 text-content hover:bg-surface-hover',
            )}
          >
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: def.color }}
            />
            <span className="flex-1 truncate text-left">{def.label}</span>
            <span className="shrink-0 rounded bg-surface px-1 py-px text-[10px] tabular-nums tracking-wider text-content-muted">
              {i + 1}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function FeedbackPanel({
  feedback,
  actions,
}: {
  feedback: Feedback;
  actions: ActionDef[];
}) {
  const fold = foldDefOrFallback(actions);
  const cell = feedback.hand.cell;
  const sumWeights = cell?.actions.reduce((s, a) => s + a.weight, 0) ?? 0;
  const residualFold = cell ? Math.max(0, 100 - sumWeights) : 100;
  const breakdown = cell
    ? [
        ...cell.actions.map((a) => ({ action: a.action, weight: a.weight })),
        ...(residualFold > 0
          ? [{ action: fold.id, weight: residualFold }]
          : []),
      ]
    : [{ action: fold.id, weight: 100 }];
  const isMixed = breakdown.length > 1;

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-lg border px-3 py-2 text-sm',
        feedback.wasCorrect
          ? 'border-emerald-500/40 bg-emerald-500/5 text-content'
          : 'border-rose-500/40 bg-rose-500/5 text-content',
      )}
    >
      <div className="flex items-center gap-2">
        {feedback.wasCorrect ? (
          <Check className="h-4 w-4 text-emerald-400" strokeWidth={2.5} />
        ) : (
          <X className="h-4 w-4 text-rose-400" strokeWidth={2.5} />
        )}
        <span className="font-semibold">
          {feedback.wasCorrect ? 'Correcto' : 'Incorrecto'}
        </span>
        <span className="text-content-muted">·</span>
        <span className="text-content-muted">
          Esperada{' '}
          <span className="inline-flex items-center gap-1 font-medium text-content">
            <span
              aria-hidden
              className="h-2.5 w-2.5 rounded-sm"
              style={{
                backgroundColor:
                  actionDefOf(actions, feedback.expected)?.color ?? fold.color,
              }}
            />
            {actionLabel(actions, feedback.expected)}
          </span>
        </span>
      </div>
      {isMixed && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-content-muted">
          <span>Cell strategy:</span>
          {breakdown.map((b) => (
            <span key={b.action} className="inline-flex items-center gap-1">
              <span
                aria-hidden
                className="h-2 w-2 rounded-sm"
                style={{ backgroundColor: actionColor(actions, b.action) }}
              />
              <span className="text-content">{actionLabel(actions, b.action)}</span>
              <span className="tabular-nums">{b.weight.toFixed(0)}%</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
