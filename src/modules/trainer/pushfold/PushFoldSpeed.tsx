import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronDown,
  ChevronUp,
  Crown,
  Flag,
  Play,
  RotateCcw,
  Settings2,
  Trophy,
  X,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import {
  ALL_PUSHFOLD_KINDS,
  generatePushFoldQuestion,
  PUSHFOLD_KIND_LABEL,
  type PushFoldAnswer,
  type PushFoldKind,
  type PushFoldQuestion,
} from '@/utils/pushFold';
import { PUSHFOLD_DURATIONS, type PushFoldEntry } from '@/store/schemas';
import {
  usePushFoldBoardForDuration,
  usePushFoldLeaderboardStore,
} from '@/store/pushFoldLeaderboardStore';

type Phase = 'config' | 'running' | 'finished';
const FEEDBACK_FLASH_MS = 220;
const DEFAULT_DURATION = 60;
const PUSH_COLOR = '#22c55e';
const CALL_COLOR = '#3b82f6';

type Mistake = {
  prompt: string;
  hand: string;
  stackBB: number;
  correct: PushFoldAnswer;
  picked: PushFoldAnswer;
  threshold: number;
  kind: PushFoldKind;
};

type RunResult = Pick<
  PushFoldEntry,
  'correct' | 'total' | 'qpm' | 'accuracyPct' | 'durationSec'
> & { mistakes: Mistake[] };

function formatDurationLabel(secs: number): string {
  if (secs < 60) return `${secs}s`;
  if (secs % 60 === 0) return `${secs / 60}min`;
  return `${secs}s`;
}

function formatTime(secs: number): string {
  const ceiled = Math.ceil(secs);
  const m = Math.floor(ceiled / 60);
  const s = ceiled % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function answerLabel(a: PushFoldAnswer): string {
  return a === 'PUSH' ? 'Push' : a === 'CALL' ? 'Call' : 'Fold';
}

export function PushFoldSpeed() {
  const [phase, setPhase] = useState<Phase>('config');
  const [duration, setDuration] = useState<number>(DEFAULT_DURATION);
  const [enabledKinds, setEnabledKinds] = useState<Set<PushFoldKind>>(
    () => new Set(ALL_PUSHFOLD_KINDS),
  );
  const [runId, setRunId] = useState(0);
  const [lastEntry, setLastEntry] = useState<PushFoldEntry | null>(null);
  const [madeTop, setMadeTop] = useState(false);
  const [sessionMistakes, setSessionMistakes] = useState<Mistake[]>([]);

  const addEntry = usePushFoldLeaderboardStore((s) => s.addEntry);
  const clearForDuration = usePushFoldLeaderboardStore(
    (s) => s.clearForDuration,
  );
  const board = usePushFoldBoardForDuration(duration);

  const enabledArr = useMemo(() => Array.from(enabledKinds), [enabledKinds]);

  const start = useCallback(() => {
    setRunId((n) => n + 1);
    setPhase('running');
  }, []);

  const finish = useCallback(
    (r: RunResult) => {
      const entry: PushFoldEntry = {
        durationSec: r.durationSec,
        correct: r.correct,
        total: r.total,
        qpm: r.qpm,
        accuracyPct: r.accuracyPct,
        dateIso: new Date().toISOString(),
      };
      const top = addEntry(entry);
      setLastEntry(entry);
      setMadeTop(top);
      setSessionMistakes(r.mistakes);
      setPhase('finished');
    },
    [addEntry],
  );

  const cancel = useCallback(() => setPhase('config'), []);

  const toggleKind = useCallback((kind: PushFoldKind) => {
    setEnabledKinds((prev) => {
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

  if (phase === 'config') {
    return (
      <ConfigScreen
        duration={duration}
        enabledKinds={enabledKinds}
        board={board}
        onDurationChange={setDuration}
        onToggleKind={toggleKind}
        onStart={start}
        onClearBoard={() => clearForDuration(duration)}
      />
    );
  }

  if (phase === 'running') {
    return (
      <SpeedRun
        key={runId}
        duration={duration}
        enabledKinds={enabledArr}
        onFinish={finish}
        onCancel={cancel}
      />
    );
  }

  return (
    <FinishedScreen
      entry={lastEntry}
      madeTop={madeTop}
      board={board}
      mistakes={sessionMistakes}
      onPlayAgain={start}
      onChangeConfig={() => setPhase('config')}
    />
  );
}

/* ------------------------------- CONFIG -------------------------------- */

function ConfigScreen({
  duration,
  enabledKinds,
  board,
  onDurationChange,
  onToggleKind,
  onStart,
  onClearBoard,
}: {
  duration: number;
  enabledKinds: Set<PushFoldKind>;
  board: readonly PushFoldEntry[];
  onDurationChange: (n: number) => void;
  onToggleKind: (k: PushFoldKind) => void;
  onStart: () => void;
  onClearBoard: () => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-border bg-surface/60 p-5 shadow-surface">
        <div className="flex items-center gap-2 text-sm font-semibold text-content">
          <Zap className="h-4 w-4 text-accent" strokeWidth={2.5} />
          Push/Fold · Velocidad
        </div>
        <p className="mt-1 text-xs text-content-muted">
          Corré contra el reloj con las tablas de Nash HU. Los 5 mejores por
          duración se guardan localmente.
        </p>

        <div className="mt-4 flex flex-col gap-4">
          <Field label="Duración">
            <div className="flex flex-wrap gap-2">
              {PUSHFOLD_DURATIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => onDurationChange(d)}
                  className={cn(
                    'rounded-lg border px-3 py-1.5 text-sm font-medium tabular-nums',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light',
                    duration === d
                      ? 'border-accent bg-accent/10 text-content'
                      : 'border-border bg-surface/40 text-content-muted hover:bg-surface-hover hover:text-content',
                  )}
                >
                  {formatDurationLabel(d)}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Tipos de pregunta">
            <div className="flex flex-wrap gap-2">
              {ALL_PUSHFOLD_KINDS.map((kind) => {
                const active = enabledKinds.has(kind);
                return (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => onToggleKind(kind)}
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
          </Field>
        </div>

        <button
          type="button"
          onClick={onStart}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-accent-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
        >
          <Play className="h-4 w-4" strokeWidth={2.5} />
          Iniciar {formatDurationLabel(duration)}
        </button>
      </div>

      <Leaderboard
        board={board}
        duration={duration}
        highlightDateIso={null}
        onClear={onClearBoard}
      />
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-content-muted">
        {label}
      </span>
      {children}
    </div>
  );
}

/* -------------------------------- RUN ---------------------------------- */

function SpeedRun({
  duration,
  enabledKinds,
  onFinish,
  onCancel,
}: {
  duration: number;
  enabledKinds: readonly PushFoldKind[];
  onFinish: (r: RunResult) => void;
  onCancel: () => void;
}) {
  const enabledRef = useRef(enabledKinds);
  enabledRef.current = enabledKinds;

  const [question, setQuestion] = useState<PushFoldQuestion>(() =>
    generatePushFoldQuestion(enabledKinds),
  );
  const [feedback, setFeedback] = useState<{
    picked: PushFoldAnswer;
    correct: boolean;
  } | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [remaining, setRemaining] = useState<number>(duration);

  const scoreRef = useRef(score);
  scoreRef.current = score;
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  const doneRef = useRef(false);
  const mistakesRef = useRef<Mistake[]>([]);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const start = performance.now();
    const id = setInterval(() => {
      const elapsed = (performance.now() - start) / 1000;
      const r = Math.max(0, duration - elapsed);
      setRemaining(r);
      if (r <= 0 && !doneRef.current) {
        doneRef.current = true;
        clearInterval(id);
        const s = scoreRef.current;
        onFinishRef.current({
          durationSec: duration,
          correct: s.correct,
          total: s.total,
          accuracyPct: s.total > 0 ? (s.correct / s.total) * 100 : 0,
          qpm: s.total > 0 ? (s.total / duration) * 60 : 0,
          mistakes: mistakesRef.current,
        });
      }
    }, 100);
    return () => clearInterval(id);
  }, [duration]);

  useEffect(
    () => () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    },
    [],
  );

  const answer = useCallback(
    (picked: PushFoldAnswer) => {
      if (feedback || doneRef.current) return;
      const correct = picked === question.correct;
      if (!correct) {
        mistakesRef.current = [
          ...mistakesRef.current,
          {
            prompt: question.hand,
            hand: question.hand,
            stackBB: question.stackBB,
            correct: question.correct,
            picked,
            threshold: question.threshold,
            kind: question.kind,
          },
        ];
      }
      setFeedback({ picked, correct });
      setScore((s) => ({
        correct: s.correct + (correct ? 1 : 0),
        total: s.total + 1,
      }));
      flashTimerRef.current = setTimeout(() => {
        setFeedback(null);
        setQuestion(generatePushFoldQuestion(enabledRef.current));
      }, FEEDBACK_FLASH_MS);
    },
    [feedback, question],
  );

  const yesAnswer: PushFoldAnswer = question.scope === 'push' ? 'PUSH' : 'CALL';

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target?.closest(
          'input, textarea, select, [contenteditable="true"]',
        )
      ) {
        return;
      }
      if (e.key === '1') {
        e.preventDefault();
        answer(yesAnswer);
        return;
      }
      if (e.key === '2') {
        e.preventDefault();
        answer('FOLD');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [answer, yesAnswer]);

  const accuracy = score.total === 0 ? 0 : (score.correct / score.total) * 100;

  return (
    <div className="flex flex-col gap-4">
      <RunHeader
        remaining={remaining}
        duration={duration}
        onEnd={onCancel}
        rightStats={[
          { label: 'Correctas', value: `${score.correct} / ${score.total}` },
          { label: 'Precisión', value: `${accuracy.toFixed(0)}%` },
        ]}
      />

      <div className="flex flex-col items-stretch gap-4 rounded-xl border border-border bg-surface/60 p-4 shadow-surface sm:p-5">
        <SpeedPrompt question={question} />

        <SpeedAnswerButtons
          yesAnswer={yesAnswer}
          feedback={feedback}
          disabled={feedback !== null}
          onAnswer={answer}
        />

        <p className="text-center text-xs text-content-muted">
          Pick fast · tecla{' '}
          <kbd className="rounded bg-surface px-1 py-0.5 font-mono text-[10px]">
            1
          </kbd>{' '}
          = {answerLabel(yesAnswer)} ·{' '}
          <kbd className="rounded bg-surface px-1 py-0.5 font-mono text-[10px]">
            2
          </kbd>{' '}
          = Fold · {formatDurationLabel(duration)} total
        </p>
      </div>
    </div>
  );
}

function SpeedPrompt({ question }: { question: PushFoldQuestion }) {
  const isPush = question.scope === 'push';
  const eyebrow = isPush
    ? `BTN · push or fold · ${question.stackBB.toFixed(1)} BB`
    : `BB · call or fold · ${question.stackBB.toFixed(1)} BB`;
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-content-muted">
        {eyebrow}
      </span>
      <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 shadow-surface">
        <span className="text-[10px] uppercase tracking-wider text-content-muted">
          Mano
        </span>
        <span className="font-mono text-2xl font-bold tabular-nums text-content">
          {question.hand}
        </span>
      </div>
    </div>
  );
}

function SpeedAnswerButtons({
  yesAnswer,
  feedback,
  disabled,
  onAnswer,
}: {
  yesAnswer: PushFoldAnswer;
  feedback: { picked: PushFoldAnswer; correct: boolean } | null;
  disabled: boolean;
  onAnswer: (a: PushFoldAnswer) => void;
}) {
  const yesLabel = answerLabel(yesAnswer);
  const yesIcon =
    yesAnswer === 'PUSH' ? (
      <ArrowUpFromLine className="h-4 w-4" strokeWidth={2.25} />
    ) : (
      <ArrowDownToLine className="h-4 w-4" strokeWidth={2.25} />
    );
  const yesColor = yesAnswer === 'PUSH' ? PUSH_COLOR : CALL_COLOR;

  return (
    <div className="mx-auto grid w-full max-w-md grid-cols-2 gap-2">
      <SpeedButton
        label={yesLabel}
        icon={yesIcon}
        accentColor={yesColor}
        keyHint="1"
        flashCorrect={!!feedback && feedback.picked === yesAnswer && feedback.correct}
        flashWrong={!!feedback && feedback.picked === yesAnswer && !feedback.correct}
        disabled={disabled}
        onClick={() => onAnswer(yesAnswer)}
      />
      <SpeedButton
        label="Fold"
        icon={<X className="h-4 w-4" strokeWidth={2.25} />}
        accentColor="#94a3b8"
        keyHint="2"
        flashCorrect={!!feedback && feedback.picked === 'FOLD' && feedback.correct}
        flashWrong={!!feedback && feedback.picked === 'FOLD' && !feedback.correct}
        disabled={disabled}
        onClick={() => onAnswer('FOLD')}
      />
    </div>
  );
}

function SpeedButton({
  label,
  icon,
  accentColor,
  keyHint,
  flashCorrect,
  flashWrong,
  disabled,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  accentColor: string;
  keyHint: string;
  flashCorrect: boolean;
  flashWrong: boolean;
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
        'transition-colors duration-100',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light',
        flashCorrect
          ? 'border-emerald-500/70 bg-emerald-500/15 text-content'
          : flashWrong
            ? 'border-rose-500/70 bg-rose-500/15 text-content'
            : 'border-border bg-surface/40 text-content hover:bg-surface-hover',
      )}
      style={
        !disabled && !flashCorrect && !flashWrong
          ? { color: accentColor, borderColor: `${accentColor}66` }
          : undefined
      }
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

/* ----------------------------- RUN HEADER ------------------------------ */

function RunHeader({
  remaining,
  duration,
  onEnd,
  rightStats,
}: {
  remaining: number;
  duration: number;
  onEnd: () => void;
  rightStats: ReadonlyArray<{ label: string; value: string }>;
}) {
  const pct = Math.max(0, Math.min(1, remaining / duration));
  const danger = remaining <= 5;
  return (
    <div className="rounded-xl border border-border bg-surface/60 p-3 shadow-surface">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <span
            className={cn(
              'font-mono text-3xl font-bold tabular-nums',
              danger ? 'text-rose-400' : 'text-content',
            )}
          >
            {formatTime(remaining)}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-content-muted">
            de {formatDurationLabel(duration)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {rightStats.map((s) => (
            <div key={s.label} className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-content-muted">
                {s.label}
              </div>
              <div className="text-sm font-semibold tabular-nums text-content">
                {s.value}
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={onEnd}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-content-muted hover:bg-surface-hover hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
            aria-label="Terminar corrida"
          >
            <Flag className="h-3 w-3" strokeWidth={2.5} />
            Terminar
          </button>
        </div>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface">
        <div
          className={cn(
            'h-full transition-all duration-100',
            danger ? 'bg-rose-500' : 'bg-accent',
          )}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  );
}

/* ----------------------------- FINISHED -------------------------------- */

function FinishedScreen({
  entry,
  madeTop,
  board,
  mistakes,
  onPlayAgain,
  onChangeConfig,
}: {
  entry: PushFoldEntry | null;
  madeTop: boolean;
  board: readonly PushFoldEntry[];
  mistakes: Mistake[];
  onPlayAgain: () => void;
  onChangeConfig: () => void;
}) {
  if (!entry) {
    return (
      <div className="rounded-xl border border-border bg-surface/40 p-6 text-center text-sm text-content-muted">
        Sin resultado.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-border bg-surface/60 p-5 shadow-surface">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-content">
            <Zap className="h-4 w-4 text-accent" strokeWidth={2.5} />
            Push/Fold · {formatDurationLabel(entry.durationSec)} · finalizado
          </div>
          {madeTop && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-300">
              <Trophy className="h-3.5 w-3.5" strokeWidth={2.5} />
              ¡Top 5 nuevo!
            </span>
          )}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Precisión" value={`${entry.accuracyPct.toFixed(0)}%`} />
          <Stat label="Correctas" value={`${entry.correct} / ${entry.total}`} />
          <Stat label="Q/min" value={entry.qpm.toFixed(1)} />
          <Stat label="Total" value={String(entry.total)} />
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onPlayAgain}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-accent-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
          >
            <RotateCcw className="h-4 w-4" strokeWidth={2.5} />
            Jugar de nuevo
          </button>
          <button
            type="button"
            onClick={onChangeConfig}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-content-muted hover:bg-surface-hover hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
          >
            <Settings2 className="h-4 w-4" strokeWidth={2.25} />
            Cambiar config
          </button>
        </div>
      </div>

      {mistakes.length > 0 && <MistakesPanel mistakes={mistakes} />}

      <Leaderboard
        board={board}
        duration={entry.durationSec}
        highlightDateIso={entry.dateIso}
        onClear={null}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface/40 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-content-muted">
        {label}
      </p>
      <p className="text-lg font-semibold tabular-nums text-content">{value}</p>
    </div>
  );
}

/* -------------------------- SESSION MISTAKES --------------------------- */

function MistakesPanel({ mistakes }: { mistakes: Mistake[] }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface/40">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-content hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-accent-light"
      >
        <span className="flex items-center gap-2">
          <X className="h-4 w-4 text-rose-400" strokeWidth={2.5} />
          Errores de sesión
          <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-rose-300">
            {mistakes.length}
          </span>
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-content-muted" strokeWidth={2} />
        ) : (
          <ChevronDown className="h-4 w-4 text-content-muted" strokeWidth={2} />
        )}
      </button>

      {open && (
        <div className="border-t border-border px-4 py-3">
          <ul className="flex flex-col gap-2">
            {mistakes.map((m, i) => {
              const verb =
                m.kind === 'push-or-fold' ? 'push hasta' : 'call hasta';
              const thresholdText =
                m.threshold > 0
                  ? `${m.hand}: ${verb} ${m.threshold} BB · te tocó ${m.stackBB.toFixed(1)} BB`
                  : `${m.hand}: nunca ${m.kind === 'push-or-fold' ? 'push' : 'call'} en este rango · te tocó ${m.stackBB.toFixed(1)} BB`;
              return (
                <li
                  key={i}
                  className="flex flex-col gap-1 rounded-lg border border-border bg-surface/60 px-3 py-2 text-xs"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[10px] uppercase tracking-[0.18em] text-content-muted">
                      {PUSHFOLD_KIND_LABEL[m.kind]}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-rose-400">{answerLabel(m.picked)}</span>
                      <span className="text-content-muted">→</span>
                      <span className="text-emerald-400">
                        {answerLabel(m.correct)}
                      </span>
                    </span>
                  </div>
                  <p className="font-mono text-[11px] text-content-muted">
                    {thresholdText}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ---------------------------- LEADERBOARD ------------------------------ */

function Leaderboard({
  board,
  duration,
  highlightDateIso,
  onClear,
}: {
  board: readonly PushFoldEntry[];
  duration: number;
  highlightDateIso: string | null;
  onClear: (() => void) | null;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-content">
          <Crown className="h-4 w-4 text-amber-400" strokeWidth={2.5} />
          Tabla de líderes · {formatDurationLabel(duration)}
        </div>
        {onClear && board.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="rounded-md px-2 py-1 text-xs text-content-muted hover:bg-surface-hover hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
          >
            Clear
          </button>
        )}
      </div>

      <div className="mt-3">
        {board.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-content-muted">
            Sin partidas todavía — ¡establecé el primer récord!
          </p>
        ) : (
          <ol className="flex flex-col gap-1">
            {board.map((e, i) => {
              const highlight = e.dateIso === highlightDateIso;
              return (
                <li
                  key={e.dateIso + i}
                  className={cn(
                    'flex items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-xs',
                    highlight
                      ? 'border-accent/50 bg-accent/10 text-content'
                      : 'border-border bg-surface/40 text-content-muted',
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className="w-4 text-right font-semibold tabular-nums">
                      {i + 1}
                    </span>
                    <span className="font-semibold tabular-nums text-content">
                      {e.accuracyPct.toFixed(0)}%
                    </span>
                    <span className="tabular-nums">
                      {e.correct}/{e.total}
                    </span>
                  </span>
                  <span className="flex items-center gap-2 tabular-nums">
                    <span>{e.qpm.toFixed(1)} q/min</span>
                    <span className="text-content-muted">
                      {new Date(e.dateIso).toLocaleDateString()}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
