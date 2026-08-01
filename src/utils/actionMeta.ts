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

/** Action id the trainer sampler emits for hands outside the range (implicit fold). */
export const FOLD_ID: ActionId = 'FOLD';

/** Synthetic Fold action used when a range's palette has no fold action of its own. */
export const FOLD_FALLBACK_DEF: ActionDef = {
  id: FOLD_ID,
  label: 'Fold',
  color: LEGACY_COLORS.FOLD,
  order: Number.POSITIVE_INFINITY,
};

/**
 * The palette action that represents folding, if any: an explicit FOLD id or a
 * label that reads as "fold" (the poker term is kept in English across the UI,
 * e.g. imported "OR to Fold" ranges whose fold action carries a custom id).
 */
export function foldActionDef(actions: ActionDef[]): ActionDef | undefined {
  return (
    actions.find((a) => a.id === FOLD_ID) ??
    actions.find((a) => a.label.trim().toLowerCase().includes('fold'))
  );
}

/**
 * Id the trainer sampler uses for hands outside the range (implicit fold): the
 * range's own fold action when present, else the synthetic FOLD id.
 */
export function impliedFoldId(actions: ActionDef[]): ActionId {
  return foldActionDef(actions)?.id ?? FOLD_ID;
}

/**
 * Answer buttons for the trainer: the range's palette sorted by order, plus a
 * synthetic Fold only when the palette has no fold action of its own — so hands
 * outside the range (which the sampler marks as an implicit fold) are always
 * answerable.
 */
export function trainerAnswerActions(actions: ActionDef[]): ActionDef[] {
  const sorted = [...actions].sort((a, b) => a.order - b.order);
  return foldActionDef(sorted) ? sorted : [...sorted, FOLD_FALLBACK_DEF];
}

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
