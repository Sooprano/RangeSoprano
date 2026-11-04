// Slow evaluator checks (~25 s): every 5-card hand and the 1M-hand
// differential test against the brute-force reference. Run with
// `npm run test:slow` before each phase commit; `npm test` skips them.

import { describe, expect, it } from 'vitest';
import {
  CK_CARD,
  categoryOfValue,
  evalCk5,
  evaluate,
  HAND_CATEGORIES,
  type HandCategory,
} from '../evaluator';
import { refCategoryOf, refScore5, refScoreBest } from './referenceEvaluator';
import { drawCards, mulberry32 } from './rng';

describe('evaluator — exhaustive 5-card hands', () => {
  it('produces the known frequencies and exactly 7462 classes', () => {
    // Textbook counts over all C(52,5) = 2,598,960 hands.
    const expected: Record<HandCategory, number> = {
      'straight-flush': 40,
      quads: 624,
      'full-house': 3744,
      flush: 5108,
      straight: 10200,
      trips: 54912,
      'two-pair': 123552,
      pair: 1098240,
      'high-card': 1302540,
    };
    const counts = Object.fromEntries(HAND_CATEGORIES.map((c) => [c, 0])) as Record<
      HandCategory,
      number
    >;
    const seen = new Set<number>();
    for (let a = 0; a < 52; a++)
      for (let b = a + 1; b < 52; b++)
        for (let c = b + 1; c < 52; c++)
          for (let d = c + 1; d < 52; d++)
            for (let e = d + 1; e < 52; e++) {
              const v = evalCk5(CK_CARD[a]!, CK_CARD[b]!, CK_CARD[c]!, CK_CARD[d]!, CK_CARD[e]!);
              counts[categoryOfValue(v)]++;
              seen.add(v);
            }
    expect(counts).toEqual(expected);
    expect(seen.size).toBe(7462);
    expect(Math.min(...seen)).toBe(1);
    expect(Math.max(...seen)).toBe(7462);
  });

  it('agrees with the reference on every 5-card hand (order and category)', () => {
    // Pair every hand's two scores, sort by the reference and check that the
    // The evaluator value moves in lockstep: equal ⇔ equal, better ⇔ lower.
    const ck: number[] = [];
    const ref: number[] = [];
    for (let a = 0; a < 52; a++)
      for (let b = a + 1; b < 52; b++)
        for (let c = b + 1; c < 52; c++)
          for (let d = c + 1; d < 52; d++)
            for (let e = d + 1; e < 52; e++) {
              ck.push(evalCk5(CK_CARD[a]!, CK_CARD[b]!, CK_CARD[c]!, CK_CARD[d]!, CK_CARD[e]!));
              ref.push(refScore5([a, b, c, d, e]));
            }
    expect(countOrderMismatches(ck, ref)).toBe(0);
  }, 120_000);
});

/**
 * Number of adjacent pairs (after sorting by the reference score) where the
 * two evaluators disagree. Zero means both induce the same total order on the
 * sample, ties included, and the same category for every hand.
 */
function countOrderMismatches(ck: readonly number[], ref: readonly number[]): number {
  const idx = Array.from({ length: ref.length }, (_, i) => i);
  idx.sort((x, y) => ref[x]! - ref[y]!);
  let mismatches = 0;
  for (let i = 0; i < idx.length; i++) {
    const cur = idx[i]!;
    if (categoryOfValue(ck[cur]!) !== refCategoryOf(ref[cur]!)) mismatches++;
    if (i === 0) continue;
    const prev = idx[i - 1]!;
    const sameRef = ref[prev] === ref[cur];
    const sameCk = ck[prev] === ck[cur];
    // Reference ascending = stronger, evaluator descending = stronger.
    if (sameRef !== sameCk || (!sameRef && !(ck[cur]! < ck[prev]!))) mismatches++;
  }
  return mismatches;
}

describe('evaluator — differential test vs brute force (7 cards)', () => {
  it('1,000,000 random 7-card hands: 0 differences', () => {
    const N = 1_000_000;
    const rand = mulberry32(0x50f2a);
    const ck = new Array<number>(N);
    const ref = new Array<number>(N);
    for (let i = 0; i < N; i++) {
      const hand = drawCards(rand, 7);
      ck[i] = evaluate(hand);
      ref[i] = refScoreBest(hand);
    }
    expect(countOrderMismatches(ck, ref)).toBe(0);
  }, 600_000);
});
