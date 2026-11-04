import { describe, expect, it } from 'vitest';
import { evTone, toneVs } from '../tone';

describe('traffic-light tones', () => {
  it('±5 points around the target is "close"', () => {
    expect(toneVs(0.37, 0.25)).toBe('good'); // 12 points over
    expect(toneVs(0.29, 0.25)).toBe('close');
    expect(toneVs(0.21, 0.25)).toBe('close');
    expect(toneVs(0.3, 0.25)).toBe('good'); // exactly +5 counts as good
    expect(toneVs(0.2, 0.25)).toBe('bad'); // exactly −5 counts as bad
    expect(toneVs(0, 0.43)).toBe('bad');
    expect(toneVs(Number.NaN, 0.25)).toBe('neutral');
  });

  it('EV: best is good, near the best is close, negative is bad', () => {
    expect(evTone(1.33, 1.33, true)).toBe('good');
    expect(evTone(1.3, 1.33, false)).toBe('close');
    expect(evTone(0.83, 1.33, false)).toBe('neutral');
    expect(evTone(-0.1, 1.33, false)).toBe('bad');
  });
});
