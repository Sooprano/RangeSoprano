import type { ActionDef, ActionId, LegacyAction } from '@/types/poker';

/** Hex colors that match the legacy --color-action-* CSS variables. */
const LEGACY_COLORS: Record<LegacyAction, string> = {
  RAISE: '#a855f7',
  '3BET': '#d946ef',
  ALL_IN: '#f59e0b',
  CALL: '#06b6d4',
  FOLD: '#3f3a5c',
};

/** Default action set seeded into legacy ranges (no `actions` field) on hydration. */
export const DEFAULT_ACTION_DEFS: ActionDef[] = [
  { id: 'RAISE', label: 'Raise', color: LEGACY_COLORS.RAISE, order: 0 },
  { id: '3BET', label: '3-Bet', color: LEGACY_COLORS['3BET'], order: 1 },
  { id: 'ALL_IN', label: 'All-In', color: LEGACY_COLORS.ALL_IN, order: 2 },
  { id: 'CALL', label: 'Call', color: LEGACY_COLORS.CALL, order: 3 },
  { id: 'FOLD', label: 'Fold', color: LEGACY_COLORS.FOLD, order: 4 },
];

/** Initial actions for a freshly created range (just Call + Raise, like the screenshot). */
export const NEW_RANGE_ACTION_DEFS: ActionDef[] = [
  { id: 'CALL', label: 'Call', color: '#22c55e', order: 0 },
  { id: 'RAISE', label: 'Raise', color: '#ef4444', order: 1 },
];

/** Color used when an action ID isn't found in the range's defs. */
export const ORPHAN_ACTION_COLOR = '#9ca3af';

export type ActionDefMap = ReadonlyMap<ActionId, ActionDef>;

export function buildActionDefMap(defs: ActionDef[]): ActionDefMap {
  const m = new Map<ActionId, ActionDef>();
  for (const d of defs) m.set(d.id, d);
  return m;
}

export function actionDefOf(defs: ActionDef[] | ActionDefMap, id: ActionId): ActionDef | undefined {
  if (defs instanceof Map) return defs.get(id);
  return (defs as ActionDef[]).find((d) => d.id === id);
}

export function actionColor(defs: ActionDef[] | ActionDefMap, id: ActionId): string {
  return actionDefOf(defs, id)?.color ?? ORPHAN_ACTION_COLOR;
}

export function actionLabel(defs: ActionDef[] | ActionDefMap, id: ActionId): string {
  return actionDefOf(defs, id)?.label ?? id;
}

export function actionOrder(defs: ActionDef[] | ActionDefMap, id: ActionId): number {
  return actionDefOf(defs, id)?.order ?? Number.POSITIVE_INFINITY;
}

/**
 * Sort actions by their order in `defs`, with stable fallback for IDs not in the map
 * (orphans go to the end, sorted by their string id).
 */
export function sortByActionOrder<T extends { action: ActionId }>(
  defs: ActionDef[] | ActionDefMap,
  list: readonly T[],
): T[] {
  return [...list].sort((a, b) => {
    const oa = actionOrder(defs, a.action);
    const ob = actionOrder(defs, b.action);
    if (oa !== ob) return oa - ob;
    return a.action.localeCompare(b.action);
  });
}
