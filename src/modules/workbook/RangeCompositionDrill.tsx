import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, RotateCcw, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { RangeGrid } from '@/components/RangeGrid';
import { parseHandRange } from '@/utils/handRangeParser';
import { CountdownBar } from '@/modules/trainer/CountdownBar';
import {
  COMPOSE_FAMILIES,
  FAMILY_LABEL,
  RANGE_ACTIONS_MAP,
  formatPct,
  handsToCells,
  rationaleOf,
  spotsIn,
  type RangeFamily,
} from './rangeBank';
import { generateComposeQuestion, type ComposeQuestion } from './rangeCompositionSpots';
import { MiniRangeChart } from './MiniRangeChart';
import { AutoAdvanceToggle, ChipFilter, ScoreBar } from './drillUi';

const COMPOSE_FILTER_OPTIONS = COMPOSE_FAMILIES.filter(
  (f) => spotsIn([f]).length > 0,
).map((f) => ({ value: f, label: FAMILY_LABEL[f] }));
import {
  AUTO_ADVANCE_MS,
  INITIAL_SCORE,
  tallyScore,
  type Score,
} from './drillScore';

type Feedback = { wasCorrect: boolean; picked: string };

export function RangeCompositionDrill() {
  const [families, setFamilies] = useState<ReadonlySet<RangeFamily>>(
    () => new Set(COMPOSE_FILTER_OPTIONS.map((o) => o.value)),
  );
  const [question, setQuestion] = useState<ComposeQuestion>(() =>
    generateComposeQuestion(),
  );
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [score, setScore] = useState<Score>(INITIAL_SCORE);
  const [autoAdvance, setAutoAdvance] = useState(false);

  const options = question.notationOptions;
  const correct = question.spot.notation;

  const drawNext = useCallback(() => {
    setQuestion(generateComposeQuestion([...families]));
    setFeedback(null);
  }, [families]);

  const toggleFamily = useCallback((value: RangeFamily) => {
    setFamilies((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        if (next.size === 1) return prev; // nunca vacío
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!autoAdvance || !feedback) return;
    const id = setTimeout(drawNext, AUTO_ADVANCE_MS);
    return () => clearTimeout(id);
  }, [autoAdvance, feedback, drawNext]);

  const answer = useCallback(
    (picked: string) => {
      if (feedback) return;
      setFeedback({ wasCorrect: picked === correct, picked });
      setScore((s) => tallyScore(s, picked === correct));
    },
    [feedback, correct],
  );

  const reset = useCallback(() => {
    setScore(INITIAL_SCORE);
    drawNext();
  }, [drawNext]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (!feedback) {
        const idx = '1234'.indexOf(e.key);
        if (idx >= 0 && idx < options.length) {
          e.preventDefault();
          answer(options[idx]!);
          return;
        }
      }
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        if (feedback) drawNext();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [feedback, options, answer, drawNext]);

  const accuracy = useMemo(
    () => (score.total === 0 ? 0 : (score.correct / score.total) * 100),
    [score],
  );

  const cells = useMemo(() => handsToCells(question.hands), [question.hands]);

  return (
    <div className="flex flex-col gap-4">
      <ScoreBar score={score} accuracy={accuracy} />

      <div className="flex flex-col items-stretch gap-4 rounded-xl border border-border bg-surface/60 p-4 shadow-surface sm:p-5">
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-bg-subtle/60 p-4">
          <ComposePrompt question={question} />
        </div>

        <NotationOptions
          options={options}
          feedback={feedback}
          correct={correct}
          onAnswer={answer}
        />

        <div className="flex min-h-[3.5rem] w-full flex-col gap-2">
          {feedback ? (
            <>
              <FeedbackPanel question={question} feedback={feedback} cells={cells} />
              {autoAdvance && (
                <CountdownBar key={score.total} durationMs={AUTO_ADVANCE_MS} />
              )}
            </>
          ) : (
            <p className="text-center text-xs text-content-muted">
              ¿Qué rango? · teclas 1-4 · N para avanzar después de responder
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

      <div className="flex flex-col items-center gap-3">
        {COMPOSE_FILTER_OPTIONS.length > 1 && (
          <ChipFilter
            label="Rangos a estudiar"
            options={COMPOSE_FILTER_OPTIONS}
            selected={families}
            onToggle={toggleFamily}
          />
        )}
        <AutoAdvanceToggle value={autoAdvance} onChange={setAutoAdvance} />
      </div>
    </div>
  );
}

function ComposePrompt({ question }: { question: ComposeQuestion }) {
  const { spot } = question;
  if (spot.family === 'call') {
    return (
      <>
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-content-muted">
          Composición · defensa de la BB
        </span>
        <p className="max-w-md text-center text-sm text-content">
          ¿Cómo se compone el rango de <span className="font-semibold">pago (call)</span> de la{' '}
          <span className="font-semibold text-accent-light">BB</span>{' '}
          <span className="font-semibold">{spot.vs}</span>?
        </p>
      </>
    );
  }
  if (spot.family === 'cold-call') {
    return (
      <>
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-content-muted">
          Composición · pago en frío (cold-call)
        </span>
        <p className="max-w-md text-center text-sm text-content">
          ¿Cómo se compone el <span className="font-semibold">pago en frío (cold-call)</span> de{' '}
          <span className="font-semibold text-accent-light">{spot.position}</span>{' '}
          <span className="font-semibold">{spot.vs}</span>?
        </p>
      </>
    );
  }
  if (spot.family === 'open') {
    return (
      <>
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-content-muted">
          Composición · apertura (RFI) por posición
        </span>
        <p className="max-w-md text-center text-sm text-content">
          ¿Cómo se compone la <span className="font-semibold">apertura (RFI)</span> de{' '}
          <span className="font-semibold text-accent-light">{spot.position}</span>
          {spot.sizing ? <span className="text-content-muted"> ({spot.sizing})</span> : null}?
        </p>
      </>
    );
  }
  if (spot.family === 'gto-3bet') {
    return (
      <>
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-content-muted">
          Composición · reg vs reg (GTO)
        </span>
        <p className="max-w-md text-center text-sm text-content">
          ¿Cómo se conforma el rango de <span className="font-semibold">3bet</span> de{' '}
          <span className="font-semibold text-accent-light">{spot.position}</span>{' '}
          <span className="font-semibold">{spot.vs}</span>
          {spot.sizing ? <span className="text-content-muted"> ({spot.sizing})</span> : null} de un{' '}
          <span className="font-semibold">reg competente</span>?
        </p>
      </>
    );
  }
  return (
    <>
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-content-muted">
        Composición · dimensiona la cifra del HUD
      </span>
      <p className="max-w-md text-center text-sm text-content">
        Un villano <span className="font-semibold">3-betea</span>{' '}
        <span className="font-semibold tabular-nums text-accent-light">
          {formatPct(question.pct)}
        </span>{' '}
        y arma su rango <span className="font-semibold">lineal</span>{' '}
        <span className="text-content-muted">(sus mejores manos, de arriba hacia abajo)</span>.
        ¿Cuál es su rango?
      </p>
    </>
  );
}

const LEGEND_ITEMS: { label: string; dot: string }[] = [
  { label: 'Pares', dot: 'bg-amber-400' },
  { label: 'Suited', dot: 'bg-emerald-400' },
  { label: 'Offsuit', dot: 'bg-sky-400' },
];

function MiniChartLegend() {
  return (
    <div className="flex items-center justify-center gap-3 text-[11px] text-content-muted">
      {LEGEND_ITEMS.map(({ label, dot }) => (
        <span key={label} className="inline-flex items-center gap-1.5">
          <span className={cn('h-2.5 w-2.5 rounded-[2px]', dot)} />
          {label}
        </span>
      ))}
    </div>
  );
}

function NotationOptions({
  options,
  feedback,
  correct,
  onAnswer,
}: {
  options: string[];
  feedback: Feedback | null;
  correct: string;
  onAnswer: (picked: string) => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-2.5">
      <MiniChartLegend />
      <div className="grid grid-cols-2 gap-2.5">
        {options.map((opt, i) => {
          const isCorrect = feedback && opt === correct;
          const pickedThis = feedback?.picked === opt;
          const hands = parseHandRange(opt).hands;
          return (
            <button
              key={`${opt}-${i}`}
              type="button"
              disabled={feedback !== null}
              onClick={() => onAnswer(opt)}
              className={cn(
                'group flex flex-col gap-1.5 rounded-lg border p-2',
                'transition-colors duration-150 ease-out-soft',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light',
                feedback
                  ? isCorrect
                    ? 'border-emerald-500/70 bg-emerald-500/10'
                    : pickedThis
                      ? 'border-rose-500/70 bg-rose-500/10'
                      : 'border-border bg-surface/40 opacity-50'
                  : 'border-border bg-surface/40 hover:border-accent-light/60 hover:bg-surface-hover',
              )}
            >
              <span className="flex h-5 w-5 items-center justify-center rounded bg-bg/80 text-[11px] font-semibold tabular-nums tracking-wider text-content-muted">
                {i + 1}
              </span>
              <MiniRangeChart hands={hands} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FeedbackPanel({
  question,
  feedback,
  cells,
}: {
  question: ComposeQuestion;
  feedback: Feedback;
  cells: ReturnType<typeof handsToCells>;
}) {
  const { spot, pct, combos } = question;
  const isLinear = spot.family === 'linear-3bet';
  const sizingSuffix = spot.sizing ? ` (${spot.sizing})` : '';
  const label =
    spot.family === 'open'
      ? `Apertura ${spot.position}${sizingSuffix}`
      : spot.family === 'call'
        ? `Call BB ${spot.vs}`
        : spot.family === 'cold-call'
          ? `Cold-call ${spot.position} ${spot.vs}`
          : spot.family === 'gto-3bet'
            ? `3bet ${spot.position} ${spot.vs}${sizingSuffix}`
            : '3bet lineal';
  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-lg border px-3 py-2.5 text-sm',
        feedback.wasCorrect
          ? 'border-emerald-500/40 bg-emerald-500/5 text-content'
          : 'border-rose-500/40 bg-rose-500/5 text-content',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        {feedback.wasCorrect ? (
          <Check className="h-4 w-4 text-emerald-400" strokeWidth={2.5} />
        ) : (
          <X className="h-4 w-4 text-rose-400" strokeWidth={2.5} />
        )}
        <span className="font-semibold">{feedback.wasCorrect ? 'Correcto' : 'Incorrecto'}</span>
        <span className="text-content-muted">·</span>
        <span className="text-content-muted">
          {label}{' '}
          <span className="tabular-nums">{formatPct(pct)}</span> ·{' '}
          <span className="tabular-nums">{combos}</span> combos
        </span>
      </div>

      <div className="mx-auto w-full max-w-[320px] py-1">
        <RangeGrid cells={cells} actionsMap={RANGE_ACTIONS_MAP} variant="compact" />
      </div>

      <p className="text-xs text-content-muted">
        {isLinear && (
          <>
            <span className="font-mono text-content">{spot.notation}</span>.{' '}
          </>
        )}
        {rationaleOf(spot)}
      </p>
    </div>
  );
}
