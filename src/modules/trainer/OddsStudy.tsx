import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, RotateCcw, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import {
  ALL_KINDS,
  generateQuestion,
  KIND_LABEL,
  type OddsQuestion,
  type QuestionKind,
} from '@/utils/potOdds';

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

type Feedback = {
  picked: string;
  wasCorrect: boolean;
};

export function OddsStudy() {
  const [enabled, setEnabled] = useState<Set<QuestionKind>>(
    () => new Set(ALL_KINDS),
  );
  const [question, setQuestion] = useState<OddsQuestion>(() =>
    generateQuestion(ALL_KINDS),
  );
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [score, setScore] = useState<Score>(INITIAL_SCORE);

  const enabledArr = useMemo(() => Array.from(enabled), [enabled]);

  const drawNext = useCallback(() => {
    setQuestion(generateQuestion(enabledArr));
    setFeedback(null);
  }, [enabledArr]);

  const answer = useCallback(
    (picked: string) => {
      if (feedback) return;
      const wasCorrect = picked === question.correct;
      setFeedback({ picked, wasCorrect });
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
    [feedback, question.correct],
  );

  const reset = useCallback(() => {
    setScore(INITIAL_SCORE);
    drawNext();
  }, [drawNext]);

  const toggleKind = useCallback((kind: QuestionKind) => {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) {
        if (next.size === 1) return prev;
        next.delete(kind);
      } else {
        next.add(kind);
      }
      return next;
    });
  }, []);

  // Keyboard: 1-4 to answer, Enter/Space/N to advance.
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
      const idx = '1234'.indexOf(e.key);
      if (idx >= 0 && idx < question.options.length) {
        e.preventDefault();
        if (!feedback) answer(question.options[idx]!);
        return;
      }
      if (
        e.key === 'Enter' ||
        e.key === ' ' ||
        e.key === 'n' ||
        e.key === 'N'
      ) {
        e.preventDefault();
        if (feedback) drawNext();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [feedback, question, answer, drawNext]);

  const accuracy = useMemo(
    () => (score.total === 0 ? 0 : (score.correct / score.total) * 100),
    [score],
  );

  return (
    <div className="flex flex-col gap-4">
      <ScoreBar score={score} accuracy={accuracy} />

      <div className="flex flex-col items-stretch gap-4 rounded-xl border border-border bg-surface/60 p-4 shadow-surface sm:p-5">
        <div className="flex flex-col items-center gap-1 text-center">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-content-muted">
            {KIND_LABEL[question.kind]}
          </span>
          <p className="max-w-xl text-sm leading-relaxed text-content sm:text-base">
            {question.prompt}
          </p>
        </div>

        <div className="mx-auto grid w-full max-w-md grid-cols-2 gap-1.5 sm:grid-cols-4">
          {question.options.map((opt, i) => {
            const isCorrect = feedback && opt === question.correct;
            const isPicked = feedback?.picked === opt;
            return (
              <button
                key={`${question.prompt}-${opt}-${i}`}
                type="button"
                disabled={feedback !== null}
                onClick={() => answer(opt)}
                className={cn(
                  'flex flex-row items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium',
                  'transition-colors duration-150 ease-out-soft',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light',
                  feedback
                    ? isCorrect
                      ? 'border-emerald-500/60 bg-emerald-500/10 text-content'
                      : isPicked
                        ? 'border-rose-500/60 bg-rose-500/10 text-content'
                        : 'border-border bg-surface/40 text-content-muted opacity-60'
                    : 'border-border bg-surface/40 text-content hover:bg-surface-hover',
                )}
              >
                <span className="flex-1 truncate text-left tabular-nums">
                  {opt}
                </span>
                <span className="shrink-0 rounded bg-surface px-1 py-px text-[10px] tabular-nums tracking-wider text-content-muted">
                  {i + 1}
                </span>
              </button>
            );
          })}
        </div>

        <div className="min-h-[3.5rem] w-full">
          {feedback ? (
            <FeedbackPanel
              wasCorrect={feedback.wasCorrect}
              correct={question.correct}
              explanation={question.explanation}
            />
          ) : (
            <p className="text-center text-xs text-content-muted">
              Pick an answer · keys 1-4 · N to skip after answering
            </p>
          )}
        </div>

        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={drawNext}
            disabled={!feedback}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition-colors',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light',
              feedback
                ? 'bg-accent text-white hover:bg-accent-deep'
                : 'cursor-not-allowed bg-surface text-content-disabled',
            )}
          >
            Next
            <span className="text-[10px] uppercase tracking-wider text-white/70">
              ↵
            </span>
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

      <KindFilter enabled={enabled} onToggle={toggleKind} />
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

function FeedbackPanel({
  wasCorrect,
  correct,
  explanation,
}: {
  wasCorrect: boolean;
  correct: string;
  explanation: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1 rounded-lg border px-3 py-2 text-sm',
        wasCorrect
          ? 'border-emerald-500/40 bg-emerald-500/5 text-content'
          : 'border-rose-500/40 bg-rose-500/5 text-content',
      )}
    >
      <div className="flex items-center gap-2">
        {wasCorrect ? (
          <Check className="h-4 w-4 text-emerald-400" strokeWidth={2.5} />
        ) : (
          <X className="h-4 w-4 text-rose-400" strokeWidth={2.5} />
        )}
        <span className="font-semibold">
          {wasCorrect ? 'Correcto' : 'Incorrecto'}
        </span>
        {!wasCorrect && (
          <>
            <span className="text-content-muted">·</span>
            <span className="text-content-muted">
              Respuesta:{' '}
              <span className="font-medium text-content tabular-nums">
                {correct}
              </span>
            </span>
          </>
        )}
      </div>
      <p className="font-mono text-xs text-content-muted">{explanation}</p>
    </div>
  );
}

function KindFilter({
  enabled,
  onToggle,
}: {
  enabled: Set<QuestionKind>;
  onToggle: (kind: QuestionKind) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <span className="text-[10px] uppercase tracking-wider text-content-muted">
        Tipos de pregunta
      </span>
      {ALL_KINDS.map((kind) => {
        const active = enabled.has(kind);
        return (
          <button
            key={kind}
            type="button"
            onClick={() => onToggle(kind)}
            aria-pressed={active}
            className={cn(
              'rounded-full border px-2.5 py-1 text-[11px] font-medium',
              'transition-colors duration-150 ease-out-soft',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light',
              active
                ? 'border-accent/60 bg-accent/10 text-content'
                : 'border-border bg-surface/40 text-content-muted hover:bg-surface-hover hover:text-content',
            )}
          >
            {KIND_LABEL[kind]}
          </button>
        );
      })}
    </div>
  );
}
