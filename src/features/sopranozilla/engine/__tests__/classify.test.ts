import { describe, expect, it } from 'vitest';
import { deadCardsOf, parseCards, type CardId } from '../cards';
import { COMBO_COUNT, comboId, isComboBlocked, type ComboId } from '../combos';
import { MADE_CATEGORIES } from '../categories';
import { classify, classifyAll, type ComboClass } from '../classify';

function cards(text: string): CardId[] {
  const out = parseCards(text);
  if (!out) throw new Error(`bad cards: ${text}`);
  return out;
}

function combo(text: string): ComboId {
  const [a, b] = cards(text);
  return comboId(a!, b!);
}

function cls(hand: string, board: string): ComboClass {
  return classify(combo(hand), cards(board));
}

const R = { A: 12, K: 11, Q: 10, J: 9, T: 8, '9': 7, '8': 6, '6': 4, '5': 3, '3': 1, '2': 0 };

const OVERCARDS = new Set(['two-overcards', 'one-overcard']);
/** Draw ids without the overcard rows (tested on their own). */
const drawIds = (c: ComboClass) =>
  c.draws
    .map((d) => d.id)
    .filter((id) => !OVERCARDS.has(id))
    .sort();
const overcardIds = (c: ComboClass) => c.draws.map((d) => d.id).filter((id) => OVERCARDS.has(id));
const comboIds = (c: ComboClass) => c.comboDraws.map((d) => d.id).sort();

describe('made hands — dry board K♠ 7♦ 2♣', () => {
  const B = 'Ks 7d 2c';
  it.each([
    ['KhKd', 'set'],
    ['AhAd', 'overpair'],
    ['QhQd', 'pp-below-top'],
    ['9h9d', 'pp-below-top'],
    ['5h5d', 'pp-below-second'],
    ['Kh7h', 'two-pair'],
    ['AhKd', 'top-pair'],
    ['7h6h', 'middle-pair'],
    ['3h2h', 'weak-pair'],
    ['AhQd', 'ace-high'],
    ['QhJd', 'nothing'],
  ])('%s → %s', (hand, made) => {
    expect(cls(hand, B).made).toBe(made);
  });

  it('pair kickers and two-pair kinds', () => {
    expect(cls('AhKd', B).madeAttrs.kicker).toBe(R.A);
    expect(cls('7h6h', B).madeAttrs.kicker).toBe(R['6']);
    expect(cls('3h2h', B).madeAttrs.kicker).toBe(R['3']);
    expect(cls('Kh7h', B).madeAttrs.twoPairKind).toBe('top-two');
    expect(cls('Kh2h', B).madeAttrs.twoPairKind).toBe('top-bottom');
    expect(cls('7h2h', B).madeAttrs.twoPairKind).toBe('bottom-two');
  });

  it('PP < board, A-high and K-high', () => {
    expect(cls('3h3d', 'Ks 7d 4c').made).toBe('pp-below-board');
    expect(cls('AhKd', '9s 7d 2c').made).toBe('ace-high');
    expect(cls('Kh8d', 'As 9d 4c').made).toBe('king-high');
    expect(cls('Kh8d', 'As 9d 4c').attrs.overcards).toBe(0);
  });
});

describe('made hands — paired board K♠ K♦ 7♣', () => {
  const B = 'Ks Kd 7c';
  it.each([
    ['Kh2h', 'trips'],
    ['7h2h', 'middle-pair'], // pairs the 2nd distinct rank, not "two pair"
    ['AhAd', 'overpair'],
    ['QhQd', 'pp-below-top'],
    ['5h5d', 'pp-below-board'],
    ['7h7d', 'full-house'], // 777KK
    ['Kh7h', 'full-house'], // KKK77
    ['KhKc', 'sf-quads'],
  ])('%s → %s', (hand, made) => {
    expect(cls(hand, B).made).toBe(made);
  });

  it('trips carry the kicker', () => {
    expect(cls('KhAh', B).madeAttrs.kicker).toBe(R.A);
  });
});

describe('made hands — straights, flushes and the board playing', () => {
  it('straights record how many own cards they use', () => {
    const two = cls('Th6h', '9s 8d 7c');
    expect(two.made).toBe('straight');
    expect(two.madeAttrs.cardsUsed).toBe(2);
    const one = cls('Th2c', '9s 8d 7c 6h');
    expect(one.made).toBe('straight');
    expect(one.madeAttrs.cardsUsed).toBe(1);
  });

  it('straight flush', () => {
    expect(cls('Ts6s', '9s 8s 7s').made).toBe('sf-quads');
  });

  it('flush with nut rank of the highest own card of the suit', () => {
    const c = cls('Jh9h', 'Th 8h 3h');
    expect(c.made).toBe('flush');
    expect(c.madeAttrs.cardsUsed).toBe(2);
    expect(c.madeAttrs.nutRank).toBe(4); // A, K, Q above the J
    expect(cls('Ah2c', 'Kh 8h 3h 5h').madeAttrs.nutRank).toBe(1);
  });

  it('river: own cards that add nothing are "sin hecho"', () => {
    // Board straight 5-9: AA plays the board.
    expect(cls('AhAd', '9s 8d 7c 6h 5s').made).toBe('ace-high');
    expect(cls('Ah2d', 'As Kd Qc Jh Ts').made).toBe('ace-high');
    // Board quads with an ace kicker on board: KQ adds nothing.
    expect(cls('KhQd', '8s 8d 8c 8h As').made).toBe('king-high');
    // But a higher straight does count.
    expect(cls('Th2c', '9s 8d 7c 6h 5s').made).toBe('straight');
  });

  it('every combo gets exactly one made category (they partition the range)', () => {
    const board = cards('Kh 9h 4c');
    const dead = deadCardsOf(board);
    const live: number[] = [];
    for (let id = 0; id < COMBO_COUNT; id++) if (!isComboBlocked(id, dead)) live.push(id);
    const counts = new Map<string, number>();
    for (const c of classifyAll(live, board).values()) {
      expect(MADE_CATEGORIES).toContain(c.made);
      counts.set(c.made, (counts.get(c.made) ?? 0) + 1);
    }
    expect([...counts.values()].reduce((a, b) => a + b, 0)).toBe(live.length);
  });
});

describe('flush draws', () => {
  it('FD 2 cards on a two-tone flop, with nut rank and overcards combo', () => {
    const c = cls('Ah5h', 'Kh 9h 4c');
    expect(drawIds(c)).toEqual(['bdsd', 'fd-2']); // A-5 also has the wheel backdoor
    expect(c.draws[0]!.attrs.nutRank).toBe(1);
    expect(c.made).toBe('ace-high');
    expect(overcardIds(c)).toEqual(['one-overcard']);
    expect(comboIds(c)).toEqual(['fd-overcards']);
  });

  it('FD 1 card on a monotone flop and on a turn', () => {
    const flop = cls('Kh2c', 'Th 8h 3h');
    expect(drawIds(flop)).toEqual(['fd-1']);
    expect(flop.draws[0]!.attrs.nutRank).toBe(2); // A is still out there
    expect(drawIds(cls('Ah7c', 'Kh 9h 4h 2d'))).toEqual(['fd-1']);
  });

  it('no flush draw once there is a flush', () => {
    const c = cls('Jh9h', 'Th 8h 3h');
    expect(c.draws.some((d) => d.id.startsWith('fd'))).toBe(false);
  });

  it('backdoors only on the flop; draws only on flop and turn', () => {
    expect(drawIds(cls('9h6d', 'Ah Jh 2c'))).toEqual(['bdfd-1']);
    expect(cls('9h6d', 'Ah Jh 2c').draws[0]!.attrs.nutRank).toBe(4); // K, Q, T above the 9
    expect(drawIds(cls('Qh5c', 'Kh 9h 4c 2d'))).toEqual([]);
    expect(cls('QhJh', 'Kh 9h 4c 2d 7s').draws).toEqual([]);
  });
});

describe('straight draws', () => {
  it('OESD 2 cards vs 1 card', () => {
    expect(drawIds(cls('6h5h', '8s 7d 2c'))).toEqual(['oesd-2']);
    expect(drawIds(cls('Ts2h', '9s 8d 7c'))).toEqual(['oesd-1']);
    expect(drawIds(cls('Ah6d', '9s 8d 7c'))).toEqual(['oesd-1']);
  });

  it('wheel draws count (A2345)', () => {
    // 5432 is open: A or 6.
    expect(drawIds(cls('5hKd', '4s 3d 2c'))).toEqual(['oesd-1']);
    // A5 on 43K needs exactly the 2.
    expect(drawIds(cls('Ah5h', '4s 3d Kc'))).toEqual(['gutshot-2']);
  });

  it('double gutshot is its own row', () => {
    const c = cls('9h7h', 'Js 8d 5c');
    expect(drawIds(c)).toEqual(['double-gutshot']);
    expect(c.draws[0]!.attrs.cardsUsed).toBe(2);
  });

  it('gutshot 1 card vs 2 cards', () => {
    expect(drawIds(cls('Ah5d', '9s 8d 6c'))).toEqual(['gutshot-1']);
    expect(drawIds(cls('QhJd', 'Ks 9d 2c'))).toEqual(['gutshot-2']);
  });

  it('outs that only make a board straight do not count', () => {
    // Turn 5-6-7-8: a 4 or 9 makes the straight for everyone; 2c3d adds nothing.
    expect(drawIds(cls('2c3d', '5s 6d 7c 8h'))).toEqual([]);
  });

  it('no straight draw once there is a straight', () => {
    expect(drawIds(cls('Th6h', '9s 8d 7c'))).toEqual([]);
  });
});

describe('BDSD and BDSD + BDFD on A♥ J♦ 2♣', () => {
  const B = 'Ah Jd 2c';
  it('Q♥9♥ has both backdoors', () => {
    const c = cls('Qh9h', B);
    expect(drawIds(c)).toEqual(['bdfd-2', 'bdsd']);
    expect(comboIds(c)).toEqual(['bdsd-bdfd']);
    const attrs = c.comboDraws[0]!.attrs;
    expect(attrs.straightCardsUsed).toBe(1); // T-J-Q-K-A uses only the Q
    expect(attrs.flushCardsUsed).toBe(2);
    expect(attrs.nutRank).toBe(2); // K♥ is above the Q♥
  });

  it('Q♠9♠ is BDSD without BDFD (no spades on the board)', () => {
    const c = cls('Qs9s', B);
    expect(drawIds(c)).toEqual(['bdsd']);
    expect(comboIds(c)).toEqual([]);
  });

  it('Q♥T♥ is a gutshot, so not BDSD (§5.2 definition kept) but Gutshot + BDFD', () => {
    const c = cls('QhTh', B);
    expect(drawIds(c)).toEqual(['bdfd-2', 'gutshot-2']);
    expect(comboIds(c)).toEqual(['gutshot-bdfd']);
    const attrs = c.comboDraws[0]!.attrs;
    expect(attrs.straightCardsUsed).toBe(2); // the K needs both Q and T
    expect(attrs.flushCardsUsed).toBe(2);
    expect(attrs.nutRank).toBe(2); // K♥ above the Q♥
  });

  it('Q♠T♠ is a gutshot without BDFD', () => {
    expect(comboIds(cls('QsTs', B))).toEqual([]);
  });

  it('Gutshot + BDFD with a 1-card BDFD, and never on the turn', () => {
    expect(comboIds(cls('Kh9d', 'Qh Jh 2c'))).toEqual(['gutshot-bdfd']);
    expect(comboIds(cls('QhTh', 'Ah Jd 2c 5s'))).toEqual([]);
  });
});

describe('overcards (draws: not exclusive, every street)', () => {
  it('two / one overcard on top of other rows', () => {
    expect(overcardIds(cls('AhKd', '9s 7d 2c'))).toEqual(['two-overcards']);
    // A7 on K72: middle pair AND one overcard.
    const c = cls('Ah7c', 'Ks 7d 2c');
    expect(c.made).toBe('middle-pair');
    expect(overcardIds(c)).toEqual(['one-overcard']);
  });

  it('pocket pairs are overpairs, never overcards', () => {
    const c = cls('AhAd', 'Ks 7d 2c');
    expect(c.made).toBe('overpair');
    expect(overcardIds(c)).toEqual([]);
    expect(c.attrs.overcards).toBe(0);
  });

  it('also on the river', () => {
    expect(overcardIds(cls('AhKd', 'Qs 9d 7c 4h 2s'))).toEqual(['two-overcards']);
  });
});

describe('combo draws', () => {
  it('FD + OESD (double gutshot counts as OESD); combo draws overlap', () => {
    // T is an overcard and there is no pair, so it is also FD + overcards.
    expect(comboIds(cls('Th7h', '9h 8h 2c'))).toEqual(['fd-oesd', 'fd-overcards']);
    // 9-7 on J-8-5 is a double gutshot (T or 6): still "FD + OESD".
    expect(drawIds(cls('9h7h', 'Jh 8h 5c'))).toEqual(['double-gutshot', 'fd-2']);
    expect(comboIds(cls('9h7h', 'Jh 8h 5c'))).toEqual(['fd-oesd']);
  });

  it('FD + gutshot', () => {
    expect(comboIds(cls('QhJh', 'Kh 9h 4c'))).toEqual(['fd-gutshot']);
  });

  it('FD + pair', () => {
    const c = cls('Ah8h', 'Kh 8c 4h');
    expect(c.made).toBe('middle-pair');
    expect(comboIds(c)).toEqual(['fd-pair']);
    expect(c.comboDraws[0]!.attrs.kicker).toBe(R.A);
  });

  it('OESD + pair and gutshot + pair', () => {
    expect(comboIds(cls('9h6d', '9s 8d 7c'))).toEqual(['oesd-pair']);
    expect(comboIds(cls('Kh9d', 'Ks Qd Jc'))).toEqual(['gutshot-pair']);
  });

  it('two pair is not "+ par"', () => {
    const c = cls('9h8h', '9s 8d 7c');
    expect(c.made).toBe('two-pair');
    expect(comboIds(c)).toEqual([]);
  });
});
