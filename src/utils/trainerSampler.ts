import type { HandNotation, Range, RangeCellData } from '@/types/poker';
import { ALL_HANDS, combosOf } from './handUtils';

export type TrainerHand = {
  hand: HandNotation;
  /** The range cell, or null when the hand is outside the range (a direct fold). */
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

/**
 * Samples a hand by its combo weight, so every combo in a 52-card deck is
 * equally likely to be the next question.
 *
 * It deliberately does NOT pick one branch of a mixed cell: a cell playing
 * "Raise 18% / All in 83%" has TWO correct answers, and drawing one of them to
 * grade against marked the dominant line wrong 18% of the time. The whole cell
 * strategy travels in `cell` and the grading lives in `trainerSource`.
 */
export function sampleTrainerHand(
  range: Range,
  rng: () => number = Math.random,
): TrainerHand {
  const idx = sampleHandIndex(rng);
  const hand = ALL_HANDS[idx]!;
  return { hand, cell: range.cells[hand] ?? null };
}
