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
