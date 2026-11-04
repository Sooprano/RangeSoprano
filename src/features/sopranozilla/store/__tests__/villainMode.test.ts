import { beforeEach, describe, expect, it } from 'vitest';
import { parseCards, type CardId } from '../../engine/cards';
import { COMBO_COUNT, weightsFromHandRange } from '../../engine/combos';
import { resetAnalyzerStore, useAnalyzerStore, visibleRows } from '../analyzerStore';
import { selectStreetView } from '../selectors';

const NONE: readonly never[] = [];
const store = () => useAnalyzerStore.getState();

function load() {
  store().loadHand(
    { hero: parseCards('AsKs') as [CardId, CardId], board: parseCards('Kh 9h 4c 7s 2d')! },
    weightsFromHandRange('22+, AJs+, KQs, QJs, JTs, T9s, AQo+'),
  );
}

const sum = (w: Float64Array) => w.reduce((a, b) => a + b, 0);

beforeEach(() => resetAnalyzerStore());

describe('"Villano apuesta" mode', () => {
  it('switches the visible rows and the played row; switching back restores them', () => {
    load();
    store().selectRow('bet-75');
    store().setPlayedRow('flop', 'bet-75');
    store().setMode('villain');
    let st = store().streets.flop;
    expect(visibleRows(st).map((r) => r.label)).toEqual(['Fold', 'Call', 'Raise 3x']);
    expect(st.playedRow).toBe('call');
    expect(st.selectedRow).toBe('call');

    store().setMode('hero');
    st = store().streets.flop;
    expect(st.playedRow).toBe('bet-75');
    expect(st.selectedRow).toBe('bet-75');
  });

  it('Fold has no range and can be neither edited nor played', () => {
    load();
    store().setMode('villain');
    store().selectRow('fold');
    store().setPlayedRow('flop', 'fold');
    const st = store().streets.flop;
    expect(st.selectedRow).toBe('call');
    expect(st.playedRow).toBe('call');
  });

  it('the raise range sits on the betting range (call × raise)', () => {
    load();
    store().setMode('villain');
    // Villain bets only with pairs-or-better…
    store().clearSelectedRow();
    store().setRowState({ kind: 'cat', id: 'top-pair' }, { s: 'follow', w: 100 });
    store().setRowState({ kind: 'cat', id: 'set' }, { s: 'follow', w: 100 });
    // …and calls the raise only with sets.
    store().selectRow('raise-3');
    store().clearSelectedRow();
    store().setRowState({ kind: 'cat', id: 'set' }, { s: 'follow', w: 100 });
    store().setRowState({ kind: 'cat', id: 'nothing' }, { s: 'follow', w: 100 });

    const v = selectStreetView(store(), 'flop', NONE)!;
    const call = v.rows.call!;
    const raise = v.rows['raise-3']!;
    for (let id = 0; id < COMBO_COUNT; id++) {
      // "Nada ✓" on the raise row cannot add combos the villain never bet.
      expect(raise[id]).toBeLessThanOrEqual(call[id]! + 1e-12);
    }
    expect(sum(raise)).toBeGreaterThan(0);
    expect(sum(raise)).toBeLessThan(sum(call));
  });

  it('the played row of villain mode chains into the next street', () => {
    load();
    store().setMode('villain');
    store().clearSelectedRow(); // the villain bets nothing → nothing reaches the turn
    expect(sum(selectStreetView(store(), 'turn', NONE)!.start)).toBe(0);
    store().fillSelectedRow();
    expect(sum(selectStreetView(store(), 'turn', NONE)!.start)).toBeGreaterThan(0);
  });

  it('villain bet size and "+ Raise"', () => {
    load();
    store().setMode('villain');
    store().setVillainBet(75);
    expect(store().streets.flop.villainBetPct).toBe(75);
    store().setVillainBet(-1);
    expect(store().streets.flop.villainBetPct).toBe(75);
    store().addRaiseSize(2.5);
    store().addRaiseSize(1);
    const st = store().streets.flop;
    expect(visibleRows(st).map((r) => r.id)).toEqual(['fold', 'call', 'raise-2.5', 'raise-3']);
    expect(st.actionRows.find((r) => r.id === 'raise-2.5')?.basedOn).toBe('call');
  });
});
