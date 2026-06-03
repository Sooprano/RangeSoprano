// Question generator for the "conteo de combos" drill.
//
// Picks a named starting hand (the villain's holding), deals hero's 2 cards +
// a board, and asks how many combos of that hand remain after the blockers.
// Pure (no React); mirrors quizSpots.ts.

import type { HandNotation, Rank } from '@/types/poker';
import { RANKS } from '@/types/poker';
import type { Card } from '@/utils/handHistory';
import {
  baseComboCount,
  comboCount,
  deadSetOf,
  makeDeck,
  shuffle,
} from '@/utils/comboMath';

export type TargetKind = 'pair' | 'suited' | 'offsuit' | 'both';

export type ComboTarget = {
  /** Display label, e.g. "77", "A5s", "AJo", "AK". */
  label: string;
  /** Notations summed to count combos (AK → AKs + AKo). */
  hands: HandNotation[];
  kind: TargetKind;
};

export type ComboQuestion = {
  target: ComboTarget;
  heroCards: Card[];
  board: Card[];
  /** Combos with no blockers (6 / 4 / 12 / 16). */
  baseCombos: number;
  /** Combos remaining after the dead cards. */
  correct: number;
  /** Dead cards that share a rank with the target (the actual blockers). */
  blockedBy: Card[];
  /** 4 unique options, one of which is `correct`. */
  options: number[];
};

const TARGET_KINDS: readonly TargetKind[] = ['pair', 'suited', 'offsuit', 'both'];
// Favor 1–2 blockers so most questions actually exercise the skill.
const BLOCKER_WEIGHTS: readonly number[] = [0, 1, 1, 1, 2, 2];
const BOARD_SIZES: readonly number[] = [3, 4, 5];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/** Two distinct ranks ordered high→low (RANKS is A..2, so lower index = higher). */
function twoRanks(): { high: Rank; low: Rank } {
  const i = Math.floor(Math.random() * RANKS.length);
  let j = Math.floor(Math.random() * RANKS.length);
  while (j === i) j = Math.floor(Math.random() * RANKS.length);
  const [hi, lo] = i < j ? [i, j] : [j, i];
  return { high: RANKS[hi]!, low: RANKS[lo]! };
}

function makeTarget(): ComboTarget {
  const kind = pick(TARGET_KINDS);
  if (kind === 'pair') {
    const r = pick(RANKS);
    return { label: `${r}${r}`, hands: [`${r}${r}`], kind };
  }
  const { high, low } = twoRanks();
  if (kind === 'suited') {
    return { label: `${high}${low}s`, hands: [`${high}${low}s`], kind };
  }
  if (kind === 'offsuit') {
    return { label: `${high}${low}o`, hands: [`${high}${low}o`], kind };
  }
  // both: AK = AKs + AKo, labelled without suffix
  return {
    label: `${high}${low}`,
    hands: [`${high}${low}s`, `${high}${low}o`],
    kind,
  };
}

/** Builds 4 unique options including `correct`, near it and around the base. */
function makeOptions(correct: number, baseMax: number): number[] {
  const valid = (v: number) =>
    Number.isInteger(v) && v >= 0 && v <= baseMax;
  const ordered: number[] = [correct, baseMax];
  for (let d = 1; d <= baseMax; d++) {
    ordered.push(correct - d, correct + d, baseMax - d);
  }
  const seen = new Set<number>();
  const out: number[] = [];
  for (const v of ordered) {
    if (valid(v) && !seen.has(v)) {
      seen.add(v);
      out.push(v);
      if (out.length === 4) break;
    }
  }
  return shuffle(out);
}

export function generateComboQuestion(): ComboQuestion {
  const target = makeTarget();
  const targetRanks = new Set<Rank>(target.hands.map((h) => h[0] as Rank));
  for (const h of target.hands) targetRanks.add(h[1] as Rank);

  const boardSize = pick(BOARD_SIZES);
  const totalDead = 2 + boardSize;

  const deck = makeDeck();
  const targetCards = shuffle(deck.filter((c) => targetRanks.has(c.rank as Rank)));
  const otherCards = shuffle(deck.filter((c) => !targetRanks.has(c.rank as Rank)));

  const blockers = Math.min(pick(BLOCKER_WEIGHTS), targetCards.length, totalDead);
  const dealt = shuffle([
    ...targetCards.slice(0, blockers),
    ...otherCards.slice(0, totalDead - blockers),
  ]);

  const heroCards = dealt.slice(0, 2);
  const board = dealt.slice(2);

  const dead = deadSetOf(dealt);
  const baseCombos = baseComboCount(target.hands);
  const correct = comboCount(target.hands, dead);
  const blockedBy = dealt.filter((c) => targetRanks.has(c.rank as Rank));

  return {
    target,
    heroCards,
    board,
    baseCombos,
    correct,
    blockedBy,
    options: makeOptions(correct, baseCombos),
  };
}
