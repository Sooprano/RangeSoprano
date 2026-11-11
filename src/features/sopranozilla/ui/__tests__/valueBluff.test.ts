import { describe, expect, it } from 'vitest';
import type { StreetView } from '../../engine/chain';
import { COMBO_COUNT, combosOfClass } from '../../engine/combos';
import { bluffsNeeded, valueBluffCells, valueBluffSummary, vbKindOf } from '../valueBluff';
import { potOddsNeeded } from '../../engine/ev';

const view = { liveMask: new Uint8Array(COMBO_COUNT).fill(1) } as unknown as StreetView;

describe('valor / farol (D140)', () => {
  it('river: beats Hero = value, loses = bluff, chop = tie', () => {
    expect(vbKindOf(0, 'river')).toBe('value');
    expect(vbKindOf(1, 'river')).toBe('bluff');
    expect(vbKindOf(0.5, 'river')).toBe('tie');
    expect(vbKindOf(Number.NaN, 'river')).toBeNull();
  });

  it('flop / turn: by Hero equity (< 35 % behind, > 65 % ahead)', () => {
    expect(vbKindOf(0.2, 'turn')).toBe('value');
    expect(vbKindOf(0.5, 'turn')).toBe('tie');
    expect(vbKindOf(0.8, 'flop')).toBe('bluff');
  });

  it('the user example: 100 value combos and a pot-size bet need 50 bluffs', () => {
    const need = potOddsNeeded(1, 1); // 1 / 3
    expect(bluffsNeeded({ value: 100, tie: 0 }, need)).toBeCloseTo(50, 6);
    // Half a pot: 25 % → 33.3 bluffs.
    expect(bluffsNeeded({ value: 100, tie: 0 }, potOddsNeeded(1, 0.5))).toBeCloseTo(33.33, 2);
    // Ties count half for Hero: 10 chops lower what is needed.
    expect(bluffsNeeded({ value: 100, tie: 10 }, need)).toBeCloseTo(47.5, 6);
    expect(bluffsNeeded({ value: 0, tie: 10 }, need)).toBe(0);
  });

  it('sums the weighted combos per group and leaves blocked / pending ones out', () => {
    const w = new Float64Array(COMBO_COUNT);
    const eq = new Float64Array(COMBO_COUNT).fill(Number.NaN);
    const [a, b, c, d] = combosOfClass('AKs');
    w[a!] = 1;
    eq[a!] = 0; // value
    w[b!] = 0.5;
    eq[b!] = 1; // bluff
    w[c!] = 1;
    eq[c!] = 0.5; // tie
    w[d!] = 1; // still computing
    const live = new Uint8Array(COMBO_COUNT).fill(1);
    const [e] = combosOfClass('QQ');
    w[e!] = 1;
    eq[e!] = 0;
    live[e!] = 0; // blocked by the board
    const v = { liveMask: live } as unknown as StreetView;
    expect(valueBluffSummary(v, w, eq, 'river')).toEqual({
      value: 1,
      tie: 1,
      bluff: 0.5,
      pending: 1,
    });
    // Per cell: share of the class's live combos.
    expect(valueBluffCells(v, w, eq, 'river').get('AKs')).toEqual({
      value: 0.25,
      tie: 0.25,
      bluff: 0.125,
    });
    expect(valueBluffSummary(view, w, null, 'river').pending).toBe(4.5);
  });
});

describe('the words depend on who bets (D146)', () => {
  it('villain bets → valor / farol; Hero bets → what calls him; else showdown', async () => {
    const { vbLabels } = await import('../valueBluff');
    expect(vbLabels('villain-bet', 'river')).toEqual({
      value: 'Valor',
      tie: 'Empate',
      bluff: 'Farol',
    });
    expect(vbLabels('hero-bet', 'river')).toEqual({
      value: 'Te paga y te gana',
      tie: 'Te paga y empata',
      bluff: 'Te paga y pierde',
    });
    expect(vbLabels('showdown', 'river').value).toBe('Te gana');
    expect(vbLabels('hero-bet', 'turn').value).toBe('Te va ganando');
  });
});
