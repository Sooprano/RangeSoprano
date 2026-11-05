import { describe, expect, it } from 'vitest';
import { parseRangeText } from '../../engine/rangeText';
import { pickCashRange } from '../../adapters/cashPick';
import data from '../cash-gto.json';
import { buildCashCatalog, demoComplement, parseCashName } from '../cashCatalog';

const catalog = buildCashCatalog(data);

describe('cash GTO catalog (D138)', () => {
  it('every range of the user export parses (93) and the demo adds 12', () => {
    const all = data.groups.flatMap((g) => g.ranges.map((r) => `${g.name}/${r.name}`));
    const gto = catalog.filter((r) => r.source === 'gto').map((r) => r.id);
    expect(gto).toEqual(all);
    expect(gto).toHaveLength(93);
    expect(demoComplement().map((r) => r.name)).toEqual([
      'UTG open 2bb',
      'HJ open 2bb',
      'CO open 2.3bb',
      'BB call vs UTG (open 2bb)',
      'BB call vs HJ (open 2bb)',
      'BB call vs CO (open 2.3bb)',
      'BB call vs SB (open 3bb)',
      'BTN call cold vs UTG (open 2bb)',
      'SB call cold vs UTG (open 2bb)',
      'BTN call cold vs HJ (open 2bb)',
      'SB call cold vs HJ (open 2bb)',
      'BTN call cold vs CO (open 2.3bb)',
    ]);
  });

  it('reads the names as the user exported them (MP = HJ, UTB = UTG, «v», case)', () => {
    expect(parseCashName('CO Or2.5')).toEqual({
      position: 'CO',
      vs: null,
      action: 'open',
      size: 2.5,
    });
    expect(parseCashName('SB OR3x')).toMatchObject({ action: 'open', size: 3 });
    expect(parseCashName('SBvsMP 3Bet 12bb')).toEqual({
      position: 'SB',
      vs: 'HJ',
      action: '3bet',
      size: 12,
    });
    expect(parseCashName('BBvsSB 3Bet')).toMatchObject({ action: '3bet', size: null });
    expect(parseCashName('COvsBTN callvs3Bet 7.5bb')).toMatchObject({
      action: 'call-3bet',
      size: 7.5,
    });
    expect(parseCashName('UTBvsBB 4bet All in')).toEqual({
      position: 'UTG',
      vs: 'BB',
      action: '4bet',
      size: 'AI',
    });
    expect(parseCashName('BTNvsSB 4Bet 26bb Allin')).toMatchObject({ size: 'AI' });
    expect(parseCashName('UTGvsBB 4bet22bb')).toMatchObject({ action: '4bet', size: 22 });
    expect(parseCashName('BTNvUTG call4Bet All in')).toMatchObject({
      position: 'BTN',
      vs: 'UTG',
      action: 'call-4bet',
      size: 'AI',
    });
    expect(parseCashName('BBvsUTG call4Bet AI')).toMatchObject({ size: 'AI' });
    expect(parseCashName('SBvsUTG call 4Bet 21bb')).toMatchObject({
      action: 'call-4bet',
      size: 21,
    });
    expect(parseCashName('BTNvsCO call cold')).toMatchObject({ action: 'call-open', size: 2.5 });
    expect(parseCashName('BBvsBTN CC')).toMatchObject({ action: 'call-open', vs: 'BTN' });
    expect(parseCashName('BTN limp')).toBeNull();
  });

  it('every range reads in the app with the combos the script counted', () => {
    for (const r of catalog) {
      const { weights, errors } = parseRangeText(r.range);
      expect(errors, r.id).toEqual([]);
      let sum = 0;
      for (let i = 0; i < weights.length; i++) sum += weights[i] ?? 0;
      expect(sum, r.id).toBeCloseTo(r.combos, 2);
    }
  });

  it('the closest size wins, a tie takes the lower; all-in only all-in', () => {
    const open = (position: 'UTG' | 'CO', size: number) =>
      pickCashRange(catalog, { position, vs: null, action: 'open', size })?.range.name;
    expect(open('UTG', 2.1)).toBe('UTG open 2bb');
    expect(open('UTG', 2.25)).toBe('UTG open 2bb');
    expect(open('UTG', 3)).toBe('UTG Or 2.5');
    expect(open('CO', 2.4)).toBe('CO open 2.3bb');
    expect(open('CO', 2.45)).toBe('CO Or2.5');
    const fourBet = (size: number | 'AI') =>
      pickCashRange(catalog, { position: 'CO', vs: 'BTN', action: '4bet', size })?.range.name;
    expect(fourBet(25)).toBe('COvsBTN 4Bet 22bb');
    expect(fourBet('AI')).toBeUndefined();
    const bbCall = (size: number) =>
      pickCashRange(catalog, { position: 'BB', vs: 'UTG', action: 'call-open', size })?.range.name;
    expect(bbCall(2)).toBe('BB call vs UTG (open 2bb)');
    expect(bbCall(3)).toBe('BBvsUTG CC');
  });
});
