// 4×4 suit picker for one class (§10.3): every combo with its weight and why
// it continues, blocked combos marked (and counted: "KTo" on a K♥ board with
// K♠ in Hero's hand only has 6 of its 12 combos).
//
// - Tap a combo: it gets the chosen weight (row mode: tap again to undo).
// - Suit buttons TOGGLE: ♣ keeps the combos with a club, then ♦ adds the ones
//   with a diamond; «Todos» brings every suit back. They work from the weights
//   the combos had when the picker opened (`base`), so filtering never piles
//   up and nothing is lost (before, each suit filtered what the previous one
//   left, and in «Rango preflop» there was no way back).
// - «Toda la mano al N%».

import { useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { HandNotation } from '@/types/poker';
import type { ComboId } from '../engine/combos';
import { holdsRule, ruleSuits, toggleSuit, type ComboCell, type SuitRule } from './viewModel';

const SUITS = ['♠', '♥', '♦', '♣'] as const;
const SUIT_TEXT = [
  'text-slate-500 dark:text-slate-300',
  'text-red-600 dark:text-red-400',
  'text-blue-600 dark:text-blue-400',
  'text-green-600 dark:text-green-400',
] as const;
const WEIGHTS = [0, 25, 50, 75, 100] as const;

type Entry = { combo: ComboId; weight: number | null };

type Props = {
  hand: HandNotation;
  cells: ComboCell[];
  /** Weights 0..100; null = back to what the rows say (row mode only). */
  onSet: (entries: Entry[]) => void;
  onClose: () => void;
  /** 'start': edits the range the street starts with (weight = in range);
   * 'row' (default): overrides of the edited EV row (weight = continues). */
  mode?: 'row' | 'start';
  /** Replaces the default card look (the floating panel brings its own). */
  className?: string;
  /** Inverted row (D132): weights are shown and set as the inverse (100 − filter). */
  inverted?: boolean;
};

/** What a combo goes back to: its override (row) or its range weight (start). */
function baseOf(c: ComboCell, isStart: boolean, inverted: boolean): number | null {
  if (isStart) return Math.round(c.inRange * 100);
  if (c.override === undefined) return null;
  return inverted ? 100 - c.override : c.override;
}

export function SuitPicker({
  hand,
  cells,
  onSet,
  onClose,
  mode = 'row',
  className,
  inverted = false,
}: Props) {
  const isStart = mode === 'start';
  // Adding combos to the range is the common edit there; filtering them out here.
  const [pick, setPick] = useState<number>(isStart ? 100 : 0);
  const [rule, setRule] = useState<SuitRule>({ kind: 'all' });
  // Weights when the picker opened, updated by the taps (the picker is
  // re-mounted per hand and per grid target).
  const [base, setBase] = useState<Map<ComboId, number | null>>(
    () =>
      new Map(cells.filter((c) => !c.blocked).map((c) => [c.combo, baseOf(c, isStart, inverted)])),
  );
  const at = (r: number, c: number) => cells.find((x) => x.rowSuit === r && x.colSuit === c);
  const live = cells.filter((c) => !c.blocked);
  const blocked = cells.length - live.length;
  const inRange = live.reduce((s, c) => s + c.inRange, 0);
  const follows = live.reduce((s, c) => s + c.follows, 0);
  const active = ruleSuits(rule);

  const applyRule = (next: SuitRule) => {
    setRule(next);
    onSet(
      live.map((c) => ({
        combo: c.combo,
        weight: holdsRule(c.combo, next) ? (base.get(c.combo) ?? (isStart ? 0 : null)) : 0,
      })),
    );
  };

  const tap = (cell: ComboCell) => {
    const weight = !isStart && cell.override !== undefined ? null : pick;
    setBase((b) => new Map(b).set(cell.combo, weight));
    onSet([{ combo: cell.combo, weight }]);
  };

  const wholeHand = () => {
    setBase(new Map(live.map((c) => [c.combo, pick] as const)));
    setRule({ kind: 'all' });
    onSet(live.map((c) => ({ combo: c.combo, weight: pick })));
  };

  return (
    <section
      aria-label={`Combos de ${hand}`}
      className={className ?? 'mt-2 rounded-xl border border-border bg-surface/40 p-3'}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="text-xs text-content-muted">
          <p>
            <span className="font-semibold text-content">{hand}</span> · en rango{' '}
            <span className="tabular-nums text-content">{inRange.toFixed(2)}</span> de{' '}
            {live.length} combos
            {!isStart && (
              <>
                {' '}
                · siguen <span className="tabular-nums text-content">{follows.toFixed(2)}</span>
              </>
            )}
          </p>
          {blocked > 0 && (
            <p className="mt-0.5">
              {blocked} de {cells.length} combos no se pueden repartir: usan una carta tuya o del
              board (punteados).
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar palos"
          className="rounded p-1 text-content-muted hover:bg-surface-hover hover:text-content"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <table className="border-separate border-spacing-1">
          <thead>
            <tr>
              <th />
              {SUITS.map((s, i) => (
                <th key={s} scope="col" className={cn('text-sm font-normal', SUIT_TEXT[i])}>
                  {s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SUITS.map((rs, r) => (
              <tr key={rs}>
                <th scope="row" className={cn('pr-1 text-sm font-normal', SUIT_TEXT[r])}>
                  {rs}
                </th>
                {SUITS.map((cs, c) => {
                  const cell = at(r, c);
                  if (!cell) return <td key={cs} className="h-11 w-12" />;
                  const shown = isStart ? cell.inRange : cell.follows;
                  const pct = isStart
                    ? Math.round(cell.inRange * 100)
                    : cell.inRange > 0
                      ? Math.round((cell.follows / cell.inRange) * 100)
                      : 0;
                  return (
                    <td key={cs}>
                      <button
                        type="button"
                        disabled={cell.blocked}
                        title={`${cell.label} · ${
                          cell.blocked
                            ? 'no se puede repartir: usa una carta tuya o del board'
                            : isStart
                              ? `${Math.round(cell.inRange * 100)}% en el rango`
                              : `${Math.round(cell.follows * 100)}% · ${cell.reason}`
                        }`}
                        aria-pressed={!isStart && cell.override !== undefined}
                        onClick={() => tap(cell)}
                        className={cn(
                          'flex h-11 w-12 flex-col items-center justify-center rounded-md border text-[11px] leading-tight focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light',
                          cell.blocked
                            ? 'cursor-not-allowed border-dashed border-border text-content-disabled line-through'
                            : !isStart && cell.override !== undefined
                              ? 'border-sky-400 ring-1 ring-sky-400'
                              : 'border-border hover:bg-surface-hover',
                        )}
                        style={
                          !cell.blocked && (isStart ? shown > 0 : cell.inRange > 0)
                            ? {
                                backgroundImage: `linear-gradient(to top, rgb(245 158 11 / 0.55) 0 ${pct}%, transparent ${pct}% 100%)`,
                              }
                            : undefined
                        }
                      >
                        <span className="font-medium">
                          <span className={SUIT_TEXT[r]}>{SUITS[r]}</span>
                          <span className={SUIT_TEXT[c]}>{SUITS[c]}</span>
                        </span>
                        <span className="tabular-nums text-content-muted">
                          {cell.blocked ? '—' : `${Math.round(shown * 100)}%`}
                        </span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex min-w-[12rem] flex-1 flex-col gap-2 text-xs text-content-muted">
          <div>
            <p className="mb-1">Peso al tocar un combo</p>
            <div className="flex gap-1">
              {WEIGHTS.map((w) => (
                <button
                  key={w}
                  type="button"
                  aria-pressed={pick === w}
                  onClick={() => setPick(w)}
                  className={cn(
                    'flex-1 rounded-md border px-1 py-0.5 tabular-nums',
                    pick === w
                      ? 'border-amber-500 bg-amber-500/15 text-content'
                      : 'border-border hover:bg-surface-hover',
                  )}
                >
                  {w}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={wholeHand}
              className="mt-1 w-full rounded-md border border-border py-0.5 hover:bg-surface-hover hover:text-content"
            >
              Toda la mano al {pick}%
            </button>
          </div>
          <div>
            <p className="mb-1">Dejar solo los combos con (se suman)</p>
            <div className="flex gap-1">
              {SUITS.map((s, i) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={active.includes(i)}
                  onClick={() => applyRule(toggleSuit(rule, i))}
                  aria-label={`Combos con ${s}`}
                  className={cn(
                    'flex-1 rounded-md border py-0.5 text-sm',
                    SUIT_TEXT[i],
                    active.includes(i)
                      ? 'border-amber-500 bg-amber-500/15'
                      : 'border-border hover:bg-surface-hover',
                  )}
                >
                  {s}
                </button>
              ))}
              <button
                type="button"
                aria-pressed={rule.kind === 'all'}
                onClick={() => applyRule({ kind: 'all' })}
                title="Vuelven todos los palos, con el peso que tenían"
                className={cn(
                  'flex-1 rounded-md border py-0.5',
                  rule.kind === 'all'
                    ? 'border-amber-500 bg-amber-500/15 text-content'
                    : 'border-border hover:bg-surface-hover',
                )}
              >
                Todos
              </button>
            </div>
          </div>
          {isStart ? (
            <p>
              Tocar un combo le pone el peso elegido en el rango (100 = lo agrega, 0 = lo quita).
            </p>
          ) : (
            <p>
              Tocar un combo le pone el peso elegido (borde azul); tocarlo otra vez lo devuelve a
              lo que digan las filas. Pasa el cursor por un combo para ver por qué sigue.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
