import { RANKS, type HandCategory, type HandNotation, type Rank } from '@/types/poker';

/** Total combos in a full deck per hand category. */
export const COMBOS_PER_CATEGORY: Record<HandCategory, number> = {
  pair: 6,
  suited: 4,
  offsuit: 12,
};

/** Total preflop combos across all 169 starting hands. */
export const TOTAL_COMBOS = 13 * 6 + 78 * 4 + 78 * 12;

const RANK_INDEX: Record<Rank, number> = RANKS.reduce(
  (acc, r, i) => {
    acc[r] = i;
    return acc;
  },
  {} as Record<Rank, number>,
);

export function isPair(hand: HandNotation): boolean {
  return hand.length === 2 && hand[0] === hand[1];
}

export function isSuited(hand: HandNotation): boolean {
  return hand.length === 3 && hand.endsWith('s');
}

export function isOffsuit(hand: HandNotation): boolean {
  return hand.length === 3 && hand.endsWith('o');
}

export function categoryOf(hand: HandNotation): HandCategory {
  if (isPair(hand)) return 'pair';
  if (isSuited(hand)) return 'suited';
  return 'offsuit';
}

export function combosOf(hand: HandNotation): number {
  return COMBOS_PER_CATEGORY[categoryOf(hand)];
}

/**
 * Grid coordinates for a hand.
 * Suited: above diagonal (row = high rank, col = low rank).
 * Pair: on diagonal.
 * Offsuit: below diagonal (row = low rank, col = high rank).
 */
export function handToGridCoords(hand: HandNotation): { row: number; col: number } {
  if (isPair(hand)) {
    const r = hand[0] as Rank;
    const i = RANK_INDEX[r];
    return { row: i, col: i };
  }
  const high = hand[0] as Rank;
  const low = hand[1] as Rank;
  const hi = RANK_INDEX[high];
  const lo = RANK_INDEX[low];
  if (isSuited(hand)) return { row: hi, col: lo };
  return { row: lo, col: hi };
}

export function gridCoordsToHand(row: number, col: number): HandNotation {
  const rHigh = RANKS[row];
  const rLow = RANKS[col];
  if (rHigh === undefined || rLow === undefined) {
    throw new Error(`Invalid grid coords: (${row}, ${col})`);
  }
  if (row === col) return `${rHigh}${rHigh}`;
  if (row < col) return `${rHigh}${rLow}s`;
  return `${rLow}${rHigh}o`;
}

/** Generates all 169 hands in grid order (row-major, ranks A..2). */
export function generateAllHands(): HandNotation[] {
  const hands: HandNotation[] = [];
  for (let row = 0; row < RANKS.length; row++) {
    for (let col = 0; col < RANKS.length; col++) {
      hands.push(gridCoordsToHand(row, col));
    }
  }
  return hands;
}

export const ALL_HANDS: readonly HandNotation[] = Object.freeze(generateAllHands());
