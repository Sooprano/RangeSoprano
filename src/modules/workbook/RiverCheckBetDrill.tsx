import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, RotateCcw, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { BoardCards } from '@/modules/analysis/BoardCards';
import { CountdownBar } from '@/modules/trainer/CountdownBar';
import { CheckVsBetCalc } from '@/modules/calculators/CheckVsBetCalc';
import {
  formatAmount,
  formatEv,
  generateRiverBetQuestion,
  pctOfPot,
  type RiverBetQuestion,
  type RiverLine,
} from './riverCheckBetSpots';
import { ChipColumn } from './ChipColumn';
import { AutoAdvanceToggle, CalcReveal, ScoreBar } from './drillUi';
import {
  AUTO_ADVANCE_MS,
  INITIAL_SCORE,
  tallyScore,
  type Score,
} from './drillScore';

type Feedback = { wasCorrect: boolean; pickedLabel: string };

const LINE_LABEL: Record<RiverLine, string> = {
  check: 'Check',
  small: 'Bet chico',
  big: 'Bet grande',
};

export function RiverCheckBetDrill() {
  const [question, setQuestion] = useState<RiverBetQuestion>(() =>
    generateRiverBetQuestion(),
  );
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [score, setScore] = useState<Score>(INITIAL_SCORE);
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [showCalc, setShowCalc] = useState(false);

  const drawNext = useCallback(() => {
    setQuestion(generateRiverBetQuestion());
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
    question.kind === 'ev-check'
      ? question.evCheck
      : question.kind === 'ev-small'
        ? question.evSmall
        : question.evBig;

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
          const map: Record<string, RiverLine> = { '1': 'check', '2': 'small', '3': 'big' };
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

  // CalcReveal seeds the queried bet (value) or the best bet (else big).
  const revealLine: 'small' | 'big' =
    question.kind === 'ev-small'
      ? 'small'
      : question.kind === 'ev-big'
        ? 'big'
        : question.bestLine === 'small'
          ? 'small'
          : 'big';
  const revealBet = revealLine === 'small' ? question.betSmall : question.betBig;
  const revealFold = revealLine === 'small' ? question.foldSmall : question.foldBig;
  const revealWin = revealLine === 'small' ? question.winSmall : question.winBig;

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
                <CheckVsBetCalc
                  initialPot={String(question.pot)}
                  initialBet={String(revealBet)}
                  initialCheckWinPct={String(question.checkWinPct)}
                  initialWinWhenCalledPct={String(revealWin)}
                  initialFoldPct={String(revealFold)}
                />
              </CalcReveal>
              {autoAdvance && !showCalc && (
                <CountdownBar key={score.total} durationMs={AUTO_ADVANCE_MS} />
              )}
            </>
          ) : (
            <p className="text-center text-xs text-content-muted">
              {question.kind === 'decision'
                ? '¿Check, bet chico o bet grande? · teclas 1-3 · N para avanzar después de responder'
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

function SpotCard({ question }: { question: RiverBetQuestion }) {
  const { unit, pot, betSmall, betBig, hero, board, kind } = question;
  const fmt = (n: number) => formatAmount(n, unit);
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-bg-subtle/60 p-4">
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-content-muted">
        River · el rival te checkea
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

      {/* MiniPot escalera: bote (ref) · bet chico · bet grande. Check behind = no apostar (3er botón). */}
      <div className="mx-auto grid w-full max-w-md grid-cols-3 items-end gap-3 px-2">
        <ChipColumn eyebrow="Bote" tone="muted" amount={pot} refAmount={pot} format={fmt} />
        <ChipColumn
          eyebrow="Bet chico"
          tone="accent"
          amount={betSmall}
          refAmount={pot}
          format={fmt}
          sub={`${pctOfPot(betSmall, pot)}% del bote`}
        />
        <ChipColumn
          eyebrow="Bet grande"
          tone="amber"
          amount={betBig}
          refAmount={pot}
          format={fmt}
          sub={`${pctOfPot(betBig, pot)}% del bote`}
        />
      </div>

      {/* Villain tendencies relevant to the question (given data from Flopzilla). */}
      <div className="flex flex-col items-center gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-300/80">
          El villano, a cada tamaño
        </span>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {(kind === 'ev-check' || kind === 'decision') && (
            <VillChip label="Ganás al showdown" value={`${question.checkWinPct}%`} />
          )}
          {(kind === 'ev-small' || kind === 'decision') && (
            <>
              <VillChip label="Foldea al bet chico" value={`${question.foldSmall}%`} />
              <VillChip label="Ganás si paga el chico" value={`${question.winSmall}%`} />
            </>
          )}
          {(kind === 'ev-big' || kind === 'decision') && (
            <>
              <VillChip label="Foldea al bet grande" value={`${question.foldBig}%`} />
              <VillChip label="Ganás si paga el grande" value={`${question.winBig}%`} />
            </>
          )}
        </div>
      </div>

      <p className="max-w-md text-center text-base font-semibold text-content">
        {kind === 'ev-check'
          ? '¿Cuál es el EV de checkear behind?'
          : kind === 'ev-small'
            ? '¿Cuál es el EV de apostar el tamaño chico?'
            : kind === 'ev-big'
              ? '¿Cuál es el EV de apostar el tamaño grande?'
              : '¿Checkeás, apostás chico o apostás grande?'}
      </p>
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
  { id: 'check', key: '1' },
  { id: 'small', key: '2' },
  { id: 'big', key: '3' },
];

function DecisionButtons({
  question,
  feedback,
  onAnswer,
}: {
  question: RiverBetQuestion;
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
                : c.id === 'check'
                  ? 'border-border bg-surface/40 text-content hover:bg-surface-hover'
                  : c.id === 'small'
                    ? 'border-accent/50 bg-accent/10 text-content hover:bg-accent/20'
                    : 'border-amber-500/40 bg-amber-500/10 text-content hover:bg-amber-500/20',
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
  question: RiverBetQuestion;
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
  question: RiverBetQuestion;
  feedback: Feedback;
}) {
  const {
    unit,
    pot,
    checkWinPct,
    betSmall,
    foldSmall,
    winSmall,
    betBig,
    foldBig,
    winBig,
    evCheck,
    evSmall,
    evBig,
    bestLine,
    kind,
  } = question;
  const ev = (n: number) => formatEv(n, unit);
  const amt = (n: number) => formatAmount(n, unit);
  const queried = kind === 'ev-check' ? evCheck : kind === 'ev-small' ? evSmall : evBig;
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
            {kind === 'ev-check'
              ? 'EV de checkear'
              : kind === 'ev-small'
                ? 'EV del bet chico'
                : 'EV del bet grande'}{' '}
            ={' '}
            <span
              className={cn(
                'font-semibold tabular-nums',
                queried >= 0 ? 'text-emerald-300' : 'text-rose-300',
              )}
            >
              {ev(queried)}
            </span>
          </span>
        )}
      </div>

      {kind === 'ev-check' && (
        <p className="text-xs text-content-muted">
          EV check = Bote · win% ={' '}
          <span className="tabular-nums text-content">{amt(pot)}</span> · {checkWinPct}% ={' '}
          <span className="font-medium tabular-nums text-content">{ev(evCheck)}</span>. Sin apostar
          no arriesgás fichas; ganás el bote tu equity al showdown.
        </p>
      )}
      {(kind === 'ev-small' || kind === 'ev-big') && (
        <p className="text-xs text-content-muted">
          EV bet = fold%·Bote + paga%·[win·(Bote+bet) − (1−win)·bet] ={' '}
          <span className="font-medium tabular-nums text-content">{ev(queried)}</span>. Apostando{' '}
          <span className="tabular-nums text-content">
            {amt(kind === 'ev-small' ? betSmall : betBig)}
          </span>{' '}
          con {(kind === 'ev-small' ? foldSmall : foldBig)}% de fold y{' '}
          {(kind === 'ev-small' ? winSmall : winBig)}% de equity al ser pagado.
        </p>
      )}

      {kind === 'decision' ? (
        <>
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
            <LineEv label="Check" value={ev(evCheck)} positive={evCheck >= 0} best={bestLine === 'check'} />
            <LineEv label="Bet chico" value={ev(evSmall)} positive={evSmall >= 0} best={bestLine === 'small'} />
            <LineEv label="Bet grande" value={ev(evBig)} positive={evBig >= 0} best={bestLine === 'big'} />
          </div>
          <p className="text-xs text-content-muted">
            Elegís la línea de mayor EV. Un bet grande foldea más, pero el rango que continúa es más
            ajustado (tu equity al ser pagado baja); checkear gana cuando tu mano tiene showdown pero
            poca equity contra el rango que pagaría.
          </p>
        </>
      ) : (
        <p className="text-xs text-content-muted">
          Las otras líneas: Check ={' '}
          <span className="tabular-nums text-content">{ev(evCheck)}</span> · Bet chico ={' '}
          <span className="tabular-nums text-content">{ev(evSmall)}</span> · Bet grande ={' '}
          <span className="tabular-nums text-content">{ev(evBig)}</span>. Mejor línea del spot:{' '}
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
