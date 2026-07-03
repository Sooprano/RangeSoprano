// Runout probability math — pure card counting, no equity, no Flopzilla.
//
// The core of the "Runouts" drill (poker math workbook, ch. 9): given hero's two
// cards + a board (flop or turn), count how many of the unseen cards make a
// condition true, and divide by the remaining-card count (47 on the flop, 46 on
// the turn). For complete runouts (two cards from the flop) we enumerate the
// C(n,2) two-card runouts and use the complement method in the feedback.
//
// Reuses the deck/card primitives from comboMath so card identity/dedupe stays
// consistent with the rest of the app. The only genuinely new piece is a small
// straight detector (no hand evaluator exists elsewhere in the codebase).

import { RANKS, type Rank } from '@/types/poker';
import { type Card, type Suit } from './handHistory';
import { deadSetOf, makeDeck, SUITS } from './comboMath';

/** RANKS is A..2, so a LOWER index is a HIGHER card. A=0 … 2=12. */
export const RANK_INDEX: Record<Rank, number> = RANKS.reduce(
  (acc, r, i) => {
    acc[r] = i;
    return acc;
  },
  {} as Record<Rank, number>,
);

/** Straight value: A=14, K=13 … 2=2. (Ace also counts as 1 for the wheel.) */
export function rankValue(rank: Rank): number {
  return 14 - RANK_INDEX[rank];
}

/** The cards still in the deck after removing the seen ones (hero + board). */
export function unseenAfter(dead: readonly Card[]): Card[] {
  const deadSet = deadSetOf(dead);
  return makeDeck().filter((c) => !deadSet.has(`${c.rank}${c.suit}`));
}

/** True if the 5+ given cards contain five consecutive ranks (wheel-aware). */
export function makesStraight(cards: readonly Card[]): boolean {
  const present = new Set<number>();
  for (const c of cards) {
    const v = rankValue(c.rank as Rank);
    present.add(v);
    if (v === 14) present.add(1); // Ace plays low for A-2-3-4-5.
  }
  for (let low = 1; low <= 10; low++) {
    let run = true;
    for (let k = 0; k < 5; k++) {
      if (!present.has(low + k)) {
        run = false;
        break;
      }
    }
    if (run) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Single-card condition predicates (the next card: turn from flop, river from
// turn). `ctx` carries hero + board so predicates can read the board extremes,
// flush draws, etc.
// ---------------------------------------------------------------------------

export type RunoutCtx = {
  hero: readonly Card[];
  board: readonly Card[];
  /** hero ∪ board, precomputed. */
  known: readonly Card[];
  /** Set of ranks present on the board. */
  boardRanks: ReadonlySet<Rank>;
  /** Highest board card index (lowest RANK_INDEX). */
  topBoardIdx: number;
  /** Lowest board card index (highest RANK_INDEX). */
  bottomBoardIdx: number;
  /** Suit in which hero+board hold exactly 4 (a flush draw), or null. */
  flushDrawSuit: Suit | null;
  /** Whether hero+board already make a straight. */
  alreadyStraight: boolean;
};

export function makeCtx(hero: readonly Card[], board: readonly Card[]): RunoutCtx {
  const known = [...hero, ...board];
  const boardRanks = new Set<Rank>(board.map((c) => c.rank as Rank));
  let topBoardIdx: number = RANKS.length;
  let bottomBoardIdx = -1;
  for (const c of board) {
    const i = RANK_INDEX[c.rank as Rank];
    if (i < topBoardIdx) topBoardIdx = i;
    if (i > bottomBoardIdx) bottomBoardIdx = i;
  }
  // Flush draw = exactly four of one suit across hero + board.
  let flushDrawSuit: Suit | null = null;
  for (const s of SUITS) {
    if (known.filter((c) => c.suit === s).length === 4) flushDrawSuit = s;
  }
  return {
    hero,
    board,
    known,
    boardRanks,
    topBoardIdx,
    bottomBoardIdx,
    flushDrawSuit,
    alreadyStraight: makesStraight(known),
  };
}

export type SinglePred = (c: Card, ctx: RunoutCtx) => boolean;

export const isSuit =
  (suit: Suit): SinglePred =>
  (c) =>
    c.suit === suit;

export const pairsBoard: SinglePred = (c, ctx) => ctx.boardRanks.has(c.rank as Rank);

export const isOvercard: SinglePred = (c, ctx) =>
  RANK_INDEX[c.rank as Rank] < ctx.topBoardIdx;

export const isUndercard: SinglePred = (c, ctx) =>
  RANK_INDEX[c.rank as Rank] > ctx.bottomBoardIdx;

/** A card higher than the given rank (e.g. overcards to your pocket pair). */
export const isAbove =
  (rank: Rank): SinglePred =>
  (c) =>
    RANK_INDEX[c.rank as Rank] < RANK_INDEX[rank];

/** Card of rank `maxRank` or lower (e.g. 2-6 "brick" cards with maxRank=6). */
export const isAtOrBelow =
  (rank: Rank): SinglePred =>
  (c) =>
    RANK_INDEX[c.rank as Rank] >= RANK_INDEX[rank];

export const completesFlush: SinglePred = (c, ctx) =>
  ctx.flushDrawSuit !== null && c.suit === ctx.flushDrawSuit;

export const completesStraight: SinglePred = (c, ctx) =>
  !ctx.alreadyStraight && makesStraight([...ctx.known, c]);

/** Count the unseen cards satisfying `pred`. */
export function countSingle(
  unseen: readonly Card[],
  ctx: RunoutCtx,
  pred: SinglePred,
): number {
  let n = 0;
  for (const c of unseen) if (pred(c, ctx)) n++;
  return n;
}

// ---------------------------------------------------------------------------
// Two-card (complete runout) enumeration. Iterate every unordered pair of
// unseen cards; `pred` decides if that runout satisfies the condition.
// ---------------------------------------------------------------------------

export type PairPred = (a: Card, b: Card, ctx: RunoutCtx) => boolean;

export type PairTally = { hits: number; total: number };

export function tallyPairs(
  unseen: readonly Card[],
  ctx: RunoutCtx,
  pred: PairPred,
): PairTally {
  let hits = 0;
  let total = 0;
  for (let i = 0; i < unseen.length; i++) {
    for (let j = i + 1; j < unseen.length; j++) {
      total++;
      if (pred(unseen[i]!, unseen[j]!, ctx)) hits++;
    }
  }
  return { hits, total };
}

/** "At least one of the two runout cards satisfies the single-card pred." */
export const eitherCard =
  (pred: SinglePred): PairPred =>
  (a, b, ctx) =>
    pred(a, ctx) || pred(b, ctx);

/** "Both runout cards satisfy the single-card pred." */
export const bothCards =
  (pred: SinglePred): PairPred =>
  (a, b, ctx) =>
    pred(a, ctx) && pred(b, ctx);

/** Runner-runner straight: not already made, but the two cards complete one. */
export const runnerStraight: PairPred = (a, b, ctx) =>
  !ctx.alreadyStraight && makesStraight([...ctx.known, a, b]);

/** Runner-runner flush of suit `s`: both runout cards are that suit. */
export const runnerFlush =
  (suit: Suit): PairPred =>
  (a, b) =>
    a.suit === suit && b.suit === suit;

export function pct(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 100);
}
