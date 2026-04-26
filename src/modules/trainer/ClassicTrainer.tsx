import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Check, RotateCcw, SkipForward, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { Action, Range } from '@/types/poker';
import { ACTION_META, ORDERED_ACTIONS } from '@/utils/actionMeta';
import {
  sampleTrainerHand,
  type TrainerHand,
} from '@/utils/trainerSampler';
import { PokerTable } from './PokerTable';

type ClassicTrainerProps = {
  range: Range;
};

type Feedback = {
  picked: Action;
  expected: Action;
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

  const answer = useCallback(
    (picked: Action) => {
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
      const idx = '12345'.indexOf(e.key);
      if (idx >= 0 && idx < ORDERED_ACTIONS.length) {
        e.preventDefault();
        if (!feedback) answer(ORDERED_ACTIONS[idx]!);
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
  }, [feedback, answer, drawNext, skip]);

  const accuracy = useMemo(
    () => (score.total === 0 ? 0 : (score.correct / score.total) * 100),
    [score],
  );

  if (!current) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center rounded-xl border border-dashed border-border p-6 text-center text-sm text-content-muted">
        Loading session…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ScoreBar score={score} accuracy={accuracy} />

      <div className="flex flex-col items-center gap-6 rounded-xl border border-border bg-surface/60 p-6 shadow-surface">
        <PokerTable
            heroPosition={range.position}
            hand={current.hand}
            {...(range.villainPosition !== undefined && { villainPosition: range.villainPosition })}
          />

        <ActionGrid
          presentActions={ORDERED_ACTIONS}
          feedback={feedback}
          onAnswer={answer}
        />

        <div className="min-h-[5rem] w-full">
          {feedback ? (
            <FeedbackPanel feedback={feedback} />
          ) : (
            <p className="text-center text-xs text-content-muted">
              Pick an action · keys 1-5 · S to skip
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
                Next hand
                <span className="text-[10px] uppercase tracking-wider text-white/70">
                  Enter
                </span>
              </>
            ) : (
              <>
                <SkipForward className="h-3.5 w-3.5" strokeWidth={2.25} />
                Skip
              </>
            )}
          </button>
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-content-muted hover:bg-surface-hover hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
          >
            <RotateCcw className="h-3.5 w-3.5" strokeWidth={2.25} />
            Reset score
          </button>
        </div>
      </div>
    </div>
  );
}

function ScoreBar({ score, accuracy }: { score: Score; accuracy: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat label="Accuracy" value={`${accuracy.toFixed(0)}%`} />
      <Stat label="Correct" value={`${score.correct} / ${score.total}`} />
      <Stat label="Streak" value={String(score.streak)} />
      <Stat label="Best streak" value={String(score.bestStreak)} />
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
  presentActions: Action[];
  feedback: Feedback | null;
  onAnswer: (action: Action) => void;
};

function ActionGrid({ presentActions, feedback, onAnswer }: ActionGridProps) {
  return (
    <div className="grid w-full max-w-md grid-cols-2 gap-2 sm:grid-cols-5">
      {presentActions.map((action, i) => {
        const meta = ACTION_META[action];
        const isExpected = feedback?.expected === action;
        const isPicked = feedback?.picked === action;
        return (
          <button
            key={action}
            type="button"
            disabled={feedback !== null}
            onClick={() => onAnswer(action)}
            className={cn(
              'flex flex-col items-center gap-1 rounded-lg border px-3 py-3 text-sm font-medium',
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
            <span aria-hidden className={cn('h-3 w-3 rounded-sm', meta.swatchClass)} />
            <span>{meta.label}</span>
            <span className="text-[10px] uppercase tracking-wider text-content-muted">
              {i + 1}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function FeedbackPanel({ feedback }: { feedback: Feedback }) {
  const expectedMeta = ACTION_META[feedback.expected];
  const cell = feedback.hand.cell;
  const sumWeights = cell?.actions.reduce((s, a) => s + a.weight, 0) ?? 0;
  const residualFold = cell ? Math.max(0, 100 - sumWeights) : 100;
  const breakdown = cell
    ? [
        ...cell.actions.map((a) => ({ action: a.action, weight: a.weight })),
        ...(residualFold > 0
          ? [{ action: 'FOLD' as Action, weight: residualFold }]
          : []),
      ]
    : [{ action: 'FOLD' as Action, weight: 100 }];
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
          {feedback.wasCorrect ? 'Correct' : 'Incorrect'}
        </span>
        <span className="text-content-muted">·</span>
        <span className="text-content-muted">
          Expected{' '}
          <span className="inline-flex items-center gap-1 font-medium text-content">
            <span aria-hidden className={cn('h-2.5 w-2.5 rounded-sm', expectedMeta.swatchClass)} />
            {expectedMeta.label}
          </span>
        </span>
      </div>
      {isMixed && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-content-muted">
          <span>Cell strategy:</span>
          {breakdown.map((b) => {
            const meta = ACTION_META[b.action];
            return (
              <span key={b.action} className="inline-flex items-center gap-1">
                <span aria-hidden className={cn('h-2 w-2 rounded-sm', meta.swatchClass)} />
                <span className="text-content">{meta.label}</span>
                <span className="tabular-nums">{b.weight.toFixed(0)}%</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
