import { describe, expect, it } from 'vitest';
import { parseCards } from '../cards';
import { comboId, combosOfClass, emptyWeights, totalWeight } from '../combos';
import { exportRange, rangeToSavedText } from '../rangeExport';
import { parseRangeText } from '../rangeText';

const id = (s: string) => {
  const c = parseCards(s)!;
  return comboId(c[0]!, c[1]!);
};

describe('exportRange', () => {
  it('whole classes collapse; flopzilla tags are integers', () => {
    const w = parseRangeText('QQ+, [50]AKs[/50]').weights;
    expect(exportRange(w, 'flopzilla')).toBe('QQ+,[50]AKs[/50]');
    expect(exportRange(w, 'notation')).toBe('QQ+,[50%]AKs[/50%]');
  });

  it('a class split by suit goes combo by combo', () => {
    const w = emptyWeights();
    w[id('AhKh')] = 1;
    w[id('AsKs')] = 0.5;
    const fz = exportRange(w, 'flopzilla');
    expect(fz).toContain('AhKh');
    expect(fz).toContain('[50]AsKs[/50]');
    expect(fz).not.toContain('AKs');
  });

  it('gtowizard lists every combo as a fraction', () => {
    const w = parseRangeText('AA').weights;
    const out = exportRange(w, 'gtowizard');
    expect(out.split(',')).toHaveLength(6);
    expect(out).toMatch(/A[cdhs]A[cdhs]: 1/);
  });

  it('blocked combos do not break a class', () => {
    const w = parseRangeText('AKs').weights;
    const live = new Uint8Array(1326).fill(1);
    w[id('AsKs')] = 0;
    live[id('AsKs')] = 0;
    expect(exportRange(w, 'flopzilla', live)).toBe('AKs');
  });
});

describe('parseRangeText reads combos exactly', () => {
  it('solver list keeps the suits', () => {
    const r = parseRangeText('AhKh: 1,AsKs: 0.5');
    expect(r.errors).toEqual([]);
    expect(r.weights[id('AhKh')]).toBe(1);
    expect(r.weights[id('AsKs')]).toBe(0.5);
    expect(r.weights[id('AdKd')]).toBe(0);
  });

  it('bracketed and plain combos mix with classes', () => {
    const r = parseRangeText('QQ, [25]AhKh, AdKd[/25], KcQc');
    expect(r.errors).toEqual([]);
    expect(r.weights[id('AhKh')]).toBe(0.25);
    expect(r.weights[id('AdKd')]).toBe(0.25);
    expect(r.weights[id('KcQc')]).toBe(1);
    expect(totalWeight(r.weights)).toBeCloseTo(6 + 0.5 + 1, 10);
  });

  it('saved text round-trips exactly', () => {
    const w = parseRangeText('22+, [33.33]AKo[/33.33], AhQh: 0.4').weights;
    w[combosOfClass('JTs')[0]!] = 0.75;
    const back = parseRangeText(rangeToSavedText(w));
    expect(back.errors).toEqual([]);
    for (let i = 0; i < 1326; i++) expect(back.weights[i]).toBeCloseTo(w[i]!, 6);
  });
});
