// Pure math for the Calculadoras module. No side effects, no React, no state.
// All percentages are passed as 0-100 (not 0-1) to match the form inputs.

export type EvBasicInput = {
  winAmount: number;
  winPct: number;
  loseAmount: number;
};

// EV = $W · W% − $L · L%   (L% = 100 − W%)
export function evBasic(input: EvBasicInput): number {
  const winFrac = input.winPct / 100;
  const loseFrac = 1 - winFrac;
  return input.winAmount * winFrac - input.loseAmount * loseFrac;
}

export type EvComplexInput = {
  foldPct: number;
  currentPot: number;
  winAmount: number;
  winPct: number;
  loseAmount: number;
};

// EV = F% · Pot + C% · ($W · W% − $L · L%)   (C% = 100 − F%, L% = 100 − W%)
export function evComplex(input: EvComplexInput): number {
  const foldFrac = input.foldPct / 100;
  const callFrac = 1 - foldFrac;
  const winFrac = input.winPct / 100;
  const loseFrac = 1 - winFrac;
  const evWhenCalled = input.winAmount * winFrac - input.loseAmount * loseFrac;
  return foldFrac * input.currentPot + callFrac * evWhenCalled;
}

export type ImpliedOddsInput = {
  callAmount: number;
  currentPot: number;
  equityPct: number;
};

export type ImpliedOddsResult = {
  potOddsNeededPct: number;
  impliedNeeded: number;
  isAlreadyProfitable: boolean;
};

// Pot odds needed = call / (pot + call)
// Implied future winnings needed for EV(call) ≥ 0: future = call/eq − call − pot
export function impliedOdds(input: ImpliedOddsInput): ImpliedOddsResult {
  const eq = input.equityPct / 100;
  const denom = input.currentPot + input.callAmount;
  const potOddsNeededPct = denom > 0 ? (input.callAmount / denom) * 100 : 0;
  const isAlreadyProfitable = denom > 0 && eq >= input.callAmount / denom;
  const rawNeeded =
    eq > 0 ? input.callAmount / eq - input.callAmount - input.currentPot : Infinity;
  return {
    potOddsNeededPct,
    impliedNeeded: Math.max(0, rawNeeded),
    isAlreadyProfitable,
  };
}

export type FloatEvInput = {
  potOnFlop: number;
  callOnFlop: number;
  barrelPct: number;
  xfPct: number;
  turnBet: number;
};

// EV = Barrel% · (−call) + X/F% · pot − (1 − Barrel% − X/F%) · (turnBet + call)
export function floatEv(input: FloatEvInput): number {
  const barrel = input.barrelPct / 100;
  const xf = input.xfPct / 100;
  const rest = 1 - barrel - xf;
  return (
    barrel * -input.callOnFlop +
    xf * input.potOnFlop -
    rest * (input.turnBet + input.callOnFlop)
  );
}

export type AllInEvInput = {
  pot: number;
  call: number;
  shove: number;
  equityPct: number;
  foldPct: number;
};

export type AllInEvResult = {
  ev: number;
  // Fold equity needed for EV=0 (analytic). null si no hay solución finita.
  breakevenFoldPct: number | null;
};

// EV = F% · Pot + (1−F%) · Eq · (Pot + Shove − Call) − (1−F%) · (1−Eq) · Shove
export function allInEv(input: AllInEvInput): AllInEvResult {
  const f = input.foldPct / 100;
  const eq = input.equityPct / 100;
  const winWhenCalled = input.pot + input.shove - input.call;
  const ev =
    f * input.pot +
    (1 - f) * eq * winWhenCalled -
    (1 - f) * (1 - eq) * input.shove;

  // EV = 0 ⟹ F* = B / (B − A)   con A = Pot, B = Eq·(Pot+Shove−Call) − (1−Eq)·Shove
  const a = input.pot;
  const b = eq * winWhenCalled - (1 - eq) * input.shove;
  const denom = b - a;
  // Raw analytic value; UI decide cómo mostrar valores fuera de [0, 100].
  const breakevenFoldPct = Math.abs(denom) < 1e-9 ? null : (b / denom) * 100;

  return { ev, breakevenFoldPct };
}

// Combined fold equity = ∏(fold_i / 100) · 100 sobre los inputs no nulos.
// Devuelve 0..100. Si todos los inputs son null, devuelve null (no hay datos).
export function combinedFoldEquity(
  foldPcts: readonly (number | null)[],
): number | null {
  const valid = foldPcts.filter((p): p is number => p !== null);
  if (valid.length === 0) return null;
  const product = valid.reduce((acc, p) => acc * (p / 100), 1);
  return product * 100;
}

export type CheckRiverEvInput = {
  pot: number;
  winPct: number;  // 0-100, frecuencia con que ganás al showdown si checkeás detrás
};

// EV = pot · win%  (cuando perdés simplemente no ganás nada extra; no hay bet en riesgo)
// Excel: =(D5*D6)
export function checkRiverEv(input: CheckRiverEvInput): number {
  return input.pot * (input.winPct / 100);
}

export type BetRiverEvInput = {
  pot: number;
  bet: number;
  winWhenCalledPct: number;  // 0-100, equity contra el rango que te paga (0% para bluff puro)
  foldPct: number;            // 0-100
};

// EV = F% · Pot + (1−F%) · WCalled% · (Pot + Bet) − (1−F%) · (1−WCalled%) · Bet
// Excel: =(D19*D16)+((1-D19)*D18*(D17+D16))-((1-D19)*(1-D18)*D17)
export function betRiverEv(input: BetRiverEvInput): number {
  const f = input.foldPct / 100;
  const w = input.winWhenCalledPct / 100;
  return f * input.pot + (1 - f) * w * (input.pot + input.bet) - (1 - f) * (1 - w) * input.bet;
}

export type BluffEvInput = {
  pot: number;
  bet: number;
  foldPct: number;  // 0-100
};

export type BluffEvResult = {
  ev: number;
  pickupAmount: number;     // foldPct · pot — lo que te llevás cuando se tira
  lossAmount: number;       // (1−foldPct) · bet — lo que perdés cuando paga
  // Breakeven bluff frequency: F* = bet / (bet + pot). Siempre en [0,100] si pot,bet ≥ 0.
  // null si pot + bet = 0 (sin solución).
  breakevenFoldPct: number | null;
};

// EV = F% · Pot − (1−F%) · Bet   (bluff puro, sin equity en showdown)
export function bluffEv(input: BluffEvInput): BluffEvResult {
  const f = input.foldPct / 100;
  const pickupAmount = f * input.pot;
  const lossAmount = (1 - f) * input.bet;
  const ev = pickupAmount - lossAmount;
  const denom = input.bet + input.pot;
  const breakevenFoldPct = denom > 0 ? (input.bet / denom) * 100 : null;
  return { ev, pickupAmount, lossAmount, breakevenFoldPct };
}

export type MultiWayCallEvInput = {
  pot: number;          // pot pre-mi-call (lo que ya hay en el centro antes de que yo llame)
  call: number;         // monto que llamo
  huEquityPct: number;  // 0-100, equity HU vs el shover
  othersCallPct: number;// 0-100, prob de que otros jugadores también llamen
  mwPot: number;        // pot efectivo si el bote queda MW (incluye mi call y los chips de los overcallers)
  mwEquityPct: number;  // 0-100, equity en el pot multi-way
};

// EV = pot·huEq·(1−oc) − call·(1−huEq)·(1−oc)
//    + (mwPot−call)·mwEq·oc − call·(1−mwEq)·oc
// Excel: =(C3*C6*(1-C8)) - (C4*(1-C6)*(1-C8)) + ((C9-C4)*C10*C8) - (C4*(1-C10)*C8)
export function multiWayCallEv(input: MultiWayCallEvInput): number {
  const huEq = input.huEquityPct / 100;
  const oc = input.othersCallPct / 100;
  const mwEq = input.mwEquityPct / 100;
  const evHu = input.pot * huEq - input.call * (1 - huEq);
  const evMw = (input.mwPot - input.call) * mwEq - input.call * (1 - mwEq);
  return evHu * (1 - oc) + evMw * oc;
}
