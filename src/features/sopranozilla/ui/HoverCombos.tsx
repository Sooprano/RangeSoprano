// Under the grid: the combos of the hovered hand, suit by suit, as in the
// custom filter builder (D108). With a table row selected, its combos get a
// violet frame, so "Top pair solo con ♥" can be checked before painting.
// Fixed height on purpose: a box that grows per hand makes the page jump.
// Each combo shows its WEIGHT in the range (bold) and, in a row, «→ N%» when
// the row lets only part of it through (the user missed the weight: before,
// a row showed only the share that continues, 100% for a 50% combo).

import type { HandNotation } from '@/types/poker';
import { cn } from '@/lib/cn';
import type { ComboId } from '../engine/combos';
import type { ComboCell } from './viewModel';
import type { VbKind } from './valueBluff';
import { comboEquityColor, handEquityColor } from './equityColors';
import { VB_COLORS } from './valueBluff';

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
  /** 'start': only the weight in the range; 'row': also what continues («→ N%»). */
  mode: 'row' | 'start';
  /** What to show with no hand under the cursor. */
  hint: string;
  /** Hero's equity vs each combo on this street (NaN while it is computed). */
  heroEq?: (combo: ComboCell['combo']) => number;
  /** «Valor / Farol» on (D140): what each combo does vs Hero, and the words for it. */
  vb?: {
    kindOf: (combo: ComboCell['combo']) => VbKind | null;
    words: Record<VbKind, string>;
  } | null;
};

export function HoverCombos({ hand, cells, inTarget, targetLabel, mode, hint, vb, heroEq }: Props) {
  const live = cells.filter((c) => !c.blocked);
  const inRange = live.reduce((s, c) => s + c.inRange, 0);
  const follows = live.reduce((s, c) => s + c.follows, 0);
  const marked = inTarget ? live.filter((c) => inTarget.has(c.combo)).length : 0;
  // Equity of the villain's combos vs Hero's hand, like a Flopzilla equity
  // matrix (D143): per combo, and the plain mean of the dealable combos for
  // the hand (88 = (9.39 + 9.39 + 4.90) / 3 = 7.89 %).
  const comboEq = (combo: ComboCell['combo']) => {
    const h = heroEq ? heroEq(combo) : Number.NaN;
    return Number.isFinite(h) ? 1 - h : Number.NaN;
  };
  const eqs = live.map((c) => comboEq(c.combo)).filter((x) => Number.isFinite(x));
  const handEq = eqs.length > 0 ? eqs.reduce((a, b) => a + b, 0) / eqs.length : Number.NaN;
  const eq2 = (x: number) => `${(x * 100).toFixed(2)}%`;

  return (
    <div
      className="mt-1.5 h-[9.25rem] overflow-hidden rounded-lg border border-border bg-surface/40 p-2 text-xs text-content-muted"
      aria-live="polite"
    >
      {!hand ? (
        <p>{hint}</p>
      ) : (
        <>
          <p className="truncate">
            <b className="text-content">{hand}</b>
            {live.length > 0 && (
              <span
                title="Peso de la mano en el rango (promedio de sus combos que se pueden repartir)"
                className="ml-1 rounded bg-surface-hover px-1 font-semibold tabular-nums text-content"
              >
                {Math.round((inRange / live.length) * 100)}%
              </span>
            )}
            {Number.isFinite(handEq) && (
              <span
                title="Equity de la mano contra la tuya: promedio de sus combos que se pueden repartir (como la matriz de equity de Flopzilla)"
                className="ml-1 tabular-nums"
              >
                eq.{' '}
                <b
                  className="rounded px-1 text-slate-950"
                  style={{ backgroundColor: handEquityColor(handEq) }}
                >
                  {eq2(handEq)}
                </b>
              </span>
            )}{' '}
            · en rango <span className="tabular-nums text-content">{inRange.toFixed(2)}</span> de{' '}
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
              const weight = Math.round(c.inRange * 100);
              const goes = Math.round(c.follows * 100);
              const cut = mode === 'row' && goes !== weight;
              const target = inTarget?.has(c.combo) ?? false;
              const kind = vb && !c.blocked && !out ? vb.kindOf(c.combo) : null;
              const vbWord = kind && vb ? ` · ${vb.words[kind]}` : '';
              const e = c.blocked ? Number.NaN : comboEq(c.combo);
              const eqText = Number.isFinite(e) ? eq2(e) : null;
              const eqWord = eqText
                ? ` · equity de este combo contra tu mano ${eqText} (la tuya ${eq2(1 - e)})`
                : '';
              return (
                <li
                  key={c.combo}
                  title={
                    c.blocked
                      ? `${c.label}: bloqueado por tus cartas o el board`
                      : out
                        ? `${c.label}: fuera del rango`
                        : mode === 'start'
                          ? `${c.label}: peso ${weight}% en el rango${eqWord}${vbWord}`
                          : `${c.label}: peso ${weight}% en el rango · sigue ${goes}%${eqWord}${vbWord} · ${c.reason}`
                  }
                  className={cn(
                    'flex flex-col rounded px-1 py-0.5 leading-tight ring-1',
                    c.blocked
                      ? 'line-through opacity-25 ring-border'
                      : out
                        ? 'opacity-35 ring-border'
                        : target
                          ? 'bg-violet-500/15 ring-violet-400'
                          : 'ring-border',
                  )}
                >
                  <span className="flex items-center gap-1">
                    {kind && (
                      <span
                        aria-hidden
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: VB_COLORS[kind] }}
                      />
                    )}
                    <span className="font-medium text-content">
                      {c.label[0]}
                      <span className={SUIT_TEXT[c.rowSuit]}>{c.label[1]}</span>
                      {c.label[2]}
                      <span className={SUIT_TEXT[c.colSuit]}>{c.label[3]}</span>
                    </span>
                    {!c.blocked && !out && (
                      <span className="tabular-nums text-[11px] font-semibold text-content">
                        {weight}%
                        {cut && (
                          <span className="ml-0.5 font-normal text-content-muted">→ {goes}%</span>
                        )}
                      </span>
                    )}
                  </span>
                  {/* This combo's equity vs Hero's hand on the street on screen,
                      colored vs the hand's mean (D144). */}
                  {eqText && !out && (
                    <span className="text-[10px] tabular-nums text-content-muted">
                      eq.{' '}
                      <span
                        className="font-semibold"
                        style={
                          Number.isFinite(handEq)
                            ? { color: comboEquityColor(e, handEq) }
                            : undefined
                        }
                      >
                        {eqText}
                      </span>
                    </span>
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
