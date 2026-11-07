import { describe, expect, it } from 'vitest';
import { comboEquityColor, handEquityColor } from '../equityColors';

const rgb = (s: string) => s.match(/\d+/g)!.map(Number) as [number, number, number];

describe('equity colors (D144)', () => {
  it('a hand: red near 0 %, yellow at 50 %, green near 100 %', () => {
    const [r0, g0] = rgb(handEquityColor(0.03));
    expect(r0).toBeGreaterThan(200);
    expect(g0).toBeLessThan(60);
    const [r5, g5, b5] = rgb(handEquityColor(0.5));
    expect(r5).toBeGreaterThan(220);
    expect(g5).toBeGreaterThan(220);
    expect(b5).toBeLessThan(80);
    const [r9, g9] = rgb(handEquityColor(0.9));
    expect(g9).toBeGreaterThan(200);
    expect(r9).toBeLessThan(100);
  });

  it('a combo: by its distance to the hand mean (75s: 33.79 green, 4.70 brown, 1.87 red)', () => {
    const mean = 0.1056;
    const [rUp, gUp] = rgb(comboEquityColor(0.3379, mean));
    expect(gUp).toBeGreaterThan(rUp);
    const [rLow, gLow] = rgb(comboEquityColor(0.047, mean));
    expect(rLow).toBeGreaterThan(gLow);
    const [rFar, gFar] = rgb(comboEquityColor(0.0187, mean));
    expect(gFar).toBeLessThan(gLow);
    expect(rFar).toBeGreaterThan(200);
    // Close to the mean is the same olive whatever the level (J2 7.83 vs 5.66 ≈ AA 89.80 vs 89.75).
    expect(comboEquityColor(0.898, 0.8975)).toBe(comboEquityColor(0.1056, 0.1056));
  });
});
