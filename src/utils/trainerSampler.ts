import type { Action, HandNotation, Range, RangeCellData } from '@/types/poker';
import { ALL_HANDS, combosOf } from './handUtils';
import { impliedFoldId } from './actionMeta';

export type TrainerHand = {
  hand: HandNotation;
  /** Sampled expected answer for this draw. The range's fold action when the cell
   *  is missing (or the synthetic FOLD id when the range has no fold action). */
  expectedAction: Action;
  /** The range cell, or null if the hand is an implicit FOLD. */
  cell: RangeCellData | null;
};

const HAND_COMBO_WEIGHTS = ALL_HANDS.map((h) => combosOf(h));
const TOTAL_HAND_WEIGHT = HAND_COMBO_WEIGHTS.reduce((s, w) => s + w, 0);

function sampleHandIndex(rng: () => number): number {
  const target = rng() * TOTAL_HAND_WEIGHT;
  let acc = 0;
  for (let i = 0; i < HAND_COMBO_WEIGHTS.length; i++) {
    acc += HAND_COMBO_WEIGHTS[i]!;
    if (target < acc) return i;
  }
  return HAND_COMBO_WEIGHTS.length - 1;
}

function sampleExpectedAction(
  cell: RangeCellData | null,
  foldId: Action,
  rng: () => number,
): Action {
  if (!cell || cell.actions.length === 0) return foldId;
  const sum = cell.actions.reduce((s, a) => s + a.weight, 0);
  // Residual mass below 100 collapses into the fold action so mixed cells
  // still train the discipline of folding the unassigned slice.
  const residual = Math.max(0, 100 - sum);
  const total = sum + residual;
  if (total <= 0) return foldId;
  const target = rng() * total;
  let acc = 0;
  for (const a of cell.actions) {
    acc += a.weight;
    if (target < acc) return a.action;
  }
  return foldId;
}

/**
 * Samples a hand by its combo weight (so each combo in a 52-card deck has
 * equal probability of being the next question), then samples the expected
 * action from the matching cell's mixed strategy. Hands outside the range
 * are implicit FOLD.
 */
export function sampleTrainerHand(
  range: Range,
  rng: () => number = Math.random,
): TrainerHand {
  const idx = sampleHandIndex(rng);
  const hand = ALL_HANDS[idx]!;
  const cell = range.cells[hand] ?? null;
  const foldId = impliedFoldId(range.actions);
  const expectedAction = sampleExpectedAction(cell, foldId, rng);
  return { hand, expectedAction, cell };
}
