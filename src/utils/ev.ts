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
  raisePct?: number;          // 0-100, frecuencia de raise del villano (foldeás perdiendo tu bet)
};

// EV = F·Pot + C·(W·(Pot+Bet) − (1−W)·Bet) − R·Bet   con C = 1 − F − R (call)
// Con R=0 colapsa al modelo fold/call simple.
// Excel (Bet vs Check IP): el villano puede fold / call / raise; al raise foldeás.
export function betRiverEv(input: BetRiverEvInput): number {
  const f = input.foldPct / 100;
  const r = (input.raisePct ?? 0) / 100;
  const c = 1 - f - r;
  const w = input.winWhenCalledPct / 100;
  return (
    f * input.pot +
    c * (w * (input.pot + input.bet) - (1 - w) * input.bet) -
    r * input.bet
  );
}

export type CallRiverBetEvInput = {
  pot: number;        // pot del río incluyendo la apuesta del villano
  call: number;       // monto que pagás
  equityPct: number;  // 0-100, equity cuando pagás (qué tan seguido ganás el pot)
};

// EV = Pot · eq − Call · (1−eq)   (pagar una apuesta de río; sin acción futura)
// Excel: =(D7*D5)-(D6*(1-D7))
export function callRiverBetEv(input: CallRiverBetEvInput): number {
  const eq = input.equityPct / 100;
  return input.pot * eq - input.call * (1 - eq);
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

// ── Raise sizing & pot odds vs raise (flop) ──────────────────────────────────
// Los tres comparten Bote + Bet. Denominador `3·Bet + Bote` en el sizing y
// `2·Raise + Bote` en las pot odds son los del Excel del usuario; se replican
// tal cual (la UI muestra la fórmula sustituida).

export type RaiseSizingInput = {
  bote: number;       // pot antes de la apuesta
  bet: number;        // tamaño de la apuesta
  raiseSize: number;  // tamaño del raise en fichas
};

// % del pot que representa un raise. Devuelve 0-100. Excel: =E67/((3*E66)+E65)
export function raisePctOfPot(input: RaiseSizingInput): number {
  const denom = 3 * input.bet + input.bote;
  return denom > 0 ? (input.raiseSize / denom) * 100 : 0;
}

export type RaiseSizeFromPctInput = {
  bote: number;
  bet: number;
  pctOfPot: number;   // 0-100, % objetivo del pot
};

// Fichas del raise dado un % objetivo (inverso de raisePctOfPot).
// Excel: =(3*E74+E73)*E76
export function raiseSizeFromPct(input: RaiseSizeFromPctInput): number {
  return (3 * input.bet + input.bote) * (input.pctOfPot / 100);
}

// Equity necesaria para pagar un raise (pot odds). Devuelve 0-100.
// Excel: =(E82-E81)/(2*E82+E80)
export function potOddsVsRaise(input: RaiseSizingInput): number {
  const denom = 2 * input.raiseSize + input.bote;
  return denom > 0 ? ((input.raiseSize - input.bet) / denom) * 100 : 0;
}

export type DoubleBarrelEvInput = {
  potTurn: number;       // pot en el turn antes del bet del hero
  betTurn: number;       // bet del hero en el turn
  foldTurnPct: number;   // 0-100, fold del villano en el turn
  betRiver: number;      // bet del hero en el river (barrel)
  foldRiverPct: number;  // 0-100, fold del villano en el river (condicional a pagar el turn)
};

export type DoubleBarrelEvResult = {
  evTurnOnly: number;    // EV del bet del turn como bluff puro de una calle
  evCombined: number;    // EV de la línea completa turn + barrel river
  riverPot: number;      // pot del river derivado = potTurn + 2·betTurn
  pmeTurnPct: number;    // fold breakeven del turn = bet/(pot+bet)
  pmeRiverPct: number;   // fold breakeven del river = bet/(pot+bet)
};

// Línea de doble barrel (bluff en turn + barrel en river, 0 equity en showdown).
//   EV turn solo = fold_t·Pot_t − (1−fold_t)·Bet_t                         (Excel: =E93*E90-(1-E93)*E91)
//   EV combinado = fold_t·Pot_t                                            ← villano foldea el turn
//                + (1−fold_t)·fold_r·(Pot_t + Bet_t)                       ← paga turn, foldea river
//                − (1−fold_t)·(1−fold_r)·(Bet_t + Bet_r)                   ← paga ambas, perdés en showdown
//   (Excel descompuesto: =F90+H99-H100). riverPot = Pot_t + 2·Bet_t.
export function doubleBarrelEv(input: DoubleBarrelEvInput): DoubleBarrelEvResult {
  const ft = input.foldTurnPct / 100;
  const fr = input.foldRiverPct / 100;
  const riverPot = input.potTurn + 2 * input.betTurn;
  const evTurnOnly = ft * input.potTurn - (1 - ft) * input.betTurn;
  const evCombined =
    ft * input.potTurn +
    (1 - ft) * fr * (input.potTurn + input.betTurn) -
    (1 - ft) * (1 - fr) * (input.betTurn + input.betRiver);
  const turnDenom = input.potTurn + input.betTurn;
  const riverDenom = riverPot + input.betRiver;
  const pmeTurnPct = turnDenom > 0 ? (input.betTurn / turnDenom) * 100 : 0;
  const pmeRiverPct = riverDenom > 0 ? (input.betRiver / riverDenom) * 100 : 0;
  return { evTurnOnly, evCombined, riverPot, pmeTurnPct, pmeRiverPct };
}

export type ValueBluffInput = {
  pot: number;          // bote antes de la apuesta
  bet: number;          // bet del hero
  valueCombos: number;  // combos de valor en tu rango de apuesta
};

export type ValueBluffResult = {
  maxBluffCombos: number;  // combos de farol máximos para balancear el rango
  bluffFreqPct: number;    // % del rango de apuesta que son faroles = bet/(pot+2·bet)
  callFreqPct: number;     // MDF del villano = pot/(pot+bet)
  oddsRatio: number;       // precio del call = (pot+bet)/bet
};

// Cuántos combos de farol podés tener respecto a tus combos de valor para que el
// rango de apuesta quede balanceado (no explotable).
//   bluff combos = value · bet/(pot+bet)                    (Excel: =E116*E113/F116 simplificado)
//   frecuencia bluff = bet/(pot+2·bet)                       (Excel: =E112/(E111+2*E112))
//   frecuencia call (MDF) = pot/(pot+bet)                    (Excel: =-((E112/(E112+E111))-1))
//   odds = (pot+bet)/bet
export function valueBluffCombos(input: ValueBluffInput): ValueBluffResult {
  const potPlusBet = input.pot + input.bet;
  const potPlus2Bet = input.pot + 2 * input.bet;
  const maxBluffCombos =
    potPlusBet > 0 ? input.valueCombos * (input.bet / potPlusBet) : 0;
  const bluffFreqPct = potPlus2Bet > 0 ? (input.bet / potPlus2Bet) * 100 : 0;
  const callFreqPct = potPlusBet > 0 ? (input.pot / potPlusBet) * 100 : 0;
  const oddsRatio = input.bet > 0 ? potPlusBet / input.bet : 0;
  return { maxBluffCombos, bluffFreqPct, callFreqPct, oddsRatio };
}

export type FoldEquityRequiredInput = {
  pot: number;         // bote antes del shove
  shove: number;       // lo que shoveás (bet del hero); x = shove/pot
  equityPct: number;   // 0-100, tu equity cuando te pagan
};

export type FoldEquityRequiredResult = {
  shoveFractionPct: number;          // x·100 — el shove como % del pot
  // Fold breakeven teniendo en cuenta tu equity. null si tu equity ya domina
  // (denominador ≤ 0 → +EV con cualquier fold). Puede ser negativo: +EV con 0 folds.
  breakevenFoldPct: number | null;
  breakevenFoldNoEquityPct: number;  // referencia con E=0: x/(1+x)·100
  alwaysProfitable: boolean;         // true si es +EV aunque el villano nunca foldee
};

// Fold equity requerida cuando el raise es all-in, teniendo en cuenta tu equity.
// EV = −x + F·(x+1) + (1−F)·E·(1+2x), con EV=0 en el break-point:
//   F = [x − E·(1+2x)] / [1 + x − E·(1+2x)]
// donde x = fracción del pot que shoveás y E = tu equity cuando te pagan (0-1).
// Con E=0 colapsa a x/(1+x) = bet/(pot+bet) (breakeven de bluff puro).
export function foldEquityRequired(
  input: FoldEquityRequiredInput,
): FoldEquityRequiredResult {
  const x = input.pot > 0 ? input.shove / input.pot : 0;
  const e = input.equityPct / 100;
  const onePlus2x = 1 + 2 * x;
  const num = x - e * onePlus2x;
  const denom = 1 + x - e * onePlus2x;
  const breakevenFoldNoEquityPct = 1 + x > 0 ? (x / (1 + x)) * 100 : 0;
  if (denom <= 1e-9) {
    // Equity tan alta que el shove es +EV pase lo que pase con el fold.
    return {
      shoveFractionPct: x * 100,
      breakevenFoldPct: null,
      breakevenFoldNoEquityPct,
      alwaysProfitable: true,
    };
  }
  const f = num / denom;
  return {
    shoveFractionPct: x * 100,
    breakevenFoldPct: f * 100,
    breakevenFoldNoEquityPct,
    alwaysProfitable: f <= 0,
  };
}

// ── C · EV de checkear (compuesto: check-call vs check-check) ─────────────────
export type CheckCompoundEvInput = {
  pot: number;                  // pot cuando checkeás
  villainBetsPct: number;       // 0-100, prob de que el villano apueste
  villainBet: number;           // tamaño de la apuesta del villano si apuesta
  callEquityPct: number;        // 0-100, tu equity si pagás su apuesta
  checkCheckEquityPct: number;  // 0-100, tu equity si va a showdown sin apostar
};

export type CheckCompoundEvResult = {
  evCheckCall: number;   // eq·(pot+vbet) − (1−eq)·vbet
  evCheckCheck: number;  // eq·pot
  evTotal: number;       // pBet·checkCall + (1−pBet)·checkCheck
};

// Checkeás: a veces el villano apuesta y pagás (check-call), a veces checkea
// atrás y vas a showdown (check-check). Combina las dos ramas ponderadas.
export function checkCompoundEv(input: CheckCompoundEvInput): CheckCompoundEvResult {
  const pBet = input.villainBetsPct / 100;
  const eqCall = input.callEquityPct / 100;
  const eqXx = input.checkCheckEquityPct / 100;
  const evCheckCall =
    eqCall * (input.pot + input.villainBet) - (1 - eqCall) * input.villainBet;
  const evCheckCheck = eqXx * input.pot;
  const evTotal = pBet * evCheckCall + (1 - pBet) * evCheckCheck;
  return { evCheckCall, evCheckCheck, evTotal };
}

// ── D · EV del raise (bluff-raise; fold% directo o derivado de combos) ────────
export type RaiseBluffEvInput = {
  pot: number;         // bote antes del raise
  villainBet: number;  // apuesta del villano que vas a subir
  raiseCost: number;   // coste total de tu raise (lo que ponés de tu stack)
  foldPct: number;     // 0-100, fold del villano frente a tu raise
};

export type RaiseBluffEvResult = {
  ev: number;
  breakevenFoldPct: number;  // raiseCost / (raiseCost + pot + villainBet)
};

// Raise como bluff puro (0 equity si te pagan): si foldea te llevás pot+apuesta,
// si paga perdés el coste de tu raise. EV = F·(pot+vbet) − (1−F)·raiseCost.
export function raiseBluffEv(input: RaiseBluffEvInput): RaiseBluffEvResult {
  const f = input.foldPct / 100;
  const win = input.pot + input.villainBet;
  const ev = f * win - (1 - f) * input.raiseCost;
  const denom = input.raiseCost + win;
  const breakevenFoldPct = denom > 0 ? (input.raiseCost / denom) * 100 : 0;
  return { ev, breakevenFoldPct };
}

// Fold% derivado de combos: 1 − combosPagan/combosApuestan. Devuelve 0-100.
export function foldPctFromCombos(combosBet: number, combosCall: number): number {
  if (combosBet <= 0) return 0;
  const fold = 1 - combosCall / combosBet;
  return Math.max(0, Math.min(100, fold * 100));
}

// ── E · EV conjunto multi-calle (encadena turn + river) ──────────────────────
export type MultiStreetEvInput = {
  evTurn: number;       // EV de la acción del turn (puede ser negativo)
  seeRiverPct: number;  // 0-100, prob de llegar al river
  evRiver: number;      // EV de la acción del river (condicional a llegar)
};

// EV total = EV_turn + P(ver river) · EV_river.
export function multiStreetEv(input: MultiStreetEvInput): number {
  return input.evTurn + (input.seeRiverPct / 100) * input.evRiver;
}
