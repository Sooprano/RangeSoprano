import { describe, expect, it } from 'vitest';
import {
  betEv,
  betFromSize,
  bluffThreshold,
  calledBreakEven,
  callEv,
  checkEv,
  evTable,
  potOddsNeeded,
  raiseEv,
  raiseThreshold,
  villainEvTable,
} from '../ev';

describe('EV formulas (§9)', () => {
  it('check = equity × pot', () => {
    expect(checkEv({ pot: 10, heroEq: 0.6 })).toBeCloseTo(6, 12);
  });

  it('bet: worked example by hand', () => {
    // P = 10, B = 5, half the range folds, eqC = 40 %:
    // EV = 0.5·10 + 0.5·(0.4·20 − 5) = 5 + 1.5 = 6.5
    const r = betEv({ pot: 10, bet: 5, total: 100, cont: 50, eqCont: 0.4 });
    expect(r.foldEq).toBeCloseTo(0.5, 12);
    expect(r.ev).toBeCloseTo(6.5, 12);
  });

  it('bet: everybody folds → EV = pot (eqC irrelevant, even NaN)', () => {
    expect(betEv({ pot: 10, bet: 5, total: 50, cont: 0, eqCont: Number.NaN })).toEqual({
      ev: 10,
      foldEq: 1,
    });
  });

  it('bet: nobody folds → EV = eq·(P + 2B) − B', () => {
    const r = betEv({ pot: 10, bet: 7.5, total: 40, cont: 40, eqCont: 0.7 });
    expect(r.foldEq).toBe(0);
    expect(r.ev).toBeCloseTo(0.7 * 25 - 7.5, 12);
  });

  it('a pure bluff (eqC = 0) breaks even exactly at the threshold fold equity', () => {
    // With eqC = 0 a bet is a pure bluff: EV = f·P − (1−f)·B, zero at f = B/(P+B).
    const pot = 10;
    const bet = betFromSize(pot, 75);
    const f = bluffThreshold(pot, bet);
    expect(f).toBeCloseTo(7.5 / 17.5, 12);
    const r = betEv({ pot, bet, total: 1, cont: 1 - f, eqCont: 0 });
    expect(r.ev).toBeCloseTo(0, 12);
  });

  it('called break-even: the called branch is 0 EV at eqC = B/(P+2B)', () => {
    const pot = 10;
    const bet = 5;
    const eq = calledBreakEven(pot, bet);
    expect(eq).toBeCloseTo(0.25, 12);
    expect(eq * (pot + 2 * bet) - bet).toBeCloseTo(0, 12);
  });

  it('empty range → NaN', () => {
    expect(Number.isNaN(betEv({ pot: 10, bet: 5, total: 0, cont: 0, eqCont: 0.5 }).ev)).toBe(true);
  });
});

describe('EV table', () => {
  it('computes every row, marks the best and reports % of the pot', () => {
    const t = evTable(
      [
        { id: 'check', kind: 'check' },
        { id: 'bet-33', kind: 'bet', sizePct: 33, cont: 80, eqCont: 0.7 },
        { id: 'bet-75', kind: 'bet', sizePct: 75, cont: 40, eqCont: 0.8 },
      ],
      { pot: 10, total: 100, heroEqFull: 0.75 },
    );
    const byId = Object.fromEntries(t.rows.map((r) => [r.id, r]));
    expect(byId.check!.ev).toBeCloseTo(7.5, 12);
    // 0.2·10 + 0.8·(0.7·16.6 − 3.3) = 2 + 0.8·8.32 = 8.656
    expect(byId['bet-33']!.ev).toBeCloseTo(8.656, 9);
    // 0.6·10 + 0.4·(0.8·25 − 7.5) = 6 + 5 = 11
    expect(byId['bet-75']!.ev).toBeCloseTo(11, 9);
    expect(byId['bet-75']!.evPot).toBeCloseTo(1.1, 9);
    expect(byId['bet-75']!.follows).toBeCloseTo(0.4, 12);
    expect(t.bestId).toBe('bet-75');
  });

  it('EV scales with the pot: % of the pot does not depend on it', () => {
    const rows = [{ id: 'b', kind: 'bet' as const, sizePct: 50, cont: 30, eqCont: 0.55 }];
    const a = evTable(rows, { pot: 1, total: 100, heroEqFull: 0.5 });
    const b = evTable(rows, { pot: 22.7, total: 100, heroEqFull: 0.5 });
    expect(b.rows[0]!.ev).toBeCloseTo(a.rows[0]!.ev * 22.7, 9);
    expect(b.rows[0]!.evPot).toBeCloseTo(a.rows[0]!.evPot, 12);
  });
});

describe('"Villano apuesta" formulas', () => {
  it('call = eq·(P + 2V) − V; pot odds V/(P + 2V)', () => {
    // P = 10, V = 5: pot after calling 20, need 5/20 = 25 %.
    expect(callEv(10, 5, 0.4)).toBeCloseTo(0.4 * 20 - 5, 12);
    expect(potOddsNeeded(10, 5)).toBeCloseTo(0.25, 12);
    expect(callEv(10, 5, 0.25)).toBeCloseTo(0, 12);
  });

  it('raise: worked example by hand', () => {
    // P = 10, V = 5, raise to R = 15. 60 % of the betting range folds, eqC = 30 %:
    // EV = 0.6·15 + 0.4·(0.3·40 − 15) = 9 − 1.2 = 7.8
    const r = raiseEv({ pot: 10, bet: 5, raiseTo: 15, betRange: 50, cont: 20, eqCont: 0.3 });
    expect(r.foldEq).toBeCloseTo(0.6, 12);
    expect(r.ev).toBeCloseTo(7.8, 12);
  });

  it('a pure bluff-raise breaks even at R/(P + V + R)', () => {
    const f = raiseThreshold(10, 5, 15);
    expect(f).toBeCloseTo(0.5, 12);
    const r = raiseEv({ pot: 10, bet: 5, raiseTo: 15, betRange: 1, cont: 1 - f, eqCont: 0 });
    expect(r.ev).toBeCloseTo(0, 12);
  });

  it('table: fold 0, call, raise N× of the villain bet; marks the best', () => {
    const t = villainEvTable(
      [
        { id: 'fold', kind: 'fold' },
        { id: 'call', kind: 'call', betRange: 50, eq: 0.4 },
        { id: 'raise-3', kind: 'raise', multiple: 3, betRange: 50, cont: 20, eqCont: 0.3 },
      ],
      { pot: 10, betPct: 50 },
    );
    const byId = Object.fromEntries(t.rows.map((r) => [r.id, r]));
    expect(byId.fold!.ev).toBe(0);
    expect(byId.call!.ev).toBeCloseTo(3, 12);
    expect(byId.call!.calledBreakEven).toBeCloseTo(0.25, 12);
    expect(byId['raise-3']!.bet).toBeCloseTo(15, 12);
    expect(byId['raise-3']!.ev).toBeCloseTo(7.8, 12);
    expect(byId['raise-3']!.follows).toBeCloseTo(0.4, 12);
    expect(byId['raise-3']!.bluffThreshold).toBeCloseTo(0.5, 12);
    expect(t.bestId).toBe('raise-3');
  });
});
