// Question generator for the "value / bluff" drill.
//
// Tests the river-balance reflex: given how many value combos you bet and the
// bet size, how many bluff combos keep the betting range unexploitable. Reuses
// `valueBluffCombos` from ev.ts (single source of truth with /calculadoras), so
// the drill answer can't drift from the calculator.

import { valueBluffCombos } from '@/utils/ev';
import { shuffle } from '@/utils/comboMath';

export type Sizing = { label: string; frac: number };

// Bet as a fraction of the pot. Labels stay sizing-focused (the absolute chips
// don't matter for balance — only bet/pot).
const SIZINGS: readonly Sizing[] = [
  { label: 'un tercio del bote (33%)', frac: 1 / 3 },
  { label: 'medio bote (50%)', frac: 0.5 },
  { label: 'dos tercios del bote (67%)', frac: 2 / 3 },
  { label: '75% del bote', frac: 0.75 },
  { label: 'el bote entero (pot-size)', frac: 1 },
  { label: '1.5× el bote (overbet)', frac: 1.5 },
  { label: '2× el bote (overbet)', frac: 2 },
];

const VALUE_COMBOS: readonly number[] = [6, 8, 9, 10, 12, 15, 16, 18, 20, 24];

const round1 = (n: number) => Math.round(n * 10) / 10;

export type ValueBluffQuestion = {
  sizing: Sizing;
  valueCombos: number;
  /** Balanced bluff combos = value · bet/(pot+bet), rounded to 1 decimal. */
  correct: number;
  /** bet/(pot+bet) as a percentage — the fraction of value to bluff. */
  bluffOfValuePct: number;
  /** value:bluff ratio per 1 bluff (e.g. 3 → "3:1"). */
  ratioValueToBluff: number;
  /** % of the betting range that should be bluffs = bet/(pot+2·bet). */
  bluffFreqPct: number;
  options: number[];
};

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/** 4 unique options including `correct`, favoring the conceptual-trap values. */
function buildOptions(correct: number, traps: number[]): number[] {
  const seen = new Set<number>([correct]);
  const out: number[] = [correct];
  const push = (raw: number) => {
    const v = round1(raw);
    if (v >= 0 && !seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  };
  for (const t of traps) {
    if (out.length >= 4) break;
    push(t);
  }
  for (let d = 1; out.length < 4 && d <= 40; d++) {
    push(correct + d * 0.5);
    if (out.length < 4) push(correct - d * 0.5);
  }
  return shuffle(out.slice(0, 4));
}

export function generateValueBluffQuestion(): ValueBluffQuestion {
  const sizing = pick(SIZINGS);
  const valueCombos = pick(VALUE_COMBOS);
  const s = sizing.frac;
  const r = valueBluffCombos({ pot: 1, bet: s, valueCombos });

  const correct = round1(r.maxBluffCombos);
  const bluffOfValuePct = Math.round((s / (1 + s)) * 100);
  const ratioValueToBluff = round1((1 + s) / s);
  const bluffFreqPct = Math.round(r.bluffFreqPct);

  // Conceptual traps: using the betting-range frequency as a count, or forgetting
  // to add the bet to the denominator (bet/pot instead of bet/(pot+bet)).
  const trapFreq = (valueCombos * s) / (1 + 2 * s);
  const trapNoBet = valueCombos * s;
  const trapDouble = correct * 2;

  return {
    sizing,
    valueCombos,
    correct,
    bluffOfValuePct,
    ratioValueToBluff,
    bluffFreqPct,
    options: buildOptions(correct, [trapNoBet, trapFreq, trapDouble]),
  };
}
