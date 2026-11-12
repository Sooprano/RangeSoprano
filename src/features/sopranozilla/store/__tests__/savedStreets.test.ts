// Each street's filtering survives a reload (D148): saved as JSON, read back
// through the schema and put back on the same hand.

import { beforeEach, describe, expect, it } from 'vitest';
import { parseCards, type CardId } from '../../engine/cards';
import { weightsFromHandRange } from '../../engine/combos';
import { targetCombos } from '../../ui/viewModel';
import { resetAnalyzerStore, useAnalyzerStore } from '../analyzerStore';
import { selectStreetView } from '../selectors';
import { handKey, parseSavedStreets } from '../savedStreets';

function cards(text: string): CardId[] {
  const out = parseCards(text);
  if (!out) throw new Error(`bad cards: ${text}`);
  return out;
}
const store = () => useAnalyzerStore.getState();
const TOP_PAIR = { kind: 'cat', id: 'top-pair' } as const;
const HAND = {
  hero: cards('2s2d') as [CardId, CardId],
  board: cards('Kh 9c 4d 7s 3c'),
  pots: { flop: 6, turn: 10, river: 20 },
  stacks: { flop: 50, turn: 47, river: 42 },
};
const RANGE = 'KQs, KQo, QQ, 99, 87s';

/** What `writeSavedStreets` stores, through JSON like localStorage. */
function snapshot() {
  const s = store();
  return JSON.parse(
    JSON.stringify({
      version: 1,
      key: handKey(s.hand!, s.meta),
      activeStreet: s.activeStreet,
      streets: s.streets,
    }),
  ) as unknown;
}

beforeEach(() => {
  resetAnalyzerStore();
  store().loadHand(HAND, weightsFromHandRange(RANGE));
});

describe('saved filtering (D148)', () => {
  it('a reload gets every street back as it was left', () => {
    store().addBetSize(50);
    store().setPlayedRow('flop', 'bet-50');
    const flopView = selectStreetView(store(), 'flop', [])!;
    store().applyRowWeight(TOP_PAIR, 0, targetCombos(flopView, TOP_PAIR, []));
    store().setActiveStreet('turn');
    store().setMode('villain');
    store().setActiveStreet('river');
    store().toggleInverse('check');
    const before = store().streets;
    const saved = parseSavedStreets(snapshot());
    expect(saved).not.toBeNull();

    // Reload: the same hand loads with its presets, then the filtering comes back.
    resetAnalyzerStore();
    store().loadHand(HAND, weightsFromHandRange(RANGE));
    expect(saved!.key).toBe(handKey(store().hand!, store().meta));
    store().restoreStreets(saved!.streets, saved!.activeStreet);
    expect(store().streets).toEqual(before);
    expect(store().activeStreet).toBe('river');
    expect(store().streets.flop.playedRow).toBe('bet-50');
    expect(store().undoDepth).toBe(0);
  });

  it('another hand has another key', () => {
    const key = handKey(store().hand!, null);
    expect(handKey({ ...HAND, board: cards('Kh 9c 4d 7s Ad') }, null)).not.toBe(key);
    expect(handKey(HAND, { handLabel: 'Mano #1' } as never)).not.toBe(key);
  });

  it('a corrupt or inconsistent save is ignored', () => {
    expect(parseSavedStreets(null)).toBeNull();
    expect(parseSavedStreets({ version: 1, key: 'x' })).toBeNull();
    const bad = snapshot() as { streets: { turn: { playedRow: string } } };
    bad.streets.turn.playedRow = 'bet-999';
    expect(parseSavedStreets(bad)).toBeNull();
  });
});
