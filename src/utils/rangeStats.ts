import type { Action, HandNotation, RangeCellData } from '@/types/poker';
import { combosOf, TOTAL_COMBOS } from '@/utils/handUtils';

export type ActionBreakdown = {
  /** Weighted combos contributed by this action across the whole range. */
  combos: number;
  /** Percentage of the 1326 total combos, 0..100. */
  pct: number;
};

export type RangeStats = {
  /** Sum of non-FOLD weighted combos. */
  activeCombos: number;
  /** activeCombos / TOTAL_COMBOS * 100. */
  totalPct: number;
  byAction: Record<Action, ActionBreakdown>;
  /** Actions that actually appear in the range with weight > 0. */
  presentActions: Action[];
};

const EMPTY_BREAKDOWN = (): Record<Action, ActionBreakdown> => ({
  RAISE: { combos: 0, pct: 0 },
  CALL: { combos: 0, pct: 0 },
  FOLD: { combos: 0, pct: 0 },
  '3BET': { combos: 0, pct: 0 },
  ALL_IN: { combos: 0, pct: 0 },
});

export function computeRangeStats(
  cells: Record<HandNotation, RangeCellData>,
): RangeStats {
  const byAction = EMPTY_BREAKDOWN();
  let activeCombos = 0;

  for (const hand in cells) {
    const cell = cells[hand];
    if (!cell) continue;
    const handCombos = combosOf(hand);
    for (const a of cell.actions) {
      const weighted = (a.weight / 100) * handCombos;
      byAction[a.action].combos += weighted;
      if (a.action !== 'FOLD') activeCombos += weighted;
    }
  }

  for (const key in byAction) {
    const a = key as Action;
    byAction[a].pct = (byAction[a].combos / TOTAL_COMBOS) * 100;
  }

  const presentActions = (Object.keys(byAction) as Action[]).filter(
    (a) => byAction[a].combos > 0,
  );

  return {
    activeCombos,
    totalPct: (activeCombos / TOTAL_COMBOS) * 100,
    byAction,
    presentActions,
  };
}
