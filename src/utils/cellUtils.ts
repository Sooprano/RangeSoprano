import type { Action, HandAction, HandNotation, RangeCellData } from '@/types/poker';

export type UpsertResult =
  | { kind: 'update'; cell: RangeCellData }
  | { kind: 'clear' };

/**
 * Pure helper that computes the result of painting `action` with `weight`
 * onto an existing cell (or empty slot), respecting the sum-of-weights ≤ 100
 * cap without mutating others. Caller decides whether to call `upsertCell`
 * or `clearCell` on the store based on the returned kind.
 *
 * Semantics:
 * - weight ≥ 100 → replace the cell with a single-action entry at 100%.
 * - weight ≤ 0   → remove the action; if the cell becomes empty, signal clear.
 * - 0 < weight < 100 → keep other actions untouched; clamp the requested
 *   weight to the remaining room (`100 - sumOthers`). When there is no room
 *   left the action is not added and the others are preserved.
 */
export function upsertActionInCell(
  existing: RangeCellData | undefined,
  hand: HandNotation,
  action: Action,
  weight: number,
): UpsertResult {
  const clamped = Math.max(0, Math.min(100, weight));
  const existingActions = existing?.actions ?? [];
  const others = existingActions.filter((a) => a.action !== action);

  if (clamped >= 100) {
    return {
      kind: 'update',
      cell: { hand, actions: [{ action, weight: 100 }] },
    };
  }

  if (clamped <= 0) {
    if (others.length === 0) return { kind: 'clear' };
    return { kind: 'update', cell: { hand, actions: others } };
  }

  const sumOthers = others.reduce((acc, a) => acc + a.weight, 0);
  const room = 100 - sumOthers;
  if (room <= 0) {
    if (others.length === 0) return { kind: 'clear' };
    return { kind: 'update', cell: { hand, actions: others } };
  }

  const finalWeight = Math.min(clamped, room);
  const nextActions: HandAction[] = [...others, { action, weight: finalWeight }];
  return { kind: 'update', cell: { hand, actions: nextActions } };
}

/**
 * Paints `action` at `weight` onto every hand of a local (non-store) cell map,
 * with the exact semantics of the Editor's `upsertActionInCell` — so a mixed
 * cell is drawn in two passes (Raise 20% then All in 80%). Returns the same
 * object when nothing changed.
 */
export function paintHands(
  cells: Record<HandNotation, RangeCellData>,
  hands: readonly HandNotation[],
  action: Action,
  weight: number,
): Record<HandNotation, RangeCellData> {
  let next: Record<HandNotation, RangeCellData> | null = null;
  for (const hand of hands) {
    const current = next ?? cells;
    const result = upsertActionInCell(current[hand], hand, action, weight);
    if (result.kind === 'clear') {
      if (!(hand in current)) continue;
      next ??= { ...cells };
      delete next[hand];
    } else {
      next ??= { ...cells };
      next[hand] = result.cell;
    }
  }
  return next ?? cells;
}
