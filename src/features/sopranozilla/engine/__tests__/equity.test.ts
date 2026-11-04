import { describe, expect, it } from 'vitest';
import { parseCards, type CardId } from '../cards';
import {
  activeCombos,
  COMBO_COUNT,
  comboCards,
  comboId,
  removeBlocked,
  weightsFromHandRange,
  type ComboId,
} from '../combos';
import { deadCardsOf } from '../cards';
import {
  buildSpotRunouts,
  comboOutcome,
  computeEqCombos,
  EqComboCache,
  equityVsRange,
  missingCombos,
  newEqComboTable,
  spotKey,
} from '../equity';
import { refScoreBest } from './referenceEvaluator';
import { mulberry32 } from './rng';

function cards(text: string): CardId[] {
  const out = parseCards(text);
  if (!out) throw new Error(`bad cards: ${text}`);
  return out;
}

function combo(text: string): ComboId {
  const [a, b] = cards(text);
  return comboId(a!, b!);
}

describe('equity — values counted by hand', () => {
  it('river: a royal flush wins against everything', () => {
    const spot = buildSpotRunouts(cards('AhKh'), cards('Qh Jh Th 2c 3d'));
    const o = comboOutcome(spot, combo('AsAd'))!;
    expect(o).toEqual({ win: 1, tie: 0, lose: 0, total: 1 });
  });

  it('river: same straight on board is a tie (0.5)', () => {
    const spot = buildSpotRunouts(cards('2c3d'), cards('9h Ts Jc Qd Kh'));
    const o = comboOutcome(spot, combo('4c5d'))!;
    expect(o).toEqual({ win: 0, tie: 1, lose: 0, total: 1 });
  });

  it('turn: AA vs set of kings has exactly 2 outs of 44 rivers', () => {
    // Hero AhAd, board Ks 7c 2d 3h, villain KcKd. Only As/Ac win (AAA > KKK).
    const spot = buildSpotRunouts(cards('AhAd'), cards('Ks 7c 2d 3h'));
    const o = comboOutcome(spot, combo('KcKd'))!;
    expect(o).toEqual({ win: 2, tie: 0, lose: 42, total: 44 });
  });

  it('flop: AA vs set of kings wins 85 of 990 runouts', () => {
    // Hero AhAd, flop Ks 7c 2d, villain KcKd. Runouts with an ace (As/Ac):
    // 1 with both + 2·43 with one = 87; minus {A, Kh} where villain makes
    // quads (2) = 85. No straights or flushes are possible.
    const spot = buildSpotRunouts(cards('AhAd'), cards('Ks 7c 2d'));
    const o = comboOutcome(spot, combo('KcKd'))!;
    expect(o).toEqual({ win: 85, tie: 0, lose: 905, total: 990 });
  });

  it('blocked combos are excluded', () => {
    const spot = buildSpotRunouts(cards('AhAd'), cards('Ks 7c 2d'));
    expect(comboOutcome(spot, combo('AhKh'))).toBeNull();
    expect(comboOutcome(spot, combo('KsQs'))).toBeNull();
  });

  it('rejects malformed spots', () => {
    expect(() => buildSpotRunouts(cards('AhAd'), cards('Ks 7c'))).toThrow();
    expect(() => buildSpotRunouts(cards('AhAd'), cards('Ah 7c 2d'))).toThrow();
  });
});

describe('equity — cross-check against the reference evaluator', () => {
  it('matches a naive enumeration on random flops, turns and rivers', () => {
    const rand = mulberry32(42);
    for (const boardSize of [3, 4, 5]) {
      for (let trial = 0; trial < 4; trial++) {
        const deck = Array.from({ length: 52 }, (_, i) => i).sort(() => rand() - 0.5);
        const hero = deck.slice(0, 2);
        const board = deck.slice(2, 2 + boardSize);
        const villain = deck.slice(2 + boardSize, 4 + boardSize) as [number, number];
        const rest = deck.slice(4 + boardSize);

        let win = 0;
        let tie = 0;
        let total = 0;
        const need = 5 - boardSize;
        const runouts: number[][] =
          need === 0
            ? [[]]
            : need === 1
              ? rest.map((c) => [c])
              : rest.flatMap((c, i) => rest.slice(i + 1).map((d) => [c, d]));
        for (const r of runouts) {
          const h = refScoreBest([...hero, ...board, ...r]);
          const v = refScoreBest([...villain, ...board, ...r]);
          total++;
          if (h > v) win++;
          else if (h === v) tie++;
        }
        const o = comboOutcome(buildSpotRunouts(hero, board), comboId(villain[0], villain[1]))!;
        expect(o.win).toBe(win);
        expect(o.tie).toBe(tie);
        expect(o.total).toBe(total);
      }
    }
  }, 60_000);
});

describe('equity — invariants', () => {
  const hero = cards('JhTh');
  const board = cards('9h 8c 2h');
  const weights = weightsFromHandRange('22+, A2s+, KTs+, QTs+, JTs, T9s, 98s, ATo+, KJo+');
  const spot = buildSpotRunouts(hero, board);
  const dead = deadCardsOf([...hero, ...board]);
  const live = activeCombos(removeBlocked(weights, dead));

  it('every valid combo faces the same number of runouts (990 on the flop)', () => {
    for (const id of live) expect(comboOutcome(spot, id)!.total).toBe(990);
  });

  it('eqHero + eqVillain = 100% for every combo', () => {
    for (const id of live.slice(0, 40)) {
      const o = comboOutcome(spot, id)!;
      const [v1, v2] = comboCards(id);
      // Swap seats: the villain combo becomes Hero, Hero becomes the villain.
      const swapped = comboOutcome(buildSpotRunouts([v1, v2], board), comboId(hero[0]!, hero[1]!))!;
      expect(swapped.win).toBe(o.lose);
      expect(swapped.tie).toBe(o.tie);
      const eqHero = (o.win + o.tie / 2) / o.total;
      const eqVillain = (swapped.win + swapped.tie / 2) / swapped.total;
      expect(eqHero + eqVillain).toBeCloseTo(1, 12);
    }
  });

  it('no combo used shares a card with Hero or the board', () => {
    const table = computeEqCombos(spot, activeCombos(weights));
    for (let id = 0; id < COMBO_COUNT; id++) {
      const [a, b] = comboCards(id);
      const blocked = dead[a] === 1 || dead[b] === 1;
      if (blocked) expect(Number.isNaN(table[id])).toBe(true);
    }
  });

  it('weights stay in [0, 1]', () => {
    for (let id = 0; id < COMBO_COUNT; id++) {
      expect(weights[id]).toBeGreaterThanOrEqual(0);
      expect(weights[id]).toBeLessThanOrEqual(1);
    }
  });

  it('equity vs range = weighted average of eqCombo = direct weighted enumeration', () => {
    const half = new Float64Array(weights);
    for (let id = 0; id < COMBO_COUNT; id += 3) half[id] = (half[id] ?? 0) * 0.5;
    const table = computeEqCombos(spot, activeCombos(half));
    const fast = equityVsRange(table, half, hero, board);

    let num = 0;
    let den = 0;
    for (const id of activeCombos(half)) {
      const o = comboOutcome(spot, id);
      if (!o) continue;
      const w = half[id]!;
      num += w * (o.win + o.tie / 2);
      den += w * o.total;
    }
    expect(fast.missing).toBe(0);
    expect(fast.hero).toBeCloseTo(num / den, 12);
    expect(fast.hero).toBeGreaterThan(0);
    expect(fast.hero).toBeLessThan(1);
  });

  it('reports missing combos until they are computed', () => {
    const table = newEqComboTable();
    expect(missingCombos(table, weights, hero, board)).toHaveLength(live.length);
    expect(equityVsRange(table, weights, hero, board).missing).toBe(live.length);
    computeEqCombos(spot, live, table);
    expect(missingCombos(table, weights, hero, board)).toHaveLength(0);
  });
});

describe('EqComboCache', () => {
  it('keys spots independently of card order', () => {
    expect(spotKey(cards('AhKd'), cards('2c 7d Ks'))).toBe(
      spotKey(cards('KdAh'), cards('Ks 2c 7d')),
    );
  });

  it('reuses tables per spot and evicts the least recently used', () => {
    const cache = new EqComboCache(2);
    const a = cache.table(cards('AhKd'), cards('2c 7d Ks'));
    a[0] = 0.5;
    cache.table(cards('AhKd'), cards('2c 7d Kh'));
    expect(cache.table(cards('KdAh'), cards('Ks 7d 2c'))).toBe(a); // touch a
    cache.table(cards('AhKd'), cards('2c 7d Kc')); // evicts the Kh spot
    expect(cache.size).toBe(2);
    expect(cache.has(cards('AhKd'), cards('2c 7d Ks'))).toBe(true);
    expect(cache.has(cards('AhKd'), cards('2c 7d Kh'))).toBe(false);
  });
});
