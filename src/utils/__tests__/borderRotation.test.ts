import { describe, expect, it } from 'vitest';
import type { Range, RangeCellData } from '@/types/poker';
import { createBorderRotation, drawRotated, frontierOf, rotationProgress } from '../borderRotation';
import { sampleWeights } from '../borderHands';
import { sampleTrainerHand } from '../trainerSampler';
import { ALL_HANDS } from '../handUtils';

function rangeOf(id: string, cells: RangeCellData[]): Range {
  return {
    id,
    cells: Object.fromEntries(cells.map((c) => [c.hand, c])),
  } as unknown as Range;
}
const shove = (hand: string): RangeCellData => ({
  hand,
  actions: [{ action: 'ALL_IN', weight: 100 }],
});
const mix = (hand: string): RangeCellData => ({
  hand,
  actions: [{ action: 'ALL_IN', weight: 50 }],
});

// A range with a real edge: pairs + broadways shove, one mixed hand.
const HANDS = ['AA', 'KK', 'QQ', 'JJ', 'TT', 'AKs', 'AQs', 'AJs', 'AKo', 'AQo', 'KQs'];
const RANGE = rangeOf('r1', [...HANDS.map(shove), mix('99')]);

/** Deterministic rng (LCG). */
function rngOf(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

describe('border rotation (phase 61)', () => {
  it('each edge hand comes once per round, in every focus', () => {
    for (const focus of ['soft', 'strong', 'only'] as const) {
      const rot = createBorderRotation();
      const rng = rngOf(3);
      const frontier = frontierOf(RANGE);
      const edgeDraws: number[] = [];
      let guard = 0;
      while (edgeDraws.length < frontier.length * 3 && guard++ < 20000) {
        const i = drawRotated(RANGE, focus, rng, rot)!;
        if (frontier.includes(i)) edgeDraws.push(i);
      }
      for (let round = 0; round < 3; round++) {
        const slice = edgeDraws.slice(round * frontier.length, (round + 1) * frontier.length);
        expect(new Set(slice).size, `${focus} round ${round}`).toBe(frontier.length);
      }
      // Never the same hand twice in a row at the seam of two rounds.
      for (let k = 1; k < edgeDraws.length; k++) expect(edgeDraws[k]).not.toBe(edgeDraws[k - 1]);
    }
  });

  it('keeps the share of edge hands the focus gives', () => {
    const rot = createBorderRotation();
    const rng = rngOf(11);
    const weights = sampleWeights(RANGE, 'strong');
    const frontier = new Set(frontierOf(RANGE));
    const expected =
      [...frontier].reduce((s, i) => s + weights[i]!, 0) / weights.reduce((s, w) => s + w, 0);
    const N = 20000;
    let edge = 0;
    for (let n = 0; n < N; n++) if (frontier.has(drawRotated(RANGE, 'strong', rng, rot)!)) edge++;
    expect(edge / N).toBeCloseTo(expected, 1);
  });

  it('«Solo bordes» never deals the fill', () => {
    const rot = createBorderRotation();
    const rng = rngOf(5);
    const frontier = new Set(frontierOf(RANGE));
    for (let n = 0; n < 500; n++)
      expect(frontier.has(drawRotated(RANGE, 'only', rng, rot)!)).toBe(true);
  });

  it('focus off deals naturally (no rotation)', () => {
    expect(drawRotated(RANGE, 'off', Math.random, createBorderRotation())).toBeNull();
  });

  it('the counter goes up per edge hand and a full round reads total/total', () => {
    const rot = createBorderRotation();
    const rng = rngOf(9);
    const total = frontierOf(RANGE).length;
    expect(rotationProgress([RANGE], rot)).toEqual({ seen: 0, total });
    let guard = 0;
    while (rotationProgress([RANGE], rot).seen < total && guard++ < 20000) {
      drawRotated(RANGE, 'only', rng, rot);
    }
    expect(rotationProgress([RANGE], rot)).toEqual({ seen: total, total });
    drawRotated(RANGE, 'only', rng, rot); // a new round starts
    expect(rotationProgress([RANGE], rot)).toEqual({ seen: 1, total });
  });

  it('one bag per range (folder mode)', () => {
    const other = rangeOf('r2', ['22', '33'].map(shove));
    const rot = createBorderRotation();
    const rng = rngOf(1);
    drawRotated(RANGE, 'only', rng, rot);
    const p = rotationProgress([RANGE, other], rot);
    expect(p).toEqual({ seen: 1, total: frontierOf(RANGE).length + frontierOf(other).length });
  });

  it('the trainer sampler uses the rotation when given one', () => {
    const rot = createBorderRotation();
    const frontier = new Set(frontierOf(RANGE).map((i) => ALL_HANDS[i]));
    for (let n = 0; n < 50; n++) {
      expect(frontier.has(sampleTrainerHand(RANGE, rngOf(n), 'only', rot).hand)).toBe(true);
    }
    expect(rotationProgress([RANGE], rot).seen).toBeGreaterThan(0);
  });
});
