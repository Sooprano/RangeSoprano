import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, RotateCcw, Shapes, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { RangeGrid } from '@/components/RangeGrid';
import { CountdownBar } from '@/modules/trainer/CountdownBar';
import {
  FAMILY_LABEL,
  HAS_TYPE_SPOTS,
  MORPHOLOGY_DEF,
  MORPHOLOGY_LABEL,
  RANGE_ACTIONS_MAP,
  TYPE_FAMILIES,
  actionPhrase,
  dimensioningTip,
  formatPct,
  handsToCells,
  spotsIn,
  type Morphology,
  type RangeFamily,
} from './rangeBank';
import { generateTypeQuestion, type TypeQuestion } from './rangeTypeSpots';
import { AutoAdvanceToggle, ChipFilter, ScoreBar } from './drillUi';

const TYPE_FILTER_OPTIONS = TYPE_FAMILIES.filter(
  (f) => spotsIn([f]).length > 0,
).map((f) => ({ value: f, label: FAMILY_LABEL[f] }));
import {
  AUTO_ADVANCE_MS,
  INITIAL_SCORE,
  tallyScore,
  type Score,
} from './drillScore';

type Feedback = { wasCorrect: boolean; picked: Morphology };

export function RangeTypeDrill() {
  if (!HAS_TYPE_SPOTS) return <TypePlaceholder />;
  return <RangeTypeDrillInner />;
}

/** Mientras el banco sea 100% lineal, el drill de morfología no aporta. */
function TypePlaceholder() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface/60 p-8 text-center shadow-surface">
      <Shapes className="h-8 w-8 text-content-muted" strokeWidth={1.75} />
      <p className="max-w-md text-sm text-content">
        Este ejercicio distingue la <span className="font-semibold">forma</span> del rango
        (lineal, polarizado, mergeado, condensado).
      </p>
      <p className="max-w-md text-xs text-content-muted">
        Se activa cuando el banco tenga rangos de distintas formas — al cargar los 3bet de GTO
        (regs), las aperturas (opens) y los rangos de pago (calls de BB/BTN). Por ahora todos los
        rangos son lineales, así que no hay nada que distinguir.
      </p>
    </div>
  );
}

function RangeTypeDrillInner() {
  const [families, setFamilies] = useState<ReadonlySet<RangeFamily>>(
    () => new Set(TYPE_FILTER_OPTIONS.map((o) => o.value)),
  );
  const [question, setQuestion] = useState<TypeQuestion>(() => generateTypeQuestion());
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [score, setScore] = useState<Score>(INITIAL_SCORE);
  const [autoAdvance, setAutoAdvance] = useState(false);

  const options = question.morphOptions;
  const correct = question.spot.morphology;

  const drawNext = useCallback(() => {
    setQuestion(generateTypeQuestion([...families]));
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
    (picked: Morphology) => {
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
  const { position, vs, action } = question.spot;
  const spotLabel = vs ? `${position} ${vs}` : position;

  return (
    <div className="flex flex-col gap-4">
      <ScoreBar score={score} accuracy={accuracy} />

      <div className="flex flex-col items-stretch gap-4 rounded-xl border border-border bg-surface/60 p-4 shadow-surface sm:p-5">
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-bg-subtle/60 p-4">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-content-muted">
            {spotLabel ? `${spotLabel} · ` : ''}
            {actionPhrase(action)} · {formatPct(question.pct)}
          </span>
          <div className="mx-auto w-full max-w-[360px] sm:max-w-[400px]">
            <RangeGrid cells={cells} actionsMap={RANGE_ACTIONS_MAP} />
          </div>
          <p className="max-w-md text-center text-sm font-medium text-content">
            ¿Qué estructura (morfología) tiene este rango?
          </p>
        </div>

        <MorphOptions
          options={options}
          feedback={feedback}
          correct={correct}
          onAnswer={answer}
        />

        <div className="flex min-h-[3.5rem] w-full flex-col gap-2">
          {feedback ? (
            <>
              <FeedbackPanel question={question} feedback={feedback} />
              {autoAdvance && (
                <CountdownBar key={score.total} durationMs={AUTO_ADVANCE_MS} />
              )}
            </>
          ) : (
            <p className="text-center text-xs text-content-muted">
              ¿Qué estructura? · teclas 1-4 · N para avanzar después de responder
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
        {TYPE_FILTER_OPTIONS.length > 1 && (
          <ChipFilter
            label="Rangos a estudiar"
            options={TYPE_FILTER_OPTIONS}
            selected={families}
            onToggle={toggleFamily}
          />
        )}
        <AutoAdvanceToggle value={autoAdvance} onChange={setAutoAdvance} />
      </div>
    </div>
  );
}

function MorphOptions({
  options,
  feedback,
  correct,
  onAnswer,
}: {
  options: readonly Morphology[];
  feedback: Feedback | null;
  correct: Morphology;
  onAnswer: (picked: Morphology) => void;
}) {
  return (
    <div className="mx-auto grid w-full max-w-md grid-cols-2 gap-1.5">
      {options.map((opt, i) => {
        const isCorrect = feedback && opt === correct;
        const pickedThis = feedback?.picked === opt;
        return (
          <button
            key={opt}
            type="button"
            disabled={feedback !== null}
            onClick={() => onAnswer(opt)}
            className={cn(
              'flex flex-row items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold',
              'transition-colors duration-150 ease-out-soft',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light',
              feedback
                ? isCorrect
                  ? 'border-emerald-500/60 bg-emerald-500/10 text-content'
                  : pickedThis
                    ? 'border-rose-500/60 bg-rose-500/10 text-content'
                    : 'border-border bg-surface/40 text-content-muted opacity-60'
                : 'border-border bg-surface/40 text-content hover:bg-surface-hover',
            )}
          >
            <span className="flex-1 text-center">{MORPHOLOGY_LABEL[opt]}</span>
            <span className="shrink-0 rounded bg-surface px-1 py-px text-[10px] font-medium tabular-nums tracking-wider text-content-muted">
              {i + 1}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function FeedbackPanel({
  question,
  feedback,
}: {
  question: TypeQuestion;
  feedback: Feedback;
}) {
  const { spot, pct, combos } = question;
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
          {MORPHOLOGY_LABEL[spot.morphology]} ·{' '}
          <span className="tabular-nums">{formatPct(pct)}</span> ·{' '}
          <span className="tabular-nums">{combos}</span> combos
        </span>
      </div>
      <p className="text-xs text-content-muted">
        <span className="text-content">{MORPHOLOGY_DEF[spot.morphology]}</span>{' '}
        {spot.rationale}
      </p>
      <p className="rounded-md bg-bg-subtle/60 px-2.5 py-1.5 text-xs text-content-muted">
        {dimensioningTip(spot.action, spot.morphology, pct)}
      </p>
    </div>
  );
}
