import { beforeEach, describe, expect, it } from 'vitest';
import { parseCards, type CardId } from '../../engine/cards';
import { comboId, combosOfClass, weightsFromHandRange } from '../../engine/combos';
import { resetAnalyzerStore, useAnalyzerStore } from '../analyzerStore';
import { selectStreetView } from '../selectors';

function cards(text: string): CardId[] {
  const out = parseCards(text);
  if (!out) throw new Error(`bad cards: ${text}`);
  return out;
}
const store = () => useAnalyzerStore.getState();
const view = (street: 'flop' | 'turn') => selectStreetView(store(), street, [])!;
const id = (s: string) => {
  const c = cards(s);
  return comboId(c[0]!, c[1]!);
};

beforeEach(() => {
  resetAnalyzerStore();
  store().loadHand(
    { hero: cards('AsKs') as [CardId, CardId], board: cards('Qh Jd 2c 7s') },
    weightsFromHandRange('22+, AKs'),
  );
});

describe('editable start range', () => {
  it('flop: painting a hand outside the range adds it to the preflop range', () => {
    expect(view('flop').start[id('9h8h')]).toBe(0);
    store().editStart(
      'flop',
      combosOfClass('98s').map((combo) => ({ combo, weight: 1 })),
      view('flop').start,
    );
    expect(view('flop').start[id('9h8h')]).toBe(1);
    // ...and it chains into the turn like any preflop hand.
    expect(view('turn').start[id('9h8h')]).toBeGreaterThan(0);
  });

  it('flop: weight 0 removes the hand', () => {
    store().editStart(
      'flop',
      combosOfClass('22').map((combo) => ({ combo, weight: 0 })),
      view('flop').start,
    );
    expect(combosOfClass('22').every((c) => view('flop').start[c] === 0)).toBe(true);
  });

  it('turn: an override replaces the chain until it is cleared', () => {
    const chained = view('turn').start[id('9h8h')];
    expect(chained).toBe(0);
    store().editStart('turn', [{ combo: id('9h8h'), weight: 0.5 }], view('turn').start);
    expect(view('turn').start[id('9h8h')]).toBe(0.5);
    // Seeded from the chained range: the rest stays.
    expect(view('turn').start[id('3h3d')]).toBeGreaterThan(0);
    // The flop is not touched.
    expect(view('flop').start[id('9h8h')]).toBe(0);
    store().clearStartOverride('turn');
    expect(view('turn').start[id('9h8h')]).toBe(0);
  });

  it('import replaces the start of the chosen street; blocked combos stay 0', () => {
    store().replaceStart('turn', weightsFromHandRange('AA, 77'));
    const v = view('turn');
    expect(v.start[id('AhAd')]).toBe(1);
    expect(v.start[id('7h7d')]).toBe(1);
    // 7s is on the turn board.
    expect(v.start[id('7s7h')]).toBe(0);
    expect(v.start[id('3h3d')]).toBe(0);
  });
});
