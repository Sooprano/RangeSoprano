// Golden equity tests from tests/fixtures/equity/*.json. Expected values come
// from an external equity tool and are filled in by hand; fixtures with
// `expectedEquity: null` are still pending (TODO) and only sanity-checked.

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { parseCards } from '../cards';
import { activeCombos, weightsFromHandRange } from '../combos';
import { buildSpotRunouts, computeEqCombos, equityVsRange } from '../equity';

const zFixture = z
  .object({
    description: z.string().optional(),
    hero: z.string(),
    board: z.string(),
    villainRange: z.string(),
    /** Hero equity in percent; null = TODO. */
    expectedEquity: z.number().min(0).max(100).nullable(),
  })
  .strict();

/** ±0.01 percentage points. */
const TOLERANCE = 0.01;

const files = import.meta.glob<unknown>('/tests/fixtures/equity/*.json', {
  eager: true,
  import: 'default',
});

describe('equity golden fixtures', () => {
  it('the fixture folder exists and has fixtures', () => {
    expect(Object.keys(files).length).toBeGreaterThan(0);
  });

  for (const [path, raw] of Object.entries(files)) {
    const name = path.split('/').pop() ?? path;
    const fx = zFixture.parse(raw);

    const compute = (): number => {
      const hero = parseCards(fx.hero);
      const board = parseCards(fx.board);
      if (!hero || !board) throw new Error(`${name}: invalid cards`);
      const weights = weightsFromHandRange(fx.villainRange);
      const table = computeEqCombos(buildSpotRunouts(hero, board), activeCombos(weights));
      return equityVsRange(table, weights, hero, board).hero * 100;
    };

    if (fx.expectedEquity === null) {
      it.todo(`${name}: expectedEquity pendiente`);
      it(`${name}: computes a valid equity`, () => {
        const eq = compute();
        expect(eq).toBeGreaterThan(0);
        expect(eq).toBeLessThan(100);
      });
    } else {
      const expected = fx.expectedEquity;
      it(`${name}: matches ${expected}% ± ${TOLERANCE}`, () => {
        expect(Math.abs(compute() - expected)).toBeLessThanOrEqual(TOLERANCE);
      });
    }
  }
});
