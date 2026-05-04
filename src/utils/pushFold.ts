import { ALL_HANDS } from '@/utils/handUtils';
import type { HandNotation } from '@/types/poker';
import {
  NASH_HU,
  NASH_MAX_BB,
  NASH_MIN_BB,
  nashCallBB,
  nashPushBB,
} from '@/data/nashTable';

export type PushFoldKind = 'push-or-fold' | 'call-or-fold';
export type PushFoldScope = 'push' | 'call';
export type PushFoldAnswer = 'PUSH' | 'CALL' | 'FOLD';

export const ALL_PUSHFOLD_KINDS: readonly PushFoldKind[] = [
  'push-or-fold',
  'call-or-fold',
];

export const PUSHFOLD_KIND_LABEL: Record<PushFoldKind, string> = {
  'push-or-fold': 'Push o Fold',
  'call-or-fold': 'Call o Fold',
};

export interface PushFoldQuestion {
  id: string;
  kind: PushFoldKind;
  hand: HandNotation;
  /** Effective stack in BB at the moment of the decision (1 decimal). */
  stackBB: number;
  /** Hero seat for the prompt: BTN for push-or-fold, BB for call-or-fold. */
  hero: 'BTN' | 'BB';
  correct: PushFoldAnswer;
  /** Threshold the answer was derived from (max BB at which yes-action is correct). */
  threshold: number;
  scope: PushFoldScope;
}

export function shouldPush(hand: HandNotation, bb: number): boolean {
  const t = nashPushBB(hand);
  return t > 0 && bb <= t;
}

export function shouldCall(hand: HandNotation, bb: number): boolean {
  const t = nashCallBB(hand);
  return t > 0 && bb <= t;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function roundTo1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Picks an effective stack (in BB) skewed toward the threshold so the question
 * lands near the decision boundary 70% of the time.
 *
 * - 70%: uniform within ±2.5 BB of `threshold`, clamped to [NASH_MIN_BB, NASH_MAX_BB].
 * - 30%: uniform across the full range (preserves obvious anchors like AA/72o).
 * - threshold === 0: uniform always (no informative neighborhood).
 */
export function pickStackBB(threshold: number): number {
  if (threshold <= 0 || Math.random() >= 0.7) {
    const span = NASH_MAX_BB - NASH_MIN_BB;
    return roundTo1(NASH_MIN_BB + Math.random() * span);
  }
  const lo = clamp(threshold - 2.5, NASH_MIN_BB, NASH_MAX_BB);
  const hi = clamp(threshold + 2.5, NASH_MIN_BB, NASH_MAX_BB);
  return roundTo1(lo + Math.random() * (hi - lo));
}

function pickFromArray<T>(arr: readonly T[]): T {
  if (arr.length === 0) {
    throw new Error('Cannot pick from empty array');
  }
  const idx = Math.floor(Math.random() * arr.length);
  return arr[idx]!;
}

export function generatePushFoldQuestion(
  enabled: readonly PushFoldKind[],
): PushFoldQuestion {
  const pool = enabled.length > 0 ? enabled : ALL_PUSHFOLD_KINDS;
  const kind = pickFromArray(pool);
  const hand = pickFromArray(ALL_HANDS);
  const scope: PushFoldScope = kind === 'push-or-fold' ? 'push' : 'call';
  const threshold = scope === 'push' ? nashPushBB(hand) : nashCallBB(hand);
  const stackBB = pickStackBB(threshold);
  const isYes = threshold > 0 && stackBB <= threshold;
  const yesAnswer: PushFoldAnswer = scope === 'push' ? 'PUSH' : 'CALL';
  return {
    id: crypto.randomUUID(),
    kind,
    hand,
    stackBB,
    hero: scope === 'push' ? 'BTN' : 'BB',
    correct: isYes ? yesAnswer : 'FOLD',
    threshold,
    scope,
  };
}

export function evaluatePushFoldAnswer(
  q: PushFoldQuestion,
  picked: PushFoldAnswer,
): boolean {
  return picked === q.correct;
}

export function describeThreshold(q: PushFoldQuestion): string {
  if (q.threshold <= 0) {
    return q.scope === 'push'
      ? `${q.hand}: nunca push en este rango.`
      : `${q.hand}: nunca call en este rango.`;
  }
  const verb = q.scope === 'push' ? 'push' : 'call';
  return `${q.hand}: ${verb} hasta ${q.threshold} BB.`;
}

export { NASH_MAX_BB, NASH_MIN_BB, NASH_HU };
