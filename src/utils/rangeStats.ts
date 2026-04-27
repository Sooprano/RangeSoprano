import type { ActionId, HandNotation, RangeCellData } from '@/types/poker';
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
  byAction: Record<ActionId, ActionBreakdown>;
  /** Action ids that actually appear in the range with weight > 0. */
  presentActions: ActionId[];
};

/**
 * The "fold" action id is treated specially: it is excluded from the
 * "active combos" total. Any action whose id is exactly "FOLD" counts as fold.
 */
const FOLD_ID: ActionId = 'FOLD';

export function computeRangeStats(
  cells: Record<HandNotation, RangeCellData>,
): RangeStats {
  const byAction: Record<ActionId, ActionBreakdown> = {};
  let activeCombos = 0;

  for (const hand in cells) {
    const cell = cells[hand];
    if (!cell) continue;
    const handCombos = combosOf(hand);
    for (const a of cell.actions) {
      const weighted = (a.weight / 100) * handCombos;
      const slot = byAction[a.action] ?? { combos: 0, pct: 0 };
      slot.combos += weighted;
      byAction[a.action] = slot;
      if (a.action !== FOLD_ID) activeCombos += weighted;
    }
  }

  for (const key in byAction) {
    const slot = byAction[key]!;
    slot.pct = (slot.combos / TOTAL_COMBOS) * 100;
  }

  const presentActions = Object.keys(byAction).filter(
    (a) => (byAction[a]?.combos ?? 0) > 0,
  );

  return {
    activeCombos,
    totalPct: (activeCombos / TOTAL_COMBOS) * 100,
    byAction,
    presentActions,
  };
}
