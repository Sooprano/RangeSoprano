import { describe, expect, it } from 'vitest';
import type { Range, RangeCellData } from '@/types/poker';
import { handTiers, sampleWeights } from '../borderHands';
import { sampleTrainerHand } from '../trainerSampler';
import { ALL_HANDS } from '../handUtils';

function rangeOf(cells: RangeCellData[]): Range {
  return {
    cells: Object.fromEntries(cells.map((c) => [c.hand, c])),
  } as unknown as Range;
}
const shove = (hand: string): RangeCellData => ({ hand, actions: [{ action: 'ALL_IN', weight: 100 }] });

// Q-high offsuit, Q2o+ shove (and everything above it in the column so the
// block is a clean rectangle on the Q row only).
const QX = ['QJo', 'QTo', 'Q9o', 'Q8o', 'Q7o', 'Q6o', 'Q5o', 'Q4o', 'Q3o', 'Q2o'];

describe('handTiers', () => {
  it('Q2o+ shove: the whole Q row borders the fold under it, J2o borders back', () => {
    const tiers = handTiers(rangeOf(QX.map(shove)));
    expect(tiers['Q2o']).toBe('border');
    expect(tiers['Q3o']).toBe('border');
    expect(tiers['J2o']).toBe('border');
    expect(tiers['J3o']).toBe('border');
    // Deep in the fold region, nowhere near the block.
    expect(tiers['72o']).toBe('interior');
    expect(tiers['T2o']).toBe('interior');
  });

  it('interior of a block is not a border', () => {
    const block = ['A9o', 'A8o', 'A7o', 'K9o', 'K8o', 'K7o', 'Q9o', 'Q8o', 'Q7o'];
    const tiers = handTiers(rangeOf(block.map(shove)));
    expect(tiers['K8o']).toBe('interior');
    expect(tiers['K9o']).toBe('border');
  });

  it('a mixed cell is its own tier', () => {
    const r = rangeOf([
      { hand: '88', actions: [{ action: 'RAISE', weight: 40 }, { action: 'ALL_IN', weight: 60 }] },
    ]);
    expect(handTiers(r)['88']).toBe('mixed');
  });
});

describe('sampleWeights / sampleTrainerHand', () => {
  it('"only" never draws the fill', () => {
    const r = rangeOf(QX.map(shove));
    const w = sampleWeights(r, 'only');
    const tiers = handTiers(r);
    ALL_HANDS.forEach((h, i) => {
      if (tiers[h] === 'interior') expect(w[i]).toBe(0);
    });
    let seed = 1;
    const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 500; k++) {
      expect(tiers[sampleTrainerHand(r, rng, 'only').hand]).not.toBe('interior');
    }
  });

  it('falls back to plain combos when there are no edges', () => {
    const w = sampleWeights(rangeOf([]), 'only');
    expect(w.every((x) => x > 0)).toBe(true);
  });
});
