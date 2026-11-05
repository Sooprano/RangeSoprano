import { describe, expect, it } from 'vitest';
import { parseRangeText } from '../../engine/rangeText';
import data from '../spins-regular.json';
import fishData from '../spins-fish.json';
import {
  bandText,
  buildSpinsCatalog,
  inBand,
  parseFishName,
  parseSpinsName,
} from '../spinsCatalog';

const catalog = buildSpinsCatalog(data);
const byName = (group: string, name: string) =>
  catalog.find((r) => r.group === group && r.name === name)!;

describe('spins Regular catalog', () => {
  it('every bundled range name parses (none left out)', () => {
    const all = data.groups.flatMap((g) => g.ranges.map((r) => `${g.name}/${r.name}`));
    const missing = all.filter((id) => !catalog.some((r) => r.id === id));
    expect(missing).toEqual([]);
    expect(catalog).toHaveLength(272);
  });

  it('reads the folders and the names as the user named them', () => {
    expect(parseSpinsName('BU 3H', 'BU OR 25bb')).toEqual({
      format: '3H',
      position: 'BTN',
      vs: null,
      action: 'open',
      stackBb: 25,
      size: null,
    });
    expect(parseSpinsName('BU 3H', 'BU OS 12bb')).toMatchObject({ action: 'shove', size: 'AI' });
    expect(parseSpinsName('BB vs BU 3H', 'BBvsBU 18bb call')).toMatchObject({
      format: '3H',
      position: 'BB',
      action: 'call-open',
      stackBb: 18,
      size: null,
    });
    expect(parseSpinsName('SB vs BB 3H', '25bb or 3bb')).toMatchObject({
      position: 'SB',
      action: 'open',
      size: 3,
    });
    expect(parseSpinsName('SB vs BB 3H', '13bb MR')).toMatchObject({ action: 'open', size: 2 });
    expect(parseSpinsName('SB vs BB 3H', '20bb limp')).toMatchObject({ action: 'limp' });
    expect(parseSpinsName('BB vs SB 3H', '16bb X')).toMatchObject({
      position: 'BB',
      action: 'check',
    });
    expect(parseSpinsName('BB vs SB 3H', '20bb call 2.5bb')).toMatchObject({
      action: 'call-open',
      size: 2.5,
    });
    expect(parseSpinsName('SBHU', 'SBHU 30bb OR 2.5bb')).toMatchObject({
      format: 'HU',
      position: 'BTN',
      action: 'open',
      stackBb: 30,
      size: 2.5,
    });
    expect(parseSpinsName('SBHU', 'SBHU 13bb LP')).toMatchObject({ action: 'limp' });
    expect(parseSpinsName('SBHU', 'SBHU 13bb OS')).toMatchObject({ action: 'shove' });
    expect(parseSpinsName('SBHU Call vs ROL', 'SBHU 25bb callvsRol 4.5bb')).toMatchObject({
      action: 'call-rol',
      size: 4.5,
    });
    expect(parseSpinsName('BBHU VS LP', 'BBHU 25bb ROL AI')).toMatchObject({
      position: 'BB',
      action: 'rol',
      size: 'AI',
    });
    expect(parseSpinsName('BBHU VS LP', 'BBHU 11bb RIK 2.5bb')).toMatchObject({
      action: 'rol',
      size: 2.5,
    });
    expect(parseSpinsName('BBHU VS LP', 'BBHU 9bb X')).toMatchObject({ action: 'check' });
    expect(parseSpinsName('BBHU VS OR', 'BBHU 16bb 3B 4.25bb')).toMatchObject({
      action: '3bet',
      size: 4.25,
    });
    expect(parseSpinsName('BBHU VS OR', 'BBHU 16bb CALL')).toMatchObject({
      action: 'call-open',
      size: null,
    });
    expect(parseSpinsName('BBHU VS OR', 'BBHU 16bb 4B AI')).toBeNull();
    expect(parseSpinsName('Otra carpeta', 'BU OR 25bb')).toBeNull();
  });

  it('every range reads back with the combos the build script counted', () => {
    for (const r of catalog) {
      const { weights, errors } = parseRangeText(r.range);
      expect(errors, r.id).toEqual([]);
      let sum = 0;
      for (let i = 0; i < weights.length; i++) sum += weights[i] ?? 0;
      expect(sum, r.id).toBeCloseTo(r.combos, 2);
    }
  });

  it('keeps the exact weights: BU OR 25bb plays K8o 53.095 % of the time', () => {
    const { weights } = parseRangeText(byName('BU 3H', 'BU OR 25bb').range);
    const k8o = parseRangeText('Kh8d').weights.findIndex((w) => w > 0);
    expect(weights[k8o]).toBeCloseTo(0.53095, 5);
  });
});

describe('spins FISH catalog (D137)', () => {
  const fishCatalog = buildSpinsCatalog(fishData, 'fish');
  const fishRange = (group: string, name: string) =>
    fishCatalog.find((r) => r.group === group && r.name === name)!;

  it('every bundled FISH range parses: 26 of the export + 7 for the BU + the SB vs BU call', () => {
    const all = fishData.groups.flatMap((g) => g.ranges.map((r) => `${g.name}/${r.name}`));
    expect(fishCatalog.map((r) => r.id)).toEqual(all);
    expect(fishCatalog).toHaveLength(35);
    expect(fishCatalog.every((r) => r.rival === 'fish')).toBe(true);
  });

  it('reads stack bands and size bands from the names', () => {
    expect(parseFishName('FISH HU SB', 'MNR 16-20')).toMatchObject({
      format: 'HU',
      position: 'BTN',
      action: 'open',
      band: { min: 16, max: 20 },
      sizeBand: { min: 0, max: 2.25 },
    });
    expect(parseFishName('FISH 3wSBvBB', '3x 10+')).toMatchObject({
      position: 'SB',
      vs: 'BB',
      band: { min: 10, max: null },
      sizeBand: { min: 2.25, max: 3.5 },
    });
    expect(parseFishName('FISH HU SB', 'CALL vs 3Bet NAI')).toMatchObject({
      action: 'call-3bet',
      band: { min: 0, max: null },
    });
    expect(parseFishName('FISH 3wBBvSB', 'CALL vs 2,5-3X 16+')).toMatchObject({
      action: 'call-open',
      band: { min: 16, max: null },
      sizeBand: { min: 2.25, max: 3.5 },
    });
    expect(parseFishName('FISH 3w SBvBU', 'CALL vs OR 18+')).toMatchObject({
      format: '3H',
      position: 'SB',
      vs: 'BTN',
      action: 'call-open',
      band: { min: 18, max: null },
    });
    expect(parseFishName('FISH 3wBBvSB', 'CHECK vs LIMP 10+')).toMatchObject({ action: 'check' });
    expect(parseFishName('FISH HU BB', 'ISO v LIMP 10+')).toMatchObject({ action: 'rol' });
    expect(parseFishName('FISH 3wSBvBB', 'OS 10-16')).toMatchObject({
      action: 'shove',
      size: 'AI',
    });
    expect(parseFishName('FISH HU SB', 'RAISE 20+')).toBeNull();
    expect(parseFishName('BU 3H', 'MNR 20+')).toBeNull();
  });

  it('the lower bound is in the band: 20bb → 20+, 19.99bb → 16-20', () => {
    expect(inBand({ min: 20, max: null }, 20)).toBe(true);
    expect(inBand({ min: 16, max: 20 }, 20)).toBe(false);
    expect(inBand({ min: 16, max: 20 }, 19.99)).toBe(true);
    expect(inBand({ min: 10, max: 16 }, 9.99)).toBe(false);
    expect(bandText({ min: 16, max: 20 })).toBe('16-20');
    expect(bandText({ min: 20, max: null })).toBe('20+');
  });

  it('the 3H BU has the heads-up button ranges, with LIMP 20+ doubled (capped at 100 %)', () => {
    const names = (g: string) => fishCatalog.filter((r) => r.group === g).map((r) => r.name);
    expect(names('FISH 3H BU')).toEqual(names('FISH HU SB'));
    expect(fishRange('FISH 3H BU', 'MNR 20+').range).toBe(fishRange('FISH HU SB', 'MNR 20+').range);
    const hu = parseRangeText(fishRange('FISH HU SB', 'LIMP 20+').range).weights;
    const bu = parseRangeText(fishRange('FISH 3H BU', 'LIMP 20+').range).weights;
    for (let i = 0; i < hu.length; i++) {
      expect(bu[i] ?? 0, String(i)).toBeCloseTo(Math.min(1, 2 * (hu[i] ?? 0)), 6);
    }
    expect(fishRange('FISH 3H BU', 'LIMP 20+').combos / 1326).toBeCloseTo(0.501, 3);
  });

  it('every FISH range reads in the app with the combos the script counted', () => {
    for (const r of fishCatalog) {
      const { weights, errors } = parseRangeText(r.range);
      expect(errors, r.id).toEqual([]);
      let sum = 0;
      for (let i = 0; i < weights.length; i++) sum += weights[i] ?? 0;
      expect(sum, r.id).toBeCloseTo(r.combos, 2);
    }
    // The SB vs BU calls the user sent by hand.
    expect(fishRange('FISH 3w SBvBU', 'CALL vs OR 18+').combos).toBeCloseTo(560.9, 1);
    expect(fishRange('FISH 3w SBvBU', 'CALL vs OR 14-18').combos).toBeCloseTo(431.7, 1);
  });
});
