// Under the grid: the combos of the hovered hand, suit by suit, as in the
// custom filter builder (D108). With a table row selected, its combos get a
// violet frame, so "Top pair solo con ♥" can be checked before painting.
// Fixed height on purpose: a box that grows per hand makes the page jump.

import type { HandNotation } from '@/types/poker';
import { cn } from '@/lib/cn';
import type { ComboId } from '../engine/combos';
import type { ComboCell } from './viewModel';

const SUIT_TEXT = [
  'text-slate-500 dark:text-slate-300',
  'text-red-600 dark:text-red-400',
  'text-blue-600 dark:text-blue-400',
  'text-green-600 dark:text-green-400',
] as const;

type Props = {
  hand: HandNotation | null;
  cells: ComboCell[];
  /** Combos of the selected table row (null = no row selected). */
  inTarget: ReadonlySet<ComboId> | null;
  targetLabel: string | null;
  /** 'start': the % is the weight in the range; 'row': the % that continues. */
  mode: 'row' | 'start';
  /** What to show with no hand under the cursor. */
  hint: string;
};

export function HoverCombos({ hand, cells, inTarget, targetLabel, mode, hint }: Props) {
  const live = cells.filter((c) => !c.blocked);
  const inRange = live.reduce((s, c) => s + c.inRange, 0);
  const follows = live.reduce((s, c) => s + c.follows, 0);
  const marked = inTarget ? live.filter((c) => inTarget.has(c.combo)).length : 0;

  return (
    <div
      className="mt-1.5 h-[6.75rem] overflow-hidden rounded-lg border border-border bg-surface/40 p-2 text-xs text-content-muted"
      aria-live="polite"
    >
      {!hand ? (
        <p>{hint}</p>
      ) : (
        <>
          <p className="truncate">
            <b className="text-content">{hand}</b> · en rango{' '}
            <span className="tabular-nums text-content">{inRange.toFixed(2)}</span> de{' '}
            {live.length} combos
            {cells.length > live.length && (
              <span title="Usan una carta tuya o del board: no se pueden repartir">
                {' '}
                ({cells.length - live.length} bloqueados)
              </span>
            )}
            {mode === 'row' && (
              <>
                {' '}
                · siguen <span className="tabular-nums text-content">{follows.toFixed(2)}</span>
              </>
            )}
            {inTarget && targetLabel && (
              <>
                {' '}
                ·{' '}
                <span className="text-violet-700 dark:text-violet-300">
                  {marked} en «{targetLabel}»
                </span>
              </>
            )}
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-1">
            {cells.map((c) => {
              const out = !c.blocked && c.inRange <= 0;
              const pct =
                mode === 'start'
                  ? c.inRange
                  : c.inRange > 0
                    ? c.follows / c.inRange
                    : 0;
              const target = inTarget?.has(c.combo) ?? false;
              return (
                <li
                  key={c.combo}
                  title={
                    c.blocked
                      ? `${c.label}: bloqueado por tus cartas o el board`
                      : out
                        ? `${c.label}: fuera del rango`
                        : mode === 'start'
                          ? `${c.label}: ${Math.round(c.inRange * 100)}% en el rango`
                          : `${c.label}: sigue ${Math.round(pct * 100)}% · ${c.reason}`
                  }
                  className={cn(
                    'flex items-center gap-1 rounded px-1 py-0.5 ring-1',
                    c.blocked
                      ? 'line-through opacity-25 ring-border'
                      : out
                        ? 'opacity-35 ring-border'
                        : target
                          ? 'bg-violet-500/15 ring-violet-400'
                          : 'ring-border',
                  )}
                >
                  <span className="font-medium text-content">
                    {c.label[0]}
                    <span className={SUIT_TEXT[c.rowSuit]}>{c.label[1]}</span>
                    {c.label[2]}
                    <span className={SUIT_TEXT[c.colSuit]}>{c.label[3]}</span>
                  </span>
                  {!c.blocked && !out && (
                    <span className="tabular-nums text-[10px]">{Math.round(pct * 100)}%</span>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
