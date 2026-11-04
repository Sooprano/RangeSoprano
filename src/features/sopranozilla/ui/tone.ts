// Traffic-light tones for the calculator: one rule everywhere.
// good  = beats the target by 5+ points · close = within ±5 points ·
// bad   = 5+ points short. Soft emerald / amber / rose, readable in both themes.

export type Tone = 'good' | 'close' | 'bad' | 'neutral';

/** ±5 percentage points. */
export const TONE_BAND = 0.05;

export function toneVs(value: number, target: number, band = TONE_BAND): Tone {
  if (!Number.isFinite(value) || !Number.isFinite(target)) return 'neutral';
  if (value >= target + band) return 'good';
  if (value <= target - band) return 'bad';
  return 'close';
}

/**
 * EV tone within one street: the best row is good, rows within 5% of the pot
 * of the best are close, negative EV is bad, the rest neutral.
 */
export function evTone(evPot: number, bestEvPot: number, isBest: boolean): Tone {
  if (!Number.isFinite(evPot)) return 'neutral';
  if (evPot < 0) return 'bad';
  if (isBest) return 'good';
  if (Number.isFinite(bestEvPot) && bestEvPot - evPot <= TONE_BAND) return 'close';
  return 'neutral';
}

export const TONE_TEXT: Record<Tone, string> = {
  good: 'text-emerald-600 dark:text-emerald-400',
  close: 'text-amber-600 dark:text-amber-300',
  bad: 'text-rose-600 dark:text-rose-400',
  neutral: 'text-content',
};

export const TONE_BAR: Record<Tone, string> = {
  good: 'bg-emerald-500/80',
  close: 'bg-amber-400/80',
  bad: 'bg-rose-500/70',
  neutral: 'bg-content-muted/50',
};
