// Bet sizes never go past the effective stack (D147): the user's hand, river
// pot 15.47 bb with 13.27 bb behind → 125 % does not fit, «All-in 86%» does.

import { beforeEach, describe, expect, it } from 'vitest';
import { parseCards, type CardId } from '../../engine/cards';
import { weightsFromHandRange } from '../../engine/combos';
import type { RecordedStreets } from '../../engine/recorded';
import { ALL_IN_ROW_ID, maxBetPct, resetAnalyzerStore, useAnalyzerStore } from '../analyzerStore';

function cards(text: string): CardId[] {
  const out = parseCards(text);
  if (!out) throw new Error(`bad cards: ${text}`);
  return out;
}
const store = () => useAnalyzerStore.getState();
const heroSizes = (street: 'flop' | 'turn' | 'river') =>
  store()
    .streets[street].actionRows.filter((r) => r.kind === 'bet')
    .map((r) => [r.id, r.size, r.label]);

function load(recorded: RecordedStreets = {}) {
  store().loadHand(
    {
      hero: cards('9d6c') as [CardId, CardId],
      board: cards('Jd 6d Qd Tc Qc'),
      pots: { flop: 4.33, turn: 6.47, river: 15.47 },
      stacks: { flop: 19.27, turn: 18.2, river: 13.27 },
    },
    weightsFromHandRange('KQs, AJo, 99, 87s'),
    { recorded },
  );
}

beforeEach(() => resetAnalyzerStore());

describe('bets capped at the effective stack (D147)', () => {
  it('max bet in % of the pot', () => {
    expect(maxBetPct(15.47, 13.27)).toBeCloseTo(85.78, 2);
    expect(maxBetPct(undefined, 13.27)).toBeNull();
    expect(maxBetPct(15.47, null)).toBeNull();
  });

  it('river: 125 % goes, «All-in 86%» takes its place; deep streets keep the defaults', () => {
    load();
    expect(heroSizes('river')).toEqual([
      ['bet-33', 33, 'Bet 33%'],
      ['bet-66', 66, 'Bet 66%'],
      [ALL_IN_ROW_ID, 85.78, 'All-in 86%'],
    ]);
    expect(heroSizes('flop').map((r) => r[0])).toEqual(['bet-33', 'bet-75']);
    expect(store().streets.river.rows[ALL_IN_ROW_ID]).toBeDefined();
    expect(store().streets.river.rows['bet-125']).toBeUndefined();
  });

  it('a recorded shove is the all-in row, played', () => {
    load({ river: { mode: 'hero', kind: 'bet', sizePct: 86, response: 'fold' } });
    const st = store().streets.river;
    expect(st.playedRow).toBe(ALL_IN_ROW_ID);
    expect(st.recordedRow).toBe(ALL_IN_ROW_ID);
    expect(heroSizes('river').map((r) => r[0])).toEqual(['bet-33', 'bet-66', ALL_IN_ROW_ID]);
  });

  it('«+ Tamaño» past the stack is the all-in; the villain bet is capped too', () => {
    load();
    store().setActiveStreet('river');
    store().addBetSize(150);
    expect(heroSizes('river').map((r) => r[0])).toEqual(['bet-33', 'bet-66', ALL_IN_ROW_ID]);
    store().setVillainBet(200);
    expect(store().streets.river.villainBetPct).toBe(86);
  });

  it('a stack typed by hand moves the all-in and drops what no longer fits', () => {
    load();
    store().setActiveStreet('river');
    store().setPlayedRow('river', 'bet-66');
    store().setEffStack(5);
    const st = store().streets.river;
    expect(heroSizes('river')).toEqual([[ALL_IN_ROW_ID, 32.32, 'All-in 32%']]);
    expect(st.playedRow).toBe(ALL_IN_ROW_ID);
    expect(st.rows['bet-66']).toBeUndefined();
  });

  it('a test hand without pot or stack keeps the defaults', () => {
    store().loadHand(
      { hero: cards('9d6c') as [CardId, CardId], board: cards('Jd 6d Qd Tc Qc') },
      weightsFromHandRange('KQs'),
    );
    expect(heroSizes('river').map((r) => r[0])).toEqual(['bet-33', 'bet-66', 'bet-125']);
  });
});
