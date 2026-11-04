import { describe, expect, it } from 'vitest';
import { parseCards } from '../cards';
import { categoryOfValue, evaluate, type HandCategory } from '../evaluator';
import { refScoreBest } from './referenceEvaluator';

function cards(text: string): number[] {
  const out = parseCards(text);
  if (!out) throw new Error(`bad cards: ${text}`);
  return out;
}

// ── Hand-verifiable ranking cases ────────────────────────────────────────────
// Each case: shared 5-card board, two hole-card pairs, the expected winner and
// (optionally) the category each player ends up with. Every expectation is
// written from the rules of poker, not from either evaluator.

type Case = {
  name: string;
  board: string;
  a: string;
  b: string;
  winner: 'a' | 'b' | 'tie';
  catA?: HandCategory;
  catB?: HandCategory;
};

const CASES: Case[] = [
  // Kickers
  {
    name: 'pair of kings, ace kicker beats queen kicker',
    board: 'Kh 9d 5c 3s 2h',
    a: 'AhKd',
    b: 'QhKc',
    winner: 'a',
    catA: 'pair',
    catB: 'pair',
  },
  {
    name: 'high card: the board plays, 3 vs 4 is irrelevant',
    board: 'Ah Kd Qc 7s 2h',
    a: 'Jc3d',
    b: 'Js4d',
    winner: 'tie',
    catA: 'high-card',
  },
  {
    name: 'high card decided by the fifth card',
    board: 'Ah Jd 8c 5s 2d',
    a: 'Kc6h',
    b: 'Kd4h',
    winner: 'a',
    catA: 'high-card',
    catB: 'high-card',
  },
  {
    name: 'pair of aces, second card K vs Q',
    board: 'Ah 9d 6c 4s 2d',
    a: 'AcKh',
    b: 'AdQh',
    winner: 'a',
    catA: 'pair',
  },
  {
    name: 'pair on board, third kicker Q vs J',
    board: '8h 8d Kc 5s 3d',
    a: 'Qc2h',
    b: 'Jd4h',
    winner: 'a',
    catA: 'pair',
  },
  {
    name: 'pair on board, 2 vs 4 does not play (only 3 kickers)',
    board: '8h 8d Kc Qs 3d',
    a: 'Jc2h',
    b: 'Jd4h',
    winner: 'tie',
    catA: 'pair',
  },
  {
    name: 'trips, first kicker A vs K',
    board: '7h 7d 7c 9s 2d',
    a: 'Ac3h',
    b: 'KcQh',
    winner: 'a',
    catA: 'trips',
    catB: 'trips',
  },
  {
    name: 'trips, second kicker T vs 9',
    board: '7h 7d 7c 2s 3d',
    a: 'AcTh',
    b: 'Ad9h',
    winner: 'a',
    catA: 'trips',
  },
  {
    name: 'quads on board, ace kicker beats pocket kings',
    board: '8h 8d 8c 8s 2d',
    a: 'Ac3h',
    b: 'KcKh',
    winner: 'a',
    catA: 'quads',
    catB: 'quads',
  },
  {
    name: 'quads + ace on board: everyone ties',
    board: '8h 8d 8c 8s Ad',
    a: 'KcKh',
    b: '2c3c',
    winner: 'tie',
    catA: 'quads',
  },

  // Two pair
  {
    name: 'same two pair, kicker A vs K',
    board: 'Jh Jd 5c 5s 2d',
    a: 'Ac3h',
    b: 'Kc3d',
    winner: 'a',
    catA: 'two-pair',
  },
  {
    name: 'three pairs: the third pair is only a kicker (4 < Q)',
    board: 'Kh Kd 6c 6s 4d',
    a: '4h2c',
    b: 'Qc3h',
    winner: 'b',
    catA: 'two-pair',
    catB: 'two-pair',
  },
  {
    name: 'three pairs: pocket aces play over the board pairs',
    board: '5h 5d 3c 3s 9d',
    a: 'AcAh',
    b: '9c2h',
    winner: 'a',
    catA: 'two-pair',
    catB: 'two-pair',
  },
  {
    name: 'counterfeited pocket pair: 66 on 8877K loses to ace kicker',
    board: '8h 8d 7c 7s Kd',
    a: '6c6h',
    b: 'Ac2h',
    winner: 'b',
    catA: 'two-pair',
  },
  {
    name: 'two pair beats one pair with better kickers',
    board: '9h 9d 6c 4s 2d',
    a: '6h3c',
    b: 'AcKh',
    winner: 'a',
    catA: 'two-pair',
    catB: 'pair',
  },

  // Straights
  {
    name: 'wheel A2345 loses to the 6-high straight',
    board: '5d 4c 3h 9s Kd',
    a: 'Ac2d',
    b: '6c2h',
    winner: 'b',
    catA: 'straight',
    catB: 'straight',
  },
  {
    name: 'wheel beats trips',
    board: '5d 4c 3h Kd Ks',
    a: 'Ac2s',
    b: 'KhQc',
    winner: 'a',
    catA: 'straight',
    catB: 'trips',
  },
  {
    name: 'wheel loses to a 7-high straight on a 2345 board',
    board: '2d 3h 4s 5c 9d',
    a: 'AhKc',
    b: '6h7c',
    winner: 'b',
    catA: 'straight',
    catB: 'straight',
  },
  {
    name: 'two wheels tie',
    board: 'Ah 2d 3c 4s Kd',
    a: '5c9h',
    b: '5dQh',
    winner: 'tie',
    catA: 'straight',
  },
  {
    name: 'higher straight using the board',
    board: '5h 6d 7c 8s Kd',
    a: '9c2h',
    b: '9dTh',
    winner: 'b',
    catA: 'straight',
    catB: 'straight',
  },
  {
    name: 'six-card run: 9 on top beats the board straight',
    board: '4h 5d 6c 7s 8d',
    a: '9c3h',
    b: '3c2h',
    winner: 'a',
    catA: 'straight',
    catB: 'straight',
  },
  {
    name: 'broadway beats king-high straight',
    board: 'Th Jd Qc 2s 3d',
    a: 'AcKh',
    b: 'Kc9h',
    winner: 'a',
    catA: 'straight',
    catB: 'straight',
  },
  {
    name: 'straight beats trips on a paired board',
    board: '9h Td Jc Qs Qd',
    a: 'Kc2h',
    b: 'Qh3c',
    winner: 'a',
    catA: 'straight',
    catB: 'trips',
  },

  // Flushes
  {
    name: 'flush beats straight',
    board: '9h 8h 7c 2h Kd',
    a: 'JsTs',
    b: 'Ah3h',
    winner: 'b',
    catA: 'straight',
    catB: 'flush',
  },
  {
    name: 'six hearts: best five of them (A K 9 7 4 > A Q 9 7 4)',
    board: 'Ah 9h 7h 4h 2c',
    a: 'Kh3h',
    b: 'QhJc',
    winner: 'a',
    catA: 'flush',
    catB: 'flush',
  },
  {
    name: 'seven hearts: A K 9 6 4 beats the board flush A K 9 6 3',
    board: 'Ah Kh 9h 6h 3h',
    a: '2h4h',
    b: '7c8c',
    winner: 'a',
    catA: 'flush',
    catB: 'flush',
  },
  {
    name: 'board flush, 2h is lower than every board heart',
    board: 'Ah Kh 9h 6h 3h',
    a: '2hQc',
    b: '7c8c',
    winner: 'tie',
    catA: 'flush',
  },
  {
    name: 'flush, second card K vs Q decides',
    board: 'Kh 9h 5h 2c 3d',
    a: 'Ah4h',
    b: 'QhJh',
    winner: 'a',
    catA: 'flush',
    catB: 'flush',
  },
  {
    name: 'flush with A2345 in hand is a flush, not a straight',
    board: 'Kh 9h 5h 2c 3d',
    a: 'Ah4h',
    b: 'As4c',
    winner: 'a',
    catA: 'flush',
    catB: 'straight',
  },

  // Full houses
  {
    name: 'two trips make a full house: KKK77 beats 777KK',
    board: 'Kh Kd 7c 7s 2d',
    a: 'Kc7h',
    b: '7dAc',
    winner: 'a',
    catA: 'full-house',
    catB: 'full-house',
  },
  {
    name: 'trips + two pairs: 222 99 beats AA99',
    board: '9h 9d 5c 5s 2d',
    a: '2c2h',
    b: 'AcAh',
    winner: 'a',
    catA: 'full-house',
    catB: 'two-pair',
  },
  {
    name: 'full house: higher trips wins (QQQ88 > 888QQ)',
    board: 'Qh Qd 8c 8s 3d',
    a: 'Qc2h',
    b: '8hAc',
    winner: 'a',
    catA: 'full-house',
    catB: 'full-house',
  },
  {
    name: 'full house: same trips, pair 99 beats 44',
    board: 'Jh Jd Jc 4s 3d',
    a: '9c9h',
    b: '4h2c',
    winner: 'a',
    catA: 'full-house',
    catB: 'full-house',
  },
  {
    name: 'board full house plays for both',
    board: '6h 6d 6c Ts Td',
    a: 'AhKc',
    b: '2h3c',
    winner: 'tie',
    catA: 'full-house',
  },
  {
    name: 'full house beats flush',
    board: 'Th Td 6h 2h 9c',
    a: '6c6s',
    b: 'Ah3h',
    winner: 'a',
    catA: 'full-house',
    catB: 'flush',
  },

  // Quads and straight flushes
  {
    name: 'quads beat full house',
    board: '5h 5d 5c Ks Kd',
    a: '5s2c',
    b: 'Kh3c',
    winner: 'a',
    catA: 'quads',
    catB: 'full-house',
  },
  {
    name: 'straight flush beats quads',
    board: '9s 8s 7s 7d 7c',
    a: '6s5s',
    b: '7h2c',
    winner: 'a',
    catA: 'straight-flush',
    catB: 'quads',
  },
  {
    name: 'seven hearts with A2345: steel wheel beats an ace-high flush',
    board: 'Ah Kh 9h 5h 3h',
    a: '2h4h',
    b: 'QhJh',
    winner: 'a',
    catA: 'straight-flush',
    catB: 'flush',
  },
  {
    name: 'royal flush beats ace-high flush',
    board: 'Ah Kh Qh Jh 2c',
    a: '9h3c',
    b: 'Th4c',
    winner: 'b',
    catA: 'flush',
    catB: 'straight-flush',
  },
  {
    name: 'higher straight flush wins (9 high > 8 high)',
    board: '5s 6s 7s 8s Kd',
    a: '4s2c',
    b: '9s2d',
    winner: 'b',
    catA: 'straight-flush',
    catB: 'straight-flush',
  },
  {
    name: 'royal on board: everyone ties',
    board: 'As Ks Qs Js Ts',
    a: '2c3d',
    b: '4h5h',
    winner: 'tie',
    catA: 'straight-flush',
  },
];

describe('evaluator — hand-verifiable ranking cases', () => {
  it('has at least 30 cases with distinct cards', () => {
    expect(CASES.length).toBeGreaterThanOrEqual(30);
    for (const c of CASES) {
      const all = [...cards(c.board), ...cards(c.a), ...cards(c.b)];
      expect(new Set(all).size, c.name).toBe(9);
    }
  });

  for (const c of CASES) {
    it(c.name, () => {
      const board = cards(c.board);
      const va = evaluate([...board, ...cards(c.a)]);
      const vb = evaluate([...board, ...cards(c.b)]);
      const got = va < vb ? 'a' : va > vb ? 'b' : 'tie';
      expect(got).toBe(c.winner);
      if (c.catA) expect(categoryOfValue(va)).toBe(c.catA);
      if (c.catB) expect(categoryOfValue(vb)).toBe(c.catB);

      // The reference evaluator must agree too.
      const ra = refScoreBest([...board, ...cards(c.a)]);
      const rb = refScoreBest([...board, ...cards(c.b)]);
      expect(ra > rb ? 'a' : ra < rb ? 'b' : 'tie').toBe(c.winner);
    });
  }
});
