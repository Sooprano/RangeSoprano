// EV formulas, "Hero decide" mode (spec §9). Pure TS, no React.
//
//   P = pot · B = bet · total = Σ weights at the start of the street ·
//   cont = Σ weights that continue against the bet.
//   Check: EV = eqVsFullRange · P
//   Bet B: f = 1 − cont / total
//          eqC = Hero equity vs the continuing range
//          EV = f·P + (1 − f)·(eqC·(P + 2B) − B)
//
// Assumption shown in the UI: equity to the river with no further betting;
// equity realization is not modelled.

export type CheckEvInput = { pot: number; heroEq: number };

export function checkEv({ pot, heroEq }: CheckEvInput): number {
  return heroEq * pot;
}

export type BetEvInput = {
  pot: number;
  bet: number;
  /** Σ weights of the range when the street starts. */
  total: number;
  /** Σ weights of the range that continues against the bet. */
  cont: number;
  /** Hero equity vs the continuing range (ignored when nothing continues). */
  eqCont: number;
};

export type BetEv = {
  ev: number;
  /** Fold equity: share of the range that folds, 0..1. */
  foldEq: number;
};

export function betEv({ pot, bet, total, cont, eqCont }: BetEvInput): BetEv {
  if (!(total > 0)) return { ev: Number.NaN, foldEq: Number.NaN };
  const c = Math.min(Math.max(cont, 0), total);
  const foldEq = 1 - c / total;
  // When nothing continues the showdown term vanishes (and eqCont is NaN).
  const showdown = foldEq >= 1 ? 0 : (1 - foldEq) * (eqCont * (pot + 2 * bet) - bet);
  return { ev: foldEq * pot + showdown, foldEq };
}

/** Fold equity a pure bluff needs to break even: B / (P + B). */
export function bluffThreshold(pot: number, bet: number): number {
  return pot + bet > 0 ? bet / (pot + bet) : Number.NaN;
}

/**
 * Equity Hero needs against the calling range for the called branch to break
 * even on its own: eqC·(P + 2B) − B ≥ 0  ⇔  eqC ≥ B / (P + 2B).
 */
export function calledBreakEven(pot: number, bet: number): number {
  return pot + 2 * bet > 0 ? bet / (pot + 2 * bet) : Number.NaN;
}

/** Bet in chips from a size in % of the pot. */
export function betFromSize(pot: number, sizePct: number): number {
  return (pot * sizePct) / 100;
}

export type EvRowInput =
  | { id: string; kind: 'check' }
  | { id: string; kind: 'bet'; sizePct: number; cont: number; eqCont: number };

export type EvRowResult = {
  id: string;
  /** EV in pot units (bb when the pot is in bb). */
  ev: number;
  /** EV as a share of the pot. */
  evPot: number;
  /** Share of the starting range that continues (1 for check). */
  follows: number;
  foldEq: number;
  /** Hero equity vs what continues (vs the whole range for check). */
  heroEq: number;
  /** Bets only: B / (P + B). */
  bluffThreshold: number | null;
  /** Bets only: B / (P + 2B), the equity needed when called. */
  calledBreakEven: number | null;
  bet: number | null;
  /** Raise rows with a re-raise all-in range (D133). */
  reraise?: ReraiseResult | null;
};

/** What the villain's all-in over Hero's raise does to the raise (D133). */
export type ReraiseResult = {
  /** Share of what goes on vs the raise that re-raises all-in. */
  share: number;
  /** Hero equity vs the all-in range. */
  eq: number;
  /** Equity needed to call the all-in: (A − R) / (P + 2A). */
  need: number;
  /** EV of calling the all-in, from the start of the street (fold = −R). */
  callEv: number;
  /** Folding loses the raise (−R). */
  foldEv: number;
  /** Calling is better than folding. */
  call: boolean;
  /** The villain's total on the street when all in (A). */
  allInTo: number;
};

export type EvTable = { rows: EvRowResult[]; bestId: string | null };

/**
 * EV of every Hero row of a street. `pot` may be unknown: EV in pot units is
 * still computed with P = 1, and the UI shows only the % of the pot.
 */
export function evTable(
  rows: readonly EvRowInput[],
  ctx: { pot: number; total: number; heroEqFull: number },
): EvTable {
  const { pot, total, heroEqFull } = ctx;
  const out: EvRowResult[] = rows.map((r) => {
    if (r.kind === 'check') {
      const ev = checkEv({ pot, heroEq: heroEqFull });
      return {
        id: r.id,
        ev,
        evPot: pot > 0 ? ev / pot : Number.NaN,
        follows: 1,
        foldEq: 0,
        heroEq: heroEqFull,
        bluffThreshold: null,
        calledBreakEven: null,
        bet: null,
      };
    }
    const bet = betFromSize(pot, r.sizePct);
    const { ev, foldEq } = betEv({ pot, bet, total, cont: r.cont, eqCont: r.eqCont });
    return {
      id: r.id,
      ev,
      evPot: pot > 0 ? ev / pot : Number.NaN,
      follows: total > 0 ? Math.min(1, Math.max(0, r.cont / total)) : Number.NaN,
      foldEq,
      heroEq: r.eqCont,
      bluffThreshold: bluffThreshold(pot, bet),
      calledBreakEven: calledBreakEven(pot, bet),
      bet,
    };
  });
  return { rows: out, bestId: bestOf(out) };
}

/** Id of the row with the highest finite EV (ties: the first one). */
function bestOf(rows: readonly EvRowResult[]): string | null {
  let bestId: string | null = null;
  let best = Number.NEGATIVE_INFINITY;
  for (const r of rows) {
    if (Number.isFinite(r.ev) && r.ev > best + 1e-12) {
      best = r.ev;
      bestId = r.id;
    }
  }
  return bestId;
}

// ── "Villano apuesta" (§9, second mode) ──────────────────────────────────────
//
//   P = pot before the villain's bet · V = villain's bet · R = Hero's raise
//   (total, "raise to") · betRange = Σ weights the villain bets with ·
//   cont = Σ weights that call the raise (a subset of betRange).
//   Fold:  EV = 0 (chips already in the pot are sunk)
//   Call:  EV = eq·(P + 2V) − V            · needs eq ≥ V / (P + 2V)
//   Raise: f = 1 − cont / betRange
//          EV = f·(P + V) + (1 − f)·(eqC·(P + 2R) − R)
//          auto-profit at f ≥ R / (P + V + R); if called needs eqC ≥ R / (P + 2R)

export function callEv(pot: number, bet: number, eq: number): number {
  return eq * (pot + 2 * bet) - bet;
}

/** Equity needed to call by pot odds: V / (P + 2V). */
export function potOddsNeeded(pot: number, bet: number): number {
  return pot + 2 * bet > 0 ? bet / (pot + 2 * bet) : Number.NaN;
}

export type RaiseEvInput = {
  pot: number;
  bet: number;
  raiseTo: number;
  /** Σ weights of the villain's betting range. */
  betRange: number;
  /** Σ weights that go on vs the raise (call or re-raise all-in). */
  cont: number;
  eqCont: number;
  /**
   * The part of `cont` that re-raises all-in (D133): Σ weights, Hero equity vs
   * it, Hero equity vs the part that only calls, and the villain's all-in
   * total on the street (A). Without it, everything that goes on calls.
   */
  shove?: { cont: number; eq: number; eqCall: number; allInTo: number } | null;
};

/**
 * EV of raising to R over a bet V (pot P before the bet):
 *   fold eq. × (P + V)
 *   + calls × (eq_call × (P + 2R) − R)
 *   + re-raises all-in × max(eq_all-in × (P + 2A) − A, −R)
 * (all as shares of the betting range). Facing the all-in Hero takes the
 * better of calling and folding.
 */
export function raiseEv({
  pot,
  bet,
  raiseTo,
  betRange,
  cont,
  eqCont,
  shove,
}: RaiseEvInput): BetEv & { reraise: ReraiseResult | null } {
  if (!(betRange > 0)) return { ev: Number.NaN, foldEq: Number.NaN, reraise: null };
  const c = Math.min(Math.max(cont, 0), betRange);
  const foldEq = 1 - c / betRange;
  const R = raiseTo;
  const A = shove?.allInTo ?? 0;
  // A re-raise needs chips behind the raise; a raise that is already all in has none.
  if (!shove || !(A > R) || !(shove.cont > 0) || c <= 0) {
    const showdown = foldEq >= 1 ? 0 : (1 - foldEq) * (eqCont * (pot + 2 * R) - R);
    return { ev: foldEq * (pot + bet) + showdown, foldEq, reraise: null };
  }
  const s = Math.min(shove.cont, c);
  const callShare = (c - s) / betRange;
  const shoveShare = s / betRange;
  const callEvShove = shove.eq * (pot + 2 * A) - A;
  const best = Math.max(callEvShove, -R);
  const ev =
    foldEq * (pot + bet) + callShare * (shove.eqCall * (pot + 2 * R) - R) + shoveShare * best;
  return {
    ev,
    foldEq,
    reraise: {
      share: s / c,
      eq: shove.eq,
      need: (A - R) / (pot + 2 * A),
      callEv: callEvShove,
      foldEv: -R,
      call: callEvShove > -R,
      allInTo: A,
    },
  };
}

/** Fold equity a pure bluff-raise needs: R / (P + V + R). */
export function raiseThreshold(pot: number, bet: number, raiseTo: number): number {
  const d = pot + bet + raiseTo;
  return d > 0 ? raiseTo / d : Number.NaN;
}

export type VillainRowInput =
  | { id: string; kind: 'fold' }
  | { id: string; kind: 'call'; betRange: number; eq: number }
  | {
      id: string;
      kind: 'raise';
      multiple: number;
      betRange: number;
      cont: number;
      eqCont: number;
      shove?: RaiseEvInput['shove'];
    };

/**
 * EV of Fold / Call / Raise rows when the villain bets `betPct` % of the pot.
 * Same result shape as the Hero-decide table so the UI renders both alike:
 * `bluffThreshold` = auto-profit fold equity, `calledBreakEven` = equity
 * needed when the money goes in (pot odds for a call).
 */
export function villainEvTable(
  rows: readonly VillainRowInput[],
  ctx: { pot: number; betPct: number },
): EvTable {
  const { pot } = ctx;
  const bet = betFromSize(pot, ctx.betPct);
  const out: EvRowResult[] = rows.map((r) => {
    if (r.kind === 'fold') {
      return {
        id: r.id,
        ev: 0,
        evPot: 0,
        follows: Number.NaN,
        foldEq: Number.NaN,
        heroEq: Number.NaN,
        bluffThreshold: null,
        calledBreakEven: null,
        bet: null,
      };
    }
    if (r.kind === 'call') {
      const ev = callEv(pot, bet, r.eq);
      return {
        id: r.id,
        ev,
        evPot: pot > 0 ? ev / pot : Number.NaN,
        follows: Number.NaN,
        foldEq: Number.NaN,
        heroEq: r.eq,
        bluffThreshold: null,
        calledBreakEven: potOddsNeeded(pot, bet),
        bet,
      };
    }
    const raiseTo = bet * r.multiple;
    const { ev, foldEq, reraise } = raiseEv({
      pot,
      bet,
      raiseTo,
      betRange: r.betRange,
      cont: r.cont,
      eqCont: r.eqCont,
      shove: r.shove ?? null,
    });
    return {
      id: r.id,
      ev,
      evPot: pot > 0 ? ev / pot : Number.NaN,
      follows: r.betRange > 0 ? Math.min(1, Math.max(0, r.cont / r.betRange)) : Number.NaN,
      foldEq,
      heroEq: r.eqCont,
      bluffThreshold: raiseThreshold(pot, bet, raiseTo),
      calledBreakEven: calledBreakEven(pot, raiseTo),
      bet: raiseTo,
      reraise,
    };
  });
  return { rows: out, bestId: bestOf(out) };
}
