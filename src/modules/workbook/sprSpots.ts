// Question generator for the "SPR / compromiso" drill.
//
// Ports the workbook's "SPR: EV Practice": the EV of committing in low-to-medium
// SPR pots, either by calling an all-in or by shoving. The hard part of the book
// (deriving your equity vs their range in Flopzilla) stays in Flopzilla — here
// the equity is GIVEN, and you practice the committing math + the decision.
// Reuses allInEv / callRiverBetEv from ev.ts (single source of truth).

import { allInEv, callRiverBetEv } from '@/utils/ev';
import { shuffle } from '@/utils/comboMath';

export type SprSituation = 'shove' | 'call';
export type SprQuestionKind = 'decision' | 'ev-value';

const POTS: readonly number[] = [200, 300, 400, 465, 500, 600];
const SPRS: readonly number[] = [0.5, 0.8, 1, 1.5, 2, 2.5, 3];

const round1 = (n: number) => Math.round(n * 10) / 10;
const roundInt = (n: number) => Math.round(n);

export type SprQuestion = {
  situation: SprSituation;
  kind: SprQuestionKind;
  pot: number;
  /** Effective stack = the all-in amount. */
  stack: number;
  /** stack / pot, rounded to 1 decimal. */
  spr: number;
  equityPct: number;
  /** Only for `shove`; how often they fold. */
  foldPct: number | null;
  /** Committing EV (rounded to integer $). Fold is the 0-EV baseline. */
  ev: number;
  correctDecision: 'commit' | 'fold';
  /** 4 unique $ options for the `ev-value` kind; includes `ev`. */
  options: number[];
};

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function randInt(lo: number, hi: number): number {
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

/** Raw committing EV for a spot (before rounding). */
function committingEv(
  situation: SprSituation,
  pot: number,
  stack: number,
  equityPct: number,
  foldPct: number,
): number {
  if (situation === 'shove') {
    return allInEv({ pot, shove: stack, call: 0, equityPct, foldPct }).ev;
  }
  // call: you pay `stack`; you win pot+stack, lose stack.
  return callRiverBetEv({ pot: pot + stack, call: stack, equityPct });
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

/** Computes a full spot from random inputs for the given situation/kind. */
function makeSpot(situation: SprSituation, kind: SprQuestionKind): SprQuestion {
  const pot = pick(POTS);
  const spr = pick(SPRS);
  const stack = Math.max(1, roundInt(pot * spr));
  const equityPct = randInt(25, 72);
  const foldPct = situation === 'shove' ? randInt(20, 70) : null;

  const evRaw = committingEv(situation, pot, stack, equityPct, foldPct ?? 0);
  const ev = roundInt(evRaw);
  const correctDecision: 'commit' | 'fold' = evRaw > 0 ? 'commit' : 'fold';

  // ev-value options: conceptual traps + neighbors.
  const step = Math.max(10, roundInt(pot * 0.15));
  const traps: number[] = [];
  if (situation === 'shove') {
    // "forgot fold equity" — the call-only EV (fold=0).
    traps.push(allInEv({ pot, shove: stack, call: 0, equityPct, foldPct: 0 }).ev);
  } else {
    // "only the winnings" — forgot to subtract the loss term.
    traps.push((equityPct / 100) * (pot + stack));
  }
  traps.push(-evRaw, ev + step, ev - step, ev + 2 * step, ev - 2 * step);
  const options = kind === 'ev-value' ? buildOptions(ev, traps) : [];

  return {
    situation,
    kind,
    pot,
    stack,
    spr: round1(stack / pot),
    equityPct,
    foldPct,
    ev,
    correctDecision,
    options,
  };
}

export function generateSprQuestion(): SprQuestion {
  const situation: SprSituation = Math.random() < 0.5 ? 'shove' : 'call';
  const kind: SprQuestionKind = Math.random() < 0.5 ? 'decision' : 'ev-value';

  // ev-value: any well-formed spot works.
  if (kind === 'ev-value') return makeSpot(situation, kind);

  // decision: balance commit/fold ~50/50 and require a clear margin so the
  // answer isn't a coin flip. Target a decision, then accept the first clear
  // spot that matches it; remember any clear spot as a fallback.
  const clear = (s: SprQuestion) => Math.abs(s.ev) > s.pot * 0.1;
  const wantFold = Math.random() < 0.5;
  let clearFallback: SprQuestion | null = null;
  for (let attempt = 0; attempt < 80; attempt++) {
    const spot = makeSpot(situation, kind);
    if (!clear(spot)) continue; // near-zero → ambiguous
    if ((spot.correctDecision === 'fold') === wantFold) return spot;
    clearFallback = spot;
  }
  if (clearFallback) return clearFallback;
  // Last resort: any clear spot (target unreachable for this situation).
  for (let attempt = 0; attempt < 200; attempt++) {
    const spot = makeSpot(situation, kind);
    if (clear(spot)) return spot;
  }
  return makeSpot(situation, kind);
}
