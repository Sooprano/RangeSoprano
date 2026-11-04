// Independent brute-force evaluator, used only by the tests as the reference
// for the differential check of evaluator.ts. It shares no code with it: it
// reads ranks/suits straight from the card id and decides the category by
// counting, then tries all 21 five-card subsets of a 7-card hand.
//
// Score: higher = stronger. category * 13^5 + tiebreak ranks in base 13.

export const REF_CATEGORIES = [
  'high-card',
  'pair',
  'two-pair',
  'trips',
  'straight',
  'flush',
  'full-house',
  'quads',
  'straight-flush',
] as const;
export type RefCategory = (typeof REF_CATEGORIES)[number];

const BASE = 13;
const CATEGORY_UNIT = BASE ** 5;

/** Score of exactly five cards (ids 0..51, rank = id >> 2, suit = id & 3). */
const COUNT = new Int8Array(13);

export function refScore5(cards: readonly number[]): number {
  COUNT.fill(0);
  let isFlush = true;
  const suit0 = cards[0]! % 4;
  for (const c of cards) {
    COUNT[Math.floor(c / 4)]!++;
    if (c % 4 !== suit0) isFlush = false;
  }

  // Groups by (size desc, rank desc): e.g. full house → [trips rank, pair rank].
  const order: number[] = [];
  const sizes: number[] = [];
  for (let size = 4; size >= 1; size--)
    for (let r = 12; r >= 0; r--)
      if (COUNT[r] === size) {
        order.push(r);
        sizes.push(size);
      }
  const shape = sizes.join('');

  const distinct = order.length === 5 ? order : [];
  // `distinct` is only filled with 5 distinct ranks, descending.
  let straightHigh = -1;
  if (distinct.length === 5) {
    if (distinct[0]! - distinct[4]! === 4) straightHigh = distinct[0]!;
    // Wheel: A 5 4 3 2 → the five is the high card.
    else if (distinct.join(',') === '12,3,2,1,0') straightHigh = 3;
  }

  let category: RefCategory;
  let tiebreak: number[];
  if (straightHigh >= 0 && isFlush) {
    category = 'straight-flush';
    tiebreak = [straightHigh];
  } else if (shape === '41') {
    category = 'quads';
    tiebreak = order;
  } else if (shape === '32') {
    category = 'full-house';
    tiebreak = order;
  } else if (isFlush) {
    category = 'flush';
    tiebreak = distinct;
  } else if (straightHigh >= 0) {
    category = 'straight';
    tiebreak = [straightHigh];
  } else if (shape === '311') {
    category = 'trips';
    tiebreak = order;
  } else if (shape === '221') {
    category = 'two-pair';
    tiebreak = order;
  } else if (shape === '2111') {
    category = 'pair';
    tiebreak = order;
  } else {
    category = 'high-card';
    tiebreak = distinct;
  }

  let score = REF_CATEGORIES.indexOf(category) * CATEGORY_UNIT;
  for (let i = 0; i < 5; i++) score += (tiebreak[i] ?? 0) * BASE ** (4 - i);
  return score;
}

export function refCategoryOf(score: number): RefCategory {
  return REF_CATEGORIES[Math.floor(score / CATEGORY_UNIT)] as RefCategory;
}

/** Best score among all 5-card subsets of 5..7 cards. */
export function refScoreBest(cards: readonly number[]): number {
  const n = cards.length;
  const five = [0, 0, 0, 0, 0];
  let best = -1;
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++)
      for (let c = b + 1; c < n; c++)
        for (let d = c + 1; d < n; d++)
          for (let e = d + 1; e < n; e++) {
            five[0] = cards[a]!;
            five[1] = cards[b]!;
            five[2] = cards[c]!;
            five[3] = cards[d]!;
            five[4] = cards[e]!;
            const s = refScore5(five);
            if (s > best) best = s;
          }
  return best;
}
