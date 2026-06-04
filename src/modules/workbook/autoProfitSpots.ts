// Generator for the "Auto-profit raise" drill (port of the "Auto-Profit Raises"
// chapter of The Postflop Poker Workbook, pp. 166-171).
//
// Concept: a bluff/semibluff RAISE auto-profits when the villain folds more
// often than the raise's breakeven %. The breakeven of a raise to R total into
// a pot P (P already includes the villain's bet) is BE% = R/(R+P) — identical
// to `raiseBluffEv().breakevenFoldPct`. We reuse that (single source of truth
// with /calculadoras → "EV del raise"); no new math.
//
// The villain's fold% comes from Flopzilla (the range they continue with) — so,
// like equity in SPR and frequencies in Floating, it's GIVEN as data. We don't
// rebuild a range/board engine.

import { raiseBluffEv } from '@/utils/ev';

export type RaiseStreet = 'flop' | 'turn' | 'river';
export type AutoProfitKind = 'be-value' | 'decision';

export type AutoProfitQuestion = {
  kind: AutoProfitKind;
  street: RaiseStreet;
  /** Display unit: '$' (cash, dollars) or 'K' (tournament chips, thousands). */
  unit: '$' | 'K';
  startingPot: number; // pot before the villain's bet (the displayed POT)
  villainBet: number; // their bet you're raising
  raiseTotal: number; // R: you raise to this total
  potRaisedInto: number; // P = startingPot + villainBet ("into a P pot")
  bePct: number; // round(R/(R+P))
  // decision only:
  continueLabel: string; // cosmetic continue-range phrase (source of foldPct)
  foldPct: number; // given villain fold% to your raise
  correctDecision: 'yes' | 'no';
  // be-value only:
  options: number[]; // 4 unique % MC options (one is bePct)
};

// ── Curated raise-size templates (clean numbers, book-style) ─────────────────
// The first 5 are the exact book spots (so node verification reproduces them).
type Template = {
  unit: '$' | 'K';
  street: RaiseStreet;
  startingPot: number;
  villainBet: number;
  raiseTotal: number;
};

const TEMPLATES: readonly Template[] = [
  // ── The five printed book spots (pp. 167-171) ──
  { unit: 'K', street: 'flop', startingPot: 6.5, villainBet: 3, raiseTotal: 9 }, // BE 49
  { unit: '$', street: 'flop', startingPot: 75, villainBet: 50, raiseTotal: 200 }, // BE 62
  { unit: 'K', street: 'turn', startingPot: 13, villainBet: 7, raiseTotal: 18 }, // BE 47
  { unit: '$', street: 'turn', startingPot: 155, villainBet: 100, raiseTotal: 300 }, // BE 54
  { unit: 'K', street: 'river', startingPot: 21, villainBet: 15, raiseTotal: 35 }, // BE 49
  // ── Extra spots for variety (clean numbers, BE spread ~45-62) ──
  { unit: '$', street: 'flop', startingPot: 50, villainBet: 30, raiseTotal: 75 }, // BE 48
  { unit: '$', street: 'flop', startingPot: 100, villainBet: 75, raiseTotal: 200 }, // BE 53
  { unit: '$', street: 'turn', startingPot: 150, villainBet: 100, raiseTotal: 250 }, // BE 50
  { unit: '$', street: 'river', startingPot: 100, villainBet: 80, raiseTotal: 160 }, // BE 47
  { unit: '$', street: 'flop', startingPot: 80, villainBet: 50, raiseTotal: 180 }, // BE 58
  { unit: 'K', street: 'flop', startingPot: 8, villainBet: 5, raiseTotal: 16 }, // BE 55
  { unit: 'K', street: 'turn', startingPot: 12, villainBet: 8, raiseTotal: 20 }, // BE 50
  { unit: 'K', street: 'river', startingPot: 30, villainBet: 20, raiseTotal: 44 }, // BE 47
  { unit: 'K', street: 'flop', startingPot: 9.5, villainBet: 5, raiseTotal: 12 }, // BE 45
  { unit: '$', street: 'turn', startingPot: 200, villainBet: 120, raiseTotal: 420 }, // BE 57
  { unit: '$', street: 'river', startingPot: 90, villainBet: 70, raiseTotal: 200 }, // BE 56
];

// Continue-range phrases bucketed by fold magnitude (the SOURCE of the given
// fold%, cosmetic). Tighter continue range → higher fold.
function continueLabelFor(foldPct: number): string {
  if (foldPct >= 80) return 'solo da acción con manos muy fuertes (trips+ / color)';
  if (foldPct >= 65) return 'solo sigue con top pair fuerte (Q+ de kicker) o mejor';
  if (foldPct >= 50) return 'sigue con top pair+ y algunos proyectos';
  if (foldPct >= 35) return 'sigue con cualquier par y proyectos de 8+ outs';
  return 'paga con cualquier par, proyectos y backdoors';
}

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

/** BE% of a raise to R total into pot P — via raiseBluffEv (R/(R+P)). */
export function breakevenPct(t: {
  startingPot: number;
  villainBet: number;
  raiseTotal: number;
}): number {
  const { breakevenFoldPct } = raiseBluffEv({
    pot: t.startingPot,
    villainBet: t.villainBet,
    raiseCost: t.raiseTotal,
    foldPct: 0,
  });
  return Math.round(breakevenFoldPct);
}

/** Four unique % options for a be-value question: bePct + conceptual traps. */
function buildOptions(
  bePct: number,
  startingPot: number,
  villainBet: number,
  raiseTotal: number,
): number[] {
  const P = startingPot + villainBet;
  const clampPct = (n: number) => Math.max(1, Math.min(99, Math.round(n)));
  const candidates: number[] = [
    100 - bePct, // complemento = P/(R+P)
    (raiseTotal / P) * 100, // olvidar sumar el raise al denominador (R/P)
    (villainBet / (villainBet + P)) * 100, // usar la apuesta del villano en vez del raise
  ].map(clampPct);

  const opts = new Set<number>([bePct]);
  for (const c of candidates) {
    if (opts.size >= 4) break;
    if (c !== bePct) opts.add(c);
  }
  // Fill remaining slots with neighbors at increasing distance.
  let k = 2;
  while (opts.size < 4) {
    const up = clampPct(bePct + k);
    const down = clampPct(bePct - k);
    if (!opts.has(up)) opts.add(up);
    if (opts.size < 4 && !opts.has(down)) opts.add(down);
    k += 1;
    if (k > 40) break; // safety
  }
  return shuffle([...opts]);
}

/** Picks a villain fold% for a decision question, balanced ~50/50 yes/no. */
function pickFoldPct(bePct: number): { foldPct: number; correctDecision: 'yes' | 'no' } {
  const wantYes = Math.random() < 0.5;
  // Mostly a clear margin, occasionally a close call (like the book's 44 vs 47).
  const delta = Math.random() < 0.25 ? randInt(2, 4) : randInt(5, 28);
  if (wantYes) {
    const foldPct = Math.min(96, bePct + delta);
    // If clamping collapsed the margin, fall back to a clear yes.
    if (foldPct <= bePct) return { foldPct: Math.min(96, bePct + 5), correctDecision: 'yes' };
    return { foldPct, correctDecision: 'yes' };
  }
  const foldPct = Math.max(4, bePct - delta);
  if (foldPct >= bePct) return { foldPct: Math.max(4, bePct - 5), correctDecision: 'no' };
  return { foldPct, correctDecision: 'no' };
}

export function generateAutoProfitQuestion(): AutoProfitQuestion {
  const t = pick(TEMPLATES);
  const potRaisedInto = t.startingPot + t.villainBet;
  const bePct = breakevenPct(t);
  const kind: AutoProfitKind = Math.random() < 0.5 ? 'be-value' : 'decision';

  const base = {
    kind,
    street: t.street,
    unit: t.unit,
    startingPot: t.startingPot,
    villainBet: t.villainBet,
    raiseTotal: t.raiseTotal,
    potRaisedInto,
    bePct,
  };

  if (kind === 'be-value') {
    return {
      ...base,
      options: buildOptions(bePct, t.startingPot, t.villainBet, t.raiseTotal),
      // decision fields unused; fill with a coherent default.
      continueLabel: continueLabelFor(bePct),
      foldPct: bePct,
      correctDecision: 'yes',
    };
  }

  const { foldPct, correctDecision } = pickFoldPct(bePct);
  return {
    ...base,
    foldPct,
    correctDecision,
    continueLabel: continueLabelFor(foldPct),
    options: [],
  };
}

/** Formats an amount in the question's unit ($ cash or K tournament). */
export function formatAmount(n: number, unit: '$' | 'K'): string {
  const trimmed = Math.round(n * 100) / 100;
  return unit === '$' ? `$${trimmed}` : `${trimmed}K`;
}
