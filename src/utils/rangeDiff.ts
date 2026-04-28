import type { ActionId, HandNotation, RangeCellData } from '@/types/poker';
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

function getPaintedAction(
  cells: Record<HandNotation, RangeCellData>,
  hand: HandNotation,
): ActionId | null {
  const cell = cells[hand];
  if (!cell) return null;
  return cell.actions.find((a) => a.weight > 0)?.action ?? null;
}

function isPainted(cells: Record<HandNotation, RangeCellData>, hand: HandNotation): boolean {
  return getPaintedAction(cells, hand) !== null;
}

function truthHasAction(
  cells: Record<HandNotation, RangeCellData>,
  hand: HandNotation,
  action: ActionId,
): boolean {
  return cells[hand]?.actions.some((a) => a.action === action && a.weight > 0) ?? false;
}

/**
 * Computes an action-aware diff between the user's guess and the truth range.
 * Match: painted action exists in the truth cell (weight > 0).
 * False positive: painted an action the truth cell doesn't have, or hand not in range.
 * False negative: truth has the hand but the user didn't paint any action on it.
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
    const guessAction = getPaintedAction(guess, hand);
    const inTruth = isPainted(truth, hand);
    const correctAction =
      guessAction !== null && truthHasAction(truth, hand, guessAction);
    const c = combosOf(hand);

    if (guessAction !== null) guessCombos += c;
    if (inTruth) truthCombos += c;

    if (guessAction !== null && correctAction) {
      cells[hand] = 'match';
      matchCombos += c;
    } else if (guessAction !== null) {
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
