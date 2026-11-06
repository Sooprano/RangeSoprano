import type { Range } from '@/types/poker';
import { ALL_HANDS } from './handUtils';
import { handTiers, sampleWeights, type BorderFocus } from './borderHands';

/**
 * "Enfocar bordes" without the variance (phase 61). Plain weighted sampling
 * repeats some edge hands and leaves others unseen for 200+ hands (an
 * offsuit edge also came 3× as often as a suited one: 12 combos vs 4). The
 * user wants to go through every edge hand with a similar frequency.
 *
 * So the focus keeps deciding HOW OFTEN an edge hand comes up (the share of
 * border + mixed vs the fill, exactly as `sampleWeights` gives it), but WHICH
 * edge hand is dealt from a bag: every border / mixed hand once per round, in
 * random order; when the bag is empty a new round starts (never repeating the
 * last hand at the seam). The fill is drawn as before, by combos.
 *
 * One bag per range (folder mode keeps one per range). Session state: the
 * trainer owns it in a ref and drops it when the range or folder changes.
 */
export type BorderRotation = {
  /** Range id → hand indexes (into `ALL_HANDS`) left in the current round. */
  bags: Map<string, number[]>;
  /** Range id → last edge hand dealt (to avoid a repeat across rounds). */
  last: Map<string, number>;
};

export function createBorderRotation(): BorderRotation {
  return { bags: new Map(), last: new Map() };
}

/** Indexes of the range's edge hands: border + mixed. */
export function frontierOf(range: Range): number[] {
  const tiers = handTiers(range);
  const out: number[] = [];
  ALL_HANDS.forEach((h, i) => {
    if (tiers[h] !== 'interior') out.push(i);
  });
  return out;
}

function pickWeighted(
  rng: () => number,
  idx: readonly number[],
  weights: readonly number[],
): number {
  const total = idx.reduce((s, i) => s + weights[i]!, 0);
  let target = rng() * total;
  for (const i of idx) {
    target -= weights[i]!;
    if (target < 0) return i;
  }
  return idx[idx.length - 1]!;
}

/**
 * Index of the next hand (into `ALL_HANDS`) with the focus on. Null when the
 * focus is off — the caller deals naturally.
 */
export function drawRotated(
  range: Range,
  focus: BorderFocus,
  rng: () => number,
  rot: BorderRotation,
): number | null {
  if (focus === 'off') return null;
  const weights = sampleWeights(range, focus);
  const frontier = frontierOf(range);
  const isEdge = new Set(frontier);
  const fill = ALL_HANDS.map((_, i) => i).filter((i) => !isEdge.has(i) && weights[i]! > 0);
  const edgeWeight = frontier.reduce((s, i) => s + weights[i]!, 0);
  const fillWeight = fill.reduce((s, i) => s + weights[i]!, 0);
  if (edgeWeight <= 0) return fill.length ? pickWeighted(rng, fill, weights) : null;

  // Edge or fill, in the proportion the focus gives today.
  if (rng() * (edgeWeight + fillWeight) >= edgeWeight) return pickWeighted(rng, fill, weights);

  // A hand that is no longer an edge (the range was edited) leaves the bag.
  let bag = (rot.bags.get(range.id) ?? []).filter((i) => isEdge.has(i));
  if (bag.length === 0) bag = [...frontier];
  let j = Math.floor(rng() * bag.length);
  if (bag.length > 1 && bag[j] === rot.last.get(range.id)) j = (j + 1) % bag.length;
  const hand = bag[j]!;
  bag.splice(j, 1);
  rot.bags.set(range.id, bag);
  rot.last.set(range.id, hand);
  return hand;
}

/**
 * Edge hands already dealt in the current round, over all of them, summed
 * over the ranges (one in range mode, the folder's in folder mode).
 */
export function rotationProgress(
  ranges: readonly Range[],
  rot: BorderRotation,
): { seen: number; total: number } {
  let seen = 0;
  let total = 0;
  for (const range of ranges) {
    const frontier = frontierOf(range);
    const isEdge = new Set(frontier);
    const bag = rot.bags.get(range.id);
    const left = bag ? bag.filter((i) => isEdge.has(i)).length : frontier.length;
    total += frontier.length;
    seen += frontier.length - left;
  }
  return { seen, total };
}
