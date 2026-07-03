// Blocker-aware combo counting — pure combinatorics, no board reading.
//
// Given a starting-hand notation (or a few summed, e.g. AK = AKs + AKo) and a
// set of dead cards (board + hero), counts how many combos of that hand remain
// in the deck. This is the core of the "conteo de combos" drill: the classic
// poker math workbook skill, 100% independent of Flopzilla (no equity, no board
// semantics — just which cards are still available).

import type { HandNotation, Rank } from '@/types/poker';
import { RANKS } from '@/types/poker';
import { isPair, isSuited } from './handUtils';
import { cardToString, type Card, type Suit } from './handHistory';

export const SUITS: readonly Suit[] = ['♠', '♥', '♦', '♣'];

/** Dead-card token, matching `cardToString` (e.g. "A♥"). */
function deadToken(rank: string, suit: Suit): string {
  return `${rank}${suit}`;
}

/** How many suits of `rank` are still available given the dead set. */
function availSuits(rank: Rank, dead: Set<string>): number {
  let n = 0;
  for (const s of SUITS) if (!dead.has(deadToken(rank, s))) n++;
  return n;
}

/** Remaining combos of a single hand notation given the dead cards. */
function combosOfHand(hand: HandNotation, dead: Set<string>): number {
  const high = hand[0] as Rank;
  if (isPair(hand)) {
    const n = availSuits(high, dead);
    return (n * (n - 1)) / 2;
  }
  const low = hand[1] as Rank;
  // Suits where both ranks are available in that suit.
  let sameSuit = 0;
  for (const s of SUITS) {
    if (!dead.has(deadToken(high, s)) && !dead.has(deadToken(low, s))) sameSuit++;
  }
  if (isSuited(hand)) return sameSuit;
  // Offsuit: all (highSuit, lowSuit) pairs minus the same-suit ones.
  const a = availSuits(high, dead);
  const b = availSuits(low, dead);
  return a * b - sameSuit;
}

/** Sum of remaining combos across one or more notations (e.g. AK = AKs+AKo). */
export function comboCount(
  targetHands: readonly HandNotation[],
  dead: Set<string>,
): number {
  return targetHands.reduce((acc, h) => acc + combosOfHand(h, dead), 0);
}

/** Base combos with an empty deck (6 pair / 4 suited / 12 offsuit, summed). */
export function baseComboCount(targetHands: readonly HandNotation[]): number {
  return comboCount(targetHands, new Set());
}

/** A fresh 52-card deck as Card objects. */
export function makeDeck(): Card[] {
  const deck: Card[] = [];
  for (const rank of RANKS) for (const suit of SUITS) deck.push({ rank, suit });
  return deck;
}

/** Builds a dead-card set from cards using the canonical token form. */
export function deadSetOf(cards: readonly Card[]): Set<string> {
  return new Set(cards.map(cardToString));
}

/** Fisher-Yates shuffle (copy). */
export function shuffle<T>(arr: readonly T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
