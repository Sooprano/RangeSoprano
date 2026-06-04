// Generator for the "River: check o bet" drill (port of the "River Play —
// Making Bets" lens of Chapter 13 of The Postflop Poker Workbook, pp. 195-203).
//
// Concept: the villain CHECKS to you on the river. You weigh three lines —
// check behind, bet a SMALL size, bet a BIG size — and pick the highest EV.
//   EV check = checkRiverEv(pot, checkWin%)                         (ev.ts)
//   EV bet   = betRiverEv(pot, bet, winWhenCalled%, fold%, raise:0) (ev.ts)
//   bestLine = argmax {check, small, big}
// Both EV functions already reproduce the book exactly — no new math. The
// frequencies (win% at showdown, fold%, win-when-called per size) come from
// Flopzilla, so they are GIVEN as data, like SPR/Floating/Auto-profit.
//
// Teaching: a bigger bet folds more but is called by a TIGHTER range (so your
// equity when called is equal or lower); checking banks the pot with hands that
// have showdown value but little equity when called. A small value bet that
// keeps more hands in can beat a big one, and a weak made hand can be worth more
// as a big bluff than as a check.

import { betRiverEv, checkRiverEv } from '@/utils/ev';
import type { Card, Suit } from '@/utils/handHistory';

export type RiverBetKind = 'ev-check' | 'ev-small' | 'ev-big' | 'decision';
export type RiverLine = 'check' | 'small' | 'big';
type Archetype = 'bluff' | 'value' | 'thin';

export type RiverBetQuestion = {
  kind: RiverBetKind;
  unit: '$' | 'K';
  pot: number; // current river pot (shared by all lines)
  checkWinPct: number; // your equity vs their checking range (check line)
  betSmall: number;
  foldSmall: number; // they fold this often vs the small bet
  winSmall: number; // your equity when called by the small bet
  betBig: number;
  foldBig: number; // they fold this often vs the big bet
  winBig: number; // your equity when called by the big bet
  evCheck: number;
  evSmall: number;
  evBig: number;
  bestLine: RiverLine; // argmax {check, small, big}
  hero: Card[]; // cosmetic
  board: Card[]; // cosmetic
  options: number[]; // value kinds: 4 unique EV options (one is correct)
};

// ── Card helper (cosmetic spot illustration) ─────────────────────────────────
const SUIT: Record<string, Suit> = { s: '♠', h: '♥', d: '♦', c: '♣' };
function cards(spec: string): Card[] {
  if (!spec) return [];
  return spec
    .split(/\s+/)
    .filter(Boolean)
    .map((tok) => ({
      rank: tok.slice(0, -1).toUpperCase(),
      suit: SUIT[tok.slice(-1).toLowerCase()]!,
    }));
}

// ── Size templates (original clean numbers, not from any source) ─────────────
// The EV formulas (checkRiverEv / betRiverEv) are universal, so any sane sizing
// works; these are made-up figures. (Correctness is verified separately by
// feeding the formulas independent reference numbers — not shipped here.)
type Template = {
  unit: '$' | 'K';
  pot: number;
  betSmall: number;
  betBig: number;
};

const TEMPLATES: readonly Template[] = [
  { unit: '$', pot: 120, betSmall: 40, betBig: 90 },
  { unit: '$', pot: 200, betSmall: 70, betBig: 160 },
  { unit: '$', pot: 320, betSmall: 110, betBig: 260 },
  { unit: '$', pot: 90, betSmall: 30, betBig: 70 },
  { unit: '$', pot: 250, betSmall: 80, betBig: 200 },
  { unit: 'K', pot: 12, betSmall: 4, betBig: 9 },
  { unit: 'K', pot: 18, betSmall: 6, betBig: 14 },
  { unit: 'K', pot: 24, betSmall: 8, betBig: 20 },
  { unit: 'K', pot: 9, betSmall: 3, betBig: 7 },
  { unit: 'K', pot: 30, betSmall: 10, betBig: 24 },
];

// Cosmetic hand+board pairs (purely illustrative, original; the EV depends only
// on the given numbers, like Floating's next card — never on these cards).
const COSMETIC: readonly { hero: string; board: string }[] = [
  { hero: 'Ac Qd', board: 'Kh Jc 7s 4d 2c' },
  { hero: 'Ts 9s', board: '8h 6c 3d Qs Ad' },
  { hero: 'Kd Kc', board: 'Qh 9c 5s 2d 7h' },
  { hero: '7h 6h', board: 'Jd 9s 4c Th 2s' },
  { hero: 'Ah Jd', board: 'Js 8c 3h 6d Qc' },
  { hero: '5c 5d', board: 'Ts 7h 4c Kd 9s' },
  { hero: 'Qs Jh', board: 'Td 8s 5c Ah 3d' },
  { hero: 'Ad Kh', board: '9s 6d 3c 8h 4s' },
];

// ── RNG helpers ──────────────────────────────────────────────────────────────
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}
function shuffle<T>(arr: readonly T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Rounds an EV/amount to the unit's display step: $ → 1, K → 0.1. */
function roundEv(n: number, unit: '$' | 'K'): number {
  return unit === '$' ? Math.round(n) : Math.round(n * 10) / 10;
}

type Freqs = {
  checkWin: number;
  foldSmall: number;
  winSmall: number;
  foldBig: number;
  winBig: number;
};

/**
 * Samples coherent frequencies for an archetype. Invariant across archetypes:
 * the bigger bet folds at least as much (tighter continue) and is called by an
 * equal-or-lower equity range (winBig ≤ winSmall).
 */
function sampleFreqs(arch: Archetype): Freqs {
  if (arch === 'bluff') {
    // Air: ~no showdown, 0 equity when called; betting is a pure bluff.
    const checkWin = randInt(0, 8);
    const foldSmall = randInt(25, 60);
    const foldBig = Math.min(96, foldSmall + randInt(8, 30));
    return { checkWin, foldSmall, winSmall: 0, foldBig, winBig: 0 };
  }
  if (arch === 'value') {
    // Strong hand: high equity when called; you want calls.
    const checkWin = randInt(45, 90);
    const winSmall = randInt(60, 95);
    const winBig = Math.max(40, winSmall - randInt(0, 25));
    const foldSmall = randInt(10, 40);
    const foldBig = Math.min(92, foldSmall + randInt(10, 35));
    return { checkWin, foldSmall, winSmall, foldBig, winBig };
  }
  // thin: medium made hand — beats their checking range often (showdown value)
  // but the calling range crushes it (low equity when called).
  const checkWin = randInt(30, 78);
  const winSmall = randInt(0, 18);
  const winBig = randInt(0, winSmall);
  const foldSmall = randInt(30, 65);
  const foldBig = Math.min(95, foldSmall + randInt(8, 30));
  return { checkWin, foldSmall, winSmall, foldBig, winBig };
}

function evsOf(t: Template, f: Freqs): { check: number; small: number; big: number } {
  return {
    check: checkRiverEv({ pot: t.pot, winPct: f.checkWin }),
    small: betRiverEv({
      pot: t.pot,
      bet: t.betSmall,
      winWhenCalledPct: f.winSmall,
      foldPct: f.foldSmall,
      raisePct: 0,
    }),
    big: betRiverEv({
      pot: t.pot,
      bet: t.betBig,
      winWhenCalledPct: f.winBig,
      foldPct: f.foldBig,
      raisePct: 0,
    }),
  };
}

function bestLineOf(evs: { check: number; small: number; big: number }): RiverLine {
  if (evs.check >= evs.small && evs.check >= evs.big) return 'check';
  if (evs.small >= evs.big) return 'small';
  return 'big';
}

/** Samples frequencies biased toward a target best line, with a clear margin. */
function freqsForTarget(t: Template, target: RiverLine): Freqs {
  const margin = 0.05 * t.pot;
  for (let i = 0; i < 600; i++) {
    const f = sampleFreqs(pick(['bluff', 'value', 'thin'] as const));
    const evs = evsOf(t, f);
    if (bestLineOf(evs) !== target) continue;
    const sorted = [evs.check, evs.small, evs.big].sort((a, b) => b - a);
    if (sorted[0]! - sorted[1]! < margin) continue;
    return f;
  }
  // Fallback (rare): any sample; bestLine is recomputed by the caller anyway.
  return sampleFreqs(pick(['bluff', 'value', 'thin'] as const));
}

/** Four unique EV options for a value question: correct + conceptual traps. */
function buildOptions(
  correct: number,
  traps: number[],
  unit: '$' | 'K',
  step: number,
): number[] {
  const opts = new Set<number>([correct]);
  for (const tr of traps) {
    if (opts.size >= 4) break;
    const r = roundEv(tr, unit);
    if (r !== correct && Number.isFinite(r)) opts.add(r);
  }
  let k = 1;
  while (opts.size < 4) {
    const up = roundEv(correct + k * step, unit);
    const down = roundEv(correct - k * step, unit);
    if (!opts.has(up)) opts.add(up);
    if (opts.size < 4 && !opts.has(down)) opts.add(down);
    k += 1;
    if (k > 60) break; // safety
  }
  return shuffle([...opts]);
}

export function generateRiverBetQuestion(): RiverBetQuestion {
  const t = pick(TEMPLATES);
  const kind: RiverBetKind = pick(['ev-check', 'ev-small', 'ev-big', 'decision'] as const);
  const cosmetic = pick(COSMETIC);

  const f =
    kind === 'decision'
      ? freqsForTarget(t, pick(['check', 'small', 'big'] as const))
      : sampleFreqs(pick(['bluff', 'value', 'thin'] as const));

  const evsRaw = evsOf(t, f);
  const evCheck = roundEv(evsRaw.check, t.unit);
  const evSmall = roundEv(evsRaw.small, t.unit);
  const evBig = roundEv(evsRaw.big, t.unit);
  const bestLine = bestLineOf(evsRaw);
  const step = Math.max(t.unit === '$' ? 1 : 0.1, roundEv(t.pot * 0.06, t.unit));

  let options: number[] = [];
  if (kind === 'ev-check') {
    const w = f.checkWin / 100;
    options = buildOptions(
      evCheck,
      [
        t.pot * (1 - w), // complemento (la parte que perdés)
        t.pot, // olvidar multiplicar por la equity
        evsRaw.check / 2, // mitad arbitraria
      ],
      t.unit,
      step,
    );
  } else if (kind === 'ev-small' || kind === 'ev-big') {
    const bet = kind === 'ev-small' ? t.betSmall : t.betBig;
    const fold = (kind === 'ev-small' ? f.foldSmall : f.foldBig) / 100;
    const win = (kind === 'ev-small' ? f.winSmall : f.winBig) / 100;
    const c = 1 - fold;
    const correctRaw = kind === 'ev-small' ? evsRaw.small : evsRaw.big;
    options = buildOptions(
      kind === 'ev-small' ? evSmall : evBig,
      [
        c * (win * (t.pot + bet) - (1 - win) * bet), // olvidar la rama de fold (F·pot)
        fold * t.pot - c * bet, // tratarlo como bluff puro (win = 0)
        fold * t.pot + c * (win * t.pot - (1 - win) * bet), // usar pot en vez de pot+bet
        -correctRaw, // signo invertido
      ],
      t.unit,
      step,
    );
  }

  return {
    kind,
    unit: t.unit,
    pot: t.pot,
    checkWinPct: f.checkWin,
    betSmall: t.betSmall,
    foldSmall: f.foldSmall,
    winSmall: f.winSmall,
    betBig: t.betBig,
    foldBig: f.foldBig,
    winBig: f.winBig,
    evCheck,
    evSmall,
    evBig,
    bestLine,
    hero: cards(cosmetic.hero),
    board: cards(cosmetic.board),
    options,
  };
}

/** Plain amount (pot/bet) in the question's unit. */
export function formatAmount(n: number, unit: '$' | 'K'): string {
  const trimmed = Math.round(n * 100) / 100;
  return unit === '$' ? `$${trimmed}` : `${trimmed}K`;
}

/** Signed EV in the question's unit (e.g. "$96", "−$192", "21.9K", "−12.6K"). */
export function formatEv(n: number, unit: '$' | 'K'): string {
  const abs = Math.abs(Math.round(n * 100) / 100);
  const body = unit === '$' ? `$${abs}` : `${abs}K`;
  return n < 0 ? `−${body}` : body;
}

/** Percentage of pot a bet represents (for the sizing chips). */
export function pctOfPot(bet: number, pot: number): number {
  return pot > 0 ? Math.round((bet / pot) * 100) : 0;
}
