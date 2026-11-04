import { beforeEach, describe, expect, it } from 'vitest';
import { parseCards, type CardId } from '../../engine/cards';
import { comboId, weightsFromHandRange } from '../../engine/combos';
import { resetAnalyzerStore, useAnalyzerStore } from '../../store/analyzerStore';
import { selectStreetView } from '../../store/selectors';
import { rowSuitEntries, startCategoryEntries, toggleSuit } from '../viewModel';

function cards(text: string): CardId[] {
  const out = parseCards(text);
  if (!out) throw new Error(`bad cards: ${text}`);
  return out;
}
const id = (s: string) => {
  const c = cards(s);
  return comboId(c[0]!, c[1]!);
};

beforeEach(() => {
  resetAnalyzerStore();
  useAnalyzerStore.getState().loadHand(
    { hero: cards('2s2d') as [CardId, CardId], board: cards('Kh 9c 4d') },
    weightsFromHandRange('KQs, KQo, QQ'),
  );
});

describe('rowSuitEntries', () => {
  it('«Top pair» solo con ♥: the rest of the row goes to 0, other rows untouched', () => {
    const view = selectStreetView(useAnalyzerStore.getState(), 'flop', [])!;
    const entries = rowSuitEntries(view, { kind: 'cat', id: 'top-pair' }, [], {
      kind: 'suit',
      suit: 1,
    });
    const by = new Map(entries.map((e) => [e.combo, e.weight]));
    // KQ is top pair on K94; the heart combos stay, the rest are cut.
    expect(by.get(id('KsQh'))).toBeNull();
    expect(by.get(id('KsQs'))).toBe(0);
    // QQ is not top pair: not touched.
    expect(by.has(id('QsQh'))).toBe(false);
  });

  it('suited keeps only the suited combos of the row', () => {
    const view = selectStreetView(useAnalyzerStore.getState(), 'flop', [])!;
    const entries = rowSuitEntries(view, { kind: 'cat', id: 'top-pair' }, [], { kind: 'suited' });
    const by = new Map(entries.map((e) => [e.combo, e.weight]));
    expect(by.get(id('KsQs'))).toBeNull();
    expect(by.get(id('KsQc'))).toBe(0);
  });
});

describe('toggleSuit', () => {
  it('suits add up and turning them all off (or all on) is every suit again', () => {
    let r = toggleSuit({ kind: 'all' }, 3);
    expect(r).toEqual({ kind: 'suits', suits: [3] });
    r = toggleSuit(r, 2);
    expect(r).toEqual({ kind: 'suits', suits: [2, 3] });
    expect(toggleSuit(toggleSuit(r, 2), 3)).toEqual({ kind: 'all' });
    expect(toggleSuit(toggleSuit(r, 0), 1)).toEqual({ kind: 'all' });
  });
});

describe('startCategoryEntries', () => {
  it('works from the base: filters never pile up and 100 restores', () => {
    const base = new Map([
      [id('KdTs'), 1],
      [id('KdTc'), 0.5],
      [id('KcTh'), 1],
    ]);
    const by = (e: { combo: number; weight: number }[]) => new Map(e.map((x) => [x.combo, x.weight]));
    // Only ♣, then ♣ or ♦: KdTs comes back.
    const clubs = by(startCategoryEntries(base, 100, { kind: 'suits', suits: [3] }));
    expect(clubs.get(id('KdTs'))).toBe(0);
    expect(clubs.get(id('KdTc'))).toBe(0.5);
    const both = by(startCategoryEntries(base, 100, { kind: 'suits', suits: [2, 3] }));
    expect(both.get(id('KdTs'))).toBe(1);
    // Weight is relative to the base.
    const half = by(startCategoryEntries(base, 50, { kind: 'all' }));
    expect(half.get(id('KdTc'))).toBe(0.25);
    expect(by(startCategoryEntries(base, 0, { kind: 'all' })).get(id('KcTh'))).toBe(0);
    expect(by(startCategoryEntries(base, 100, { kind: 'all' })).get(id('KcTh'))).toBe(1);
  });
});
