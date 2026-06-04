import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, RotateCcw, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { BoardCards } from '@/modules/analysis/BoardCards';
import { CountdownBar } from '@/modules/trainer/CountdownBar';
import { CallVsRaiseCalc } from '@/modules/calculators/CallVsRaiseCalc';
import {
  formatAmount,
  formatEv,
  generateRiverQuestion,
  type RiverLine,
  type RiverQuestion,
} from './riverCallShoveSpots';
import { AutoAdvanceToggle, CalcReveal, ScoreBar } from './drillUi';
import {
  AUTO_ADVANCE_MS,
  INITIAL_SCORE,
  tallyScore,
  type Score,
} from './drillScore';

type Feedback = { wasCorrect: boolean; pickedLabel: string };

const LINE_LABEL: Record<RiverLine, string> = {
  call: 'Call',
  fold: 'Fold',
  shove: 'Shove',
};

export function RiverCallShoveDrill() {
  const [question, setQuestion] = useState<RiverQuestion>(() =>
    generateRiverQuestion(),
  );
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [score, setScore] = useState<Score>(INITIAL_SCORE);
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [showCalc, setShowCalc] = useState(false);

  const drawNext = useCallback(() => {
    setQuestion(generateRiverQuestion());
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

  const correctValue =
    question.kind === 'ev-call' ? question.evCall : question.evShove;

  const answerDecision = useCallback(
    (choice: RiverLine) => {
      if (feedback) return;
      grade(choice === question.bestLine, LINE_LABEL[choice]);
    },
    [feedback, question.bestLine, grade],
  );

  const answerValue = useCallback(
    (picked: number) => {
      if (feedback) return;
      grade(picked === correctValue, formatEv(picked, question.unit));
    },
    [feedback, correctValue, question.unit, grade],
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
          const map: Record<string, RiverLine> = { '1': 'call', '2': 'fold', '3': 'shove' };
          const line = map[e.key];
          if (line) {
            e.preventDefault();
            answerDecision(line);
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
            correct={correctValue}
            onAnswer={answerValue}
          />
        )}

        <div className="flex min-h-[3.5rem] w-full flex-col gap-2">
          {feedback ? (
            <>
              <FeedbackPanel question={question} feedback={feedback} />
              <CalcReveal open={showCalc} onToggle={() => setShowCalc((v) => !v)}>
                <CallVsRaiseCalc
                  initialPot={String(question.potWon)}
                  initialCall={String(question.villainBet)}
                  initialShove={String(question.shove)}
                  initialCallEquityPct={String(question.winCallingPct)}
                  initialWinWhenCalledPct={String(question.winWhenCalledPct)}
                  initialFoldPct={String(question.foldPct)}
                />
              </CalcReveal>
              {autoAdvance && !showCalc && (
                <CountdownBar key={score.total} durationMs={AUTO_ADVANCE_MS} />
              )}
            </>
          ) : (
            <p className="text-center text-xs text-content-muted">
              {question.kind === 'decision'
                ? '¿Call, fold o shove? · teclas 1-3 · N para avanzar después de responder'
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

function SpotCard({ question }: { question: RiverQuestion }) {
  const { unit, villainBet, potWon, shove, hero, board, kind } = question;
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-bg-subtle/60 p-4">
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-content-muted">
        River · enfrentás una apuesta
      </span>

      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3">
        <div className="flex flex-col items-center gap-1">
          <span className="text-[10px] uppercase tracking-wider text-content-muted">Tu mano</span>
          <BoardCards cards={hero} />
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-[10px] uppercase tracking-wider text-content-muted">Board</span>
          <BoardCards cards={board} />
        </div>
      </div>

      <p className="max-w-md text-center text-sm text-content-muted">
        El rival apuesta{' '}
        <span className="font-semibold text-content tabular-nums">
          {formatAmount(villainBet, unit)}
        </span>{' '}
        en el river. Podés pagar, foldear o ir all-in por{' '}
        <span className="font-semibold text-content tabular-nums">
          {formatAmount(shove, unit)}
        </span>
        .
      </p>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Chip label="Bote" value={formatAmount(potWon, unit)} />
        <Chip label="Apuesta del villano" value={formatAmount(villainBet, unit)} />
        <Chip label="Tu all-in" value={formatAmount(shove, unit)} accent />
      </div>

      {/* Villain equities relevant to the question (given data from Flopzilla). */}
      <div className="flex flex-col items-center gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-300/80">
          El villano
        </span>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {(kind === 'ev-call' || kind === 'decision') && (
            <VillChip label="Ganás al pagar" value={`${question.winCallingPct}%`} />
          )}
          {(kind === 'ev-shove' || kind === 'decision') && (
            <>
              <VillChip label="Foldea al all-in" value={`${question.foldPct}%`} />
              <VillChip label="Ganás si te paga" value={`${question.winWhenCalledPct}%`} />
            </>
          )}
        </div>
      </div>

      <p className="max-w-md text-center text-sm font-medium text-content">
        {kind === 'ev-call'
          ? '¿Cuál es el EV de pagar?'
          : kind === 'ev-shove'
            ? '¿Cuál es el EV de ir all-in?'
            : '¿Pagás, foldeás o vas all-in?'}
      </p>
    </div>
  );
}

function Chip({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
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

function VillChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-1.5">
      <span className="text-[10px] uppercase tracking-wider text-content-muted">{label}</span>
      <span className="text-sm font-semibold tabular-nums text-rose-200">{value}</span>
    </div>
  );
}

const DECISIONS: readonly { id: RiverLine; key: string }[] = [
  { id: 'call', key: '1' },
  { id: 'fold', key: '2' },
  { id: 'shove', key: '3' },
];

function DecisionButtons({
  question,
  feedback,
  onAnswer,
}: {
  question: RiverQuestion;
  feedback: Feedback | null;
  onAnswer: (choice: RiverLine) => void;
}) {
  return (
    <div className="mx-auto grid w-full max-w-md grid-cols-3 gap-1.5">
      {DECISIONS.map((c) => {
        const isCorrect = feedback && c.id === question.bestLine;
        const pickedThis = feedback?.pickedLabel === LINE_LABEL[c.id];
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
                : c.id === 'call'
                  ? 'border-accent/50 bg-accent/10 text-content hover:bg-accent/20'
                  : c.id === 'shove'
                    ? 'border-amber-500/40 bg-amber-500/10 text-content hover:bg-amber-500/20'
                    : 'border-border bg-surface/40 text-content hover:bg-surface-hover',
            )}
          >
            <span className="flex-1 text-center">{LINE_LABEL[c.id]}</span>
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
  correct,
  onAnswer,
}: {
  question: RiverQuestion;
  feedback: Feedback | null;
  correct: number;
  onAnswer: (picked: number) => void;
}) {
  return (
    <div className="mx-auto grid w-full max-w-md grid-cols-2 gap-1.5 sm:grid-cols-4">
      {question.options.map((opt, i) => {
        const isCorrect = feedback && opt === correct;
        const pickedThis = feedback?.pickedLabel === formatEv(opt, question.unit);
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
            <span className="flex-1 text-center">{formatEv(opt, question.unit)}</span>
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
  question: RiverQuestion;
  feedback: Feedback;
}) {
  const { unit, potWon, villainBet, winCallingPct, foldPct, winWhenCalledPct, evCall, evShove, bestLine, kind } =
    question;
  const ev = (n: number) => formatEv(n, unit);
  const amt = (n: number) => formatAmount(n, unit);
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
        {kind === 'decision' ? (
          <span className="text-content-muted">
            Mejor línea:{' '}
            <span className="font-semibold text-content">{LINE_LABEL[bestLine]}</span>
          </span>
        ) : (
          <span className="text-content-muted">
            {kind === 'ev-call' ? 'EV de pagar' : 'EV de ir all-in'} ={' '}
            <span
              className={cn(
                'font-semibold tabular-nums',
                (kind === 'ev-call' ? evCall : evShove) >= 0
                  ? 'text-emerald-300'
                  : 'text-rose-300',
              )}
            >
              {ev(kind === 'ev-call' ? evCall : evShove)}
            </span>
          </span>
        )}
      </div>

      {kind === 'ev-call' && (
        <p className="text-xs text-content-muted">
          EV pagar = Bote·win% − Apuesta·(1−win%) ={' '}
          <span className="tabular-nums text-content">{amt(potWon)}</span>·{winCallingPct}% −{' '}
          <span className="tabular-nums text-content">{amt(villainBet)}</span>·{100 - winCallingPct}% ={' '}
          <span className="font-medium tabular-nums text-content">{ev(evCall)}</span>.
        </p>
      )}
      {kind === 'ev-shove' && (
        <p className="text-xs text-content-muted">
          EV all-in = fold%·Bote + (1−fold%)·[win·(Bote+all-in−Apuesta) − (1−win)·all-in] ={' '}
          <span className="font-medium tabular-nums text-content">{ev(evShove)}</span>. Con{' '}
          {foldPct}% de fold y {winWhenCalledPct}% de equity al ser pagado.
        </p>
      )}

      {kind === 'decision' ? (
        <>
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
            <LineEv label="Call" value={ev(evCall)} positive={evCall >= 0} best={bestLine === 'call'} />
            <LineEv label="Fold" value={ev(0)} positive best={bestLine === 'fold'} />
            <LineEv label="Shove" value={ev(evShove)} positive={evShove >= 0} best={bestLine === 'shove'} />
          </div>
          <p className="text-xs text-content-muted">
            Elegís la línea de mayor EV (fold = 0). Considerá el shove, no solo call/fold: el
            rango con el que el rival continúa cambia el EV del all-in, aunque ganes ~0% cuando te paga.
          </p>
        </>
      ) : (
        <p className="text-xs text-content-muted">
          La otra línea: {kind === 'ev-call' ? 'EV de ir all-in' : 'EV de pagar'} ={' '}
          <span className="tabular-nums text-content">
            {ev(kind === 'ev-call' ? evShove : evCall)}
          </span>{' '}
          (fold = {ev(0)}). Mejor línea del spot:{' '}
          <span className="font-medium text-content">{LINE_LABEL[bestLine]}</span>.
        </p>
      )}
    </div>
  );
}

function LineEv({
  label,
  value,
  positive,
  best,
}: {
  label: string;
  value: string;
  positive: boolean;
  best: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-lg border px-2.5 py-1',
        best ? 'border-emerald-500/60 bg-emerald-500/10' : 'border-border bg-surface/40',
      )}
    >
      <span className="text-[10px] uppercase tracking-wider text-content-muted">{label}</span>
      <span
        className={cn(
          'text-sm font-semibold tabular-nums',
          best ? 'text-emerald-200' : positive ? 'text-content' : 'text-rose-300',
        )}
      >
        {value}
      </span>
    </div>
  );
}
