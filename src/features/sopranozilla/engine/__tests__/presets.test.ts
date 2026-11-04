import { describe, expect, it } from 'vitest';
import { DEFAULT_PRESETS } from '../../presets';
import { parsePresetFile } from '../../schemas/presets';
import { matchPreset, presetToActionRow } from '../presets';

describe('presets (§12)', () => {
  it('the default file validates: 7 "call" + 4 check-raise presets', () => {
    expect(DEFAULT_PRESETS.map((p) => p.id)).toEqual([
      'flop-call-25-45',
      'flop-call-55-100',
      'turn-call-40-60',
      'turn-call-60-100',
      'river-call-25-45',
      'river-call-50-80',
      'river-call-100-plus',
      'flop-raise-25-45',
      'flop-raise-55-100',
      'turn-raise-40-100',
      'river-raise-25-plus',
    ]);
  });

  it('matching: street + action + a sizing range that contains the bet', () => {
    const id = (s: Parameters<typeof matchPreset>[1], a: 'call' | 'raise', pct: number) =>
      matchPreset(DEFAULT_PRESETS, s, a, pct)?.id ?? null;
    expect(id('flop', 'call', 33)).toBe('flop-call-25-45');
    expect(id('flop', 'call', 25)).toBe('flop-call-25-45');
    expect(id('flop', 'call', 75)).toBe('flop-call-55-100');
    // Gaps of the table: no preset.
    expect(id('flop', 'call', 50)).toBeNull();
    expect(id('flop', 'call', 20)).toBeNull();
    expect(id('flop', 'call', 120)).toBeNull();
    // Overlapping bound: the first one in the file.
    expect(id('turn', 'call', 60)).toBe('turn-call-40-60');
    expect(id('river', 'call', 125)).toBe('river-call-100-plus');
    expect(id('river', 'call', 300)).toBe('river-call-100-plus');
    // Check-raise presets (approved in phase 6).
    expect(id('flop', 'raise', 33)).toBe('flop-raise-25-45');
    expect(id('turn', 'raise', 100)).toBe('turn-raise-40-100');
    expect(id('river', 'raise', 200)).toBe('river-raise-25-plus');
    expect(id('flop', 'raise', 50)).toBeNull();
  });

  it('a preset becomes an ordinary row: follow with a weight, ✗, or neutral', () => {
    const row = presetToActionRow(matchPreset(DEFAULT_PRESETS, 'flop', 'call', 33)!);
    expect(row.cats['top-pair']).toEqual({ s: 'follow', w: 100 });
    expect(row.cats['ace-high']).toEqual({ s: 'follow', w: 50 });
    expect(row.cats.nothing).toEqual({ s: 'exclude', w: 100 });
    expect(row.cats['gutshot-bdfd']).toEqual({ s: 'follow', w: 60 });
    expect(row.cats['fd-oesd']).toEqual({ s: 'follow', w: 100 });
    expect(row.cats.bdsd).toBeUndefined();
    expect(row.edited).toBe(false);

    const turn = presetToActionRow(matchPreset(DEFAULT_PRESETS, 'turn', 'call', 75)!);
    expect(turn.cats['pp-below-board']).toEqual({ s: 'exclude', w: 100 });
    // BDFD rows do not exist on the turn.
    expect(turn.cats['bdfd-2']).toBeUndefined();
    const river = presetToActionRow(matchPreset(DEFAULT_PRESETS, 'river', 'call', 33)!);
    expect(river.cats.nothing).toEqual({ s: 'follow', w: 5 });
    expect(river.cats['two-overcards']).toEqual({ s: 'follow', w: 25 });
    expect(river.cats['fd-2']).toBeUndefined();

    // Check-raise: bluffs with backdoors are key rows, medium hands are low or out.
    const cr = presetToActionRow(matchPreset(DEFAULT_PRESETS, 'flop', 'raise', 33)!);
    expect(cr.cats['bdsd-bdfd']).toEqual({ s: 'follow', w: 50 });
    expect(cr.cats['gutshot-bdfd']).toEqual({ s: 'follow', w: 60 });
    expect(cr.cats['middle-pair']).toEqual({ s: 'follow', w: 5 });
    expect(cr.cats['weak-pair']).toEqual({ s: 'exclude', w: 100 });
  });

  it('the schema rejects unknown categories, bad weights and repeated ids', () => {
    const base = {
      id: 'a',
      label: 'A',
      street: 'flop',
      villainAction: 'call',
      sizeMin: 25,
      sizeMax: 45,
      rows: { 'top-pair': 100 },
    };
    expect(() => parsePresetFile({ version: 1, presets: [base] })).not.toThrow();
    expect(() =>
      parsePresetFile({ version: 1, presets: [{ ...base, rows: { 'top-pairr': 100 } }] }),
    ).toThrow();
    expect(() =>
      parsePresetFile({ version: 1, presets: [{ ...base, rows: { 'top-pair': 140 } }] }),
    ).toThrow();
    expect(() => parsePresetFile({ version: 1, presets: [base, base] })).toThrow();
    expect(() => parsePresetFile({ version: 1, presets: [{ ...base, sizeMax: 10 }] })).toThrow();
  });
});
