import { describe, expect, it } from 'vitest';
import type { HandNotation, RangeCellData } from '@/types/poker';
import { computeRangeDiff } from '../rangeDiff';
import { paintHands } from '../cellUtils';

type Cells = Record<HandNotation, RangeCellData>;
const cell = (hand: HandNotation, ...actions: [string, number][]): RangeCellData => ({
  hand,
  actions: actions.map(([action, weight]) => ({ action, weight })),
});
const map = (...cs: RangeCellData[]): Cells => Object.fromEntries(cs.map((c) => [c.hand, c]));

describe('computeRangeDiff', () => {
  it('pure cells score like the old binary diff', () => {
    const truth = map(cell('AA', ['RAISE', 100]), cell('KK', ['RAISE', 100]));
    const guess = map(cell('AA', ['RAISE', 100]), cell('72o', ['RAISE', 100]));
    const d = computeRangeDiff(guess, truth);
    expect(d.cells['AA']).toBe('match');
    expect(d.cells['KK']).toBe('fn');
    expect(d.cells['72o']).toBe('fp');
    expect(d.matchCombos).toBe(6);
    expect(d.fnCombos).toBe(6);
    expect(d.fpCombos).toBe(12);
  });

  it('a wrong action on an in-range hand is a false positive', () => {
    const d = computeRangeDiff(map(cell('AA', ['CALL', 100])), map(cell('AA', ['RAISE', 100])));
    expect(d.cells['AA']).toBe('fp');
    expect(d.matchCombos).toBe(0);
  });

  it('mixed cell drawn within ±10 counts as exact', () => {
    const truth = map(cell('88', ['RAISE', 18], ['ALL_IN', 82]));
    const guess = map(cell('88', ['RAISE', 20], ['ALL_IN', 80]));
    const d = computeRangeDiff(guess, truth);
    expect(d.cells['88']).toBe('match');
    expect(d.accuracyPct).toBeCloseTo(100);
  });

  it('mixed cell drawn as a pure line is partial credit, not a full match', () => {
    const truth = map(cell('88', ['RAISE', 50], ['ALL_IN', 50]));
    const guess = map(cell('88', ['ALL_IN', 100]));
    const d = computeRangeDiff(guess, truth);
    expect(d.cells['88']).toBe('freq');
    expect(d.matchCombos).toBeCloseTo(3);
    expect(d.fpCombos).toBeCloseTo(3);
    expect(d.fnCombos).toBeCloseTo(3);
  });

  it('a thin branch within tolerance can be left unpainted', () => {
    const truth = map(cell('A5s', ['RAISE', 5]));
    const d = computeRangeDiff({}, truth);
    expect(d.cells['A5s']).toBe('none');
    expect(d.fnCombos).toBe(0);
  });
});

describe('paintHands', () => {
  it('builds a mixed cell in two passes and keeps the sum ≤ 100', () => {
    let g: Cells = {};
    g = paintHands(g, ['88'], 'RAISE', 20);
    g = paintHands(g, ['88'], 'ALL_IN', 90);
    expect(g['88']?.actions).toEqual([
      { action: 'RAISE', weight: 20 },
      { action: 'ALL_IN', weight: 80 },
    ]);
    g = paintHands(g, ['88'], 'CALL', 100);
    expect(g['88']?.actions).toEqual([{ action: 'CALL', weight: 100 }]);
  });
});
