import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

const AUTO_ADVANCE_MS = 1500;
import {
  Check,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  SkipForward,
  X,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import type { ActionDef, ActionId, Range } from '@/types/poker';
import {
  actionColor,
  actionDefOf,
  actionLabel,
  FOLD_FALLBACK_DEF,
  foldActionDef,
} from '@/utils/actionMeta';
import {
  answerActionsFor,
  drawFromSource,
  paletteOfRange,
  sourceKey,
  trainerPalette,
  type TrainerDraw,
  type TrainerSource,
} from '@/utils/trainerSource';
import { PokerTable } from './PokerTable';
import { TableSurface } from './TableSurface';
import { spotLabelOf, stackLabelOf } from '@/utils/rangeStack';
import { VILLAIN_ACTION_LABELS } from '@/data/positions';
import { relativeGroupPath } from '@/utils/groupUtils';
import { useTableThemeStore } from '@/store/tableThemeStore';
import { CountdownBar } from './CountdownBar';
import { AutoAdvanceToggle } from '@/modules/workbook/drillUi';
import { useActionHotkeys, type ActionHotkeys } from '@/hooks/useActionHotkeys';

type ClassicTrainerProps = {
  source: TrainerSource;
};

type Feedback = {
  /** In the source's answer space (range-local id, or merged key in a folder). */
  picked: ActionId;
  expected: ActionId;
  wasCorrect: boolean;
  draw: TrainerDraw;
};

type Score = {
  correct: number;
  total: number;
  streak: number;
  bestStreak: number;
};

/** Per-range tally, so a folder session shows which stack depth is leaking. */
type ByRange = Record<string, { correct: number; total: number }>;

const INITIAL_SCORE: Score = {
  correct: 0,
  total: 0,
  streak: 0,
  bestStreak: 0,
};

export function ClassicTrainer({ source }: ClassicTrainerProps) {
  const [current, setCurrent] = useState<TrainerDraw | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [score, setScore] = useState<Score>(INITIAL_SCORE);
  const [byRange, setByRange] = useState<ByRange>({});
  const [autoAdvance, setAutoAdvance] = useState(true);
  const showVillainAction = useTableThemeStore((s) => s.showVillainAction);
  const showSpotName = useTableThemeStore((s) => s.showSpotName);
  const key = sourceKey(source);
  const sourceKeyRef = useRef(key);

  const drawNext = useCallback(() => {
    setCurrent(drawFromSource(source));
    setFeedback(null);
  }, [source]);

  // Reset session when the range (or folder) being trained changes.
  useEffect(() => {
    if (sourceKeyRef.current !== key) {
      sourceKeyRef.current = key;
      setScore(INITIAL_SCORE);
      setByRange({});
    }
    setFeedback(null);
    setCurrent(drawFromSource(source));
  }, [source, key]);

  // Auto-advance to next hand after 1.5s when feedback is shown (if enabled)
  useEffect(() => {
    if (!feedback || !autoAdvance) return;
    const id = setTimeout(drawNext, AUTO_ADVANCE_MS);
    return () => clearTimeout(id);
  }, [feedback, autoAdvance, drawNext]);

  // The session palette drives the hotkeys (stable numbering); only the subset
  // this hand's range actually offers is rendered.
  const orderedActions = useMemo(() => trainerPalette(source), [source]);
  const hk = useActionHotkeys(orderedActions);
  const visibleActions = useMemo(
    () =>
      current
        ? answerActionsFor(source, orderedActions, current.range)
        : orderedActions,
    [source, orderedActions, current],
  );

  const answer = useCallback(
    (picked: ActionId) => {
      if (!current || feedback) return;
      const wasCorrect = picked === current.answerKey;
      setFeedback({
        picked,
        expected: current.answerKey,
        wasCorrect,
        draw: current,
      });
      setScore((s) => {
        const streak = wasCorrect ? s.streak + 1 : 0;
        return {
          correct: s.correct + (wasCorrect ? 1 : 0),
          total: s.total + 1,
          streak,
          bestStreak: Math.max(s.bestStreak, streak),
        };
      });
      const id = current.range.id;
      setByRange((m) => {
        const prev = m[id] ?? { correct: 0, total: 0 };
        return {
          ...m,
          [id]: {
            correct: prev.correct + (wasCorrect ? 1 : 0),
            total: prev.total + 1,
          },
        };
      });
    },
    [current, feedback],
  );

  const skip = useCallback(() => {
    if (!current) return;
    drawNext();
  }, [current, drawNext]);

  const reset = useCallback(() => {
    setScore(INITIAL_SCORE);
    setByRange({});
    drawNext();
  }, [drawNext]);

  // Keyboard: custom/number keys to answer, Enter/Space/N to advance, S to skip.
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
      const actionId = hk.actionForKey(e.key);
      // A key bound to an action this hand does not offer is dead: answering
      // with a button that isn't on screen would be a guaranteed miss.
      if (actionId && visibleActions.some((d) => d.id === actionId)) {
        e.preventDefault();
        if (!feedback) answer(actionId);
        return;
      }
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        if (feedback) drawNext();
        return;
      }
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        if (!feedback) skip();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [feedback, answer, drawNext, skip, hk.actionForKey, visibleActions]);

  const accuracy = useMemo(
    () => (score.total === 0 ? 0 : (score.correct / score.total) * 100),
    [score],
  );

  if (!current) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center rounded-xl border border-dashed border-border p-6 text-center text-sm text-content-muted">
        Cargando sesión…
      </div>
    );
  }

  const isFolder = source.kind === 'folder';
  const handRange = current.range;
  const stackLabel = stackLabelOf(handRange);
  const villainAction = showVillainAction
    ? VILLAIN_ACTION_LABELS[handRange.situation]
    : null;
  // The toggle removes a redundant cue, never the only one: with no stack chip
  // on the felt the pill is all there is, so it stays.
  const spotPill =
    showSpotName || stackLabel === null ? spotLabelOf(handRange) : null;

  return (
    <div className="flex flex-col gap-4">
      <ScoreBar score={score} accuracy={accuracy} />

      {isFolder && (
        <ByRangeBar
          ranges={source.ranges}
          byRange={byRange}
          basePath={source.path}
        />
      )}

      <TableSurface>
        {/* A folder mixes stacks AND spots, so the felt has to carry both cues:
            the stack chip is forced on (even if the Mesa modal has it off) and
            the pill names the spot WITHOUT its depth — reading the chips is half
            the exercise. Ranges with no derivable stack keep the full name. */}
        {isFolder && spotPill !== null && (
          // `self-start`: the top-center seat badge is centered AND overflows
          // above the table container (`-translate-y-1/2` on a slot at y≈1-4%),
          // so a centered pill lands underneath it.
          <span className="max-w-full self-start truncate rounded-full border border-border bg-surface/70 px-2.5 py-1 text-[11px] font-medium text-content-muted">
            {spotPill}
          </span>
        )}
        <PokerTable
            heroPosition={handRange.position}
            hand={current.hand.hand}
            tableFormat={handRange.tableFormat}
            {...(handRange.villainPosition !== undefined && { villainPosition: handRange.villainPosition })}
            {...(stackLabel !== null && { stackLabel })}
            {...(isFolder && { forceStack: true })}
            {...(villainAction !== null && { villainAction })}
          />

        <ActionGrid
          actions={visibleActions}
          feedback={feedback}
          onAnswer={answer}
          hk={hk}
        />

        <div className="min-h-[3.5rem] w-full flex flex-col gap-2">
          {feedback ? (
            <>
              <FeedbackPanel
                feedback={feedback}
                actions={paletteOfRange(feedback.draw.range)}
                {...(isFolder && { rangeName: feedback.draw.range.name })}
              />
              {autoAdvance && (
                <CountdownBar key={score.total} durationMs={AUTO_ADVANCE_MS} />
              )}
            </>
          ) : (
            <p className="text-center text-xs text-content-muted">
              {hk.assigningId
                ? 'Presiona una tecla para asignarla · Esc cancela · ⌫ borra'
                : 'Elige una acción · S para omitir · clic derecho en un botón para asignar tu hotkey'}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={feedback ? drawNext : skip}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-accent-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
          >
            {feedback ? (
              <>
                Siguiente mano
                <span className="text-[10px] uppercase tracking-wider text-white/70">
                  {autoAdvance ? '↵ / auto' : '↵'}
                </span>
              </>
            ) : (
              <>
                <SkipForward className="h-3.5 w-3.5" strokeWidth={2.25} />
                Omitir
              </>
            )}
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
      </TableSurface>

      <div className="flex justify-center">
        <AutoAdvanceToggle
          value={autoAdvance}
          onChange={setAutoAdvance}
          durationMs={AUTO_ADVANCE_MS}
        />
      </div>
    </div>
  );
}

function ScoreBar({ score, accuracy }: { score: Score; accuracy: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat label="Precisión" value={`${accuracy.toFixed(0)}%`} />
      <Stat label="Correctas" value={`${score.correct} / ${score.total}`} />
      <Stat label="Racha" value={String(score.streak)} />
      <Stat label="Mejor racha" value={String(score.bestStreak)} />
    </div>
  );
}

/** Above this many ranges the breakdown starts folded — 38 chips is a wall. */
const BY_RANGE_AUTO_COLLAPSE = 10;

/**
 * Per-range tally of a folder session, grouped by subfolder: in a folder of
 * folders half a dozen ranges share the label "25bb" and only their subfolder
 * tells them apart. Inside a group the label is the stack (the thing you are
 * being asked to read); it falls back to the full name when the range has no
 * stack, or when two ranges of the same group would collide.
 */
function ByRangeBar({
  ranges,
  byRange,
  basePath,
}: {
  ranges: Range[];
  byRange: ByRange;
  basePath: string;
}) {
  const groups = useMemo(() => {
    const byPath = new Map<string, Range[]>();
    for (const r of ranges) {
      const rel = relativeGroupPath(r.group, basePath) ?? '';
      const bucket = byPath.get(rel);
      if (bucket) bucket.push(r);
      else byPath.set(rel, [r]);
    }
    // Ranges hanging directly off the trained folder go first, unlabeled.
    return [...byPath.entries()].sort(([a], [b]) =>
      a === '' ? -1 : b === '' ? 1 : a.localeCompare(b),
    );
  }, [ranges, basePath]);

  const [open, setOpen] = useState(ranges.length <= BY_RANGE_AUTO_COLLAPSE);

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex w-fit items-center gap-1.5 rounded-md text-[10px] uppercase tracking-wider text-content-muted hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
      >
        {open ? (
          <ChevronDown className="h-3 w-3" strokeWidth={2.5} />
        ) : (
          <ChevronRight className="h-3 w-3" strokeWidth={2.5} />
        )}
        Por rango ({ranges.length})
      </button>

      {open &&
        groups.map(([path, groupRanges]) => {
          const labelCount = new Map<string, number>();
          for (const r of groupRanges) {
            const l = stackLabelOf(r);
            if (l !== null) labelCount.set(l, (labelCount.get(l) ?? 0) + 1);
          }
          return (
            <div key={path || '(root)'} className="flex flex-wrap items-center gap-1.5">
              {path !== '' && (
                <span className="text-[10px] uppercase tracking-wider text-content-disabled">
                  {path}
                </span>
              )}
              {groupRanges.map((r) => {
                const tally = byRange[r.id];
                const total = tally?.total ?? 0;
                const correct = tally?.correct ?? 0;
                const pct = total === 0 ? null : (correct / total) * 100;
                const stack = stackLabelOf(r);
                const label =
                  stack !== null && (labelCount.get(stack) ?? 0) === 1
                    ? stack
                    : r.name;
                return (
                  <span
                    key={r.id}
                    title={r.name}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs',
                      total === 0
                        ? 'border-border bg-surface/40 text-content-disabled'
                        : pct! >= 80
                          ? 'border-emerald-500/40 bg-emerald-500/5 text-content'
                          : pct! >= 50
                            ? 'border-amber-500/40 bg-amber-500/5 text-content'
                            : 'border-rose-500/40 bg-rose-500/5 text-content',
                    )}
                  >
                    <span className="max-w-[12rem] truncate font-medium">{label}</span>
                    <span className="tabular-nums text-content-muted">
                      {correct}/{total}
                    </span>
                  </span>
                );
              })}
            </div>
          );
        })}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface/40 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-content-muted">
        {label}
      </p>
      <p className="text-lg font-semibold tabular-nums text-content">{value}</p>
    </div>
  );
}


type ActionGridProps = {
  actions: ActionDef[];
  feedback: Feedback | null;
  onAnswer: (action: ActionId) => void;
  hk: ActionHotkeys;
};

function ActionGrid({ actions, feedback, onAnswer, hk }: ActionGridProps) {
  return (
    <div className="grid w-full max-w-md grid-cols-2 gap-1.5 sm:grid-cols-3">
      {actions.map((def) => {
        const isExpected = feedback?.expected === def.id;
        const isPicked = feedback?.picked === def.id;
        const isAssigning = hk.assigningId === def.id;
        const key = hk.effectiveKey(def.id);
        return (
          <button
            key={def.id}
            type="button"
            disabled={feedback !== null}
            onClick={() => onAnswer(def.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              hk.beginAssign(def.id);
            }}
            title="Clic derecho para asignar tu hotkey"
            className={cn(
              'flex flex-row items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium',
              'transition-colors duration-150 ease-out-soft',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light',
              isAssigning
                ? 'border-accent bg-accent/10 text-content ring-1 ring-accent'
                : feedback
                  ? isExpected
                    ? 'border-emerald-500/60 bg-emerald-500/10 text-content'
                    : isPicked
                      ? 'border-rose-500/60 bg-rose-500/10 text-content'
                      : 'border-border bg-surface/40 text-content-muted opacity-60'
                  : 'border-border bg-surface/40 text-content hover:bg-surface-hover',
            )}
          >
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: def.color }}
            />
            <span className="flex-1 truncate text-left">{def.label}</span>
            <span
              className={cn(
                'shrink-0 rounded px-1 py-px text-[10px] font-semibold uppercase tracking-wider tabular-nums',
                isAssigning
                  ? 'bg-accent/20 text-accent-light'
                  : 'bg-surface text-content-muted',
              )}
            >
              {isAssigning ? '…' : key || '·'}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function FeedbackPanel({
  feedback,
  actions,
  rangeName,
}: {
  feedback: Feedback;
  /** The palette OF THE HAND'S RANGE — the cell breakdown uses local ids. */
  actions: ActionDef[];
  rangeName?: string;
}) {
  const fold = foldActionDef(actions) ?? FOLD_FALLBACK_DEF;
  const cell = feedback.draw.hand.cell;
  // Range-local id (identical to feedback.expected outside folder mode, where
  // the answer space is the merged label key).
  const expectedLocal = feedback.draw.hand.expectedAction;
  const sumWeights = cell?.actions.reduce((s, a) => s + a.weight, 0) ?? 0;
  const residualFold = cell ? Math.max(0, 100 - sumWeights) : 100;
  const breakdown = cell
    ? [
        ...cell.actions.map((a) => ({ action: a.action, weight: a.weight })),
        ...(residualFold > 0
          ? [{ action: fold.id, weight: residualFold }]
          : []),
      ]
    : [{ action: fold.id, weight: 100 }];
  const isMixed = breakdown.length > 1;

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-lg border px-3 py-2 text-sm',
        feedback.wasCorrect
          ? 'border-emerald-500/40 bg-emerald-500/5 text-content'
          : 'border-rose-500/40 bg-rose-500/5 text-content',
      )}
    >
      <div className="flex items-center gap-2">
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
          Esperada{' '}
          <span className="inline-flex items-center gap-1 font-medium text-content">
            <span
              aria-hidden
              className="h-2.5 w-2.5 rounded-sm"
              style={{
                backgroundColor:
                  actionDefOf(actions, expectedLocal)?.color ?? fold.color,
              }}
            />
            {actionLabel(actions, expectedLocal)}
          </span>
        </span>
        {rangeName !== undefined && (
          <>
            <span className="text-content-muted">·</span>
            <span className="truncate rounded-full bg-surface px-2 py-0.5 text-xs text-content-muted">
              {rangeName}
            </span>
          </>
        )}
      </div>
      {isMixed && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-content-muted">
          <span>Cell strategy:</span>
          {breakdown.map((b) => (
            <span key={b.action} className="inline-flex items-center gap-1">
              <span
                aria-hidden
                className="h-2 w-2 rounded-sm"
                style={{ backgroundColor: actionColor(actions, b.action) }}
              />
              <span className="text-content">{actionLabel(actions, b.action)}</span>
              <span className="tabular-nums">{b.weight.toFixed(0)}%</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
