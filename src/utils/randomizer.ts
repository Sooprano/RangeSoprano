/** Inclusive 1..100 roll (matches the `60/40` preset reading: ≤60 = yes, >60 = no). */
export function rollOnce(): number {
  return Math.floor(Math.random() * 100) + 1;
}

export function rollMany(n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(rollOnce());
  return out;
}

export function clampPresetValue(n: number): number {
  if (!Number.isFinite(n)) return 50;
  return Math.max(1, Math.min(100, Math.round(n)));
}

/** True when the roll falls into the "yes" half of a `value/(100-value)` split. */
export function rollMatches(roll: number, presetValue: number): boolean {
  return roll <= presetValue;
}
