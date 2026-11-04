import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseCards, type CardId } from '../../engine/cards';
import { comboId, weightsFromHandRange } from '../../engine/combos';
import { resetAnalyzerStore, useAnalyzerStore, visibleRows } from '../analyzerStore';
import { selectStreetView } from '../selectors';

import type * as PresetsModule from '../../presets';

// These tests cover the preset table, which is switched off for now
// (PRESETS_ENABLED): turn it on here.
vi.mock('../../presets', async (importOriginal) => {
  const actual = await importOriginal<typeof PresetsModule>();
  return { ...actual, PRESETS_ENABLED: true, ACTIVE_PRESETS: actual.DEFAULT_PRESETS };
});


function cards(text: string): CardId[] {
  const out = parseCards(text);
  if (!out) throw new Error(`bad cards: ${text}`);
  return out;
}

const store = () => useAnalyzerStore.getState();
const selected = () => {
  const s = store();
  const st = s.streets[s.activeStreet];
  return st.rows[st.selectedRow]!;
};

function load(board = 'Qh Jd 2c 7s') {
  store().loadHand(
    { hero: cards('AsKs') as [CardId, CardId], board: cards(board) },
    weightsFromHandRange('22+, AKs, AKo'),
  );
}

beforeEach(() => resetAnalyzerStore());

describe('analyzer store', () => {
  it('loads a hand with default EV rows per street (§9)', () => {
    load();
    const s = store();
    expect(visibleRows(s.streets.flop).map((r) => r.label)).toEqual([
      'Check',
      'Bet 33%',
      'Bet 75%',
    ]);
    expect(visibleRows(s.streets.turn).map((r) => r.size)).toEqual([undefined, 50, 75]);
    expect(visibleRows(s.streets.river).map((r) => r.size)).toEqual([undefined, 33, 66, 125]);
    expect(Object.keys(s.villainPreflop)).toHaveLength(13 * 6 + 16);
    expect(s.activeStreet).toBe('flop');
  });

  it('only switches to streets the board reaches', () => {
    load('Qh Jd 2c 7s');
    store().setActiveStreet('turn');
    expect(store().activeStreet).toBe('turn');
    store().setActiveStreet('river');
    expect(store().activeStreet).toBe('turn');
  });

  it('editing a row marks it edited; matching the preset again clears it', () => {
    load();
    expect(selected().edited).toBe(false);
    store().setRowState({ kind: 'cat', id: 'ace-high' }, { s: 'exclude' });
    expect(selected().cats['ace-high']).toEqual({ s: 'exclude', w: 50 });
    expect(selected().edited).toBe(true);
    store().setRowState({ kind: 'cat', id: 'ace-high' }, { s: 'follow' });
    expect(selected().edited).toBe(false);
  });

  it('weights are clamped to 0..100', () => {
    load();
    store().setRowState({ kind: 'cat', id: 'top-pair' }, { w: 140 });
    expect(selected().cats['top-pair']!.w).toBe(100);
    store().setClassOverride('AKs', -5);
    expect(selected().classOverrides.AKs).toBe(0);
    store().setBrush(250);
    expect(store().brush).toBe(100);
  });

  it('Vaciar, Todo ✓ 100 and Restablecer preset', () => {
    load();
    store().clearSelectedRow();
    expect(selected().cats).toEqual({});
    expect(selected().edited).toBe(true);
    store().fillSelectedRow();
    // Made rows only; draws stay neutral (D53).
    expect(selected().cats['top-pair']).toEqual({ s: 'follow', w: 100 });
    expect(selected().cats['bdfd-1']).toBeUndefined();
    store().setClassOverride('AA', 0);
    store().resetSelectedRow();
    expect(selected().edited).toBe(false);
    expect(selected().classOverrides).toEqual({});
    expect(selected().custom).toEqual({});
  });

  it('class and combo overrides can be set and removed', () => {
    load();
    const id = comboId(cards('Ah')[0]!, cards('Kh')[0]!);
    store().setComboOverride(id, 30);
    expect(selected().comboOverrides[id]).toBe(30);
    store().setComboOverride(id, null);
    expect(selected().comboOverrides).toEqual({});
  });

  it('edits only touch the selected row of the active street', () => {
    load();
    store().selectRow('bet-33');
    store().setRowState({ kind: 'cat', id: 'top-pair' }, { s: 'exclude' });
    const s = store();
    expect(s.streets.flop.rows['bet-33']!.edited).toBe(true);
    expect(s.streets.flop.rows.check!.edited).toBe(false);
    expect(s.streets.turn.rows['bet-50']!.edited).toBe(false);
  });

  it('batch combo overrides set and clear in one update', () => {
    load();
    const a = comboId(cards('Ah')[0]!, cards('Kd')[0]!);
    const b = comboId(cards('Ac')[0]!, cards('Kd')[0]!);
    store().setComboOverrides([
      { combo: a, weight: 0 },
      { combo: b, weight: 120 },
    ]);
    expect(selected().comboOverrides).toEqual({ [a]: 0, [b]: 100 });
    store().setComboOverrides([{ combo: a, weight: null }]);
    expect(selected().comboOverrides).toEqual({ [b]: 100 });
  });

  it('"+ Tamaño" adds a sorted bet row with its own range', () => {
    load();
    store().addBetSize(50);
    store().addBetSize(50);
    expect(visibleRows(store().streets.flop).map((r) => r.id)).toEqual([
      'check',
      'bet-33',
      'bet-50',
      'bet-75',
    ]);
  });

  it('every street has a played row: the first bet row by default (D37)', () => {
    load();
    // ...and the page starts editing that same row.
    expect(store().streets.flop.selectedRow).toBe('bet-33');
    expect(store().streets.flop.playedRow).toBe('bet-33');
    expect(store().streets.turn.playedRow).toBe('bet-50');
    expect(store().streets.river.playedRow).toBe('bet-33');
  });

  it('selecting a row never changes the played row; "Marcar como jugada" does', () => {
    load();
    store().selectRow('bet-75');
    expect(store().streets.flop.playedRow).toBe('bet-33');
    store().setPlayedRow('flop', 'bet-75');
    expect(store().streets.flop.playedRow).toBe('bet-75');
    store().setPlayedRow('flop', 'nope');
    expect(store().streets.flop.playedRow).toBe('bet-75');
  });
});

describe('memoized street view', () => {
  // The memo is keyed by identity, so the filters list must be a stable array.
  const NONE: readonly never[] = [];
  it('returns the same object until an input changes', () => {
    load();
    const a = selectStreetView(store(), 'flop', NONE);
    const b = selectStreetView(store(), 'flop', NONE);
    expect(a).not.toBeNull();
    expect(b).toBe(a);
    // Another street does not evict it.
    selectStreetView(store(), 'turn', NONE);
    expect(selectStreetView(store(), 'flop', NONE)).toBe(a);

    store().setRowState({ kind: 'cat', id: 'set' }, { s: 'exclude' });
    const c = selectStreetView(store(), 'flop', NONE);
    expect(c).not.toBe(a);
  });

  it('editing the played flop row changes the turn; editing another row does not', () => {
    load();
    const before = selectStreetView(store(), 'turn', NONE)!;
    store().selectRow('check');
    store().clearSelectedRow(); // "check" is selected but "bet-33" is played
    const same = selectStreetView(store(), 'turn', NONE)!;
    expect([...same.start]).toEqual([...before.start]);

    store().selectRow('bet-33');
    store().clearSelectedRow(); // the played row: nothing continues
    const after = selectStreetView(store(), 'turn', NONE)!;
    expect(before.start.some((w) => w > 0)).toBe(true);
    expect(after.start.every((w) => w === 0)).toBe(true);
  });
});
