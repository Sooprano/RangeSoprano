import type { ActionId, HandNotation, RangeCellData } from '@/types/poker';
import { ALL_HANDS, combosOf } from './handUtils';

/**
 * - match: every action within tolerance of the truth frequency.
 * - freq: right actions (some overlap) but at least one frequency is off.
 * - fp: painted something with no overlap with the truth (or hand not in range).
 * - fn: the truth has the hand and nothing was painted.
 */
export type DiffCellState = 'match' | 'freq' | 'fp' | 'fn' | 'none';

export type RangeDiff = {
  /** Per-hand classification covering all 169 hands. */
  cells: Record<HandNotation, DiffCellState>;
  matchCombos: number;
  fpCombos: number;
  fnCombos: number;
  truthCombos: number;
  guessCombos: number;
  /** Jaccard: matchCombos / (matchCombos + fpCombos + fnCombos). 0-100. */
  accuracyPct: number;
};

/**
 * Points of frequency (0-100) a painted action may miss the truth by and still
 * count as exact. Nobody memorizes an 18% branch to the point; 20% is right.
 */
export const FREQUENCY_TOLERANCE = 10;

function weightsOf(cell: RangeCellData | undefined): Map<ActionId, number> {
  const out = new Map<ActionId, number>();
  if (!cell) return out;
  for (const a of cell.actions) {
    if (a.weight > 0) out.set(a.action, (out.get(a.action) ?? 0) + a.weight);
  }
  return out;
}

/**
 * Frequency-aware diff between the user's drawing and the truth range, in
 * combos. Per hand and per action, a painted frequency within
 * `FREQUENCY_TOLERANCE` of the truth snaps to it; then the overlap
 * `min(guess, truth)` is a match, the excess a false positive and the shortfall
 * a false negative — each scaled by the hand's combos.
 *
 * A pure cell (100%) painted 100% with the right action scores exactly as the
 * old binary diff did; only mixed cells change.
 */
export function computeRangeDiff(
  guess: Record<HandNotation, RangeCellData>,
  truth: Record<HandNotation, RangeCellData>,
): RangeDiff {
  const cells: Record<HandNotation, DiffCellState> = {};
  let matchCombos = 0;
  let fpCombos = 0;
  let fnCombos = 0;
  let truthCombos = 0;
  let guessCombos = 0;

  for (const hand of ALL_HANDS) {
    const g = weightsOf(guess[hand]);
    const t = weightsOf(truth[hand]);
    const c = combosOf(hand) / 100;

    let gSum = 0;
    let tSum = 0;
    let match = 0;
    let fp = 0;
    let fn = 0;
    let allWithinTolerance = true;

    for (const action of new Set([...g.keys(), ...t.keys()])) {
      const gw = g.get(action) ?? 0;
      const tw = t.get(action) ?? 0;
      gSum += gw;
      tSum += tw;
      const within = Math.abs(gw - tw) <= FREQUENCY_TOLERANCE;
      if (!within) allWithinTolerance = false;
      const snapped = within ? tw : gw;
      match += Math.min(snapped, tw);
      fp += Math.max(0, snapped - tw);
      fn += Math.max(0, tw - snapped);
    }

    guessCombos += gSum * c;
    truthCombos += tSum * c;
    matchCombos += match * c;
    fpCombos += fp * c;
    fnCombos += fn * c;

    if (gSum === 0 && tSum === 0) cells[hand] = 'none';
    else if (gSum === 0) cells[hand] = allWithinTolerance ? 'none' : 'fn';
    else if (allWithinTolerance) cells[hand] = tSum === 0 ? 'none' : 'match';
    else if (match > 0) cells[hand] = 'freq';
    else if (tSum === 0 || fp > 0) cells[hand] = 'fp';
    else cells[hand] = 'fn';
  }

  const denom = matchCombos + fpCombos + fnCombos;
  const accuracyPct = denom === 0 ? 100 : (matchCombos / denom) * 100;

  return {
    cells,
    matchCombos,
    fpCombos,
    fnCombos,
    truthCombos,
    guessCombos,
    accuracyPct,
  };
}

function describeCell(
  cell: RangeCellData | undefined,
  labelOf: (id: ActionId) => string,
): string {
  const parts = (cell?.actions ?? [])
    .filter((a) => a.weight > 0)
    .map((a) => `${labelOf(a.action)} ${Math.round(a.weight)}%`);
  return parts.length === 0 ? 'Fold' : parts.join(' · ');
}

/**
 * Hover text per hand for the diff grid: the real strategy vs what was drawn,
 * which is what a "frecuencia distinta" cell needs to be learned from.
 */
export function diffCellTitles(
  guess: Record<HandNotation, RangeCellData>,
  truth: Record<HandNotation, RangeCellData>,
  labelOf: (id: ActionId) => string,
): Record<HandNotation, string> {
  const out: Record<HandNotation, string> = {};
  for (const hand of ALL_HANDS) {
    out[hand] = `${hand} — Rango: ${describeCell(truth[hand], labelOf)} | Tuyo: ${describeCell(guess[hand], labelOf)}`;
  }
  return out;
}
