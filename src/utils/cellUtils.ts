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
