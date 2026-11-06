import type { HandNotation, Range, RangeCellData } from '@/types/poker';
import { ALL_HANDS, combosOf } from './handUtils';
import { sampleWeights, type BorderFocus } from './borderHands';
import { drawRotated, type BorderRotation } from './borderRotation';

export type TrainerHand = {
  hand: HandNotation;
  /** The range cell, or null when the hand is outside the range (a direct fold). */
  cell: RangeCellData | null;
};

const HAND_COMBO_WEIGHTS = ALL_HANDS.map((h) => combosOf(h));
const TOTAL_HAND_WEIGHT = HAND_COMBO_WEIGHTS.reduce((s, w) => s + w, 0);

function sampleHandIndex(
  rng: () => number,
  weights: readonly number[] = HAND_COMBO_WEIGHTS,
  total: number = TOTAL_HAND_WEIGHT,
): number {
  const target = rng() * total;
  let acc = 0;
  for (let i = 0; i < weights.length; i++) {
    acc += weights[i]!;
    if (target < acc) return i;
  }
  // Float residue: land on the last hand that can actually be drawn.
  for (let i = weights.length - 1; i >= 0; i--) if (weights[i]! > 0) return i;
  return weights.length - 1;
}

/**
 * Samples a hand by its combo weight, so every combo in a 52-card deck is
 * equally likely to be the next question.
 *
 * It deliberately does NOT pick one branch of a mixed cell: a cell playing
 * "Raise 18% / All in 83%" has TWO correct answers, and drawing one of them to
 * grade against marked the dominant line wrong 18% of the time. The whole cell
 * strategy travels in `cell` and the grading lives in `trainerSource`.
 *
 * `focus` (Classic › "Enfocar bordes") multiplies border and mixed hands on
 * top of the combo weight; `'off'` is the natural deal. With a `rotation`
 * the edge hands are dealt from a bag instead (each once per round), keeping
 * the share the focus gives them.
 */
export function sampleTrainerHand(
  range: Range,
  rng: () => number = Math.random,
  focus: BorderFocus = 'off',
  rotation?: BorderRotation,
): TrainerHand {
  let idx: number;
  const rotated = rotation ? drawRotated(range, focus, rng, rotation) : null;
  if (rotated !== null) {
    idx = rotated;
  } else if (focus === 'off') {
    idx = sampleHandIndex(rng);
  } else {
    const weights = sampleWeights(range, focus);
    idx = sampleHandIndex(rng, weights, weights.reduce((a, w) => a + w, 0));
  }
  const hand = ALL_HANDS[idx]!;
  return { hand, cell: range.cells[hand] ?? null };
}
