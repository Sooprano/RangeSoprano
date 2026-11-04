// Final weight of each combo on one street for one EV row (spec §7).
// Pure TS, no React.
//
// Precedence, highest first:
//   1. combo override (4×4 suit picker)
//   2. class override (brush on a 13×13 cell)
//   3. custom filters that match: any ✓ → the highest ✓ weight; only ✗ → 0
//   4. combo-draw rows that match: same rule
//   5. generic rows (the made row + draw rows): the highest ✓ weight among
//      the matching rows; no ✓ row matches → 0. A ✗ row is weight 0 but never
//      cancels another ✓ row that also matches ("Nada ✗" + "BDFD ✓ 40" → 40).

import type { HandNotation } from '@/types/poker';
import {
  MADE_CATEGORIES,
  type CategoryId,
  type ComboDrawCategory,
  type DrawCategory,
  type MadeCategory,
} from './categories';
import type { ComboClass } from './classify';
import { classOfCombo, COMBO_COUNT, type ComboId, type ComboWeights } from './combos';
import {
  CircularFilterError,
  exprMatches,
  type CustomFilter,
  type CustomFilterId,
  type FilterContext,
} from './filterExpr';

/** ✓ follow · ✗ exclude · null neutral. `w` is 0..100. */
export type RowState = { s: 'follow' | 'exclude' | null; w: number };

/** The continuation range of one EV row, as row states + manual overrides. */
export type ActionRowState = {
  /** Missing category = neutral. */
  cats: Partial<Record<CategoryId, RowState>>;
  custom: Record<CustomFilterId, RowState>;
  /** "AKs" → 0..100 */
  classOverrides: Record<HandNotation, number>;
  /** ComboId → 0..100 */
  comboOverrides: Record<number, number>;
  /** Differs from its preset. */
  edited: boolean;
};

export function emptyActionRow(): ActionRowState {
  return { cats: {}, custom: {}, classOverrides: {}, comboOverrides: {}, edited: false };
}

/**
 * "Todo ✓ 100": every MADE row follows at 100, draws / combo draws / custom
 * filters stay neutral. Made rows partition the range, so the whole range
 * continues; and lowering a made row is exact, because no draw row is there
 * to "rescue" its combos unless the user marks it (D53).
 */
export function fullActionRow(): ActionRowState {
  const cats: Partial<Record<CategoryId, RowState>> = {};
  for (const c of MADE_CATEGORIES) cats[c] = { s: 'follow', w: 100 };
  return { cats, custom: {}, classOverrides: {}, comboOverrides: {}, edited: false };
}

function toFactor(pct: number): number {
  if (!Number.isFinite(pct)) return 0;
  return pct <= 0 ? 0 : pct >= 100 ? 1 : pct / 100;
}

/** A row that matches the combo: its id and its state in the edited EV row. */
type Candidate = { id: string; state: RowState | undefined };

/**
 * Applies the ✓/✗ rule to the matching rows. Returns the weight in percent
 * and the deciding row (the highest ✓, or a ✗ when only ✗ matched), or null
 * when no row was marked (the next precedence level decides).
 */
function decide(candidates: readonly Candidate[]): { pct: number; row: string } | null {
  let best: { pct: number; row: string } | null = null;
  let excludedBy: string | null = null;
  for (const { id, state } of candidates) {
    if (!state || state.s === null) continue;
    if (state.s === 'follow') {
      if (!best || state.w > best.pct) best = { pct: state.w, row: id };
    } else excludedBy ??= id;
  }
  if (best) return best;
  return excludedBy !== null ? { pct: 0, row: excludedBy } : null;
}

export type ResolveContext = {
  filters: readonly CustomFilter[];
  filterCtx: FilterContext;
};

/** Which level decided a combo's weight — for tests and for the UI help. */
export type WeightSource = 'combo' | 'class' | 'custom' | 'combo-draw' | 'generic';

export type ResolvedWeight = {
  weight: number;
  source: WeightSource;
  /** Deciding row: a CategoryId or a custom filter id (absent for overrides
   * and when nothing matched). */
  row?: string;
};

/** Weight (0..1) of one classified combo under one action row, and why. */
export function resolveComboWeight(
  combo: ComboId,
  cls: ComboClass,
  row: ActionRowState,
  ctx: ResolveContext,
): ResolvedWeight {
  const comboOverride = row.comboOverrides[combo];
  if (comboOverride !== undefined) return { weight: toFactor(comboOverride), source: 'combo' };

  const classOverride = row.classOverrides[classOfCombo(combo)];
  if (classOverride !== undefined) return { weight: toFactor(classOverride), source: 'class' };

  const customs: Candidate[] = [];
  for (const f of ctx.filters) {
    const state = row.custom[f.id];
    if (!state || state.s === null) continue;
    let hit = false;
    try {
      hit = exprMatches(f.expr, combo, cls, ctx.filterCtx);
    } catch (err) {
      // Cycles are rejected on save/import; a stray one simply never matches.
      if (!(err instanceof CircularFilterError)) throw err;
    }
    if (hit) customs.push({ id: f.id, state });
  }
  const custom = decide(customs);
  if (custom) return { weight: toFactor(custom.pct), source: 'custom', row: custom.row };

  const comboDraw = decide(
    cls.comboDraws.map((d) => ({ id: d.id, state: row.cats[d.id as ComboDrawCategory] })),
  );
  if (comboDraw) {
    return { weight: toFactor(comboDraw.pct), source: 'combo-draw', row: comboDraw.row };
  }

  const generic: Candidate[] = [{ id: cls.made, state: row.cats[cls.made as MadeCategory] }];
  for (const d of cls.draws) {
    if (d.id !== 'bdsd') generic.push({ id: d.id, state: row.cats[d.id as DrawCategory] });
  }
  const g = decide(generic);
  return g
    ? { weight: toFactor(g.pct), source: 'generic', row: g.row }
    : { weight: 0, source: 'generic' };
}

/**
 * Street factor (0..1) for every classified combo under one action row.
 * Combos without a classification (blocked by Hero or the board) are 0.
 */
export function resolveRowWeights(
  classes: ReadonlyMap<ComboId, ComboClass>,
  row: ActionRowState,
  ctx: ResolveContext,
): ComboWeights {
  const out = new Float64Array(COMBO_COUNT);
  for (const [id, cls] of classes) out[id] = resolveComboWeight(id, cls, row, ctx).weight;
  return out;
}
