import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, RotateCcw, Trophy, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import {
  ALL_KINDS,
  generateQuestion,
  KIND_LABEL,
  sizingFraction,
  type OddsQuestion,
  type QuestionKind,
  type Sizing,
} from '@/utils/potOdds';

const AUTO_ADVANCE_MS = 1500;
const STREAK_BONUS_THRESHOLD = 5;

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
  const [autoAdvance, setAutoAdvance] = useState(false);

  const enabledArr = useMemo(() => Array.from(enabled), [enabled]);

  const drawNext = useCallback(() => {
    setQuestion(generateQuestion(enabledArr));
    setFeedback(null);
  }, [enabledArr]);

  // Auto-advance: tras feedback, dispara drawNext en AUTO_ADVANCE_MS si el
  // toggle está activo. Si el usuario toca Next/Enter/N antes, ese effect se
  // cancela porque drawNext limpia feedback (setFeedback(null) en drawNext).
  useEffect(() => {
    if (!autoAdvance || !feedback) return;
    const id = setTimeout(drawNext, AUTO_ADVANCE_MS);
    return () => clearTimeout(id);
  }, [autoAdvance, feedback, drawNext]);

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

        {question.visualSize !== undefined && (
          <MiniPot size={question.visualSize} />
        )}

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

      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
        <KindFilter enabled={enabled} onToggle={toggleKind} />
        <AutoAdvanceToggle value={autoAdvance} onChange={setAutoAdvance} />
      </div>
    </div>
  );
}

function MiniPot({ size }: { size: Sizing }) {
  const fraction = sizingFraction(size);
  // Both bars share the same row width. Scale so the larger of pot=1 and bet
  // fills 100%; the smaller scales proportionally.
  const max = Math.max(1, fraction);
  const potPct = (1 / max) * 100;
  const betPct = (fraction / max) * 100;
  const overpot = fraction > 1;
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-1.5 px-1">
      <BarRow
        label="Pot"
        widthPct={potPct}
        barClass="bg-content/40"
        labelClass="text-content-muted"
      />
      <BarRow
        label="Bet"
        widthPct={betPct}
        barClass={overpot ? 'bg-amber-400' : 'bg-accent'}
        labelClass={overpot ? 'text-amber-300' : 'text-accent-light'}
      />
    </div>
  );
}

function BarRow({
  label,
  widthPct,
  barClass,
  labelClass,
}: {
  label: string;
  widthPct: number;
  barClass: string;
  labelClass: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          'w-8 shrink-0 text-[10px] font-semibold uppercase tracking-wider',
          labelClass,
        )}
      >
        {label}
      </span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface">
        <div
          className={cn('h-full rounded-full transition-[width]', barClass)}
          style={{ width: `${widthPct}%` }}
        />
      </div>
    </div>
  );
}

function ScoreBar({ score, accuracy }: { score: Score; accuracy: number }) {
  const streakHot = score.streak >= STREAK_BONUS_THRESHOLD;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat label="Accuracy" value={`${accuracy.toFixed(0)}%`} />
      <Stat label="Correct" value={`${score.correct} / ${score.total}`} />
      <Stat
        label="Streak"
        value={String(score.streak)}
        accent={streakHot}
        {...(streakHot && {
          icon: <Trophy className="h-4 w-4" strokeWidth={2.5} />,
        })}
      />
      <Stat label="Best streak" value={String(score.bestStreak)} />
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: string;
  accent?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border px-3 py-2 transition-colors',
        accent
          ? 'border-amber-500/60 bg-amber-500/10'
          : 'border-border bg-surface/40',
      )}
    >
      <p
        className={cn(
          'text-[10px] uppercase tracking-wider',
          accent ? 'text-amber-300' : 'text-content-muted',
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          'flex items-center gap-1.5 text-lg font-semibold tabular-nums',
          accent ? 'text-amber-200' : 'text-content',
        )}
      >
        {icon && <span aria-hidden>{icon}</span>}
        <span>{value}</span>
      </p>
    </div>
  );
}

function AutoAdvanceToggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label
      className={cn(
        'inline-flex cursor-pointer items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium',
        'transition-colors duration-150 ease-out-soft',
        'focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent-light',
        value
          ? 'border-accent/60 bg-accent/10 text-content'
          : 'border-border bg-surface/40 text-content-muted hover:bg-surface-hover hover:text-content',
      )}
    >
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span
        aria-hidden
        className={cn(
          'inline-block h-3 w-3 rounded-sm border',
          value
            ? 'border-accent bg-accent'
            : 'border-border bg-surface',
        )}
      />
      Auto-avance ({(AUTO_ADVANCE_MS / 1000).toFixed(1)}s)
    </label>
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
