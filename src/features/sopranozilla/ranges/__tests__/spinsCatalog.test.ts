import { describe, expect, it } from 'vitest';
import { parseRangeText } from '../../engine/rangeText';
import data from '../spins-regular.json';
import { buildSpinsCatalog, parseSpinsName } from '../spinsCatalog';

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
