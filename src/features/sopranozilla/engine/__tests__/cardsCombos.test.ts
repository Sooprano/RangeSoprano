import { describe, expect, it } from 'vitest';
import {
  deadCardsOf,
  formatCard,
  formatCardSymbol,
  fromCardId,
  liveCards,
  parseCard,
  parseCards,
  toCardId,
} from '../cards';
import {
  activeCombos,
  classOfCombo,
  COMBO_COUNT,
  comboCards,
  comboId,
  combosOfClass,
  formatCombo,
  isComboBlocked,
  removeBlocked,
  totalWeight,
  weightsFromClassWeights,
  weightsFromHandRange,
  weightsFromRange,
} from '../combos';
import { ALL_HANDS } from '@/utils/handUtils';
import type { Range } from '@/types/poker';

describe('cards', () => {
  it('round-trips every card through text and the app Card type', () => {
    for (let id = 0; id < 52; id++) {
      expect(parseCard(formatCard(id))).toBe(id);
      expect(toCardId(fromCardId(id))).toBe(id);
    }
  });

  it('parses common notations', () => {
    expect(formatCard(parseCard('As')!)).toBe('As');
    expect(formatCard(parseCard('10h')!)).toBe('Th');
    expect(formatCard(parseCard('k♦')!)).toBe('Kd');
    expect(formatCardSymbol(parseCard('Qc')!)).toBe('Q♣');
    expect(parseCard('1s')).toBeNull();
    expect(parseCard('Ax')).toBeNull();
  });

  it('parses runs of cards and rejects repeats', () => {
    expect(parseCards('Ah Kd 2c')?.map(formatCard)).toEqual(['Ah', 'Kd', '2c']);
    expect(parseCards('AhKd10c')?.map(formatCard)).toEqual(['Ah', 'Kd', 'Tc']);
    expect(parseCards('AhAh')).toBeNull();
  });

  it('tracks dead and live cards', () => {
    const dead = deadCardsOf(parseCards('AhKd')!);
    expect(liveCards(dead)).toHaveLength(50);
  });
});

describe('combos', () => {
  it('enumerates 1326 distinct two-card combos with a symmetric index', () => {
    const seen = new Set<string>();
    for (let id = 0; id < COMBO_COUNT; id++) {
      const [a, b] = comboCards(id);
      expect(a).toBeLessThan(b);
      expect(comboId(a, b)).toBe(id);
      expect(comboId(b, a)).toBe(id);
      seen.add(`${a}-${b}`);
    }
    expect(seen.size).toBe(1326);
  });

  it('expands every class to 6 / 4 / 12 combos covering all 1326', () => {
    const all = new Set<number>();
    for (const hand of ALL_HANDS) {
      const combos = combosOfClass(hand);
      const expected = hand.length === 2 ? 6 : hand.endsWith('s') ? 4 : 12;
      expect(combos, hand).toHaveLength(expected);
      for (const id of combos) {
        expect(classOfCombo(id)).toBe(hand);
        all.add(id);
      }
    }
    expect(all.size).toBe(1326);
  });

  it('formats combos higher card first', () => {
    expect(formatCombo(comboId(parseCard('2c')!, parseCard('Ah')!))).toBe('Ah2c');
  });

  it('builds weights from class weights, text ranges and library ranges', () => {
    const w = weightsFromClassWeights({ AA: 100, AKs: 50 });
    expect(totalWeight(w)).toBe(6 + 2);

    const t = weightsFromHandRange('QQ+, [50]AKs[/50]');
    expect(totalWeight(t)).toBe(18 + 2);

    const range: Range = {
      id: 'r',
      name: 'test',
      position: 'BB',
      situation: 'DEFEND_BB',
      cells: {
        AKo: {
          hand: 'AKo',
          actions: [
            { action: 'CALL', weight: 60 },
            { action: 'RAISE', weight: 40 },
          ],
        },
        '22': { hand: '22', actions: [{ action: 'RAISE', weight: 100 }] },
      },
      createdAt: '',
      updatedAt: '',
      actions: [],
      tableFormat: '6max',
    };
    const calls = weightsFromRange(range, ['CALL']);
    expect(totalWeight(calls)).toBeCloseTo(12 * 0.6, 10);
    expect(totalWeight(weightsFromRange(range, ['CALL', 'RAISE']))).toBeCloseTo(12 + 6, 10);
  });

  it('removes combos blocked by dead cards', () => {
    const dead = deadCardsOf(parseCards('AhKs')!);
    const w = removeBlocked(weightsFromClassWeights({ AA: 100, AKo: 100 }), dead);
    // AA: 3 left (no Ah). AKo: (3 aces) x (3 kings) minus 2 suited (Ad Kd, Ac Kc) = 7.
    expect(totalWeight(w)).toBe(3 + 7);
    for (const id of activeCombos(w)) expect(isComboBlocked(id, dead)).toBe(false);
  });
});
