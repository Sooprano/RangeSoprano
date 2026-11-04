// Loading the villain's preflop range from the library: the built-in GTO
// ranges of the site and the user's own ranges. Pure helpers (no React).

import type { ActionDef, ActionId, Range, RangeCellData } from '@/types/poker';
import { FOLD_ID } from '@/utils/actionMeta';
import { combosOf, TOTAL_COMBOS } from '@/utils/handUtils';
import type { WeightedHand } from '@/utils/handRangeParser';
import { serializeWeightedHands } from '@/utils/handRangeSerializer';

export type ActionShare = { def: ActionDef; share: number };

/** Each action of the range with its share of all 1326 combos. */
export function actionShares(range: Range): ActionShare[] {
  return [...range.actions]
    .sort((a, b) => a.order - b.order)
    .map((def) => {
      let combos = 0;
      for (const cell of Object.values(range.cells)) {
        for (const a of cell.actions) {
          if (a.action === def.id) combos += (combosOf(cell.hand) * a.weight) / 100;
        }
      }
      return { def, share: combos / TOTAL_COMBOS };
    });
}

/** By default every action counts except the explicit Fold. */
export function defaultActionIds(range: Range): ActionId[] {
  return range.actions.filter((a) => a.id !== FOLD_ID).map((a) => a.id);
}

/** Per-hand weight (0..100) summing the chosen actions. */
export function chosenWeights(range: Range, actionIds: readonly ActionId[]): WeightedHand[] {
  const chosen = new Set(actionIds);
  const out: WeightedHand[] = [];
  for (const cell of Object.values(range.cells)) {
    let w = 0;
    for (const a of cell.actions) if (chosen.has(a.action)) w += a.weight;
    if (w > 0) out.push({ hand: cell.hand, weight: Math.min(100, Math.round(w * 10) / 10) });
  }
  return out;
}

/** The chosen part of a range as text ("22-JJ, [50]QQ[/50], …"). */
export function rangeToText(range: Range, actionIds: readonly ActionId[]): string {
  return serializeWeightedHands(chosenWeights(range, actionIds), { weightTag: 'flopzilla' });
}

/** Cells restricted to the chosen actions, for the read-only preview grid. */
export function previewCells(
  range: Range,
  actionIds: readonly ActionId[],
): Record<string, RangeCellData> {
  const chosen = new Set(actionIds);
  const out: Record<string, RangeCellData> = {};
  for (const [hand, cell] of Object.entries(range.cells)) {
    const actions = cell.actions.filter((a) => chosen.has(a.action));
    if (actions.length > 0) out[hand] = { hand: cell.hand, actions };
  }
  return out;
}
