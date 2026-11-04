import { describe, expect, it } from 'vitest';
import { deadCardsOf, parseCards, type CardId } from '../cards';
import { MADE_CATEGORIES } from '../categories';
import { classify } from '../classify';
import {
  availableStreets,
  rowTotals,
  streetView,
  weightsFromRecord,
  type ChainInput,
  type StreetState,
} from '../chain';
import { COMBO_COUNT, isComboBlocked, weightsFromHandRange } from '../combos';
import type { Street } from '../equity';
import { emptyActionRow, fullActionRow, type ActionRowState } from '../weights';

function cards(text: string): CardId[] {
  const out = parseCards(text);
  if (!out) throw new Error(`bad cards: ${text}`);
  return out;
}

const HERO = cards('AsKs') as [CardId, CardId];
const BOARD = cards('Qh Jd 2c 7s 3h');
const PREFLOP = weightsFromHandRange('22+, A2s+, KTs+, QTs+, JTs, T9s, ATo+, KJo+');

function street(row: ActionRowState, extra: Partial<StreetState> = {}): StreetState {
  return {
    actionRows: [
      { id: 'check', label: 'Check', kind: 'check' },
      { id: 'bet-33', label: 'Bet 33%', kind: 'bet', size: 33 },
    ],
    rows: { check: row, 'bet-33': fullActionRow() },
    selectedRow: 'check',
    playedRow: 'check',
    ...extra,
  };
}

function input(
  streets: Partial<Record<Street, StreetState>> = {},
  board: CardId[] = BOARD,
  preflop = PREFLOP,
): ChainInput {
  return {
    hand: { hero: HERO, board },
    villainPreflop: preflop,
    streets: {
      flop: streets.flop ?? street(fullActionRow()),
      turn: streets.turn ?? street(fullActionRow()),
      river: streets.river ?? street(fullActionRow()),
    },
    filters: [],
  };
}

const topPairOnly = (w: number): ActionRowState => ({
  ...emptyActionRow(),
  cats: { 'top-pair': { s: 'follow', w } },
});

describe('streets available from the board', () => {
  it('flop / turn / river follow the board length', () => {
    expect(availableStreets({ hero: HERO, board: BOARD.slice(0, 3) })).toEqual(['flop']);
    expect(availableStreets({ hero: HERO, board: BOARD.slice(0, 4) })).toEqual(['flop', 'turn']);
    expect(availableStreets({ hero: HERO, board: BOARD })).toEqual(['flop', 'turn', 'river']);
    expect(streetView(input({}, BOARD.slice(0, 4)), 'river')).toBeNull();
  });
});

describe('chaining between streets', () => {
  it('the flop starts from the preflop range minus blockers', () => {
    const v = streetView(input(), 'flop')!;
    const dead = deadCardsOf([...HERO, ...BOARD.slice(0, 3)]);
    for (let id = 0; id < COMBO_COUNT; id++) {
      expect(v.start[id]).toBe(isComboBlocked(id, dead) ? 0 : PREFLOP[id]);
    }
    // "Todo ✓ 100" rows continue with the whole range.
    expect([...v.rows['bet-33']!]).toEqual([...v.start]);
  });

  it('the played flop row chains into the turn, classified on the flop', () => {
    const flopBoard = BOARD.slice(0, 3);
    const v = streetView(
      input({
        flop: street(fullActionRow(), {
          rows: { check: fullActionRow(), 'bet-33': topPairOnly(100) },
          playedRow: 'bet-33',
        }),
      }),
      'turn',
    )!;
    const dead = deadCardsOf([...HERO, ...BOARD.slice(0, 4)]);
    let kept = 0;
    for (let id = 0; id < COMBO_COUNT; id++) {
      const pre = PREFLOP[id] ?? 0;
      if (pre === 0 || isComboBlocked(id, dead)) {
        expect(v.start[id]).toBe(0);
        continue;
      }
      const flopTopPair = classify(id, flopBoard).made === 'top-pair';
      expect(v.start[id]).toBe(flopTopPair ? pre : 0);
      if (flopTopPair) kept++;
    }
    expect(kept).toBeGreaterThan(0);
  });

  it('only the played row chains; selecting another row never changes it (D37)', () => {
    const flop = (selectedRow: string, playedRow: string) =>
      street(fullActionRow(), {
        rows: { check: topPairOnly(100), 'bet-33': fullActionRow() },
        selectedRow,
        playedRow,
      });
    const playedCheck = streetView(input({ flop: flop('check', 'check') }), 'turn')!;
    const selectedOther = streetView(input({ flop: flop('bet-33', 'check') }), 'turn')!;
    const playedBet = streetView(input({ flop: flop('check', 'bet-33') }), 'turn')!;
    expect([...selectedOther.start]).toEqual([...playedCheck.start]);
    expect([...playedBet.start]).not.toEqual([...playedCheck.start]);
  });

  it('effective weight = preflop × flop played × turn played × river row', () => {
    const v = streetView(
      input({
        flop: street(topPairOnly(50), { playedRow: 'check' }),
        turn: street(
          {
            ...emptyActionRow(),
            cats: Object.fromEntries(MADE_CATEGORIES.map((c) => [c, { s: 'follow', w: 40 }])),
          },
          { playedRow: 'check' },
        ),
        river: street({
          ...emptyActionRow(),
          cats: Object.fromEntries(MADE_CATEGORIES.map((c) => [c, { s: 'follow', w: 25 }])),
        }),
      }),
      'river',
    )!;
    const flopBoard = BOARD.slice(0, 3);
    const dead = deadCardsOf([...HERO, ...BOARD]);
    for (let id = 0; id < COMBO_COUNT; id++) {
      const pre = PREFLOP[id] ?? 0;
      const ok =
        pre > 0 && !isComboBlocked(id, dead) && classify(id, flopBoard).made === 'top-pair';
      expect(v.start[id]).toBeCloseTo(ok ? pre * 0.5 * 0.4 : 0, 12);
      expect(v.rows.check![id]).toBeCloseTo(ok ? pre * 0.5 * 0.4 * 0.25 : 0, 12);
    }
  });

  it('changing the flop recalculates the turn and the river', () => {
    const base = input({ flop: street(topPairOnly(100), { playedRow: 'check' }) });
    const a = streetView(base, 'turn')!;
    const b = streetView(
      { ...base, hand: { hero: HERO, board: cards('Kh Td 4c 7s 3h') } },
      'turn',
    )!;
    expect([...a.start]).not.toEqual([...b.start]);
  });
});

describe('invariants (§11.5)', () => {
  const streets = input({
    flop: street(topPairOnly(70), { playedRow: 'check' }),
    turn: street(fullActionRow(), { playedRow: 'check' }),
  });

  it('no weighted combo shares a card with Hero or the board, on any street', () => {
    for (const s of ['flop', 'turn', 'river'] as const) {
      const v = streetView(streets, s)!;
      const dead = deadCardsOf([...HERO, ...v.board]);
      for (let id = 0; id < COMBO_COUNT; id++) {
        if (!isComboBlocked(id, dead)) continue;
        expect(v.start[id]).toBe(0);
        for (const w of Object.values(v.rows)) expect(w[id]).toBe(0);
      }
    }
  });

  it('the made rows add up to the range total', () => {
    for (const s of ['flop', 'turn', 'river'] as const) {
      const v = streetView(streets, s)!;
      const t = rowTotals(v.start, v.classes, v.board);
      const made = MADE_CATEGORIES.reduce((sum, c) => sum + (t.byCategory[c] ?? 0), 0);
      expect(made).toBeCloseTo(t.total, 9);
      expect(t.total).toBeGreaterThan(0);
    }
  });

  it('weights stay in [0, 1] even with out-of-range inputs', () => {
    const wild = weightsFromRecord({ 0: 5, 1: -2, 2: Number.NaN, 3: 0.5 });
    expect([wild[0], wild[1], wild[2], wild[3]]).toEqual([1, 0, 0, 0.5]);
    const crazyRow: ActionRowState = {
      ...emptyActionRow(),
      cats: { 'top-pair': { s: 'follow', w: 999 }, nothing: { s: 'follow', w: -50 } },
      classOverrides: { AA: 300, KK: -10 },
    };
    const raw = new Float64Array(PREFLOP).map((w, i) => (i % 2 ? w * 7 : -w));
    const v = streetView(
      input({ flop: street(crazyRow, { playedRow: 'check' }), turn: street(crazyRow) }, BOARD, raw),
      'turn',
    )!;
    for (const w of [v.start, ...Object.values(v.rows)]) {
      for (let id = 0; id < COMBO_COUNT; id++) {
        expect(w[id]).toBeGreaterThanOrEqual(0);
        expect(w[id]).toBeLessThanOrEqual(1);
      }
    }
  });
});
