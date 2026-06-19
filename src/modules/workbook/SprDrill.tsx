import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, RotateCcw, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { CountdownBar } from '@/modules/trainer/CountdownBar';
import { AllInEvCalc } from '@/modules/calculators/AllInEvCalc';
import { EvBasicCalc } from '@/modules/calculators/EvBasicCalc';
import { generateSprQuestion, type SprQuestion } from './sprSpots';
import { ChipColumn, type ChipTone } from './ChipColumn';
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

function commitLabel(situation: SprQuestion['situation']): string {
  return situation === 'shove' ? 'Ir all-in' : 'Pagar';
}

export function SprDrill() {
  const [question, setQuestion] = useState<SprQuestion>(() =>
    generateSprQuestion(),
  );
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [score, setScore] = useState<Score>(INITIAL_SCORE);
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [showCalc, setShowCalc] = useState(false);

  const drawNext = useCallback(() => {
    setQuestion(generateSprQuestion());
    setFeedback(null);
    setShowCalc(false);
  }, []);

  // Opening the calc pauses auto-advance so it isn't whisked away mid-read.
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
    (choice: 'commit' | 'fold') => {
      if (feedback) return;
      const label = choice === 'commit' ? commitLabel(question.situation) : 'Fold';
      grade(choice === question.correctDecision, label);
    },
    [feedback, question.correctDecision, question.situation, grade],
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
            answerDecision('commit');
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
                <SprCalc question={question} />
              </CalcReveal>
              {autoAdvance && !showCalc && (
                <CountdownBar key={score.total} durationMs={AUTO_ADVANCE_MS} />
              )}
            </>
          ) : (
            <p className="text-center text-xs text-content-muted">
              {question.kind === 'decision'
                ? 'Comprometerte o fold · teclas 1-2 · N para avanzar después de responder'
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

const TASK_EYEBROW: Record<SprQuestion['kind'], string> = {
  decision: 'Decisión — comprometerte o fold',
  'ev-value': 'Cálculo — EV de comprometerte',
};

function SpotCard({ question }: { question: SprQuestion }) {
  const { situation, pot, stack, spr, equityPct, foldPct } = question;
  const fmt = (n: number) => money(n);
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-bg-subtle/60 p-4">
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent-light">
        {TASK_EYEBROW[question.kind]}
      </span>

      {/* MiniPot: bote vs all-in, fichas escaladas al bote → el SPR se ve. */}
      <div className="mx-auto grid w-full max-w-[16rem] grid-cols-2 items-end gap-3 px-2">
        {situation === 'shove' ? (
          <>
            <ChipColumn eyebrow="Bote" tone="muted" amount={pot} refAmount={pot} format={fmt} />
            <ChipColumn eyebrow="Tu all-in" tone="accent" amount={stack} refAmount={pot} format={fmt} />
          </>
        ) : (
          <>
            <ChipColumn eyebrow="Villano all-in" tone="rose" amount={stack} refAmount={pot} format={fmt} />
            <ChipColumn eyebrow="Bote" tone="muted" amount={pot} refAmount={pot} format={fmt} />
          </>
        )}
      </div>

      {/* Stat tiles color-codeados: SPR (ámbar), tu equity (accent), foldean (rose). */}
      <div className="flex flex-wrap items-stretch justify-center gap-2">
        <StatTile label="SPR" value={String(spr)} tone="amber" caption="stack ÷ bote" />
        <StatTile label="Tu equity" value={`${equityPct}%`} tone="accent" />
        {foldPct != null && <StatTile label="Foldean" value={`${foldPct}%`} tone="rose" />}
      </div>

      {/* Escenario + la pregunta real en su propia línea. */}
      <div className="flex max-w-md flex-col items-center gap-1 text-center">
        <p className="text-sm text-content-muted">
          {situation === 'shove' ? (
            <>
              Haces all-in por{' '}
              <span className="font-semibold text-content">{money(stack)}</span> sobre un bote de{' '}
              <span className="font-semibold text-content">{money(pot)}</span>.
            </>
          ) : (
            <>
              El rival hace all-in por{' '}
              <span className="font-semibold text-content">{money(stack)}</span>; pagas{' '}
              <span className="font-semibold text-content">{money(stack)}</span>.
            </>
          )}
        </p>
        <p className="text-base font-semibold text-content">
          {question.kind === 'decision'
            ? '¿Te comprometes o foldeas?'
            : '¿Cuál es el EV de comprometerte? (fold = $0)'}
        </p>
      </div>
    </div>
  );
}

const STAT_TONE: Record<ChipTone, { border: string; value: string }> = {
  muted: { border: 'border-border', value: 'text-content' },
  accent: { border: 'border-accent/40', value: 'text-accent-light' },
  rose: { border: 'border-rose-500/40', value: 'text-rose-200' },
  amber: { border: 'border-amber-400/40', value: 'text-amber-200' },
};

function StatTile({
  label,
  value,
  tone,
  caption,
}: {
  label: string;
  value: string;
  tone: ChipTone;
  caption?: string;
}) {
  const t = STAT_TONE[tone];
  return (
    <div
      className={cn(
        'flex min-w-[5rem] flex-col items-center justify-center gap-0.5 rounded-lg border bg-surface/60 px-3 py-1.5',
        t.border,
      )}
    >
      <span className="text-[10px] uppercase tracking-wider text-content-muted">{label}</span>
      <span className={cn('font-mono text-lg font-bold tabular-nums', t.value)}>{value}</span>
      {caption && (
        <span className="text-[9px] tabular-nums text-content-muted">{caption}</span>
      )}
    </div>
  );
}

function DecisionButtons({
  question,
  feedback,
  onAnswer,
}: {
  question: SprQuestion;
  feedback: Feedback | null;
  onAnswer: (choice: 'commit' | 'fold') => void;
}) {
  const choices: { id: 'commit' | 'fold'; label: string; key: string }[] = [
    { id: 'commit', label: commitLabel(question.situation), key: '1' },
    { id: 'fold', label: 'Fold', key: '2' },
  ];
  return (
    <div className="mx-auto grid w-full max-w-md grid-cols-2 gap-1.5">
      {choices.map((c) => {
        const isCorrect = feedback && c.id === question.correctDecision;
        const isWrongPick =
          feedback && c.id !== question.correctDecision && !feedback.wasCorrect;
        // Highlight the wrong-picked button only if it was the one chosen.
        const pickedThis = feedback?.pickedLabel === c.label;
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
                  : isWrongPick && pickedThis
                    ? 'border-rose-500/60 bg-rose-500/10 text-content'
                    : 'border-border bg-surface/40 text-content-muted opacity-60'
                : c.id === 'commit'
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
  question: SprQuestion;
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

function SprCalc({ question }: { question: SprQuestion }) {
  const { situation, pot, stack, equityPct, foldPct } = question;
  // shove → All-in EV (Complex EV); pagar un all-in → EV básico (Basic EV).
  // Ambas reproducen el EV del drill con los mismos números.
  return situation === 'shove' ? (
    <AllInEvCalc
      initialPot={String(pot)}
      initialCall="0"
      initialShove={String(stack)}
      initialEquityPct={String(equityPct)}
      initialFoldPct={String(foldPct ?? 0)}
    />
  ) : (
    <EvBasicCalc
      initialWinAmount={String(pot + stack)}
      initialWinPct={String(equityPct)}
      initialLoseAmount={String(stack)}
    />
  );
}

function FeedbackPanel({
  question,
  feedback,
}: {
  question: SprQuestion;
  feedback: Feedback;
}) {
  const { situation, pot, stack, spr, equityPct, foldPct, ev, correctDecision } =
    question;
  const win = pot + stack; // $W: what you win when you win
  const committed = spr <= 2;
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
          EV de comprometerte ={' '}
          <span
            className={cn(
              'font-semibold tabular-nums',
              ev > 0 ? 'text-emerald-300' : 'text-rose-300',
            )}
          >
            {money(ev)}
          </span>{' '}
          → {correctDecision === 'commit' ? commitLabel(situation).toLowerCase() : 'fold'}
        </span>
      </div>
      <p className="text-xs text-content-muted">
        {situation === 'shove' ? (
          <>
            EV = F·bote + C·eq·$W − C·(1−eq)·$L ={' '}
            <span className="tabular-nums text-content">{foldPct}%</span>·{money(pot)} +{' '}
            <span className="tabular-nums text-content">{100 - (foldPct ?? 0)}%</span>·
            <span className="tabular-nums text-content">{equityPct}%</span>·{money(win)} − …
            = <span className="font-medium tabular-nums text-content">{money(ev)}</span>.
          </>
        ) : (
          <>
            EV = eq·$W − (1−eq)·$L ={' '}
            <span className="tabular-nums text-content">{equityPct}%</span>·{money(win)} −{' '}
            <span className="tabular-nums text-content">{100 - equityPct}%</span>·
            {money(stack)} ={' '}
            <span className="font-medium tabular-nums text-content">{money(ev)}</span>.
          </>
        )}{' '}
        Fold = $0. A SPR {spr} ({committed ? 'bajo' : 'alto'}) te comprometes con{' '}
        {committed ? 'menos' : 'más'} equity.
      </p>
    </div>
  );
}
