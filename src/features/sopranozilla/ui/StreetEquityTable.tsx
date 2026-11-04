// "Equity por calle" (§10.1): Hero's equity against the villain's range when
// each street starts, against what continues after the played row, and that
// row's fold equity vs the auto-profit threshold of its size. Same
// green / amber / rose rule as the calculator.

import { cn } from '@/lib/cn';
import type { Street } from '../engine/equity';
import { combos, pct } from './format';
import { TONE_TEXT, toneVs } from './tone';

const LABEL: Record<Street, string> = { flop: 'Flop', turn: 'Turn', river: 'River' };

// One soft hue per street, outside the traffic-light palette.
const STREET_TEXT: Record<Street, string> = {
  flop: 'text-sky-600 dark:text-sky-300',
  turn: 'text-indigo-600 dark:text-indigo-300',
  river: 'text-fuchsia-600 dark:text-fuchsia-300',
};

export type StreetEquityRow = {
  street: Street;
  combos: number;
  heroEq: number;
  playedLabel: string;
  playedEq: number;
  /** Played row is a bet: its fold equity, auto-profit threshold and the
   * equity needed when called. Null for check. */
  played: {
    /** Null when the played row has no fold equity (a call). */
    foldEq: number | null;
    threshold: number | null;
    calledBreakEven: number;
  } | null;
  /** Share of the previous street's range that continued after its played
   * row, and the MDF of that row's bet (null if it was a check). Null on the flop. */
  kept: { share: number; mdf: number | null } | null;
};

export function StreetEquityTable({ rows }: { rows: StreetEquityRow[] }) {
  return (
    <table className="text-xs">
      <caption className="mb-1 text-left text-[10px] font-semibold uppercase tracking-wide text-content-muted">
        Equity por calle
      </caption>
      <thead>
        <tr className="text-[10px] text-content-muted">
          <th className="pr-3 text-left font-normal">Calle</th>
          <th className="pr-3 text-right font-normal">Combos</th>
          <th className="pr-3 text-right font-normal">Queda</th>
          <th className="pr-3 text-right font-normal">Tu eq.</th>
          <th className="pr-3 text-right font-normal">Jugada</th>
          <th className="pr-3 text-right font-normal">Fold eq.</th>
          <th className="text-right font-normal">Eq. vs lo que sigue</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const p = r.played;
          return (
            <tr key={r.street}>
              <th scope="row" className={cn('pr-3 text-left font-semibold', STREET_TEXT[r.street])}>
                {LABEL[r.street]}
              </th>
              <td className="pr-3 text-right tabular-nums">{combos(r.combos)}</td>
              <td
                className={cn(
                  'pr-3 text-right tabular-nums',
                  // Fewer than MDF continue → villain over-folds → green.
                  r.kept && r.kept.mdf !== null
                    ? TONE_TEXT[toneVs(r.kept.mdf, r.kept.share)]
                    : 'text-content-muted',
                )}
                title={
                  r.kept
                    ? r.kept.mdf !== null
                      ? `Siguió ${pct(r.kept.share, 0)} del rango; el MDF de esa apuesta es ${pct(r.kept.mdf, 0)}`
                      : `Siguió ${pct(r.kept.share, 0)} del rango (se jugó check)`
                    : undefined
                }
              >
                {r.kept ? pct(r.kept.share, 0) : '—'}
              </td>
              <td className={cn('pr-3 text-right tabular-nums', TONE_TEXT[toneVs(r.heroEq, 0.5)])}>
                {Number.isNaN(r.heroEq) ? '…' : pct(r.heroEq)}
              </td>
              <td className="pr-3 text-right text-content-muted">{r.playedLabel}</td>
              <td
                className={cn(
                  'pr-3 text-right tabular-nums',
                  p && p.foldEq !== null && p.threshold !== null
                    ? TONE_TEXT[toneVs(p.foldEq, p.threshold)]
                    : 'text-content-muted',
                )}
                title={
                  p && p.threshold !== null
                    ? `Autoprofit: ${pct(p.threshold, 0)} de fold`
                    : undefined
                }
              >
                {p && p.foldEq !== null && p.threshold !== null
                  ? `${pct(p.foldEq, 0)} / ${pct(p.threshold, 0)}`
                  : '—'}
              </td>
              <td
                className={cn(
                  'text-right tabular-nums',
                  TONE_TEXT[toneVs(r.playedEq, p ? p.calledBreakEven : 0.5)],
                )}
              >
                {Number.isNaN(r.playedEq) ? '…' : pct(r.playedEq)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
