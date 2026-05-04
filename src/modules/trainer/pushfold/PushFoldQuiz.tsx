import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Check, RotateCcw, Trophy, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import {
  ALL_PUSHFOLD_KINDS,
  describeThreshold,
  generatePushFoldQuestion,
  PUSHFOLD_KIND_LABEL,
  type PushFoldAnswer,
  type PushFoldKind,
  type PushFoldQuestion,
} from '@/utils/pushFold';

const STREAK_BONUS_THRESHOLD = 5;
const PUSH_COLOR = '#22c55e';
const CALL_COLOR = '#3b82f6';

type Score = {
  correct: number;
  total: number;
  streak: number;
  bestStreak: number;
};

const INITIAL_SCORE: Score = {
  correct: 0,
  total: 0,
  streak: 0,
  bestStreak: 0,
};

type Feedback = {
  picked: PushFoldAnswer;
  wasCorrect: boolean;
};

export function PushFoldQuiz() {
  const [enabled, setEnabled] = useState<Set<PushFoldKind>>(
    () => new Set(ALL_PUSHFOLD_KINDS),
  );
  const [question, setQuestion] = useState<PushFoldQuestion>(() =>
    generatePushFoldQuestion(ALL_PUSHFOLD_KINDS),
  );
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [score, setScore] = useState<Score>(INITIAL_SCORE);

  const enabledArr = useMemo(() => Array.from(enabled), [enabled]);

  const drawNext = useCallback(() => {
    const pool = enabledArr.length > 0 ? enabledArr : ALL_PUSHFOLD_KINDS;
    setQuestion(generatePushFoldQuestion(pool));
    setFeedback(null);
  }, [enabledArr]);

  const recordAnswer = useCallback(
    (picked: PushFoldAnswer, wasCorrect: boolean) => {
      setFeedback({ picked, wasCorrect });
      setScore((s) => {
        const streak = wasCorrect ? s.streak + 1 : 0;
        return {
          correct: s.correct + (wasCorrect ? 1 : 0),
          total: s.total + 1,
          streak,
          bestStreak: Math.max(s.bestStreak, streak),
        };
      });
    },
    [],
  );

  const answer = useCallback(
    (picked: PushFoldAnswer) => {
      if (feedback) return;
      recordAnswer(picked, picked === question.correct);
    },
    [feedback, question.correct, recordAnswer],
  );

  const reset = useCallback(() => {
    setScore(INITIAL_SCORE);
    drawNext();
  }, [drawNext]);

  const toggleKind = useCallback((kind: PushFoldKind) => {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) {
        if (next.size === 1) return prev;
        next.delete(kind);
      } else {
        next.add(kind);
      }
      return next;
    });
  }, []);

  const yesAnswer: PushFoldAnswer = question.scope === 'push' ? 'PUSH' : 'CALL';

  // Keyboard: 1 = Push/Call, 2 = Fold, Enter/Space/N = next.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target?.closest(
          'input, textarea, select, [contenteditable="true"], [role="grid"]',
        )
      ) {
        return;
      }
      if (e.key === '1') {
        e.preventDefault();
        if (!feedback) answer(yesAnswer);
        return;
      }
      if (e.key === '2') {
        e.preventDefault();
        if (!feedback) answer('FOLD');
        return;
      }
      if (
        e.key === 'Enter' ||
        e.key === ' ' ||
        e.key === 'n' ||
        e.key === 'N'
      ) {
        e.preventDefault();
        if (feedback) drawNext();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [feedback, yesAnswer, answer, drawNext]);

  const accuracy = useMemo(
    () => (score.total === 0 ? 0 : (score.correct / score.total) * 100),
    [score],
  );

  return (
    <div className="flex flex-col gap-4">
      <ScoreBar score={score} accuracy={accuracy} />

      <div className="flex flex-col items-stretch gap-4 rounded-xl border border-border bg-surface/60 p-4 shadow-surface sm:p-5">
        <Prompt question={question} />

        <AnswerButtons
          yesAnswer={yesAnswer}
          feedback={feedback}
          correct={question.correct}
          onAnswer={answer}
        />

        <div className="min-h-[3.5rem] w-full">
          {feedback ? (
            <FeedbackPanel
              wasCorrect={feedback.wasCorrect}
              picked={feedback.picked}
              correct={question.correct}
              explanation={describeThreshold(question)}
            />
          ) : (
            <p className="text-center text-xs text-content-muted">
              Tecla <kbd className="rounded bg-surface px-1 py-0.5 font-mono text-[10px]">1</kbd> = {yesAnswer === 'PUSH' ? 'Push' : 'Call'} ·{' '}
              <kbd className="rounded bg-surface px-1 py-0.5 font-mono text-[10px]">2</kbd> = Fold ·{' '}
              <kbd className="rounded bg-surface px-1 py-0.5 font-mono text-[10px]">N</kbd> = siguiente
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
            <span className="text-[10px] uppercase tracking-wider text-white/70">
              ↵
            </span>
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
        <KindFilter enabled={enabled} onToggle={toggleKind} />
      </div>
    </div>
  );
}

function Prompt({ question }: { question: PushFoldQuestion }) {
  const isPush = question.scope === 'push';
  const eyebrow = isPush
    ? `BTN · push or fold · ${question.stackBB.toFixed(1)} BB`
    : `BB · call or fold · ${question.stackBB.toFixed(1)} BB`;
  const sentence = isPush
    ? `Estás en BTN con stack efectivo de ${question.stackBB.toFixed(1)} BB. Te toca actuar.`
    : `Estás en BB con stack efectivo de ${question.stackBB.toFixed(1)} BB. BTN va all-in.`;
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-content-muted">
        {eyebrow}
      </span>
      <p className="max-w-xl text-sm leading-relaxed text-content sm:text-base">
        {sentence}
      </p>
      <HandBadge hand={question.hand} />
    </div>
  );
}

function HandBadge({ hand }: { hand: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 shadow-surface">
      <span className="text-[10px] uppercase tracking-wider text-content-muted">
        Mano
      </span>
      <span className="font-mono text-2xl font-bold tabular-nums text-content">
        {hand}
      </span>
    </div>
  );
}

function AnswerButtons({
  yesAnswer,
  feedback,
  correct,
  onAnswer,
}: {
  yesAnswer: PushFoldAnswer;
  feedback: Feedback | null;
  correct: PushFoldAnswer;
  onAnswer: (picked: PushFoldAnswer) => void;
}) {
  const yesLabel = yesAnswer === 'PUSH' ? 'Push' : 'Call';
  const yesIcon =
    yesAnswer === 'PUSH' ? (
      <ArrowUpFromLine className="h-4 w-4" strokeWidth={2.25} />
    ) : (
      <ArrowDownToLine className="h-4 w-4" strokeWidth={2.25} />
    );
  const yesColor = yesAnswer === 'PUSH' ? PUSH_COLOR : CALL_COLOR;

  return (
    <div className="mx-auto grid w-full max-w-md grid-cols-2 gap-2">
      <AnswerButton
        label={yesLabel}
        icon={yesIcon}
        accentColor={yesColor}
        keyHint="1"
        active={feedback?.picked === yesAnswer}
        showAsCorrect={!!feedback && correct === yesAnswer}
        showAsWrong={
          !!feedback && feedback.picked === yesAnswer && correct !== yesAnswer
        }
        disabled={feedback !== null}
        onClick={() => onAnswer(yesAnswer)}
      />
      <AnswerButton
        label="Fold"
        icon={<X className="h-4 w-4" strokeWidth={2.25} />}
        accentColor="#94a3b8"
        keyHint="2"
        active={feedback?.picked === 'FOLD'}
        showAsCorrect={!!feedback && correct === 'FOLD'}
        showAsWrong={
          !!feedback && feedback.picked === 'FOLD' && correct !== 'FOLD'
        }
        disabled={feedback !== null}
        onClick={() => onAnswer('FOLD')}
      />
    </div>
  );
}

function AnswerButton({
  label,
  icon,
  accentColor,
  keyHint,
  showAsCorrect,
  showAsWrong,
  disabled,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  accentColor: string;
  keyHint: string;
  active: boolean;
  showAsCorrect: boolean;
  showAsWrong: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex items-center justify-between gap-2 rounded-lg border px-3 py-3 text-sm font-semibold',
        'transition-colors duration-150 ease-out-soft',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light',
        showAsCorrect
          ? 'border-emerald-500/60 bg-emerald-500/10 text-content'
          : showAsWrong
            ? 'border-rose-500/60 bg-rose-500/10 text-content'
            : disabled
              ? 'border-border bg-surface/40 text-content-muted opacity-60'
              : 'border-border bg-surface/40 text-content hover:bg-surface-hover',
      )}
      style={!disabled ? { color: accentColor, borderColor: `${accentColor}66` } : undefined}
    >
      <span className="flex items-center gap-2">
        {icon}
        {label}
      </span>
      <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] tabular-nums tracking-wider text-content-muted">
        {keyHint}
      </span>
    </button>
  );
}

function FeedbackPanel({
  wasCorrect,
  picked,
  correct,
  explanation,
}: {
  wasCorrect: boolean;
  picked: PushFoldAnswer;
  correct: PushFoldAnswer;
  explanation: string;
}) {
  const labelOf = (a: PushFoldAnswer) =>
    a === 'PUSH' ? 'Push' : a === 'CALL' ? 'Call' : 'Fold';
  return (
    <div
      className={cn(
        'flex flex-col gap-1 rounded-lg border px-3 py-2 text-sm',
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
        <span className="font-semibold">
          {wasCorrect ? 'Correcto' : 'Incorrecto'}
        </span>
        {!wasCorrect && (
          <>
            <span className="text-content-muted">·</span>
            <span className="text-content-muted">
              Elegiste{' '}
              <span className="font-medium text-content">{labelOf(picked)}</span>
            </span>
            <span className="text-content-muted">·</span>
            <span className="text-content-muted">
              Respuesta:{' '}
              <span className="font-medium text-content">{labelOf(correct)}</span>
            </span>
          </>
        )}
      </div>
      <p className="font-mono text-xs text-content-muted">{explanation}</p>
    </div>
  );
}

function ScoreBar({ score, accuracy }: { score: Score; accuracy: number }) {
  const streakHot = score.streak >= STREAK_BONUS_THRESHOLD;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat label="Precisión" value={`${accuracy.toFixed(0)}%`} />
      <Stat label="Correctas" value={`${score.correct} / ${score.total}`} />
      <Stat
        label="Racha"
        value={String(score.streak)}
        accent={streakHot}
        {...(streakHot && {
          icon: <Trophy className="h-4 w-4" strokeWidth={2.5} />,
        })}
      />
      <Stat label="Mejor racha" value={String(score.bestStreak)} />
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: string;
  accent?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border px-3 py-2 transition-colors',
        accent
          ? 'border-amber-500/60 bg-amber-500/10'
          : 'border-border bg-surface/40',
      )}
    >
      <p
        className={cn(
          'text-[10px] uppercase tracking-wider',
          accent ? 'text-amber-300' : 'text-content-muted',
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          'flex items-center gap-1.5 text-lg font-semibold tabular-nums',
          accent ? 'text-amber-200' : 'text-content',
        )}
      >
        {icon && <span aria-hidden>{icon}</span>}
        <span>{value}</span>
      </p>
    </div>
  );
}

function KindFilter({
  enabled,
  onToggle,
}: {
  enabled: Set<PushFoldKind>;
  onToggle: (kind: PushFoldKind) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <span className="text-[10px] uppercase tracking-wider text-content-muted">
        Tipos de pregunta
      </span>
      {ALL_PUSHFOLD_KINDS.map((kind) => {
        const active = enabled.has(kind);
        return (
          <button
            key={kind}
            type="button"
            onClick={() => onToggle(kind)}
            aria-pressed={active}
            className={cn(
              'rounded-full border px-2.5 py-1 text-[11px] font-medium',
              'transition-colors duration-150 ease-out-soft',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light',
              active
                ? 'border-accent/60 bg-accent/10 text-content'
                : 'border-border bg-surface/40 text-content-muted hover:bg-surface-hover hover:text-content',
            )}
          >
            {PUSHFOLD_KIND_LABEL[kind]}
          </button>
        );
      })}
    </div>
  );
}
