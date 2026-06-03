// Spot bank + question generator for the "¿Qué calculadora?" drill.
//
// Single source of truth: a handful of real-format hand histories (iPoker, the
// user's native export). At module load we parse each and run every postflop
// hero decision through `suggestCalcForDecision` — the SAME brain the análisis
// worksheet uses — so the drill's "correct" answer can never drift from what the
// worksheet would pre-fill. The drill just asks the user to pick the tool first.
//
// Preflop decisions are out of scope here: an open/3-bet isn't a spot for these
// postflop EV calcs, and asserting a "correct" calc for it would mislead.

import { CALC_GROUPS, type CalcMode } from '@/modules/calculators/calcMeta';
import {
  parseHandHistory,
  type Decision,
  type ParsedHand,
  type Street,
} from '@/utils/handHistory';
import { suggestCalcForDecision } from '@/utils/spotCalc';

const STREET_ES: Record<Street, string> = {
  preflop: 'preflop',
  flop: 'flop',
  turn: 'turn',
  river: 'river',
};

/**
 * Curated hands, one calc focus each (plus the rich double-barrel example that
 * also yields a river check-vs-bet). iPoker convention: calls state the *added*
 * amount, raises state the *total* ("to Y"), all-in via "and is all-in".
 */
const SPOT_HANDS: readonly string[] = [
  // ── Doble barrel (flop+turn) + check river → check-vs-bet ────────────────
  `GAME #12139533229 Texas Hold'em NL Tournament 2026-03-28 02:15:56/GMT
Table Info: Size: 2, Blinds: 15/30, Ante: 0
Seat 6: Balans3 (572.00 in chips)  DEALER
Seat 10: denf0rdz (928.00 in chips)
Balans3: Post SB 15.00
denf0rdz: Post BB 30.00
*** HOLE CARDS ***
Dealt to Balans3 [HJ S9]
Balans3: Call 15.00
denf0rdz: Check
*** FLOP *** [HA H7 C9]
denf0rdz: Check
Balans3: Bet 35.00
denf0rdz: Call 35.00
*** TURN *** [H3]
denf0rdz: Check
Balans3: Bet 105.00
denf0rdz: Call 105.00
*** RIVER *** [S8]
denf0rdz: Check
Balans3: Check`,

  // ── Bluff de una calle (flop bet, no barrel) → bluff-ev ──────────────────
  `GAME #1001 Texas Hold'em NL Tournament 2026-04-01 10:00:00/GMT
Table Info: Size: 2, Blinds: 25/50, Ante: 0
Seat 1: Hero (5000.00 in chips)  DEALER
Seat 2: Villano (5000.00 in chips)
Hero: Post SB 25.00
Villano: Post BB 50.00
*** HOLE CARDS ***
Dealt to Hero [SA HK]
Hero: Raise to 125.00
Villano: Call 75.00
*** FLOP *** [C7 D2 S9]
Villano: Check
Hero: Bet 100.00
Villano: Fold`,

  // ── Barrel suelto en el turn (check flop, bet turn, give up) → bluff-ev ──
  `GAME #1002 Texas Hold'em NL Tournament 2026-04-01 11:00:00/GMT
Table Info: Size: 2, Blinds: 25/50, Ante: 0
Seat 1: Hero (5000.00 in chips)  DEALER
Seat 2: Villano (5000.00 in chips)
Hero: Post SB 25.00
Villano: Post BB 50.00
*** HOLE CARDS ***
Dealt to Hero [DT D9]
Hero: Raise to 125.00
Villano: Call 75.00
*** FLOP *** [SK H4 C2]
Villano: Check
Hero: Check
*** TURN *** [DA]
Villano: Check
Hero: Bet 150.00
Villano: Call 150.00
*** RIVER *** [C7]
Villano: Check
Hero: Check`,

  // ── Shove sobre la apuesta del villano → all-in-ev ───────────────────────
  `GAME #1003 Texas Hold'em NL Tournament 2026-04-01 12:00:00/GMT
Table Info: Size: 2, Blinds: 25/50, Ante: 0
Seat 1: Hero (1500.00 in chips)  DEALER
Seat 2: Villano (1800.00 in chips)
Hero: Post SB 25.00
Villano: Post BB 50.00
*** HOLE CARDS ***
Dealt to Hero [HJ HT]
Hero: Raise to 125.00
Villano: Call 75.00
*** FLOP *** [H4 H8 S2]
Villano: Bet 150.00
Hero: Raise to 1375.00 and is all-in
Villano: Fold`,

  // ── Enfrentas una apuesta y pagas → call-vs-raise ────────────────────────
  `GAME #1004 Texas Hold'em NL Tournament 2026-04-01 13:00:00/GMT
Table Info: Size: 2, Blinds: 25/50, Ante: 0
Seat 1: Villano (4000.00 in chips)  DEALER
Seat 2: Hero (4000.00 in chips)
Villano: Post SB 25.00
Hero: Post BB 50.00
*** HOLE CARDS ***
Dealt to Hero [DQ CJ]
Villano: Raise to 150.00
Hero: Call 100.00
*** FLOP *** [HQ S7 D2]
Hero: Check
Villano: Bet 175.00
Hero: Call 175.00
*** TURN *** [C5]
Hero: Check
Villano: Check
*** RIVER *** [S3]
Hero: Check
Villano: Check`,
];

export type QuizSpot = {
  id: string;
  hand: ParsedHand;
  decision: Decision;
  /** The calc that fits — `suggestCalcForDecision().primary`. */
  correct: CalcMode;
  /** Also-valid calcs; excluded from distractors so wrong options are truly wrong. */
  alternatives: CalcMode[];
  /** Explanation shown after answering (reused from spotCalc). */
  rationale: string;
};

export type QuizQuestion = {
  spot: QuizSpot;
  /** 4 options, shuffled, exactly one is `spot.correct`. */
  options: CalcMode[];
};

const ALL_MODES: readonly CalcMode[] = CALC_GROUPS.flatMap((g) =>
  g.items.map((i) => i.mode),
);

/** The pedagogical group's modes for a given mode (for hard, near-miss distractors). */
function groupModesOf(mode: CalcMode): CalcMode[] {
  const group = CALC_GROUPS.find((g) => g.items.some((i) => i.mode === mode));
  return group ? group.items.map((i) => i.mode) : [];
}

function shuffle<T>(arr: readonly T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Parses the hand bank once and collects every analyzable postflop hero spot. */
function buildPool(): QuizSpot[] {
  const pool: QuizSpot[] = [];
  SPOT_HANDS.forEach((raw, hi) => {
    const { hand } = parseHandHistory(raw);
    if (!hand) return;
    for (const sd of hand.streets) {
      if (sd.street === 'preflop') continue;
      for (const d of sd.decisions) {
        if (!d.isHero) continue;
        const suggestion = suggestCalcForDecision(d, hand);
        if (!suggestion) continue;
        pool.push({
          id: `${hi}-${d.id}`,
          hand,
          decision: d,
          correct: suggestion.primary,
          alternatives: suggestion.alternatives,
          rationale: suggestion.rationale,
        });
      }
    }
  });
  return pool;
}

export const QUIZ_POOL: readonly QuizSpot[] = buildPool();

/** Builds one multiple-choice question: correct calc + 3 truly-wrong distractors. */
export function generateQuizQuestion(
  pool: readonly QuizSpot[] = QUIZ_POOL,
): QuizQuestion {
  const spot = pool[Math.floor(Math.random() * pool.length)]!;
  const exclude = new Set<CalcMode>([spot.correct, ...spot.alternatives]);
  const sameGroup = groupModesOf(spot.correct).filter((m) => !exclude.has(m));
  const others = ALL_MODES.filter(
    (m) => !exclude.has(m) && !sameGroup.includes(m),
  );
  // Prefer same-group distractors (harder), then fill from the rest.
  const distractors = [...shuffle(sameGroup), ...shuffle(others)].slice(0, 3);
  return { spot, options: shuffle([spot.correct, ...distractors]) };
}

/** Formats a chip amount in BB when blinds are known, else with the currency. */
export function formatAmount(hand: ParsedHand, n: number): string {
  const bb = hand.bigBlind;
  const trimmed = (v: number) => String(Math.round(v * 100) / 100);
  if (bb != null && bb > 0) return `${trimmed(n / bb)} BB`;
  return `${hand.currency}${trimmed(n)}`;
}

/** One-line prose description of the hero's decision, for the spot card. */
export function describeSpot(decision: Decision, hand: ParsedHand): string {
  const street = STREET_ES[decision.street];
  const pot = formatAmount(hand, decision.potBefore);
  if (decision.type === 'bet' || decision.type === 'raise') {
    const pct =
      decision.potBefore > 0
        ? Math.round((decision.amount / decision.potBefore) * 100)
        : null;
    const size = formatAmount(hand, decision.amount);
    return `En el ${street} apuestas ${size}${pct != null ? ` (${pct}% del bote)` : ''} en un bote de ${pot}.`;
  }
  if (decision.type === 'allin') {
    return `En el ${street} vas all-in por ${formatAmount(hand, decision.amount)} en un bote de ${pot}.`;
  }
  if (decision.type === 'call') {
    return `En el ${street} enfrentas una apuesta y te toca pagar ${formatAmount(hand, decision.amount)}.`;
  }
  return `Llegas al ${street} y checkeas en un bote de ${pot}. ¿Valuebet fino o check behind?`;
}

/** The board visible on the street of a decision. */
export function boardForDecision(decision: Decision, hand: ParsedHand) {
  return hand.streets.find((s) => s.street === decision.street)?.board ?? [];
}
