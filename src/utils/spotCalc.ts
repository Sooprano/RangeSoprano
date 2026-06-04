// Maps a hand-history decision to the EV calculator that fits it, with the
// pot/bet seeds pulled from the hand. Pure, no React.
//
// This is the shared brain behind two features: the análisis worksheet (which
// renders the suggested calc inline, pre-filled) and the future "¿Qué
// calculadora?" drill (which asks the user to pick the right tool for a spot).
// Building it once keeps both in sync.

import type { CalcMode } from '@/modules/calculators/calcMeta';
import type { Decision, ParsedHand, Street } from './handHistory';

const STREET_ORDER: readonly Street[] = ['preflop', 'flop', 'turn', 'river'];

/** Numeric seeds for a calc; the worksheet stringifies them (€ or BB) at render. */
export type CalcSeedNumbers = {
  pot?: number;
  bet?: number;
  call?: number;
  shove?: number;
  potTurn?: number;
  betTurn?: number;
  betRiver?: number;
  currentPot?: number;
  loseAmount?: number;
};

export type CalcSuggestion = {
  primary: CalcMode;
  seed: CalcSeedNumbers;
  /** Other calcs that also fit; the worksheet offers them in a dropdown. */
  alternatives: CalcMode[];
  /** Short reason shown to the user (and reusable as drill explanation). */
  rationale: string;
};

function streetIndex(street: Street): number {
  return STREET_ORDER.indexOf(street);
}

/**
 * True if the villain checked before the hero on the decision's street — i.e.
 * the hero acts last and is in position. Lets us frame a river check as a true
 * "check behind" (IP) vs a first-to-act check (OOP), where check-behind can't
 * happen. Single source of truth for both the worksheet rationale and the drill
 * prompt.
 */
export function villainCheckedBeforeHero(
  hand: ParsedHand,
  decision: Decision,
): boolean {
  const sd = hand.streets.find((s) => s.street === decision.street);
  if (!sd) return false;
  const idx = sd.decisions.indexOf(decision);
  if (idx <= 0) return false;
  return sd.decisions
    .slice(0, idx)
    .some((d) => !d.isHero && d.type === 'check');
}

/** Hero's first bet/raise decision on a given street, if any. */
export function heroAggressionOnStreet(
  hand: ParsedHand,
  street: Street,
): Decision | null {
  const sd = hand.streets.find((s) => s.street === street);
  if (!sd) return null;
  return (
    sd.decisions.find(
      (d) => d.isHero && (d.type === 'bet' || d.type === 'raise'),
    ) ?? null
  );
}

/** The aggressive amount the hero is facing on this street before `decision`. */
function villainBetFaced(hand: ParsedHand, decision: Decision): number {
  const sd = hand.streets.find((s) => s.street === decision.street);
  if (!sd) return 0;
  const idx = sd.decisions.indexOf(decision);
  for (let i = idx - 1; i >= 0; i--) {
    const d = sd.decisions[i]!;
    if (!d.isHero && (d.type === 'bet' || d.type === 'raise' || d.type === 'allin')) {
      return d.amount;
    }
  }
  return 0;
}

/** The two-street barrel line a hero bet participates in, if any. */
function barrelPairSeed(
  decision: Decision,
  hand: ParsedHand,
): { potTurn: number; betTurn: number; betRiver: number } | null {
  const idx = streetIndex(decision.street);
  if (decision.street === 'preflop') return null;
  const nextStreet = STREET_ORDER[idx + 1];
  const prevStreet = STREET_ORDER[idx - 1];
  const nextBarrel = nextStreet ? heroAggressionOnStreet(hand, nextStreet) : null;
  const prevBarrel =
    prevStreet && prevStreet !== 'preflop'
      ? heroAggressionOnStreet(hand, prevStreet)
      : null;
  // This bet is the first barrel of the pair.
  if (nextBarrel) {
    return {
      potTurn: decision.potBefore,
      betTurn: decision.amount,
      betRiver: nextBarrel.amount,
    };
  }
  // This bet is the second barrel: the line started on the previous street.
  if (prevBarrel) {
    return {
      potTurn: prevBarrel.potBefore,
      betTurn: prevBarrel.amount,
      betRiver: decision.amount,
    };
  }
  return null;
}

/** Drops the primary from the alternatives list (no duplicate chip). */
function withoutPrimary(primary: CalcMode, alts: CalcMode[]): CalcMode[] {
  return alts.filter((m) => m !== primary);
}

/**
 * The inputs the user must bring from Flopzilla (equity / villain reads) for a
 * given calc. The monetary fields (pot, bet) are seeded from the hand; these
 * are the ones the app can't know. Used to label the worksheet panel so the
 * user knows exactly what to read off Flopzilla.
 */
export function flopzillaInputsFor(mode: CalcMode): string[] {
  switch (mode) {
    case 'bluff-ev':
      return ['F% — con qué frecuencia se tira el villano'];
    case 'ev-complex':
      return ['F% — frecuencia de fold del villano', 'W% — tu equity cuando te pagan'];
    case 'double-barrel':
      return ['Fold% del villano en el turn', 'Fold% del villano en el river'];
    case 'all-in-ev':
      return ['Equity cuando te pagan', 'F% — fold del villano'];
    case 'call-vs-raise':
      return ['Equity al pagar', 'Win% si te pagan el raise', 'F% — fold vs tu raise'];
    case 'implied-odds':
      return ['Tu equity (% de completar el draw)'];
    case 'check-vs-bet':
      return [
        'Win% al showdown si checkeas',
        'Win% si te pagan la apuesta',
        'F% — fold del villano',
        'R% — frecuencia de raise',
      ];
    case 'check-ev':
      return [
        'Prob. de que el villano apueste',
        'Tu equity si pagas',
        'Tu equity si va check-check',
      ];
    case 'fold-equity-required':
      return ['Tu equity cuando te pagan'];
    case 'ev-basic':
      return ['% que esperas ganar'];
    default:
      return [];
  }
}

/**
 * Suggests the calculator for a hero decision. Returns null for actions with no
 * EV question (fold / post) or non-hero decisions. Seeds carry every generic
 * field the offered calcs may read, so switching to an alternative keeps the
 * hand's numbers pre-filled (not the calc's defaults).
 */
export function suggestCalcForDecision(
  decision: Decision,
  hand: ParsedHand,
): CalcSuggestion | null {
  if (!decision.isHero) return null;

  // ── Hero bets / raises ──────────────────────────────────────────────────
  if (decision.type === 'bet' || decision.type === 'raise') {
    const pair = barrelPairSeed(decision, hand);
    const idx = streetIndex(decision.street);
    const nextStreet = STREET_ORDER[idx + 1];
    const isFirstBarrel =
      decision.street !== 'preflop' &&
      nextStreet != null &&
      heroAggressionOnStreet(hand, nextStreet) != null;

    // Shared seed: every offered calc reads what it needs from here.
    const seed: CalcSeedNumbers = {
      pot: decision.potBefore,
      bet: decision.amount,
      currentPot: decision.potBefore,
      loseAmount: decision.amount,
      ...(pair ?? {}),
    };

    const primary: CalcMode = isFirstBarrel ? 'double-barrel' : 'bluff-ev';
    const alternatives = withoutPrimary(
      primary,
      pair ? ['double-barrel', 'bluff-ev', 'ev-complex'] : ['bluff-ev', 'ev-complex'],
    );

    return {
      primary,
      seed,
      alternatives,
      rationale: isFirstBarrel
        ? 'Apostaste esta calle y volviste a apostar la siguiente: la línea completa de dos barriles puede ser +EV aunque un barril suelto no lo sea.'
        : 'Una apuesta como bluff: cuánta fold equity necesitas para que sea rentable. Si tienes equity de respaldo, mira también EV con fold equity.',
    };
  }

  // ── Hero shoves all-in ──────────────────────────────────────────────────
  if (decision.type === 'allin') {
    const call = villainBetFaced(hand, decision);
    return {
      primary: 'all-in-ev',
      seed: {
        pot: decision.potBefore,
        call,
        shove: decision.amount,
        bet: decision.amount,
        currentPot: decision.potBefore,
      },
      alternatives: ['call-vs-raise', 'fold-equity-required'],
      rationale:
        'Un all-in combina fold equity y la equity cuando te pagan. El breakeven de fold te dice cuánto necesitas que se tiren.',
    };
  }

  // ── Hero calls a bet ────────────────────────────────────────────────────
  if (decision.type === 'call') {
    return {
      primary: 'call-vs-raise',
      seed: {
        pot: decision.potBefore,
        call: decision.amount,
        currentPot: decision.potBefore - decision.amount,
      },
      alternatives: ['implied-odds', 'ev-basic'],
      rationale:
        'Pagar una apuesta: compara el EV de pagar con tu equity contra el de restear. Implied odds si esperas cobrar más en calles futuras.',
    };
  }

  // ── Hero checks the river ────────────────────────────────────────────────
  // The right tool depends on position. In position (the villain checked to
  // hero) the choice is "check behind vs value bet" → check-vs-bet. Out of
  // position (hero acts first) you can't check behind, and betting thin only
  // folds out the villain's bluffs and gets called by better; the real question
  // is the EV of checking — villain checks back (no value) vs villain bluffs and
  // you call → check-ev (EV de checkear).
  if (decision.type === 'check' && decision.street === 'river') {
    const inPosition = villainCheckedBeforeHero(hand, decision);
    const seed: CalcSeedNumbers = {
      pot: decision.potBefore,
      currentPot: decision.potBefore,
    };
    if (inPosition) {
      return {
        primary: 'check-vs-bet',
        seed,
        alternatives: ['check-ev'],
        rationale:
          'El rival checkeó y estás en posición: compara el EV de checkear atrás (check behind) contra apostar, sea por valor fino o de farol (la calc maneja Win% = 0 cuando bluffeas). Ingresa un tamaño de apuesta hipotético y tus equities de Flopzilla.',
      };
    }
    return {
      primary: 'check-ev',
      seed,
      // check-vs-bet NO aplica fuera de posición: lo dejamos fuera de las
      // alternativas para que pueda aparecer como distractor incorrecto.
      alternatives: [],
      rationale:
        'Estás fuera de posición y hablas primero: no puedes check behind, y apostar fino tus manos de valor solo hace que el villano tire sus faroles y te pague con algo mejor. La herramienta es "EV de checkear": compara las veces que el villano checkea atrás (no sacas valor) contra las que apuesta de farol y le pagas. Trae de Flopzilla la prob. de que el villano apueste y tus equities.',
    };
  }

  return null;
}
