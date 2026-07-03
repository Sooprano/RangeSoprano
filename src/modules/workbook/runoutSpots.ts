// Question generator for the "Runouts" drill (poker math workbook, ch. 9).
//
// Three phases: turn (1 card from the flop, /47), river (1 card from the turn,
// /46) and complete (2 cards from the flop, via the complement method). For each
// it builds a hero hand + board, picks a condition, and asks the probability —
// always with blocker-aware counting. Pure (no React); mirrors comboSpots.ts.

import { RANKS, type Rank } from '@/types/poker';
import type { Card, Suit } from '@/utils/handHistory';
import { makeDeck, shuffle, SUITS } from '@/utils/comboMath';
import {
  bothCards,
  completesFlush,
  completesStraight,
  countSingle,
  eitherCard,
  isAbove,
  isAtOrBelow,
  isOvercard,
  isSuit,
  isUndercard,
  makeCtx,
  pairsBoard,
  pct,
  RANK_INDEX,
  runnerFlush,
  tallyPairs,
  unseenAfter,
  type RunoutCtx,
  type SinglePred,
} from '@/utils/runoutMath';

export type RunoutPhase = 'turn' | 'river' | 'complete';
export const ALL_PHASES: readonly RunoutPhase[] = ['turn', 'river', 'complete'];
export const PHASE_LABEL: Record<RunoutPhase, string> = {
  turn: 'Turn',
  river: 'River',
  complete: 'Completo',
};

export type Breakdown =
  | { mode: 'single'; count: number; denom: number; matchBlockers: number }
  | { mode: 'complement'; k: number; denom: number; hits: number; total: number }
  | { mode: 'runner-flush'; suitsLeft: number; unseen: number; hits: number; total: number }
  | { mode: 'pairs'; hits: number; total: number };

export type RunoutQuestion = {
  phase: RunoutPhase;
  /** Internal condition id (for tests / debugging). */
  kind: string;
  heroCards: Card[];
  board: Card[];
  /** Unknown runout cards: 1 for turn/river, 2 for complete. */
  unknownCount: number;
  prompt: string;
  /** Correct answer, whole percent. */
  correct: number;
  breakdown: Breakdown;
  /** 4 unique percentage options including `correct`. */
  options: number[];
};

const SUIT_ARTICLE: Record<Suit, string> = {
  '♠': 'una pica',
  '♥': 'un corazón',
  '♦': 'un diamante',
  '♣': 'un trébol',
};
const SUIT_NAME: Record<Suit, string> = {
  '♠': 'picas',
  '♥': 'corazones',
  '♦': 'diamantes',
  '♣': 'tréboles',
};

const FLOP = 3;
const TURN_BOARD = 4;

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}
function token(c: Card): string {
  return `${c.rank}${c.suit}`;
}
function clampPct(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}
function phaseWord(phase: RunoutPhase): string {
  return phase === 'river' ? 'river' : 'turn';
}

/** Pull `n` cards matching `filter` from a shuffled deck, skipping `used`. */
function take(
  used: Set<string>,
  n: number,
  filter: (c: Card) => boolean,
): Card[] {
  const out: Card[] = [];
  for (const c of shuffle(makeDeck())) {
    if (out.length === n) break;
    if (used.has(token(c)) || !filter(c)) continue;
    used.add(token(c));
    out.push(c);
  }
  return out;
}

// --- MC options -----------------------------------------------------------
/** 4 unique percent options: correct + conceptual traps, padded with neighbors. */
function makePctOptions(correct: number, traps: number[]): number[] {
  const out: number[] = [correct];
  const push = (raw: number) => {
    const v = clampPct(raw);
    if (out.length < 4 && !out.includes(v)) out.push(v);
  };
  for (const t of traps) push(t);
  for (let d = 1; out.length < 4 && d <= 100; d++) {
    push(correct - d);
    if (out.length < 4) push(correct + d);
  }
  return shuffle(out.slice(0, 4));
}

// --- Single-card kinds ----------------------------------------------------
type SingleKind = 'suit' | 'pair-board' | 'overcard' | 'undercard' | 'flush' | 'straight';
const SINGLE_KINDS: readonly SingleKind[] = [
  'suit',
  'pair-board',
  'overcard',
  'undercard',
  'flush',
  'straight',
];

/** A flush draw = hero 2 of suit + board 2 of suit + (boardSize-2) bricks. */
function buildFlushDraw(suit: Suit, boardSize: number): { hero: Card[]; board: Card[] } {
  const used = new Set<string>();
  const hero = take(used, 2, (c) => c.suit === suit);
  const boardSuit = take(used, 2, (c) => c.suit === suit);
  const bricks = take(used, boardSize - 2, (c) => c.suit !== suit);
  return { hero, board: shuffle([...boardSuit, ...bricks]) };
}

/** An open-ended straight draw on a window of 4 consecutive ranks. */
function buildStraightDraw(boardSize: number): { hero: Card[]; board: Card[] } | null {
  for (let attempt = 0; attempt < 40; attempt++) {
    // base value b → run {b, b+1, b+2, b+3}; outs are b-1 and b+4.
    const b = 2 + Math.floor(Math.random() * 9); // 2..10
    const runValues = [b, b + 1, b + 2, b + 3];
    const runRanks = runValues.map((v) => RANKS[14 - v] as Rank);
    const used = new Set<string>();
    const runCards: Card[] = [];
    let okRun = true;
    for (const r of runRanks) {
      const got = take(used, 1, (c) => c.rank === r);
      if (got.length === 0) {
        okRun = false;
        break;
      }
      runCards.push(got[0]!);
    }
    if (!okRun) continue;
    const shuffled = shuffle(runCards);
    const hero = shuffled.slice(0, 2);
    const boardRun = shuffled.slice(2, 4);
    // Bricks: ranks well outside the window so they neither extend nor pair it.
    const bricks = take(
      used,
      boardSize - 2,
      (c) => {
        const v = 14 - RANK_INDEX[c.rank as Rank];
        return v < b - 2 || v > b + 5;
      },
    );
    if (bricks.length < boardSize - 2) continue;
    const board = shuffle([...boardRun, ...bricks]);
    const ctx = makeCtx(hero, board);
    if (ctx.alreadyStraight) continue;
    const unseen = unseenAfter([...hero, ...board]);
    if (countSingle(unseen, ctx, completesStraight) === 0) continue;
    return { hero, board };
  }
  return null;
}

/** Random hero + board with no immediate degeneracy guard. */
function randomDeal(boardSize: number): { hero: Card[]; board: Card[] } {
  const deck = shuffle(makeDeck());
  return { hero: deck.slice(0, 2), board: deck.slice(2, 2 + boardSize) };
}

/**
 * Hero (2) + a board with distinct ranks (no pre-existing pair). For
 * "the board pairs" questions: if the board already held a pair, asking
 * "¿se emparejará?" is ambiguous (a third card of the paired rank = trips),
 * so we deal an unpaired board to keep the prompt unequivocal.
 */
function dealUnpairedBoard(boardSize: number): { hero: Card[]; board: Card[] } {
  const deck = shuffle(makeDeck());
  const used = new Set<string>();
  const hero = deck.slice(0, 2);
  for (const c of hero) used.add(token(c));
  const board: Card[] = [];
  const ranks = new Set<Rank>();
  for (const c of deck) {
    if (board.length === boardSize) break;
    if (used.has(token(c)) || ranks.has(c.rank as Rank)) continue;
    used.add(token(c));
    ranks.add(c.rank as Rank);
    board.push(c);
  }
  return { hero, board };
}

function singleResult(
  ctx: RunoutCtx,
  unseen: Card[],
  pred: SinglePred,
): { correct: number; count: number; denom: number; matchBlockers: number } {
  const count = countSingle(unseen, ctx, pred);
  const denom = unseen.length;
  // "Forgot your blockers" = hero/board cards that satisfy the card-level pred.
  const matchBlockers = ctx.known.filter((c) => pred(c, ctx)).length;
  return { correct: pct(count, denom), count, denom, matchBlockers };
}

function buildSingle(phase: RunoutPhase): RunoutQuestion | null {
  const boardSize = phase === 'river' ? TURN_BOARD : FLOP;
  const word = phaseWord(phase);
  const kind = pick(SINGLE_KINDS);

  let hero: Card[];
  let board: Card[];
  let pred: SinglePred;
  let prompt: string;

  if (kind === 'flush') {
    const suit = pick(SUITS);
    ({ hero, board } = buildFlushDraw(suit, boardSize));
    pred = completesFlush;
    prompt = `¿Con qué frecuencia completarás tu color en el ${word}?`;
  } else if (kind === 'straight') {
    const built = buildStraightDraw(boardSize);
    if (!built) return null;
    ({ hero, board } = built);
    pred = completesStraight;
    prompt = `¿Con qué frecuencia ligarás escalera en el ${word}?`;
  } else if (kind === 'suit') {
    const suit = pick(SUITS);
    ({ hero, board } = randomDeal(boardSize));
    pred = isSuit(suit);
    prompt = `¿Con qué frecuencia el ${word} será ${SUIT_ARTICLE[suit]}?`;
  } else if (kind === 'pair-board') {
    ({ hero, board } = dealUnpairedBoard(boardSize));
    pred = pairsBoard;
    prompt = `¿Con qué frecuencia el ${word} emparejará el board?`;
  } else if (kind === 'overcard') {
    ({ hero, board } = randomDeal(boardSize));
    pred = isOvercard;
    prompt = `¿Con qué frecuencia el ${word} será un overcard (sobre el board)?`;
  } else {
    ({ hero, board } = randomDeal(boardSize));
    pred = isUndercard;
    prompt = `¿Con qué frecuencia el ${word} será un undercard (bajo el board)?`;
  }

  const ctx = makeCtx(hero, board);
  const unseen = unseenAfter([...hero, ...board]);
  const { correct, count, denom, matchBlockers } = singleResult(ctx, unseen, pred);
  // Reject trivial spots (0% or 100%) for category kinds.
  if (correct === 0 || correct === 100) return null;

  const traps = [
    pct(count, 52), // used 52 instead of 47/46
    matchBlockers > 0 ? pct(count + matchBlockers, denom) : pct(count + 1, denom),
    100 - correct,
  ];
  return {
    phase,
    kind,
    heroCards: hero,
    board,
    unknownCount: 1,
    prompt,
    correct,
    breakdown: { mode: 'single', count, denom, matchBlockers },
    options: makePctOptions(correct, traps),
  };
}

// --- Complete-runout kinds ------------------------------------------------
type CompleteKind =
  | 'suit'
  | 'pair-board'
  | 'overcard'
  | 'flush'
  | 'runner-flush'
  | 'both-low'
  | 'zero-overcards';
const COMPLETE_KINDS: readonly CompleteKind[] = [
  'suit',
  'pair-board',
  'overcard',
  'flush',
  'runner-flush',
  'both-low',
  'zero-overcards',
];

/** A backdoor flush = exactly 3 of suit among hero+board (runner-runner). */
function buildBackdoorFlush(suit: Suit): { hero: Card[]; board: Card[] } {
  const used = new Set<string>();
  const hero = take(used, 2, (c) => c.suit === suit);
  const boardSuit = take(used, 1, (c) => c.suit === suit);
  const bricks = take(used, FLOP - 1, (c) => c.suit !== suit);
  return { hero, board: shuffle([...boardSuit, ...bricks]) };
}

/** Pocket pair + a board with no overcards to the pair (for zero-overcards). */
function buildPairLowBoard(pairRank: Rank): { hero: Card[]; board: Card[] } {
  const used = new Set<string>();
  const hero = take(used, 2, (c) => c.rank === pairRank);
  const board = take(
    used,
    FLOP,
    (c) => RANK_INDEX[c.rank as Rank] >= RANK_INDEX[pairRank],
  );
  return { hero, board };
}

function buildComplete(): RunoutQuestion | null {
  const kind = pick(COMPLETE_KINDS);
  let hero: Card[];
  let board: Card[];
  let prompt: string;
  let pred: Parameters<typeof tallyPairs>[2];
  let single: SinglePred | null = null; // base single-pred for the complement/turn-only trap
  let runnerSuit: Suit | null = null; // set for runner-runner flush (mental-shortcut breakdown)

  if (kind === 'flush') {
    const suit = pick(SUITS);
    ({ hero, board } = buildFlushDraw(suit, FLOP));
    single = completesFlush;
    pred = eitherCard(completesFlush);
    prompt = `¿Con qué frecuencia completarás tu color para el river?`;
  } else if (kind === 'runner-flush') {
    const suit = pick(SUITS);
    runnerSuit = suit;
    ({ hero, board } = buildBackdoorFlush(suit));
    pred = runnerFlush(suit);
    prompt = `¿Con qué frecuencia ligarás color runner-runner (${SUIT_NAME[suit]}) para el river?`;
  } else if (kind === 'both-low') {
    ({ hero, board } = randomDeal(FLOP));
    single = isAtOrBelow('6');
    pred = bothCards(isAtOrBelow('6'));
    prompt = `¿Con qué frecuencia el runout serán dos cartas 6 o menores (2–6)?`;
  } else if (kind === 'zero-overcards') {
    const pairRank = pick(['9', '8', 'T', 'J', 'Q', '7'] as Rank[]);
    ({ hero, board } = buildPairLowBoard(pairRank));
    pred = bothCards((c, ctx) => !isAbove(pairRank)(c, ctx));
    prompt = `¿Con qué frecuencia el runout no traerá overcards a tu ${pairRank}${pairRank}?`;
  } else if (kind === 'suit') {
    const suit = pick(SUITS);
    ({ hero, board } = randomDeal(FLOP));
    single = isSuit(suit);
    pred = eitherCard(isSuit(suit));
    prompt = `¿Con qué frecuencia saldrá ${SUIT_ARTICLE[suit]} para el river?`;
  } else if (kind === 'overcard') {
    ({ hero, board } = randomDeal(FLOP));
    single = isOvercard;
    pred = eitherCard(isOvercard);
    prompt = `¿Con qué frecuencia saldrá un overcard para el river?`;
  } else {
    ({ hero, board } = dealUnpairedBoard(FLOP));
    single = pairsBoard;
    pred = eitherCard(pairsBoard);
    prompt = `¿Con qué frecuencia el board se emparejará para el river?`;
  }

  const ctx = makeCtx(hero, board);
  const unseen = unseenAfter([...hero, ...board]);
  const { hits, total } = tallyPairs(unseen, ctx, pred);
  const correct = pct(hits, total);
  if (correct === 0 || correct === 100) return null;

  const k = single ? countSingle(unseen, ctx, single) : 0;
  const traps: number[] = [100 - correct];
  if (single) traps.push(pct(k, unseen.length)); // turn-only: forgot the river

  const breakdown: Breakdown = runnerSuit
    ? {
        mode: 'runner-flush',
        suitsLeft: unseen.filter((c) => c.suit === runnerSuit).length,
        unseen: unseen.length,
        hits,
        total,
      }
    : single &&
        (kind === 'suit' ||
          kind === 'overcard' ||
          kind === 'pair-board' ||
          kind === 'flush')
      ? { mode: 'complement', k, denom: unseen.length, hits, total }
      : { mode: 'pairs', hits, total };

  return {
    phase: 'complete',
    kind,
    heroCards: hero,
    board,
    unknownCount: 2,
    prompt,
    correct,
    breakdown,
    options: makePctOptions(correct, traps),
  };
}

/** Generates one question from the enabled phases. Retries on degeneracy. */
export function generateRunoutQuestion(
  phases: ReadonlySet<RunoutPhase>,
): RunoutQuestion {
  const enabled = ALL_PHASES.filter((p) => phases.has(p));
  const pool = enabled.length > 0 ? enabled : ALL_PHASES;
  for (let attempt = 0; attempt < 60; attempt++) {
    const phase = pick(pool);
    const q = phase === 'complete' ? buildComplete() : buildSingle(phase);
    if (q) return q;
  }
  // Extremely unlikely fallback: a guaranteed non-degenerate spade question.
  const built = buildFlushDraw('♠', FLOP);
  const ctx = makeCtx(built.hero, built.board);
  const unseen = unseenAfter([...built.hero, ...built.board]);
  const { hits, total } = tallyPairs(unseen, ctx, eitherCard(completesFlush));
  const correct = pct(hits, total);
  const k = countSingle(unseen, ctx, completesFlush);
  return {
    phase: 'complete',
    kind: 'flush',
    heroCards: built.hero,
    board: built.board,
    unknownCount: 2,
    prompt: '¿Con qué frecuencia completarás tu color para el river?',
    correct,
    breakdown: { mode: 'complement', k, denom: unseen.length, hits, total },
    options: makePctOptions(correct, [100 - correct, pct(k, unseen.length)]),
  };
}
