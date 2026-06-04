import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Pencil, RotateCcw, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { CALC_META, type CalcMode } from '@/modules/calculators/calcMeta';
import { BoardCards } from '@/modules/analysis/BoardCards';
import { flopzillaInputsFor } from '@/utils/spotCalc';
import { CountdownBar } from '@/modules/trainer/CountdownBar';
import { generateQuizQuestion, type QuizQuestion } from './quizSpots';
import { AutoAdvanceToggle, ScoreBar } from './drillUi';
import {
  AUTO_ADVANCE_MS,
  INITIAL_SCORE,
  tallyScore,
  type Score,
} from './drillScore';

type Feedback = { picked: CalcMode; wasCorrect: boolean };

export function WhichCalcDrill() {
  const [question, setQuestion] = useState<QuizQuestion>(() =>
    generateQuizQuestion(),
  );
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [score, setScore] = useState<Score>(INITIAL_SCORE);
  const [autoAdvance, setAutoAdvance] = useState(false);

  const drawNext = useCallback(() => {
    setQuestion(generateQuizQuestion());
    setFeedback(null);
  }, []);

  // Auto-advance: tras feedback dispara drawNext; si el usuario avanza antes,
  // drawNext limpia feedback y cancela el timer.
  useEffect(() => {
    if (!autoAdvance || !feedback) return;
    const id = setTimeout(drawNext, AUTO_ADVANCE_MS);
    return () => clearTimeout(id);
  }, [autoAdvance, feedback, drawNext]);

  const answer = useCallback(
    (picked: CalcMode) => {
      if (feedback) return;
      const wasCorrect = picked === question.spot.correct;
      setFeedback({ picked, wasCorrect });
      setScore((s) => tallyScore(s, wasCorrect));
    },
    [feedback, question.spot.correct],
  );

  const reset = useCallback(() => {
    setScore(INITIAL_SCORE);
    drawNext();
  }, [drawNext]);

  // Teclado: 1-4 responder, Enter/Space/N avanzar.
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

        <p className="text-center text-sm font-medium text-content">
          ¿Qué calculadora usarías para analizar este spot?
        </p>

        <div className="mx-auto grid w-full max-w-xl grid-cols-1 gap-1.5 sm:grid-cols-2">
          {question.options.map((mode, i) => {
            const meta = CALC_META[mode];
            const Icon = meta.Icon;
            const isCorrect = feedback && mode === question.spot.correct;
            const isPicked = feedback?.picked === mode;
            return (
              <button
                key={`${question.spot.id}-${mode}`}
                type="button"
                disabled={feedback !== null}
                onClick={() => answer(mode)}
                className={cn(
                  'flex flex-row items-center gap-2.5 rounded-lg border px-3 py-2 text-sm font-medium',
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
                <Icon className="h-4 w-4 shrink-0 text-accent-light" strokeWidth={2.25} />
                <span className="flex-1 text-left">{meta.label}</span>
                <span className="shrink-0 rounded bg-surface px-1 py-px text-[10px] tabular-nums tracking-wider text-content-muted">
                  {i + 1}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex min-h-[3.5rem] w-full flex-col gap-2">
          {feedback ? (
            <>
              <FeedbackPanel
                wasCorrect={feedback.wasCorrect}
                correct={question.spot.correct}
                rationale={question.spot.rationale}
              />
              {autoAdvance && (
                <CountdownBar key={score.total} durationMs={AUTO_ADVANCE_MS} />
              )}
            </>
          ) : (
            <p className="text-center text-xs text-content-muted">
              Elige la herramienta · teclas 1-4 · N para avanzar después de responder
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

function SpotCard({ question }: { question: QuizQuestion }) {
  const { spot } = question;
  const hasCards = spot.hero.length > 0 || spot.board.length > 0;
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-bg-subtle/60 p-4">
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-content-muted">
        {spot.context}
      </span>

      {hasCards && (
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3">
          {spot.hero.length > 0 && (
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] uppercase tracking-wider text-content-muted">
                Tu mano
              </span>
              <BoardCards cards={spot.hero} />
            </div>
          )}
          {spot.board.length > 0 && (
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] uppercase tracking-wider text-content-muted">
                Board
              </span>
              <BoardCards cards={spot.board} />
            </div>
          )}
        </div>
      )}

      {spot.chips.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {spot.chips.map((c) => (
            <Chip key={c.label} label={c.label} value={c.value} accent={c.accent ?? false} />
          ))}
        </div>
      )}

      <p className="max-w-md text-center text-sm text-content">{spot.prompt}</p>
    </div>
  );
}

function Chip({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-0.5 rounded-lg border px-3 py-1.5',
        accent ? 'border-accent/40 bg-accent/5' : 'border-border bg-surface/60',
      )}
    >
      <span className="text-[10px] uppercase tracking-wider text-content-muted">{label}</span>
      <span
        className={cn(
          'text-sm font-semibold tabular-nums',
          accent ? 'text-accent-light' : 'text-content',
        )}
      >
        {value}
      </span>
    </div>
  );
}

function FeedbackPanel({
  wasCorrect,
  correct,
  rationale,
}: {
  wasCorrect: boolean;
  correct: CalcMode;
  rationale: string;
}) {
  const meta = CALC_META[correct];
  const Icon = meta.Icon;
  const flopzilla = flopzillaInputsFor(correct);
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
        <span className="inline-flex items-center gap-1.5 text-content-muted">
          La calculadora es
          <span className="inline-flex items-center gap-1 font-medium text-content">
            <Icon className="h-3.5 w-3.5 text-accent-light" strokeWidth={2.25} />
            {meta.label}
          </span>
        </span>
      </div>
      <p className="text-xs text-content-muted">{rationale}</p>
      {flopzilla.length > 0 && (
        <p className="flex items-start gap-1.5 text-xs text-content-muted">
          <Pencil className="mt-0.5 h-3 w-3 shrink-0 text-amber-300" strokeWidth={2.5} />
          <span>
            De Flopzilla traes: <span className="text-content">{flopzilla.join(' · ')}</span>
          </span>
        </p>
      )}
    </div>
  );
}
