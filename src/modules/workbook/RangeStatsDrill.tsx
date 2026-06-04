import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, RotateCcw, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { RangeGrid } from '@/components/RangeGrid';
import { CountdownBar } from '@/modules/trainer/CountdownBar';
import {
  RANGE_ACTIONS_MAP,
  handsToCells,
  type RangeAction,
} from './rangeBank';
import {
  checkExpert,
  generateStatsQuestion,
  type StatsQuestion,
} from './rangeStatsSpots';
import { AutoAdvanceToggle, ScoreBar } from './drillUi';
import {
  AUTO_ADVANCE_MS,
  INITIAL_SCORE,
  tallyScore,
  type Score,
} from './drillScore';

type Feedback = { wasCorrect: boolean; pickedLabel: string };

const ACTION_WORD: Record<RangeAction, string> = {
  open: 'apertura (RFI)',
  '3bet': '3-bet',
  '4bet': '4-bet',
  'cold-call': 'cold-call',
  call: 'call',
};

function spotEyebrow(q: StatsQuestion): string {
  const { position, vs, action } = q.spot;
  const word = ACTION_WORD[action];
  return vs ? `${position} · ${word} ${vs}` : `${position} · ${word}`;
}

export function RangeStatsDrill() {
  const [question, setQuestion] = useState<StatsQuestion>(() => generateStatsQuestion());
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [score, setScore] = useState<Score>(INITIAL_SCORE);
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [expert, setExpert] = useState(false);
  const [expertInput, setExpertInput] = useState('');

  const fmt = useCallback(
    (v: number) => (question.kind === 'pct' ? `${v}%` : String(v)),
    [question.kind],
  );

  const drawNext = useCallback(() => {
    setQuestion(generateStatsQuestion());
    setFeedback(null);
    setExpertInput('');
  }, []);

  useEffect(() => {
    if (!autoAdvance || !feedback) return;
    const id = setTimeout(drawNext, AUTO_ADVANCE_MS);
    return () => clearTimeout(id);
  }, [autoAdvance, feedback, drawNext]);

  const grade = useCallback((wasCorrect: boolean, pickedLabel: string) => {
    setFeedback({ wasCorrect, pickedLabel });
    setScore((s) => tallyScore(s, wasCorrect));
  }, []);

  const answerMc = useCallback(
    (picked: number) => {
      if (feedback) return;
      grade(picked === question.correct, fmt(picked));
    },
    [feedback, question.correct, fmt, grade],
  );

  const answerExpert = useCallback(() => {
    if (feedback) return;
    const value = Number(expertInput.trim());
    if (expertInput.trim() === '' || !Number.isFinite(value)) return;
    grade(checkExpert(question.kind, value, question.correct), fmt(value));
  }, [feedback, expertInput, question.kind, question.correct, fmt, grade]);

  const reset = useCallback(() => {
    setScore(INITIAL_SCORE);
    drawNext();
  }, [drawNext]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (!feedback && !expert) {
        const idx = '1234'.indexOf(e.key);
        if (idx >= 0 && idx < question.options.length) {
          e.preventDefault();
          answerMc(question.options[idx]!);
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
  }, [feedback, expert, question, answerMc, drawNext]);

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
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-content-muted">
            {spotEyebrow(question)}
          </span>

          <div className="mx-auto w-full max-w-[380px] sm:max-w-[420px]">
            <RangeGrid cells={cells} actionsMap={RANGE_ACTIONS_MAP} />
          </div>

          <p className="max-w-md text-center font-mono text-xs text-content-muted">
            {question.spot.notation}
          </p>

          <p className="max-w-md text-center text-sm font-medium text-content">
            {question.kind === 'pct'
              ? '¿Qué % del total representa este rango?'
              : '¿Cuántos combos tiene este rango?'}
          </p>
        </div>

        {expert ? (
          <ExpertInput
            kind={question.kind}
            value={expertInput}
            onChange={setExpertInput}
            onSubmit={answerExpert}
            disabled={feedback !== null}
          />
        ) : (
          <McOptions question={question} feedback={feedback} fmt={fmt} onAnswer={answerMc} />
        )}

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
              {expert
                ? 'Escribí tu respuesta y Enter · N para avanzar después'
                : '¿Tu respuesta? · teclas 1-4 · N para avanzar después de responder'}
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

      <div className="flex flex-wrap items-center justify-center gap-2">
        <AutoAdvanceToggle value={autoAdvance} onChange={setAutoAdvance} />
        <ToggleChip
          label="Modo experto"
          value={expert}
          onChange={(v) => {
            setExpert(v);
            setExpertInput('');
          }}
        />
      </div>
    </div>
  );
}

function McOptions({
  question,
  feedback,
  fmt,
  onAnswer,
}: {
  question: StatsQuestion;
  feedback: Feedback | null;
  fmt: (v: number) => string;
  onAnswer: (picked: number) => void;
}) {
  return (
    <div className="mx-auto grid w-full max-w-md grid-cols-2 gap-1.5 sm:grid-cols-4">
      {question.options.map((opt, i) => {
        const isCorrect = feedback && opt === question.correct;
        const pickedThis = feedback?.pickedLabel === fmt(opt);
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
            <span className="flex-1 text-center">{fmt(opt)}</span>
            <span className="shrink-0 rounded bg-surface px-1 py-px text-[10px] font-medium tabular-nums tracking-wider text-content-muted">
              {i + 1}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ExpertInput({
  kind,
  value,
  onChange,
  onSubmit,
  disabled,
}: {
  kind: StatsQuestion['kind'];
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled: boolean;
}) {
  return (
    <div className="mx-auto flex w-full max-w-xs items-end gap-2">
      <label className="flex flex-1 flex-col gap-1">
        <span className="text-[11px] uppercase tracking-wider text-content-muted">
          {kind === 'pct' ? 'Tu % (tolerancia ±1)' : 'Tus combos (exacto)'}
        </span>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-surface px-3 py-2">
          <input
            type="number"
            inputMode="numeric"
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onSubmit();
              }
            }}
            autoFocus
            className="w-full bg-transparent text-lg font-semibold tabular-nums text-content outline-none disabled:opacity-60"
            placeholder={kind === 'pct' ? '12' : '124'}
          />
          {kind === 'pct' && <span className="text-content-muted">%</span>}
        </div>
      </label>
      <button
        type="button"
        onClick={onSubmit}
        disabled={disabled || value.trim() === ''}
        className={cn(
          'rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition-colors',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light',
          disabled || value.trim() === ''
            ? 'cursor-not-allowed bg-surface text-content-disabled'
            : 'bg-accent text-white hover:bg-accent-deep',
        )}
      >
        Responder
      </button>
    </div>
  );
}

function ToggleChip({
  label,
  value,
  onChange,
}: {
  label: string;
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
      {label}
    </label>
  );
}

function FeedbackPanel({
  question,
  feedback,
}: {
  question: StatsQuestion;
  feedback: Feedback;
}) {
  const { pct, combos, breakdown } = question;
  const b = breakdown;
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
          <span className="font-semibold text-content tabular-nums">{combos}</span> combos ·{' '}
          <span className="font-semibold text-content tabular-nums">{pct}%</span> del total
        </span>
      </div>
      <p className="text-xs text-content-muted">
        {b.pairs} <span className="text-content">pares</span> + {b.suited}{' '}
        <span className="text-content">suited</span> + {b.offsuit}{' '}
        <span className="text-content">offsuit</span> ={' '}
        <span className="font-medium tabular-nums text-content">{combos}</span> combos.{' '}
        <span className="tabular-nums text-content">{combos}</span> / 1326 ={' '}
        <span className="font-medium tabular-nums text-content">{pct}%</span>.
      </p>
    </div>
  );
}
