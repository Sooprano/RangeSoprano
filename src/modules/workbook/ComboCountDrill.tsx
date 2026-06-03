import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, RotateCcw, Trophy, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { BoardCards } from '@/modules/analysis/BoardCards';
import { CountdownBar } from '@/modules/trainer/CountdownBar';
import { generateComboQuestion, type ComboQuestion } from './comboSpots';

const AUTO_ADVANCE_MS = 2000;
const STREAK_BONUS_THRESHOLD = 5;

type Score = {
  correct: number;
  total: number;
  streak: number;
  bestStreak: number;
};

const INITIAL_SCORE: Score = { correct: 0, total: 0, streak: 0, bestStreak: 0 };

type Feedback = { picked: number; wasCorrect: boolean };

export function ComboCountDrill() {
  const [question, setQuestion] = useState<ComboQuestion>(() =>
    generateComboQuestion(),
  );
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [score, setScore] = useState<Score>(INITIAL_SCORE);
  const [autoAdvance, setAutoAdvance] = useState(true);

  const drawNext = useCallback(() => {
    setQuestion(generateComboQuestion());
    setFeedback(null);
  }, []);

  useEffect(() => {
    if (!autoAdvance || !feedback) return;
    const id = setTimeout(drawNext, AUTO_ADVANCE_MS);
    return () => clearTimeout(id);
  }, [autoAdvance, feedback, drawNext]);

  const answer = useCallback(
    (picked: number) => {
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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) {
        return;
      }
      const idx = '1234'.indexOf(e.key);
      if (idx >= 0 && idx < question.options.length) {
        e.preventDefault();
        if (!feedback) answer(question.options[idx]!);
        return;
      }
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'n' || e.key === 'N') {
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
        <SpotCard question={question} />

        <div className="mx-auto grid w-full max-w-md grid-cols-2 gap-1.5 sm:grid-cols-4">
          {question.options.map((opt, i) => {
            const isCorrect = feedback && opt === question.correct;
            const isPicked = feedback?.picked === opt;
            return (
              <button
                key={`${opt}-${i}`}
                type="button"
                disabled={feedback !== null}
                onClick={() => answer(opt)}
                className={cn(
                  'flex flex-row items-center justify-between gap-2 rounded-lg border px-3 py-2 text-base font-semibold tabular-nums',
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
                <span className="flex-1 text-center">{opt}</span>
                <span className="shrink-0 rounded bg-surface px-1 py-px text-[10px] font-medium tabular-nums tracking-wider text-content-muted">
                  {i + 1}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex min-h-[3.5rem] w-full flex-col gap-2">
          {feedback ? (
            <>
              <FeedbackPanel question={question} wasCorrect={feedback.wasCorrect} />
              {autoAdvance && (
                <CountdownBar key={score.total} durationMs={AUTO_ADVANCE_MS} />
              )}
            </>
          ) : (
            <p className="text-center text-xs text-content-muted">
              ¿Cuántos combos quedan? · teclas 1-4 · N para avanzar después de responder
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
            Siguiente
            <span className="text-[10px] uppercase tracking-wider text-white/70">↵</span>
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

      <div className="flex items-center justify-center">
        <AutoAdvanceToggle value={autoAdvance} onChange={setAutoAdvance} />
      </div>
    </div>
  );
}

function SpotCard({ question }: { question: ComboQuestion }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-bg-subtle/60 p-4">
      <p className="text-center text-sm font-medium text-content">
        ¿Cuántos combos de{' '}
        <span className="font-mono text-lg font-bold text-accent-light">
          {question.target.label}
        </span>{' '}
        quedan?
      </p>
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3">
        <div className="flex flex-col items-center gap-1">
          <span className="text-[10px] uppercase tracking-wider text-content-muted">
            Tus cartas
          </span>
          <BoardCards cards={question.heroCards} />
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-[10px] uppercase tracking-wider text-content-muted">
            Board
          </span>
          <BoardCards cards={question.board} />
        </div>
      </div>
    </div>
  );
}

function ScoreBar({ score, accuracy }: { score: Score; accuracy: number }) {
  const streakHot = score.streak >= STREAK_BONUS_THRESHOLD;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat label="Precisión" value={`${accuracy.toFixed(0)}%`} />
      <Stat label="Correctas" value={`${score.correct} / ${score.total}`} />
      <Stat
        label="Racha"
        value={String(score.streak)}
        accent={streakHot}
        {...(streakHot && {
          icon: <Trophy className="h-4 w-4" strokeWidth={2.5} />,
        })}
      />
      <Stat label="Mejor racha" value={String(score.bestStreak)} />
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
        accent ? 'border-amber-500/60 bg-amber-500/10' : 'border-border bg-surface/40',
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

function FeedbackPanel({
  question,
  wasCorrect,
}: {
  question: ComboQuestion;
  wasCorrect: boolean;
}) {
  const { baseCombos, correct, blockedBy } = question;
  const removed = baseCombos - correct;
  const cards = blockedBy.map((c) => `${c.rank}${c.suit}`).join(', ');
  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-lg border px-3 py-2.5 text-sm',
        wasCorrect
          ? 'border-emerald-500/40 bg-emerald-500/5 text-content'
          : 'border-rose-500/40 bg-rose-500/5 text-content',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        {wasCorrect ? (
          <Check className="h-4 w-4 text-emerald-400" strokeWidth={2.5} />
        ) : (
          <X className="h-4 w-4 text-rose-400" strokeWidth={2.5} />
        )}
        <span className="font-semibold">{wasCorrect ? 'Correcto' : 'Incorrecto'}</span>
        <span className="text-content-muted">·</span>
        <span className="text-content-muted">
          Quedan{' '}
          <span className="font-semibold tabular-nums text-content">{correct}</span>{' '}
          combos de{' '}
          <span className="font-mono font-medium text-content">{question.target.label}</span>
        </span>
      </div>
      <p className="text-xs text-content-muted">
        Base:{' '}
        <span className="font-medium text-content tabular-nums">{baseCombos}</span> combos
        {removed > 0 ? (
          <>
            {' · '}
            <span className="font-medium text-amber-300 tabular-nums">−{removed}</span>{' '}
            bloqueados por{' '}
            <span className="font-mono text-content">{cards}</span>
          </>
        ) : (
          ' · sin bloqueadores en el board ni en tus cartas'
        )}
        {' · quedan '}
        <span className="font-medium text-content tabular-nums">{correct}</span>.
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
          value ? 'border-accent bg-accent' : 'border-border bg-surface',
        )}
      />
      Auto-avance ({(AUTO_ADVANCE_MS / 1000).toFixed(1)}s)
    </label>
  );
}
