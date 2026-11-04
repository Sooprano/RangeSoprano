import { describe, expect, it } from 'vitest';
import { SAMPLE_RANGES } from '@/data/sampleRanges';
import { parseCards } from '../../engine/cards';
import { streetView, type ChainInput } from '../../engine/chain';
import { comboId, formatCombo, totalWeight } from '../../engine/combos';
import { parseRangeText } from '../../engine/rangeText';
import { fullActionRow } from '../../engine/weights';
import { defaultStreetState } from '../../store/analyzerStore';
import { actionShares, chosenWeights, defaultActionIds, rangeToText } from '../rangeLibrary';
import { buildTestHand, DEFAULT_TEST_HAND } from '../testHand';
import { classCombos, filterComboBreakdown, onlySuitEntries } from '../viewModel';

const built = buildTestHand(DEFAULT_TEST_HAND);
if (!built.ok) throw new Error('default test hand must build');

function flopView() {
  const input: ChainInput = {
    hand: built.ok ? built.hand : (undefined as never),
    villainPreflop: built.ok ? built.villain : (undefined as never),
    streets: {
      flop: defaultStreetState('flop'),
      turn: defaultStreetState('turn'),
      river: defaultStreetState('river'),
    },
    filters: [],
  };
  return streetView(input, 'flop')!;
}

const id = (text: string) => {
  const [a, b] = parseCards(text)!;
  return comboId(a!, b!);
};

describe('4×4 suit picker', () => {
  const view = flopView();

  it('lays out a pair on the upper triangle and explains each weight', () => {
    // K♥ 9♥ 4♣: 88 is PP < 2nd card; the 8♥ combos also have BDFD 1 carta.
    const row = fullActionRow();
    row.cats['pp-below-second'] = { s: 'follow', w: 50 };
    row.cats['bdfd-1'] = { s: 'follow', w: 100 };
    const cont = new Float64Array(view.start).map((w, i) =>
      i === id('8h8s') ? w : i === id('8d8c') ? w * 0.5 : w,
    );
    const cells = classCombos(view, cont, row, '88', []);
    expect(cells).toHaveLength(6);
    for (const c of cells) expect(c.rowSuit).toBeLessThan(c.colSuit);
    const hs = cells.find((c) => c.combo === id('8h8s'))!;
    expect(hs.label).toBe('8♠8♥');
    expect(hs.reason).toBe('por: BDFD 1 carta');
    expect(cells.find((c) => c.combo === id('8d8c'))!.reason).toBe('por: PP < 2nd card');
  });

  it('marks combos blocked by Hero or the board', () => {
    const cells = classCombos(view, view.start, fullActionRow(), 'AKs', []);
    const blocked = cells.filter((c) => c.blocked).map((c) => c.label);
    expect(blocked.sort()).toEqual(['A♠K♠', 'A♥K♥']);
  });

  it('"solo ♥" keeps heart combos on their rows and zeroes the rest', () => {
    const cells = classCombos(view, view.start, fullActionRow(), '88', []);
    const entries = onlySuitEntries(cells, 1);
    const kept = entries.filter((e) => e.weight === null).map((e) => e.combo);
    expect(kept.sort()).toEqual([id('8h8s'), id('8h8d'), id('8h8c')].sort());
    expect(entries.filter((e) => e.weight === 0)).toHaveLength(3);
  });
});

describe('range library', () => {
  const range = SAMPLE_RANGES[0]!;

  it('lists actions with their share of hands', () => {
    const shares = actionShares(range);
    expect(shares.length).toBeGreaterThan(0);
    for (const s of shares) {
      expect(s.share).toBeGreaterThanOrEqual(0);
      expect(s.share).toBeLessThanOrEqual(1);
    }
  });

  it('turns the chosen actions into text that reads back the same', () => {
    const ids = defaultActionIds(range);
    const text = rangeToText(range, ids);
    const back = parseRangeText(text);
    expect(back.errors).toEqual([]);
    const expected = chosenWeights(range, ids).reduce(
      (sum, { hand, weight }) =>
        sum + (weight / 100) * (hand.length === 2 ? 6 : hand.endsWith('s') ? 4 : 12),
      0,
    );
    expect(totalWeight(back.weights)).toBeCloseTo(expected, 6);
  });
});

describe('filter builder: suits that pass (D108)', () => {
  it('on Kh9h4c, «BDFD 2 cartas» keeps only Q♣5♣ of Q5s', () => {
    const view = flopView();
    const cells = filterComboBreakdown(view, { type: 'leaf', category: 'bdfd-2' }, [], 'Q5s');
    expect(cells).toHaveLength(4);
    const passing = cells.filter((c) => c.passes).map((c) => formatCombo(c.combo));
    expect(passing).toEqual([formatCombo(id('Qc5c'))]);
    expect(cells.every((c) => !c.blocked && c.weight > 0)).toBe(true);
  });

  it('marks combos blocked by the board and by Hero (A♠K♠)', () => {
    const cells = filterComboBreakdown(flopView(), null, [], 'K9s');
    const blocked = cells.filter((c) => c.blocked).map((c) => formatCombo(c.combo)).sort();
    expect(blocked).toEqual([formatCombo(id('Kh9h')), formatCombo(id('Ks9s'))].sort());
    expect(cells.some((c) => c.passes)).toBe(false);
  });
});
