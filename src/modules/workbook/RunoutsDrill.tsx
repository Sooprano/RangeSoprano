import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Layers, RotateCcw, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { BoardCards } from '@/modules/analysis/BoardCards';
import { CountdownBar } from '@/modules/trainer/CountdownBar';
import {
  ALL_PHASES,
  PHASE_LABEL,
  generateRunoutQuestion,
  type RunoutPhase,
  type RunoutQuestion,
} from './runoutSpots';
import { AutoAdvanceToggle, ScoreBar } from './drillUi';
import {
  AUTO_ADVANCE_MS,
  INITIAL_SCORE,
  tallyScore,
  type Score,
} from './drillScore';

type Feedback = { picked: number; wasCorrect: boolean };

export function RunoutsDrill() {
  const [phases, setPhases] = useState<Set<RunoutPhase>>(
    () => new Set(ALL_PHASES),
  );
  const [question, setQuestion] = useState<RunoutQuestion>(() =>
    generateRunoutQuestion(phases),
  );
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [score, setScore] = useState<Score>(INITIAL_SCORE);
  const [autoAdvance, setAutoAdvance] = useState(false);

  const drawNext = useCallback(() => {
    setQuestion(generateRunoutQuestion(phases));
    setFeedback(null);
  }, [phases]);

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
      setScore((s) => tallyScore(s, wasCorrect));
    },
    [feedback, question.correct],
  );

  const reset = useCallback(() => {
    setScore(INITIAL_SCORE);
    drawNext();
  }, [drawNext]);

  const togglePhase = useCallback((phase: RunoutPhase) => {
    setPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phase)) {
        if (next.size === 1) return prev; // keep at least one
        next.delete(phase);
      } else {
        next.add(phase);
      }
      return next;
    });
  }, []);

  // Note: toggling a phase off doesn't discard the current question — the next
  // draw already honors the updated set via `drawNext`'s closure.

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
                <span className="flex-1 text-center">{opt}%</span>
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
              Estima el porcentaje · teclas 1-4 · N para avanzar después de responder
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

      <div className="flex flex-wrap items-center justify-center gap-3">
        <PhaseFilter phases={phases} onToggle={togglePhase} />
        <AutoAdvanceToggle value={autoAdvance} onChange={setAutoAdvance} />
      </div>
    </div>
  );
}

function PhaseFilter({
  phases,
  onToggle,
}: {
  phases: Set<RunoutPhase>;
  onToggle: (phase: RunoutPhase) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <span className="text-[10px] uppercase tracking-wider text-content-muted">
        Fases
      </span>
      {ALL_PHASES.map((p) => {
        const active = phases.has(p);
        return (
          <button
            key={p}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(p)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light',
              active
                ? 'border-accent/60 bg-accent/10 text-content'
                : 'border-border bg-surface/40 text-content-muted hover:text-content',
            )}
          >
            {PHASE_LABEL[p]}
          </button>
        );
      })}
    </div>
  );
}

/** Amber placeholder for an unknown runout card, labelled with its street. */
function UnknownCard({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex h-14 w-10 items-center justify-center rounded-lg border-2 border-dashed border-amber-400/70 bg-amber-400/10 text-2xl font-bold text-amber-300 select-none">
        ?
      </div>
      <span className="text-[9px] font-semibold uppercase tracking-wider text-amber-300/90">
        {label}
      </span>
    </div>
  );
}

const PHASE_CHIP: Record<RunoutQuestion['phase'], string> = {
  turn: '1 carta · turn',
  river: '1 carta · river',
  complete: '2 cartas · turn + river',
};

function SpotCard({ question }: { question: RunoutQuestion }) {
  const isComplete = question.phase === 'complete';
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-bg-subtle/60 p-4">
      <span
        className={cn(
          'rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]',
          isComplete
            ? 'bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/40'
            : 'bg-surface text-content-muted ring-1 ring-border',
        )}
      >
        Runouts · {PHASE_CHIP[question.phase]}
      </span>
      <div className="flex flex-wrap items-start justify-center gap-x-5 gap-y-3">
        <div className="flex flex-col items-center gap-1">
          <span className="text-[10px] uppercase tracking-wider text-content-muted">
            Tu mano
          </span>
          <BoardCards cards={question.heroCards} />
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-[10px] uppercase tracking-wider text-content-muted">
            Board
          </span>
          <div className="flex items-start gap-1.5">
            <BoardCards cards={question.board} />
            {isComplete ? (
              <div className="flex items-start gap-1.5 rounded-lg bg-amber-400/5 px-1.5 py-1 ring-1 ring-amber-400/40">
                <UnknownCard label="Turn" />
                <UnknownCard label="River" />
              </div>
            ) : (
              <UnknownCard label={question.phase === 'river' ? 'River' : 'Turn'} />
            )}
          </div>
        </div>
      </div>
      <p className="max-w-md text-center text-sm font-medium text-content">
        {question.prompt}
      </p>
      {isComplete && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-amber-300/90">
          <Layers className="h-3.5 w-3.5" strokeWidth={2.25} />
          Considerá las dos cartas del runout (turn y river), no solo el turn.
        </p>
      )}
    </div>
  );
}

function FeedbackPanel({
  question,
  wasCorrect,
}: {
  question: RunoutQuestion;
  wasCorrect: boolean;
}) {
  const { correct, breakdown } = question;
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
          Ocurre el{' '}
          <span className="font-semibold tabular-nums text-content">{correct}%</span>
        </span>
      </div>
      {breakdown.mode === 'single' && (
        <p className="text-xs text-content-muted">
          De las{' '}
          <span className="font-medium text-content tabular-nums">{breakdown.denom}</span>{' '}
          cartas sin ver,{' '}
          <span className="font-medium text-content tabular-nums">{breakdown.count}</span>{' '}
          sirven →{' '}
          <span className="font-medium text-content tabular-nums">{breakdown.count}</span>{' '}
          ÷{' '}
          <span className="font-medium text-content tabular-nums">{breakdown.denom}</span>{' '}
          ={' '}
          <span className="font-medium text-content tabular-nums">{correct}%</span>
          {breakdown.matchBlockers > 0 && (
            <>
              {' '}· ya restaste{' '}
              <span className="font-medium text-amber-300 tabular-nums">
                {breakdown.matchBlockers}
              </span>{' '}
              de tus cartas/board (bloqueadores).
            </>
          )}
        </p>
      )}
      {breakdown.mode === 'complement' && (
        <>
          <p className="text-xs text-content-muted">
            Método del complemento con{' '}
            <span className="font-medium text-amber-300 tabular-nums">{breakdown.k}</span>{' '}
            cartas que sirven: no sale ={' '}
            <span className="font-medium text-content tabular-nums">
              {breakdown.denom - breakdown.k}
            </span>
            /{breakdown.denom} ·{' '}
            <span className="font-medium text-content tabular-nums">
              {breakdown.denom - 1 - breakdown.k}
            </span>
            /{breakdown.denom - 1} ={' '}
            <span className="font-medium text-content tabular-nums">{100 - correct}%</span>{' '}
            → sale 100 − {100 - correct} ={' '}
            <span className="font-medium text-content tabular-nums">{correct}%</span>.
          </p>
          <p className="text-xs text-content-muted">
            Atajo (regla 4/2): ≈ {breakdown.k}×4 ={' '}
            <span className="font-medium text-content tabular-nums">{breakdown.k * 4}%</span>.
          </p>
        </>
      )}
      {breakdown.mode === 'runner-flush' && (
        <>
          <p className="text-xs text-content-muted">
            Atajo (×2 por carta): turn ≈{' '}
            <span className="font-medium text-content tabular-nums">{breakdown.suitsLeft}</span>
            ×2 ={' '}
            <span className="font-medium text-content tabular-nums">
              {breakdown.suitsLeft * 2}%
            </span>
            , river ≈{' '}
            <span className="font-medium text-content tabular-nums">
              {breakdown.suitsLeft - 1}
            </span>
            ×2 ={' '}
            <span className="font-medium text-content tabular-nums">
              {(breakdown.suitsLeft - 1) * 2}%
            </span>{' '}
            → {breakdown.suitsLeft * 2}% × {(breakdown.suitsLeft - 1) * 2}% ≈{' '}
            <span className="font-medium text-content tabular-nums">{correct}%</span>.
          </p>
          <p className="text-xs text-content-muted">
            Exacto:{' '}
            <span className="font-medium text-content tabular-nums">{breakdown.hits}</span> ÷{' '}
            <span className="font-medium text-content tabular-nums">{breakdown.total}</span>{' '}
            combinaciones.
          </p>
        </>
      )}
      {breakdown.mode === 'pairs' && (
        <p className="text-xs text-content-muted">
          Runouts que cumplen ÷ runouts posibles ={' '}
          <span className="font-medium text-content tabular-nums">{breakdown.hits}</span>{' '}
          ÷{' '}
          <span className="font-medium text-content tabular-nums">{breakdown.total}</span>{' '}
          ={' '}
          <span className="font-medium text-content tabular-nums">{correct}%</span> (todas
          las combinaciones de turn + river).
        </p>
      )}
    </div>
  );
}
