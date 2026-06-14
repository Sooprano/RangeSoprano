import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, RotateCcw, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { raisePctOfPot } from '@/utils/ev';
import { CountdownBar } from '@/modules/trainer/CountdownBar';
import { RaiseBluffEvCalc } from '@/modules/calculators/RaiseBluffEvCalc';
import {
  formatAmount,
  generateAutoProfitQuestion,
  type AutoProfitQuestion,
} from './autoProfitSpots';
import { AutoAdvanceToggle, CalcReveal, ScoreBar } from './drillUi';
import {
  AUTO_ADVANCE_MS,
  INITIAL_SCORE,
  tallyScore,
  type Score,
} from './drillScore';

const STREET_LABEL: Record<string, string> = {
  flop: 'flop',
  turn: 'turn',
  river: 'river',
};

type Feedback = { wasCorrect: boolean; pickedLabel: string };

export function AutoProfitDrill() {
  const [question, setQuestion] = useState<AutoProfitQuestion>(() =>
    generateAutoProfitQuestion(),
  );
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [score, setScore] = useState<Score>(INITIAL_SCORE);
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [showCalc, setShowCalc] = useState(false);

  const drawNext = useCallback(() => {
    setQuestion(generateAutoProfitQuestion());
    setFeedback(null);
    setShowCalc(false);
  }, []);

  useEffect(() => {
    if (!autoAdvance || !feedback || showCalc) return;
    const id = setTimeout(drawNext, AUTO_ADVANCE_MS);
    return () => clearTimeout(id);
  }, [autoAdvance, feedback, showCalc, drawNext]);

  const grade = useCallback((wasCorrect: boolean, pickedLabel: string) => {
    setFeedback({ wasCorrect, pickedLabel });
    setScore((s) => tallyScore(s, wasCorrect));
  }, []);

  const answerDecision = useCallback(
    (choice: 'yes' | 'no') => {
      if (feedback) return;
      grade(choice === question.correctDecision, choice === 'yes' ? 'Sí' : 'No');
    },
    [feedback, question.correctDecision, grade],
  );

  const answerValue = useCallback(
    (picked: number) => {
      if (feedback) return;
      grade(picked === question.bePct, `${picked}%`);
    },
    [feedback, question.bePct, grade],
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
      if (!feedback) {
        if (question.kind === 'decision') {
          if (e.key === '1') {
            e.preventDefault();
            answerDecision('yes');
            return;
          }
          if (e.key === '2') {
            e.preventDefault();
            answerDecision('no');
            return;
          }
        } else {
          const idx = '1234'.indexOf(e.key);
          if (idx >= 0 && idx < question.options.length) {
            e.preventDefault();
            answerValue(question.options[idx]!);
            return;
          }
        }
      }
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        if (feedback) drawNext();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [feedback, question, answerDecision, answerValue, drawNext]);

  const accuracy = useMemo(
    () => (score.total === 0 ? 0 : (score.correct / score.total) * 100),
    [score],
  );

  return (
    <div className="flex flex-col gap-4">
      <ScoreBar score={score} accuracy={accuracy} />

      <div className="flex flex-col items-stretch gap-4 rounded-xl border border-border bg-surface/60 p-4 shadow-surface sm:p-5">
        <SpotCard question={question} />

        {question.kind === 'decision' ? (
          <DecisionButtons
            question={question}
            feedback={feedback}
            onAnswer={answerDecision}
          />
        ) : (
          <ValueOptions
            question={question}
            feedback={feedback}
            onAnswer={answerValue}
          />
        )}

        <div className="flex min-h-[3.5rem] w-full flex-col gap-2">
          {feedback ? (
            <>
              <FeedbackPanel question={question} feedback={feedback} />
              <CalcReveal open={showCalc} onToggle={() => setShowCalc((v) => !v)}>
                <RaiseBluffEvCalc
                  initialPot={String(question.startingPot)}
                  initialVillainBet={String(question.villainBet)}
                  initialRaiseCost={String(question.raiseTotal)}
                  initialFoldPct={String(
                    question.kind === 'decision' ? question.foldPct : question.bePct,
                  )}
                />
              </CalcReveal>
              {autoAdvance && !showCalc && (
                <CountdownBar key={score.total} durationMs={AUTO_ADVANCE_MS} />
              )}
            </>
          ) : (
            <p className="text-center text-xs text-content-muted">
              {question.kind === 'decision'
                ? '¿Auto-profit? · teclas 1-2 · N para avanzar después de responder'
                : '¿Cuál es el BE%? · teclas 1-4 · N para avanzar después de responder'}
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

function SpotCard({ question }: { question: AutoProfitQuestion }) {
  const { street, unit, villainBet, raiseTotal } = question;
  const streetWord = STREET_LABEL[street] ?? street;
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-bg-subtle/60 p-4">
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-content-muted">
        Auto-profit raise · {streetWord}
      </span>

      {/* Action recap: villain bet, you raise. */}
      <p className="max-w-md text-center text-sm text-content-muted">
        El rival apuesta{' '}
        <span className="font-semibold text-content tabular-nums">
          {formatAmount(villainBet, unit)}
        </span>{' '}
        en el {streetWord} y subís a{' '}
        <span className="font-semibold text-content tabular-nums">
          {formatAmount(raiseTotal, unit)}
        </span>
        .
      </p>

      <RaisePot question={question} />

      {question.kind === 'decision' && (
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-300/80">
            El villano, a tu raise
          </span>
          <p className="max-w-md text-center text-xs text-content-muted">
            {question.continueLabel} → foldea{' '}
            <span className="font-semibold tabular-nums text-rose-200">
              {question.foldPct}%
            </span>
          </p>
        </div>
      )}

      <p className="max-w-md text-center text-sm font-medium text-content">
        {question.kind === 'decision'
          ? '¿Es un auto-profit raise?'
          : '¿Cuál es el BE% (breakeven) de este raise?'}
      </p>
    </div>
  );
}

// Mini-table like the Pot Odds drill: pot stack centered, villain's bet to the
// LEFT and your raise to the RIGHT. Chip heights scale to the pot so the raise
// reads as "bigger than the pot" at a glance. Sizing % under each bet.
function RaisePot({ question }: { question: AutoProfitQuestion }) {
  const { unit, startingPot, villainBet, raiseTotal } = question;
  const betPctOfPot = Math.round((villainBet / startingPot) * 100);
  const raisePct = Math.round(
    raisePctOfPot({ bote: startingPot, bet: villainBet, raiseSize: raiseTotal }),
  );
  return (
    <div className="mx-auto grid w-full max-w-md grid-cols-3 items-end gap-3 px-2">
      <BetColumn
        eyebrow="Villano apuesta"
        tone="rose"
        amount={villainBet}
        unit={unit}
        refAmount={startingPot}
        sub={`${betPctOfPot}% del bote`}
      />
      <BetColumn
        eyebrow="Bote"
        tone="muted"
        amount={startingPot}
        unit={unit}
        refAmount={startingPot}
      />
      <BetColumn
        eyebrow="Tu raise"
        tone="accent"
        amount={raiseTotal}
        unit={unit}
        refAmount={startingPot}
        sub={`raise al ${raisePct}%`}
      />
    </div>
  );
}

const CHIP_TONE: Record<
  'muted' | 'accent' | 'rose',
  { bar: string; ring: string; label: string; value: string }
> = {
  muted: {
    bar: 'bg-content/30',
    ring: 'ring-white/10',
    label: 'text-content-muted',
    value: 'text-content',
  },
  accent: {
    bar: 'bg-accent',
    ring: 'ring-accent-light/40',
    label: 'text-accent-light',
    value: 'text-accent-light',
  },
  rose: {
    bar: 'bg-rose-400',
    ring: 'ring-rose-200/40',
    label: 'text-rose-300',
    value: 'text-rose-200',
  },
};

function BetColumn({
  eyebrow,
  tone,
  amount,
  unit,
  refAmount,
  sub,
}: {
  eyebrow: string;
  tone: 'muted' | 'accent' | 'rose';
  amount: number;
  unit: '$' | 'K';
  refAmount: number;
  sub?: string;
}) {
  const palette = CHIP_TONE[tone];
  // ~4 chips per pot; the raise (often >1 pot) stacks taller. Capped at 12.
  const chips = Math.max(
    1,
    Math.min(12, Math.round((amount / refAmount) * 4) || 1),
  );
  const CHIP_GAP_PX = 4;
  const CHIP_HEIGHT_PX = 6;
  const stackHeight = chips * CHIP_GAP_PX + CHIP_HEIGHT_PX;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative w-12" style={{ height: `${stackHeight}px` }} aria-hidden>
        {Array.from({ length: chips }, (_, i) => (
          <div
            key={i}
            className={cn(
              'absolute left-0 right-0 h-1.5 rounded-full ring-1',
              palette.bar,
              palette.ring,
            )}
            style={{ bottom: `${i * CHIP_GAP_PX}px` }}
          />
        ))}
      </div>
      <div className="flex flex-col items-center leading-tight">
        <span className={cn('text-[9px] font-semibold uppercase tracking-[0.14em]', palette.label)}>
          {eyebrow}
        </span>
        <span className={cn('font-mono text-sm font-bold tabular-nums', palette.value)}>
          {formatAmount(amount, unit)}
        </span>
        <span className="text-[10px] tabular-nums text-content-muted min-h-[0.9rem]">{sub ??' '}</span>
      </div>
    </div>
  );
}

function DecisionButtons({
  question,
  feedback,
  onAnswer,
}: {
  question: AutoProfitQuestion;
  feedback: Feedback | null;
  onAnswer: (choice: 'yes' | 'no') => void;
}) {
  const choices: { id: 'yes' | 'no'; label: string; key: string }[] = [
    { id: 'yes', label: 'Sí, auto-profit', key: '1' },
    { id: 'no', label: 'No', key: '2' },
  ];
  return (
    <div className="mx-auto grid w-full max-w-md grid-cols-2 gap-1.5">
      {choices.map((c) => {
        const isCorrect = feedback && c.id === question.correctDecision;
        const pickedThis = feedback?.pickedLabel === (c.id === 'yes' ? 'Sí' : 'No');
        const isWrongPick = feedback && !feedback.wasCorrect && pickedThis;
        return (
          <button
            key={c.id}
            type="button"
            disabled={feedback !== null}
            onClick={() => onAnswer(c.id)}
            className={cn(
              'flex flex-row items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold',
              'transition-colors duration-150 ease-out-soft',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light',
              feedback
                ? isCorrect
                  ? 'border-emerald-500/60 bg-emerald-500/10 text-content'
                  : isWrongPick
                    ? 'border-rose-500/60 bg-rose-500/10 text-content'
                    : 'border-border bg-surface/40 text-content-muted opacity-60'
                : c.id === 'yes'
                  ? 'border-accent/50 bg-accent/10 text-content hover:bg-accent/20'
                  : 'border-border bg-surface/40 text-content hover:bg-surface-hover',
            )}
          >
            <span className="flex-1 text-center">{c.label}</span>
            <span className="shrink-0 rounded bg-surface px-1 py-px text-[10px] font-medium tabular-nums tracking-wider text-content-muted">
              {c.key}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ValueOptions({
  question,
  feedback,
  onAnswer,
}: {
  question: AutoProfitQuestion;
  feedback: Feedback | null;
  onAnswer: (picked: number) => void;
}) {
  return (
    <div className="mx-auto grid w-full max-w-md grid-cols-2 gap-1.5 sm:grid-cols-4">
      {question.options.map((opt, i) => {
        const isCorrect = feedback && opt === question.bePct;
        const pickedThis = feedback?.pickedLabel === `${opt}%`;
        return (
          <button
            key={`${opt}-${i}`}
            type="button"
            disabled={feedback !== null}
            onClick={() => onAnswer(opt)}
            className={cn(
              'flex flex-row items-center justify-between gap-2 rounded-lg border px-3 py-2 text-base font-semibold tabular-nums',
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
            <span className="flex-1 text-center">{opt}%</span>
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
  question: AutoProfitQuestion;
  feedback: Feedback;
}) {
  const {
    unit,
    startingPot,
    villainBet,
    raiseTotal,
    potRaisedInto,
    bePct,
    kind,
    foldPct,
    correctDecision,
  } = question;
  const R = formatAmount(raiseTotal, unit);
  const P = formatAmount(potRaisedInto, unit);
  const raisePct = Math.round(
    raisePctOfPot({ bote: startingPot, bet: villainBet, raiseSize: raiseTotal }),
  );
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
        <span className="font-semibold">
          {feedback.wasCorrect ? 'Correcto' : 'Incorrecto'}
        </span>
        <span className="text-content-muted">·</span>
        {kind === 'decision' ? (
          <span className="text-content-muted">
            {correctDecision === 'yes' ? 'Auto-profit' : 'No auto-profit'}
          </span>
        ) : (
          <span className="text-content-muted">
            BE% ={' '}
            <span className="font-semibold tabular-nums text-content">{bePct}%</span>
          </span>
        )}
      </div>

      <p className="text-xs text-content-muted">
        BE% = R/(R+P) = <span className="tabular-nums text-content">{R}</span>/(
        <span className="tabular-nums text-content">{R}</span>+
        <span className="tabular-nums text-content">{P}</span>) ={' '}
        <span className="font-medium tabular-nums text-content">{bePct}%</span> — el fold
        mínimo que necesitás para que el raise sea break-even como bluff.
      </p>

      <p className="text-xs text-content-muted">
        Subís al{' '}
        <span className="font-medium tabular-nums text-content">{raisePct}%</span> del bote:
        (3·{formatAmount(villainBet, unit)} + {formatAmount(startingPot, unit)})·{raisePct}% ={' '}
        <span className="tabular-nums text-content">{R}</span>. El fold% que necesitás lo fija
        el tamaño del raise respecto al bote: el mismo raise pide siempre el mismo BE%.
      </p>

      {kind === 'decision' && (
        <p className="text-xs text-content-muted">
          El rival foldea{' '}
          <span className="font-semibold tabular-nums text-content">{foldPct}%</span>{' '}
          {foldPct > bePct ? (
            <>
              &gt; BE% ({bePct}%) → <span className="text-emerald-300">auto-profit</span>:
              el raise gana solo por la fold equity, sin importar tu equity cuando te pagan.
            </>
          ) : (
            <>
              &lt; BE% ({bePct}%) → <span className="text-rose-300">no auto-profit</span>:
              el rival no foldea lo suficiente; el raise depende de tu equity al ser pagado.
            </>
          )}
        </p>
      )}

      <p className="text-xs text-content-muted">
        Cuanto más ancho el rango que el villano sigue (pares débiles, proyectos), más baja
        su fold% y antes deja de auto-rentar el raise.
      </p>
    </div>
  );
}
