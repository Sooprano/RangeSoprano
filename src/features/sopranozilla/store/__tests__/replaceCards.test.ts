// «Editar cartas» keeps the filtering of every street (D141): the same line,
// replayed on another river (or with another Hero hand).

import { beforeEach, describe, expect, it } from 'vitest';
import { parseCards, type CardId } from '../../engine/cards';
import { weightsFromHandRange } from '../../engine/combos';
import { targetCombos } from '../../ui/viewModel';
import { resetAnalyzerStore, useAnalyzerStore } from '../analyzerStore';
import { selectStreetView } from '../selectors';

function cards(text: string): CardId[] {
  const out = parseCards(text);
  if (!out) throw new Error(`bad cards: ${text}`);
  return out;
}
const store = () => useAnalyzerStore.getState();
const TOP_PAIR = { kind: 'cat', id: 'top-pair' } as const;

beforeEach(() => {
  resetAnalyzerStore();
  store().loadHand(
    { hero: cards('2s2d') as [CardId, CardId], board: cards('Kh 9c 4d 7s 3c') },
    weightsFromHandRange('KQs, KQo, QQ, 99, 87s'),
  );
  // Flop: a new size, played, and top pair folded out of the selected row.
  store().addBetSize(50);
  store().setPlayedRow('flop', 'bet-50');
  const flopView = selectStreetView(store(), 'flop', [])!;
  store().applyRowWeight(TOP_PAIR, 0, targetCombos(flopView, TOP_PAIR, []));
  store().setActiveStreet('river');
});

describe('replaceCards (D141)', () => {
  it('a new river keeps every street as it was filtered, and stays on the river', () => {
    const before = store().streets;
    store().replaceCards(cards('2s2d') as [CardId, CardId], cards('Kh 9c 4d 7s Ad'));
    expect(store().hand?.board).toEqual(cards('Kh 9c 4d 7s Ad'));
    expect(store().streets).toBe(before);
    expect(store().streets.flop.playedRow).toBe('bet-50');
    expect(store().activeStreet).toBe('river');
    // The chain re-reads on the new board: the river view exists and is filtered
    // by the same flop row (no top pair carried from the flop).
    expect(selectStreetView(store(), 'river', [])).not.toBeNull();
  });

  it('a new Hero hand keeps everything too', () => {
    const before = store().streets;
    store().replaceCards(cards('AsAc') as [CardId, CardId], cards('Kh 9c 4d 7s 3c'));
    expect(store().hand?.hero).toEqual(cards('AsAc'));
    expect(store().streets).toBe(before);
  });

  it('removing the river moves to the last street left', () => {
    store().replaceCards(cards('2s2d') as [CardId, CardId], cards('Kh 9c 4d 7s'));
    expect(store().activeStreet).toBe('turn');
  });
});
