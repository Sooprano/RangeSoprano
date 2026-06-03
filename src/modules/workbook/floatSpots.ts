// Question generator for the "Floating" drill (SplitSuit workbook, ch. 10).
//
// The EV of floating: you call a cbet with air, then bet the next card when
// checked to. The model has three branches whose frequencies sum to 100%:
//  - villain check/folds  -> you win the pot minus your call
//  - villain barrels       -> you fold, losing your call
//  - villain check/continues (call or raise) -> you lose your call + your bet
// Reuses floatEv from ev.ts (single source of truth, verified vs the book).

import { floatEv } from '@/utils/ev';
import { makeDeck, shuffle } from '@/utils/comboMath';
import { RANK_INDEX } from '@/utils/runoutMath';
import type { Card } from '@/utils/handHistory';
import type { Rank } from '@/types/poker';

export type FloatStreet = 'turn' | 'river';
export type FloatKind = 'decision' | 'ev-value';

export type FloatQuestion = {
  street: FloatStreet;
  kind: FloatKind;
  /** Truthful description of the next card vs the board (flavor + takeaway). */
  scenarioLabel: string;
  /** The community board so far (flop = 3, turn = 4). */
  board: Card[];
  /** The next card (turn or river) you'd bet after they check. */
  nextCard: Card;
  /** Pot including the villain's bet, BEFORE your call (floatEv's potOnFlop). */
  potOnFlop: number;
  /** What you called on the prior street. */
  call: number;
  /** Your bet on the next street when they check. */
  bet: number;
  barrelPct: number;
  xfPct: number;
  restPct: number;
  /** Float EV, rounded to integer $. Fold = 0-EV baseline. */
  ev: number;
  correctDecision: 'float' | 'fold';
  /** 4 unique $ options for the `ev-value` kind; includes `ev`. */
  options: number[];
};

const CALLS: readonly number[] = [25, 30, 40, 50, 75, 100, 125, 150];
const POT_MULT: readonly number[] = [1.5, 2, 2.5, 3];
const BET_FRAC: readonly number[] = [0.5, 0.66, 0.75, 1];
const PCTS5: readonly number[] = [20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70];

// Round half AWAY from zero, matching the workbook's convention (−9.5 → −10).
const roundInt = (n: number) => Math.sign(n) * Math.round(Math.abs(n));

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/** Truthful one-liner about how the next card relates to the board. */
function describeNextCard(board: readonly Card[], next: Card): string {
  if (board.some((c) => c.rank === next.rank)) return 'empareja el board';
  if (board.filter((c) => c.suit === next.suit).length >= 3)
    return 'completa un color';
  const idxs = board.map((c) => RANK_INDEX[c.rank as Rank]);
  const top = Math.min(...idxs); // highest board card (lowest index)
  const bottom = Math.max(...idxs); // lowest board card
  const ni = RANK_INDEX[next.rank as Rank];
  if (ni < top) return 'es un overcard (carta alta)';
  if (ni > bottom) return 'es un brick (carta baja)';
  return 'es una carta media';
}

/** Deals a board (flop or turn) + the next card from a fresh shuffled deck. */
function dealBoard(street: FloatStreet): { board: Card[]; nextCard: Card } {
  const deck = shuffle(makeDeck());
  const boardSize = street === 'turn' ? 3 : 4;
  return { board: deck.slice(0, boardSize), nextCard: deck[boardSize]! };
}

/** 4 unique integer-$ options including `correct`, trap-first. */
function buildOptions(correct: number, traps: number[]): number[] {
  const seen = new Set<number>([correct]);
  const out: number[] = [correct];
  const push = (raw: number) => {
    const v = roundInt(raw);
    if (!seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  };
  for (const t of traps) {
    if (out.length >= 4) break;
    push(t);
  }
  return out.length >= 4 ? shuffle(out.slice(0, 4)) : out;
}

function makeSpot(street: FloatStreet, kind: FloatKind): FloatQuestion {
  const call = pick(CALLS);
  const potBefore = roundInt(call * pick(POT_MULT));
  const potOnFlop = potBefore + call; // pot incl. villain's bet, before your call
  const potAfterCall = potOnFlop + call;
  const bet = Math.max(1, roundInt(potAfterCall * pick(BET_FRAC)));

  const barrelPct = pick(PCTS5);
  const xfMax = 95 - barrelPct; // leave >=5% for the check-continue branch
  const xfPct = pick(PCTS5.filter((p) => p <= xfMax));
  const restPct = 100 - barrelPct - xfPct;

  const evRaw = floatEv({
    potOnFlop,
    callOnFlop: call,
    barrelPct,
    xfPct,
    turnBet: bet,
  });
  const ev = roundInt(evRaw);
  const correctDecision: 'float' | 'fold' = evRaw > 0 ? 'float' : 'fold';

  const barrel = barrelPct / 100;
  const xf = xfPct / 100;
  const rest = restPct / 100;
  const step = Math.max(3, roundInt(potOnFlop * 0.08));
  const traps: number[] = [
    // (a) forgot the check-continue branch entirely.
    barrel * -call + xf * potOnFlop,
    // (b) used the full pot you bet into (didn't subtract your call) on the win.
    barrel * -call + xf * (potOnFlop + call) - rest * (bet + call),
    -evRaw,
    ev + step,
    ev - step,
    ev + 2 * step,
    ev - 2 * step,
  ];

  const { board, nextCard } = dealBoard(street);

  return {
    street,
    kind,
    scenarioLabel: describeNextCard(board, nextCard),
    board,
    nextCard,
    potOnFlop,
    call,
    bet,
    barrelPct,
    xfPct,
    restPct,
    ev,
    correctDecision,
    options: kind === 'ev-value' ? buildOptions(ev, traps) : [],
  };
}

export function generateFloatQuestion(): FloatQuestion {
  const street: FloatStreet = Math.random() < 0.5 ? 'turn' : 'river';
  const kind: FloatKind = Math.random() < 0.5 ? 'decision' : 'ev-value';

  if (kind === 'ev-value') return makeSpot(street, kind);

  // decision: balance float/fold ~50/50, require a clear margin (not a coin flip).
  const clear = (s: FloatQuestion) => Math.abs(s.ev) > Math.max(3, s.potOnFlop * 0.05);
  const wantFold = Math.random() < 0.5;
  let clearFallback: FloatQuestion | null = null;
  for (let attempt = 0; attempt < 80; attempt++) {
    const spot = makeSpot(street, kind);
    if (!clear(spot)) continue;
    if ((spot.correctDecision === 'fold') === wantFold) return spot;
    clearFallback = spot;
  }
  if (clearFallback) return clearFallback;
  for (let attempt = 0; attempt < 200; attempt++) {
    const spot = makeSpot(street, kind);
    if (clear(spot)) return spot;
  }
  return makeSpot(street, kind);
}
