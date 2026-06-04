// Generator for the "River: call o shove" drill (port of Chapter 13 "River
// Play — Facing Bets" of The Postflop Poker Workbook, pp. 185-194).
//
// Concept: facing a river bet, don't stop at call/fold — also weigh the SHOVE
// (all-in) and pick the highest-EV line. We compare:
//   EV call  = callRiverBetEv(potWon, bet, winCalling)          (ev.ts)
//   EV shove = allInEv(potWon, bet, shove, winWhenCalled, fold) (ev.ts)
//   EV fold  = 0
// Both EV functions already reproduce the book exactly — no new math. The
// equities (win% calling, fold%, win-when-called) come from Flopzilla, so they
// are GIVEN as data, like SPR/Floating/Auto-profit.

import { allInEv, callRiverBetEv } from '@/utils/ev';
import type { Card, Suit } from '@/utils/handHistory';

export type RiverKind = 'ev-call' | 'ev-shove' | 'decision';
export type RiverLine = 'call' | 'fold' | 'shove';

export type RiverQuestion = {
  kind: RiverKind;
  unit: '$' | 'K';
  potBefore: number; // pot before the villain's river bet ("into a P pot")
  villainBet: number; // their river bet you face
  potWon: number; // potBefore + villainBet (the pot you win = the POT shown)
  shove: number; // your effective all-in total = min(your stack, bet + their stack)
  winCallingPct: number; // your equity vs their BETTING range
  foldPct: number; // how often they fold to your shove
  winWhenCalledPct: number; // your equity when they call your shove (continuing range)
  evCall: number; // rounded EV of calling, in `unit`
  evShove: number; // rounded EV of shoving, in `unit`
  bestLine: RiverLine; // argmax {call, fold:0, shove}
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
// The EV formulas (callRiverBetEv / allInEv) are universal, so any sane sizing
// works; these are made-up figures. (Correctness is verified separately by
// feeding the formulas independent reference numbers — not shipped here.)
type Template = {
  unit: '$' | 'K';
  potBefore: number;
  villainBet: number;
  shove: number; // effective all-in total
};

const TEMPLATES: readonly Template[] = [
  { unit: '$', potBefore: 220, villainBet: 170, shove: 720 },
  { unit: 'K', potBefore: 24, villainBet: 10, shove: 55 },
  { unit: '$', potBefore: 280, villainBet: 210, shove: 950 },
  { unit: '$', potBefore: 180, villainBet: 120, shove: 640 },
  { unit: 'K', potBefore: 16, villainBet: 7, shove: 34 },
  { unit: '$', potBefore: 200, villainBet: 150, shove: 600 },
  { unit: '$', potBefore: 120, villainBet: 90, shove: 430 },
  { unit: '$', potBefore: 320, villainBet: 220, shove: 880 },
  { unit: '$', potBefore: 160, villainBet: 110, shove: 520 },
  { unit: 'K', potBefore: 32, villainBet: 22, shove: 95 },
  { unit: 'K', potBefore: 14, villainBet: 10, shove: 44 },
  { unit: 'K', potBefore: 44, villainBet: 28, shove: 130 },
  { unit: 'K', potBefore: 26, villainBet: 17, shove: 72 },
];

// Cosmetic hand+board pairs (purely illustrative, original; the EV depends only
// on the given numbers, like Floating's next card — never on these cards).
const COSMETIC: readonly { hero: string; board: string }[] = [
  { hero: 'Qc Jd', board: 'As 8h 6c 2d Kh' },
  { hero: 'Td 9d', board: '7s 5c 3h Jd Qc' },
  { hero: 'Ah Kc', board: 'Qd 9s 4c 8h 2s' },
  { hero: '8s 8d', board: 'Ks 6h 5c Tc 3d' },
  { hero: 'Jh Th', board: '9d 7c 2s Ah 4h' },
  { hero: 'Ad Qs', board: 'Kc Jd 6h 9s 3c' },
  { hero: '6h 6s', board: 'Tc 8d 4s Qh 2c' },
  { hero: 'Ks Qc', board: 'Js 9h 5d 7c Ad' },
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

function evCallOf(t: Template, winCallingPct: number): number {
  return callRiverBetEv({
    pot: t.potBefore + t.villainBet,
    call: t.villainBet,
    equityPct: winCallingPct,
  });
}
function evShoveOf(t: Template, foldPct: number, winWhenCalledPct: number): number {
  return allInEv({
    pot: t.potBefore + t.villainBet,
    call: t.villainBet,
    shove: t.shove,
    equityPct: winWhenCalledPct,
    foldPct,
  }).ev;
}

function bestLineOf(evCall: number, evShove: number): RiverLine {
  if (evShove >= evCall && evShove > 0) return 'shove';
  if (evCall >= evShove && evCall > 0) return 'call';
  return 'fold';
}

/** Four unique EV options for a value question: correct + conceptual traps. */
function buildOptions(
  correct: number,
  traps: number[],
  unit: '$' | 'K',
  step: number,
): number[] {
  const opts = new Set<number>([correct]);
  for (const t of traps) {
    if (opts.size >= 4) break;
    const r = roundEv(t, unit);
    if (r !== correct) opts.add(r);
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

/** Picks equities biased toward a target best line, retrying until it wins by a margin. */
function equitiesForTarget(
  t: Template,
  target: RiverLine,
): { winCalling: number; fold: number; winWhenCalled: number } {
  const potWon = t.potBefore + t.villainBet;
  const beCall = (t.villainBet / (potWon + t.villainBet)) * 100; // call breakeven equity
  const margin = 0.04 * potWon;

  for (let i = 0; i < 500; i++) {
    let winCalling: number;
    let fold: number;
    const winWhenCalled = Math.random() < 0.45 ? 0 : randInt(5, 38);
    if (target === 'call') {
      winCalling = randInt(Math.min(85, Math.ceil(beCall) + 15), 85);
      fold = randInt(20, 58);
    } else if (target === 'shove') {
      winCalling = randInt(8, 42);
      fold = randInt(70, 92);
    } else {
      // fold: both EVs negative
      winCalling = randInt(3, Math.max(4, Math.floor(beCall) - 3));
      fold = randInt(20, 50);
    }
    const evCall = evCallOf(t, winCalling);
    const evShove = evShoveOf(t, fold, winWhenCalled);
    const best = bestLineOf(evCall, evShove);
    if (best !== target) continue;
    // Require a clear margin over the runner-up so the decision isn't a near-tie.
    const evs = [evCall, evShove, 0].sort((a, b) => b - a);
    if (evs[0]! - evs[1]! < margin) continue;
    return { winCalling, fold, winWhenCalled };
  }
  // Fallback (rare): broad sample; bestLine is recomputed by the caller.
  return {
    winCalling: randInt(5, 85),
    fold: randInt(20, 90),
    winWhenCalled: Math.random() < 0.45 ? 0 : randInt(5, 38),
  };
}

export function generateRiverQuestion(): RiverQuestion {
  const t = pick(TEMPLATES);
  const potWon = t.potBefore + t.villainBet;
  const kind: RiverKind = pick(['ev-call', 'ev-shove', 'decision'] as const);
  const cosmetic = pick(COSMETIC);

  let winCalling: number;
  let fold: number;
  let winWhenCalled: number;
  if (kind === 'decision') {
    const target = pick(['call', 'shove', 'fold'] as const);
    ({ winCalling, fold, winWhenCalled } = equitiesForTarget(t, target));
  } else {
    winCalling = randInt(5, 85);
    fold = randInt(20, 90);
    winWhenCalled = Math.random() < 0.45 ? 0 : randInt(5, 38);
  }

  const evCallRaw = evCallOf(t, winCalling);
  const evShoveRaw = evShoveOf(t, fold, winWhenCalled);
  const evCall = roundEv(evCallRaw, t.unit);
  const evShove = roundEv(evShoveRaw, t.unit);
  const bestLine = bestLineOf(evCallRaw, evShoveRaw);
  const step = Math.max(t.unit === '$' ? 1 : 0.1, roundEv(potWon * 0.06, t.unit));

  let options: number[] = [];
  if (kind === 'ev-call') {
    const wc = winCalling / 100;
    options = buildOptions(
      evCall,
      [
        wc * potWon, // olvidar restar la pérdida
        wc * t.potBefore - (1 - wc) * t.villainBet, // usar potBefore en vez de potWon
        -evCallRaw, // signo invertido
      ],
      t.unit,
      step,
    );
  } else if (kind === 'ev-shove') {
    const f = fold / 100;
    options = buildOptions(
      evShove,
      [
        evShoveOf(t, 0, winWhenCalled), // olvidar la fold equity
        f * potWon, // solo el pickup del fold
        f * potWon - (1 - f) * t.shove, // tratarlo como bluff puro (eq 0)
      ],
      t.unit,
      step,
    );
  }

  return {
    kind,
    unit: t.unit,
    potBefore: t.potBefore,
    villainBet: t.villainBet,
    potWon,
    shove: t.shove,
    winCallingPct: winCalling,
    foldPct: fold,
    winWhenCalledPct: winWhenCalled,
    evCall,
    evShove,
    bestLine,
    hero: cards(cosmetic.hero),
    board: cards(cosmetic.board),
    options,
  };
}

/** Plain amount (pot/bet/shove) in the question's unit. */
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
