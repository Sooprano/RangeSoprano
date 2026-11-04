import { describe, expect, it } from 'vitest';
import { combosOfClass, totalWeight } from '../combos';
import { parseRangeText } from '../rangeText';
import { DEFAULT_TEST_HAND } from '../../ui/testHand';

describe('range text', () => {
  it('reads the "hand:weight" shorthand', () => {
    const r = parseRangeText('QQ:50, AKs, A7o-A5o:50');
    expect(r.errors).toEqual([]);
    expect(totalWeight(r.weights)).toBeCloseTo(6 * 0.5 + 4 + 3 * 12 * 0.5, 10);
  });

  it('fractions with a decimal point are fractions', () => {
    const r = parseRangeText('QQ:0.5, KK:1');
    // "KK:1" has no decimal point → 1%.
    expect(totalWeight(r.weights)).toBeCloseTo(3 + 0.06, 10);
  });

  it('keeps the bracket form and plain lists working', () => {
    const r = parseRangeText('22+, [50]QJs, JTs[/50]');
    expect(r.errors).toEqual([]);
    expect(totalWeight(r.weights)).toBeCloseTo(78 + 4, 10);
  });

  it('reads the default test range without errors', () => {
    const r = parseRangeText(DEFAULT_TEST_HAND.range);
    expect(r.errors).toEqual([]);
    const w = (hand: string) => r.weights[combosOfClass(hand)[0]!];
    expect(w('JJ')).toBe(1);
    expect(w('QQ')).toBe(0.5);
    expect(w('KK')).toBe(0);
    expect(w('AQs')).toBe(0.5);
    expect(w('AKs')).toBe(0);
    expect(w('A5o')).toBe(0.5);
    expect(w('K8o')).toBe(0.5);
    expect(w('T8o')).toBe(1);
    expect(w('T7o')).toBe(0);
    expect(w('42s')).toBe(1);
    expect(w('32s')).toBe(0);
  });
});
