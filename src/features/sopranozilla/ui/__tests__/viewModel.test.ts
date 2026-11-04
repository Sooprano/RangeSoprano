import { describe, expect, it } from 'vitest';
import { MADE_CATEGORIES } from '../../engine/categories';
import { streetView, type ChainInput } from '../../engine/chain';
import { combosOfClass } from '../../engine/combos';
import { buildSpotRunouts, computeEqCombos, newEqComboTable } from '../../engine/equity';
import { activeCombos } from '../../engine/combos';
import { emptyActionRow, fullActionRow } from '../../engine/weights';
import { defaultStreetState } from '../../store/analyzerStore';
import { buildTestHand, DEFAULT_TEST_HAND } from '../testHand';
import { equityOf, gridCells, rowsForStreet, tableModel } from '../viewModel';

const built = buildTestHand(DEFAULT_TEST_HAND);
if (!built.ok) throw new Error('default test hand must build');

function input(): ChainInput {
  return {
    hand: built.ok ? built.hand : (undefined as never),
    villainPreflop: built.ok ? built.villain : (undefined as never),
    streets: {
      flop: defaultStreetState('flop'),
      turn: defaultStreetState('turn'),
      river: defaultStreetState('river'),
    },
    filters: [],
  };
}

describe('default test hand', () => {
  it('is A♠K♠ BTN vs BB on K♥9♥4♣ 7♠ 2♦ with pots 5.5 / 9.1 / 22.7', () => {
    if (!built.ok) return;
    expect(built.warnings).toEqual([]);
    expect(built.hand.board).toHaveLength(5);
    expect(built.hand.pots).toEqual({ flop: 5.5, turn: 9.1, river: 22.7 });
    expect(built.hand.heroPosition).toBe('BTN');
  });

  it('rejects bad input with readable errors', () => {
    const bad = buildTestHand({ ...DEFAULT_TEST_HAND, hero: 'AsKh', board: 'Ah 2c' });
    expect(bad.ok).toBe(false);
  });
});

describe('table model', () => {
  const view = streetView(input(), 'flop')!;
  const cont = view.rows.check!;

  it('made rows add up to the total; footer counts match', () => {
    const m = tableModel(view, cont, fullActionRow(), null, []);
    const made = m.groups.find((g) => g.id === 'made')!;
    const sum = made.rows.reduce((s, r) => s + r.combos, 0);
    expect(sum).toBeCloseTo(m.total, 9);
    expect(m.follows).toBeCloseTo(m.total, 9); // "Todo ✓ 100"
    expect(m.total).toBeGreaterThan(100);
  });

  it('per-row Hero equity once the equity table is filled', () => {
    const spot = buildSpotRunouts(input().hand.hero, view.board);
    const eq = computeEqCombos(spot, activeCombos(view.start), newEqComboTable());
    const m = tableModel(view, cont, fullActionRow(), eq, []);
    const tp = m.groups[0]!.rows.find(
      (r) => r.target.kind === 'cat' && r.target.id === 'top-pair',
    )!;
    expect(tp.combos).toBeGreaterThan(0);
    expect(tp.heroEq).toBeGreaterThan(0.5); // AK on a K-high board vs weaker kings
    const overall = equityOf(view.start, eq);
    expect(overall).toBeGreaterThan(0.5);
    expect(overall).toBeLessThan(1);
  });

  it('streets show only the rows that exist there', () => {
    expect(rowsForStreet('flop').combo).toContain('bdsd-bdfd');
    expect(rowsForStreet('turn').combo).not.toContain('bdsd-bdfd');
    expect(rowsForStreet('turn').draws).not.toContain('bdfd-2');
    expect(rowsForStreet('river').draws).toEqual(['two-overcards', 'one-overcard']);
    expect(rowsForStreet('river').combo).toEqual([]);
    expect(rowsForStreet('river').made).toEqual([...MADE_CATEGORIES]);
  });
});

describe('grid cells', () => {
  const view = streetView(input(), 'flop')!;

  it('blocked classes are dead; in-range and follow shares are consistent', () => {
    const cells = gridCells(view, view.rows.check!, fullActionRow(), null, []);
    expect(cells).toHaveLength(169);
    const ak = cells.find((c) => c.hand === 'AKs')!;
    expect(ak.live).toBe(2); // A♠K♠ is Hero, K♥ on board → A♥K♥ out, A♦K♦ and A♣K♣ live
    const jj = cells.find((c) => c.hand === 'JJ')!;
    expect(jj.inRange).toBe(1);
    expect(jj.follows).toBe(1);
    expect(cells.find((c) => c.hand === 'QQ')!.inRange).toBe(0.5);
    for (const c of cells) expect(c.follows).toBeLessThanOrEqual(c.inRange + 1e-12);
  });

  it('reports which part of each class the selected row explains', () => {
    // K♥ 9♥ 4♣: the three 88 combos with the 8♥ are "BDFD 1 carta".
    const cells = gridCells(
      view,
      view.rows.check!,
      fullActionRow(),
      { kind: 'cat', id: 'bdfd-1' },
      [],
    );
    const c88 = cells.find((c) => c.hand === '88')!;
    expect(c88.highlighted).toBe(true);
    expect(c88.categoryShare).toBeCloseTo(0.5, 12);
    expect(c88.categoryCombos).toBeCloseTo(3, 12);
    // T8s: its only heart combo (T♥8♥) is a 2-card flush draw, not BDFD 1 carta.
    expect(cells.find((c) => c.hand === 'T8s')!.categoryShare).toBe(0);
    // No row selected → no share.
    expect(
      gridCells(view, view.rows.check!, fullActionRow(), null, [])[0]!.categoryShare,
    ).toBeNull();
  });

  it('highlights the selected row and marks painted classes', () => {
    const row = { ...emptyActionRow(), classOverrides: { JJ: 40 } };
    const cells = gridCells(view, view.rows.check!, row, { kind: 'cat', id: 'set' }, []);
    expect(cells.find((c) => c.hand === '99')!.highlighted).toBe(true);
    expect(cells.find((c) => c.hand === 'JJ')!.highlighted).toBe(false);
    expect(cells.find((c) => c.hand === 'JJ')!.overridden).toBe(true);
    expect(combosOfClass('99')).toHaveLength(6);
  });
});
