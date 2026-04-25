import type { HandNotation, RangeCellData } from '@/types/poker';
import { ALL_HANDS, combosOf } from './handUtils';

export type DiffCellState = 'match' | 'fp' | 'fn' | 'none';

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

function isPainted(cells: Record<HandNotation, RangeCellData>, hand: HandNotation): boolean {
  const cell = cells[hand];
  if (!cell || cell.actions.length === 0) return false;
  // Any non-zero action weight counts as painted.
  return cell.actions.some((a) => a.weight > 0);
}

/**
 * Computes a binary in/out diff between the user's guess and the truth range.
 * Mixed-frequency truth cells count as "in" if any action is present, since
 * the drawing trainer is a binary play/fold exercise.
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
    const inGuess = isPainted(guess, hand);
    const inTruth = isPainted(truth, hand);
    const c = combosOf(hand);
    if (inGuess) guessCombos += c;
    if (inTruth) truthCombos += c;
    if (inGuess && inTruth) {
      cells[hand] = 'match';
      matchCombos += c;
    } else if (inGuess) {
      cells[hand] = 'fp';
      fpCombos += c;
    } else if (inTruth) {
      cells[hand] = 'fn';
      fnCombos += c;
    } else {
      cells[hand] = 'none';
    }
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
