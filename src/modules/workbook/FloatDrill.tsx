import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ChevronRight, RotateCcw, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { BoardCards } from '@/modules/analysis/BoardCards';
import { CardFace } from '@/modules/trainer/HandCards';
import { CountdownBar } from '@/modules/trainer/CountdownBar';
import { FloatEvCalc } from '@/modules/calculators/FloatEvCalc';
import { generateFloatQuestion, type FloatQuestion } from './floatSpots';
import { ChipColumn } from './ChipColumn';
import { AutoAdvanceToggle, CalcReveal, ScoreBar } from './drillUi';
import {
  AUTO_ADVANCE_MS,
  INITIAL_SCORE,
  tallyScore,
  type Score,
} from './drillScore';

type Feedback = { wasCorrect: boolean; pickedLabel: string };

function money(n: number): string {
  return n < 0 ? `−$${Math.abs(n)}` : `$${n}`;
}

export function FloatDrill() {
  const [question, setQuestion] = useState<FloatQuestion>(() =>
    generateFloatQuestion(),
  );
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [score, setScore] = useState<Score>(INITIAL_SCORE);
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [showCalc, setShowCalc] = useState(false);

  const drawNext = useCallback(() => {
    setQuestion(generateFloatQuestion());
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
    (choice: 'float' | 'fold') => {
      if (feedback) return;
      grade(choice === question.correctDecision, choice === 'float' ? 'Flotar' : 'Foldear');
    },
    [feedback, question.correctDecision, grade],
  );

  const answerValue = useCallback(
    (picked: number) => {
      if (feedback) return;
      grade(picked === question.ev, money(picked));
    },
    [feedback, question.ev, grade],
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
            answerDecision('float');
            return;
          }
          if (e.key === '2') {
            e.preventDefault();
            answerDecision('fold');
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
                <FloatEvCalc
                  initialPot={String(question.potOnFlop)}
                  initialCall={String(question.call)}
                  initialBarrelPct={String(question.barrelPct)}
                  initialXfPct={String(question.xfPct)}
                  initialTurnBet={String(question.bet)}
                />
              </CalcReveal>
              {autoAdvance && !showCalc && (
                <CountdownBar key={score.total} durationMs={AUTO_ADVANCE_MS} />
              )}
            </>
          ) : (
            <p className="text-center text-xs text-content-muted">
              {question.kind === 'decision'
                ? '¿Flotar o foldear? · teclas 1-2 · N para avanzar después de responder'
                : '¿Cuál es el EV? · teclas 1-4 · N para avanzar después de responder'}
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

function SpotCard({ question }: { question: FloatQuestion }) {
  const { street, scenarioLabel, board, nextCard, potOnFlop, call, bet, barrelPct, xfPct, restPct } =
    question;
  const streetWord = street === 'turn' ? 'turn' : 'river';
  const priorStreet = street === 'turn' ? 'flop' : 'turn';
  const potAfterCall = potOnFlop + call;
  const betPct = Math.round((bet / potAfterCall) * 100);
  const fmt = (n: number) => money(n);
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-bg-subtle/60 p-4">
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-content-muted">
        Floating · {streetWord}
      </span>

      <div className="flex flex-col items-center gap-1">
        <span className="text-[10px] uppercase tracking-wider text-content-muted">
          Board
        </span>
        <div className="flex items-start gap-1.5">
          <BoardCards cards={board} />
          <div className="flex flex-col items-center gap-1">
            <div className="rounded-lg ring-2 ring-accent">
              <CardFace rank={nextCard.rank} suit={nextCard.suit} />
            </div>
            <span className="text-[9px] font-semibold uppercase tracking-wider text-accent-light">
              {streetWord}
            </span>
          </div>
        </div>
      </div>

      <p className="text-sm font-medium text-content">
        El {streetWord} <span className="text-accent-light">{scenarioLabel}</span>
      </p>

      {/* Mini hand-history: prior street (left, hecho) → current street (right, tu plan). */}
      <div className="flex w-full max-w-md flex-col items-stretch gap-2 sm:flex-row sm:items-stretch">
        <div className="flex flex-1 flex-col items-center gap-0.5 rounded-lg border border-border bg-surface/40 px-3 py-2 text-center">
          <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-content-muted">
            {priorStreet}
          </span>
          <span className="text-xs text-content-muted">Flotaste con aire</span>
          <span className="text-sm font-semibold tabular-nums text-content">
            pagaste {money(call)}
          </span>
        </div>
        <ChevronRight
          aria-hidden
          className="mx-auto h-5 w-5 shrink-0 rotate-90 self-center text-content-muted sm:rotate-0"
          strokeWidth={2.25}
        />
        <div className="flex flex-1 flex-col items-center gap-0.5 rounded-lg border border-accent/40 bg-accent/5 px-3 py-2 text-center">
          <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-accent-light">
            {streetWord}
          </span>
          <span className="text-xs text-content">
            Checkea → <span className="font-semibold text-accent-light">apostás</span>
          </span>
          <span className="text-xs text-content-muted">Barrelea → foldeás</span>
        </div>
      </div>

      {/* MiniPot: bote vs tu apuesta, fichas escaladas → el % pegado al monto. */}
      <div className="mx-auto grid w-full max-w-[16rem] grid-cols-2 items-end gap-3 px-2">
        <ChipColumn eyebrow="Bote" tone="muted" amount={potAfterCall} refAmount={potAfterCall} format={fmt} />
        <ChipColumn
          eyebrow="Tu apuesta"
          tone="accent"
          amount={bet}
          refAmount={potAfterCall}
          format={fmt}
          sub={`${betPct}% del bote`}
        />
      </div>

      {/* Villain stats on this card — made explicit so the student reads them as the villain's tendencies. */}
      <div className="flex flex-col items-center gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-300/80">
          El villano, en esta carta
        </span>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Chip label="Barrel" value={`${barrelPct}%`} tone="villain" />
          <Chip label="Check/fold" value={`${xfPct}%`} tone="villain" />
          <Chip label="Check-call" value={`${restPct}%`} tone="villain" />
        </div>
      </div>

      <p className="text-base font-semibold text-content">
        {question.kind === 'decision'
          ? '¿Flotar es +EV?'
          : '¿Cuál es el EV de flotar?'}
      </p>
    </div>
  );
}

function Chip({
  label,
  value,
  tone = 'mine',
}: {
  label: string;
  value: string;
  tone?: 'mine' | 'villain';
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-0.5 rounded-lg border px-3 py-1.5',
        tone === 'villain'
          ? 'border-rose-500/30 bg-rose-500/5'
          : 'border-border bg-surface/60',
      )}
    >
      <span className="text-[10px] uppercase tracking-wider text-content-muted">
        {label}
      </span>
      <span className="text-sm font-semibold tabular-nums text-content">{value}</span>
    </div>
  );
}

function DecisionButtons({
  question,
  feedback,
  onAnswer,
}: {
  question: FloatQuestion;
  feedback: Feedback | null;
  onAnswer: (choice: 'float' | 'fold') => void;
}) {
  const choices: { id: 'float' | 'fold'; label: string; key: string }[] = [
    { id: 'float', label: 'Flotar (apostar)', key: '1' },
    { id: 'fold', label: 'Foldear', key: '2' },
  ];
  return (
    <div className="mx-auto grid w-full max-w-md grid-cols-2 gap-1.5">
      {choices.map((c) => {
        const isCorrect = feedback && c.id === question.correctDecision;
        const pickedThis =
          feedback?.pickedLabel === (c.id === 'float' ? 'Flotar' : 'Foldear');
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
                : c.id === 'float'
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
  question: FloatQuestion;
  feedback: Feedback | null;
  onAnswer: (picked: number) => void;
}) {
  return (
    <div className="mx-auto grid w-full max-w-md grid-cols-2 gap-1.5 sm:grid-cols-4">
      {question.options.map((opt, i) => {
        const isCorrect = feedback && opt === question.ev;
        const pickedThis = feedback?.pickedLabel === money(opt);
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
            <span className="flex-1 text-center">{money(opt)}</span>
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
  question: FloatQuestion;
  feedback: Feedback;
}) {
  const { potOnFlop, call, bet, barrelPct, xfPct, restPct, ev, correctDecision } =
    question;
  const potAfterCall = potOnFlop + call;
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
        <span className="text-content-muted">
          EV de flotar ={' '}
          <span
            className={cn(
              'font-semibold tabular-nums',
              ev > 0 ? 'text-emerald-300' : 'text-rose-300',
            )}
          >
            {money(ev)}
          </span>{' '}
          → {correctDecision === 'float' ? 'flotar' : 'fold'}
        </span>
      </div>
      <p className="text-xs text-content-muted">
        EV = Check/fold%·(bote − call) + Barrel%·(−call) + Check-call%·(−(apuesta + call)) ={' '}
        <span className="tabular-nums text-content">{xfPct}%</span>·(
        <span className="tabular-nums text-content">{potAfterCall}</span>−
        <span className="tabular-nums text-content">{call}</span>) +{' '}
        <span className="tabular-nums text-content">{barrelPct}%</span>·(−{call}) +{' '}
        <span className="tabular-nums text-content">{restPct}%</span>·(−(
        <span className="tabular-nums text-content">{bet}</span>+{call})) ={' '}
        <span className="font-medium tabular-nums text-content">{money(ev)}</span>. Las
        tres frecuencias suman 100%.
      </p>
      <p className="text-xs text-content-muted">
        La EV de flotar sube cuando hay muchas cartas parecidas en la baraja que el
        villano teme: overcards en flops bajos, bricks en boards tipo AK6.
      </p>
    </div>
  );
}
