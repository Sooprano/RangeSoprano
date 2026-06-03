// Question generator for the "fold equity / auto-profit" drill.
//
// Tests the minimum-fold-equity reflex: betting a pure bluff, what % of folds
// makes it break-even (auto-profit above that). Answer = bet/(pot+bet) — the
// "alpha", complement of the villain's MDF. Reuses `bluffEv` from ev.ts so the
// drill can't drift from the calculator.

import { bluffEv } from '@/utils/ev';
import { shuffle } from '@/utils/comboMath';

const POTS: readonly number[] = [40, 50, 60, 75, 80, 100, 120, 150, 200];
const FRACS: readonly number[] = [1 / 3, 1 / 2, 2 / 3, 3 / 4, 1, 1.5, 2];

const roundInt = (n: number) => Math.round(n);

export type FoldEquityQuestion = {
  pot: number;
  bet: number;
  /** bet as % of pot, for display. */
  pctOfPot: number;
  /** Breakeven fold % = bet/(pot+bet)·100, rounded. */
  correct: number;
  /** Villain MDF = 100 − correct. */
  mdfPct: number;
  options: number[];
};

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/** 4 unique integer-% options in [0,100], including `correct`, trap-first. */
function buildOptions(correct: number, traps: number[]): number[] {
  const seen = new Set<number>([correct]);
  const out: number[] = [correct];
  const push = (raw: number) => {
    const v = roundInt(raw);
    if (v >= 0 && v <= 100 && !seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  };
  for (const t of traps) {
    if (out.length >= 4) break;
    push(t);
  }
  for (let d = 1; out.length < 4 && d <= 100; d++) {
    push(correct + d);
    if (out.length < 4) push(correct - d);
  }
  return shuffle(out.slice(0, 4));
}

export function generateFoldEquityQuestion(): FoldEquityQuestion {
  const pot = pick(POTS);
  const frac = pick(FRACS);
  const bet = Math.max(1, Math.round(pot * frac));

  const breakeven = bluffEv({ pot, bet, foldPct: 0 }).breakevenFoldPct ?? 0;
  const correct = roundInt(breakeven);
  const mdfPct = 100 - correct;
  const pctOfPot = roundInt((bet / pot) * 100);

  // Conceptual traps: the MDF complement (call frequency, a classic mix-up) and
  // bet/pot instead of bet/(pot+bet) (forgetting the bet in the denominator).
  const trapMdf = mdfPct;
  const trapBetOverPot = (bet / pot) * 100;

  return {
    pot,
    bet,
    pctOfPot,
    correct,
    mdfPct,
    options: buildOptions(correct, [trapMdf, trapBetOverPot]),
  };
}
