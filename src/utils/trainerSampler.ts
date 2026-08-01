import type { Action, HandNotation, Range, RangeCellData } from '@/types/poker';
import { ALL_HANDS, combosOf } from './handUtils';

/** Hands outside the range (and residual mass) are a direct preflop fold. */
const FOLD_ID: Action = 'FOLD';

export type TrainerHand = {
  hand: HandNotation;
  /** Sampled expected answer for this draw. A direct FOLD when the cell is
   *  missing (a hand outside the range) or for a mixed cell's residual mass. */
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
  rng: () => number,
): Action {
  if (!cell || cell.actions.length === 0) return FOLD_ID;
  const sum = cell.actions.reduce((s, a) => s + a.weight, 0);
  // Residual mass below 100 collapses into FOLD so mixed cells still
  // train the discipline of folding the unassigned slice.
  const residual = Math.max(0, 100 - sum);
  const total = sum + residual;
  if (total <= 0) return FOLD_ID;
  const target = rng() * total;
  let acc = 0;
  for (const a of cell.actions) {
    acc += a.weight;
    if (target < acc) return a.action;
  }
  return FOLD_ID;
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
  const expectedAction = sampleExpectedAction(cell, rng);
  return { hand, expectedAction, cell };
}
