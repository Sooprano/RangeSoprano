import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseCards, type CardId } from '../../engine/cards';
import { weightsFromHandRange } from '../../engine/combos';
import type { RecordedStreets } from '../../engine/recorded';
import { resetAnalyzerStore, useAnalyzerStore, visibleRows } from '../analyzerStore';
import {
  fromSavedHand,
  LAST_HAND_KEY,
  parseSavedHand,
  readLastHand,
  toSavedHand,
  writeLastHand,
} from '../lastHand';

import type * as PresetsModule from '../../presets';

// These tests cover the preset table, which is switched off for now
// (PRESETS_ENABLED): turn it on here.
vi.mock('../../presets', async (importOriginal) => {
  const actual = await importOriginal<typeof PresetsModule>();
  return { ...actual, PRESETS_ENABLED: true, ACTIVE_PRESETS: actual.DEFAULT_PRESETS };
});


const store = () => useAnalyzerStore.getState();
const hand = {
  hero: parseCards('AsKs') as [CardId, CardId],
  board: parseCards('Kh 9h 4c 7s 2d')!,
  pots: { flop: 5.5, turn: 9.1, river: 45.1 },
  heroPosition: 'BTN',
  villainPosition: 'BB',
};
const RANGE = '22+, AJs+, KQs, QJs, JTs, T9s, AQo+';

const RECORDED: RecordedStreets = {
  flop: { mode: 'hero', kind: 'bet', sizePct: 40, response: 'call' },
  turn: { mode: 'villain', betPct: 49, response: 'raise', raiseMultiple: 4 },
  river: { mode: 'hero', kind: 'check' },
};

beforeEach(() => resetAnalyzerStore());

describe('loading a real hand', () => {
  it('each street starts on the recorded action, with its preset', () => {
    store().loadHand(hand, weightsFromHandRange(RANGE), { recorded: RECORDED });
    const { flop, turn, river } = store().streets;

    // Flop: Hero bet 40% (not a default size → added), the villain called.
    expect(visibleRows(flop).map((r) => r.label)).toEqual(['Check', 'Bet 33%', 'Bet 40%', 'Bet 75%']);
    expect(flop.playedRow).toBe('bet-40');
    expect(flop.selectedRow).toBe('bet-40');
    expect(flop.recordedRow).toBe('bet-40');
    expect(flop.recordedResponse).toBe('call');
    expect(flop.presetRefs['bet-40']).toEqual({ kind: 'preset', label: 'Call vs 25–45%' });
    expect(flop.presetRefs['bet-75']).toEqual({ kind: 'preset', label: 'Call vs 55–100%' });
    expect(flop.presetRefs.check).toEqual({ kind: 'check' });
    expect(flop.rows['bet-40']!.cats['ace-high']).toEqual({ s: 'follow', w: 50 });

    // Turn: the villain bet 49%, Hero raised to 4x.
    expect(turn.mode).toBe('villain');
    expect(turn.villainBetPct).toBe(49);
    expect(visibleRows(turn).map((r) => r.id)).toEqual(['fold', 'call', 'raise-3', 'raise-4']);
    expect(turn.playedRow).toBe('raise-4');
    expect(turn.presetRefs['raise-4']).toEqual({ kind: 'none', action: null });
    // Switching to "Hero decide" lands on the first bet row.
    expect(turn.modeMemory.hero.playedRow).toBe('bet-50');

    expect(river.playedRow).toBe('check');
  });

  it('a check-raise: the recorded bet row takes the check-raise preset', () => {
    store().loadHand(hand, weightsFromHandRange(RANGE), {
      recorded: { flop: { mode: 'hero', kind: 'bet', sizePct: 75, response: 'raise' } },
    });
    const flop = store().streets.flop;
    expect(flop.presetRefs['bet-75']).toEqual({
      kind: 'preset',
      label: 'Check-raise vs 55–100%',
    });
    expect(flop.rows['bet-75']!.cats['gutshot-bdfd']).toEqual({ s: 'follow', w: 50 });
    // The other bet row keeps its call preset.
    expect(flop.presetRefs['bet-33']).toEqual({ kind: 'preset', label: 'Call vs 25–45%' });
  });

  it('a test hand (no recorded action) also starts from the presets', () => {
    store().loadHand(hand, weightsFromHandRange(RANGE));
    const flop = store().streets.flop;
    expect(flop.playedRow).toBe('bet-33');
    expect(flop.recordedRow).toBeNull();
    expect(flop.presetRefs['bet-33']).toEqual({ kind: 'preset', label: 'Call vs 25–45%' });
  });

  it('"+ Tamaño" takes the call preset of its size, or none in a gap', () => {
    store().loadHand(hand, weightsFromHandRange(RANGE));
    store().addBetSize(60);
    store().addBetSize(50);
    const flop = store().streets.flop;
    expect(flop.presetRefs['bet-60']).toEqual({ kind: 'preset', label: 'Call vs 55–100%' });
    expect(flop.presetRefs['bet-50']).toEqual({ kind: 'none', action: 'call' });
  });
});

describe('last hand (localStorage)', () => {
  // Tests run in Node: a tiny in-memory localStorage.
  beforeEach(() => {
    const data = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('round-trips through JSON and the schema', () => {
    const meta = {
      title: 'Mano #1 · Hero BTN vs BB',
      spot: 'Hero (BTN) abre · BB paga',
      rangeLabel: 'BB call vs BTN · Rangos GTO',
      rangeMissing: null,
      warnings: [],
    };
    const saved = toSavedHand(hand, RANGE, RECORDED, meta);
    writeLastHand(saved);
    const back = readLastHand();
    expect(back).toEqual(saved);
    const loaded = fromSavedHand(back!)!;
    expect(loaded.hand.board).toEqual(hand.board);
    expect(loaded.recorded).toEqual(RECORDED);
    expect(loaded.meta).toEqual(meta);
  });

  it('keeps the table (format, positions, stacks) of a real hand', () => {
    const meta = {
      title: 'Mano #2',
      spot: null,
      rangeLabel: null,
      rangeMissing: null,
      warnings: [],
      table: {
        format: 'HU',
        blinds: '$0.50/$1.00',
        currency: '$',
        seats: [
          { name: 'Hero', position: 'BTN' as const, stack: 12, stackBb: 12, role: 'hero' as const, inFlop: true },
          { name: 'Vil', position: 'BB' as const, stack: 85.5, stackBb: 85.5, role: 'villain' as const, inFlop: true },
        ],
        effectiveBb: 12,
        effective: 12,
      },
    };
    writeLastHand(toSavedHand(hand, RANGE, RECORDED, meta));
    expect(readLastHand()?.meta).toEqual(meta);
    const bad = { ...meta, table: { ...meta.table, seats: [{ ...meta.table.seats[0], position: 'X' }] } };
    expect(parseSavedHand({ ...toSavedHand(hand, RANGE, {}, null), meta: bad })).toBeNull();
  });

  it('a corrupt or foreign value is ignored', () => {
    localStorage.setItem(LAST_HAND_KEY, '{not json');
    expect(readLastHand()).toBeNull();
    const saved = toSavedHand(hand, RANGE, {}, null);
    expect(parseSavedHand({ ...saved, version: 2 })).toBeNull();
    expect(parseSavedHand({ ...saved, extra: true })).toBeNull();
    expect(
      parseSavedHand({ ...saved, recorded: { flop: { mode: 'hero', kind: 'bet' } } }),
    ).toBeNull();
    expect(fromSavedHand({ ...saved, hero: 'AsAs7c' })).toBeNull();
  });
});
