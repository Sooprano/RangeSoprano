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
  /** Effective stack still behind after paying the current bet. */
  effectiveStack?: number;
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

/**
 * Chips the actor of `decision` still had to put in to continue: what the most
 * aggressive opponent committed on this street minus what the actor already
 * put in. Unlike reading the villain's bet amount raw, this is correct when the
 * hero had already bet and the villain raised over it (you only owe the
 * difference).
 */
function amountToCall(hand: ParsedHand, decision: Decision): number {
  const sd = hand.streets.find((s) => s.street === decision.street);
  if (!sd) return 0;
  const idx = sd.decisions.indexOf(decision);
  if (idx < 0) return 0;
  const committed: Record<string, number> = {};
  for (const d of sd.decisions.slice(0, idx)) {
    committed[d.actor] = (committed[d.actor] ?? 0) + d.amount;
  }
  const mine = committed[decision.actor] ?? 0;
  const theirs = Object.entries(committed)
    .filter(([name]) => name !== decision.actor)
    .reduce((max, [, v]) => Math.max(max, v), 0);
  return Math.max(0, theirs - mine);
}

/**
 * Chips each player still has behind at the moment `decision` is taken: their
 * starting stack minus everything they already put in the pot across the whole
 * hand (blinds and antes included, and the bet the hero is facing right now).
 */
function stacksBehind(
  hand: ParsedHand,
  decision: Decision,
): Record<string, number> {
  const behind: Record<string, number> = {};
  for (const p of hand.players) behind[p.name] = p.stack;
  for (const sd of hand.streets) {
    for (const d of sd.decisions) {
      if (d === decision) return behind;
      const left = behind[d.actor];
      if (left !== undefined) behind[d.actor] = left - d.amount;
    }
  }
  return behind;
}

/**
 * Money still playable behind the bet the hero is facing:
 *   - `effective`: the most the hero can still win on future streets — capped
 *     by the shortest stack, which is what implied odds are really limited by.
 *   - `shove`: total chips the hero would put in raising all-in, capped at what
 *     the villain can actually call (raising more than that wins nothing extra).
 * Null when the history carries no stacks to work with.
 */
function stackContext(
  hand: ParsedHand,
  decision: Decision,
  call: number,
): { effective: number; shove: number } | null {
  if (hand.players.length < 2) return null;
  const behind = stacksBehind(hand, decision);
  const mine = behind[decision.actor];
  if (mine === undefined) return null;
  const others = Object.entries(behind)
    .filter(([name]) => name !== decision.actor)
    .map(([, left]) => left);
  if (others.length === 0) return null;
  const opponent = Math.max(...others);
  return {
    effective: Math.max(0, Math.min(mine - call, opponent)),
    shove: Math.max(call, Math.min(mine, call + Math.max(0, opponent))),
  };
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
 * EV question (a post, a fold that faced nothing) or non-hero decisions. Seeds
 * carry every generic
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
    const stacks = stackContext(hand, decision, decision.amount);
    return {
      primary: 'call-vs-raise',
      seed: {
        pot: decision.potBefore,
        call: decision.amount,
        // Implied odds read `currentPot` as the pot the call is priced against
        // — the villain's bet included, your own call excluded. That is exactly
        // `potBefore`.
        currentPot: decision.potBefore,
        ...(stacks
          ? { effectiveStack: stacks.effective, shove: stacks.shove }
          : {}),
      },
      alternatives: ['implied-odds', 'ev-basic'],
      rationale:
        'Pagar una apuesta: compara el EV de pagar con tu equity contra el de restear. Implied odds si esperas cobrar más en calles futuras.',
    };
  }

  // ── Hero folds to a bet ─────────────────────────────────────────────────
  // A fold is a decision like any other: the question is whether the pot was
  // laying the price to continue. Same tool as a call (the calc already scores
  // Fold = 0 against it), so the hand doesn't go dark on the street where you
  // gave up — which is usually the one worth reviewing.
  if (decision.type === 'fold') {
    const call = amountToCall(hand, decision);
    if (call <= 0) return null; // folded facing nothing → no EV question
    const stacks = stackContext(hand, decision, call);
    return {
      primary: 'call-vs-raise',
      seed: {
        pot: decision.potBefore,
        call,
        currentPot: decision.potBefore, // ver el comentario del branch de call
        ...(stacks
          ? { effectiveStack: stacks.effective, shove: stacks.shove }
          : {}),
      },
      alternatives: ['implied-odds', 'ev-basic'],
      rationale:
        'Te tiraste: la pregunta es si el pot te daba precio. Ingresa la equity que tenías y compara el EV de pagar contra el 0 que vale el fold (la calc también evalúa restarte all-in). Si esperabas cobrar más en calles futuras, mira implied odds.',
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
