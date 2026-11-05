// View models for the analyzer UI: what each grid cell and each table row
// shows. Pure functions (no React) so they can be tested and memoized.

import type { HandNotation } from '@/types/poker';
import { ALL_HANDS } from '@/utils/handUtils';
import { ENGINE_RANKS, rankOf, suitOf, type CardId } from '../engine/cards';
import {
  CATEGORY_INFO,
  COMBO_DRAW_CATEGORIES,
  DRAW_ROWS,
  FLOP_ONLY,
  isCategoryId,
  MADE_CATEGORIES,
  type CategoryId,
} from '../engine/categories';
import type { StreetView } from '../engine/chain';
import type { ComboClass } from '../engine/classify';
import { comboCards, combosOfClass, type ComboId, type ComboWeights } from '../engine/combos';
import type { EqComboTable, Street } from '../engine/equity';
import {
  CircularFilterError,
  exprMatches,
  makeFilterContext,
  type CustomFilter,
  type FilterContext,
  type FilterExpr,
} from '../engine/filterExpr';
import {
  resolveComboWeight,
  type ActionRowState,
  type ResolveContext,
  type ResolvedWeight,
  type RowState,
} from '../engine/weights';
import type { RowTarget } from '../store/analyzerStore';

/** Whether a classified combo belongs to a table row. */
export function inRow(
  combo: ComboId,
  cls: ComboClass,
  target: RowTarget,
  filters: readonly CustomFilter[],
  filterCtx: FilterContext,
): boolean {
  if (target.kind === 'cat') {
    return (
      cls.made === target.id ||
      cls.draws.some((d) => d.id === target.id) ||
      cls.comboDraws.some((d) => d.id === target.id)
    );
  }
  const f = filters.find((x) => x.id === target.id);
  if (!f) return false;
  try {
    return exprMatches(f.expr, combo, cls, filterCtx);
  } catch (err) {
    if (err instanceof CircularFilterError) return false;
    throw err;
  }
}

// ── Grid ─────────────────────────────────────────────────────────────────────

export type GridCell = {
  hand: HandNotation;
  /** Combos not blocked by Hero or the board. */
  live: number;
  /** Σ start weight / live: share of the class that is in the range. */
  inRange: number;
  /** Σ continuation weight / live: share of the class that continues. */
  follows: number;
  /** Some combo of the class is in the selected table row (null = no row selected). */
  highlighted: boolean | null;
  /** Σ start weight of the combos in the selected row / Σ start weight of the
   * class: which part of the in-range class the category explains (null =
   * no row selected). */
  categoryShare: number | null;
  /** Σ start weight of the combos in the selected row (for the hover text). */
  categoryCombos: number;
  /** Σ start weight of the class. */
  rangeCombos: number;
  /** Painted by hand (class or combo override) in the edited EV row. */
  overridden: boolean;
  /** Σ all-in weight / live (D135): the part of `follows` that re-raises all-in. */
  shove: number;
};

/**
 * `base` (D135): the range the edited row filters — the villain's betting
 * range for a raise row, what goes on vs the raise for a re-raise row. It is
 * the "in range" part of each cell (default: the street's start range).
 * `shove`: the part of `cont` that re-raises all-in, drawn in its own color.
 */
export function gridCells(
  view: StreetView,
  cont: ComboWeights,
  row: ActionRowState | undefined,
  selected: RowTarget | null,
  filters: readonly CustomFilter[],
  base: ComboWeights = view.start,
  shove?: ComboWeights,
): GridCell[] {
  const filterCtx = makeFilterContext(view.board, filters);
  const comboOverridden = new Set<HandNotation>();
  if (row) {
    for (const hand of ALL_HANDS) {
      if (combosOfClass(hand).some((id) => row.comboOverrides[id] !== undefined)) {
        comboOverridden.add(hand);
      }
    }
  }
  return ALL_HANDS.map((hand) => {
    let live = 0;
    let start = 0;
    let follows = 0;
    let shoves = 0;
    let inCategory = 0;
    for (const id of combosOfClass(hand)) {
      const cls = view.classes.get(id);
      const w = base[id] ?? 0;
      if (!cls || view.liveMask[id] !== 1) continue;
      live++;
      start += w;
      follows += cont[id] ?? 0;
      shoves += shove?.[id] ?? 0;
      if (selected && w > 0 && inRow(id, cls, selected, filters, filterCtx)) inCategory += w;
    }
    const highlighted: boolean | null = selected ? inCategory > 0 : null;
    return {
      hand,
      live,
      inRange: live > 0 ? start / live : 0,
      follows: live > 0 ? follows / live : 0,
      highlighted,
      categoryShare: selected ? (start > 0 ? inCategory / start : 0) : null,
      categoryCombos: inCategory,
      rangeCombos: start,
      overridden: row ? row.classOverrides[hand] !== undefined || comboOverridden.has(hand) : false,
      shove: live > 0 ? Math.min(shoves, follows) / live : 0,
    };
  });
}

// ── Category table ───────────────────────────────────────────────────────────

export type TableRow = {
  target: RowTarget;
  /** Σ start weight of the combos in the row ("combos", 2 decimals in the UI). */
  combos: number;
  /** combos / range total, 0..1. */
  share: number;
  /** Hero equity vs the row's combos (start weights), NaN if empty or pending. */
  heroEq: number;
  state: RowState | undefined;
};

export type TableGroup = {
  id: 'made' | 'draws' | 'combo' | 'custom';
  label: string;
  rows: TableRow[];
};

/** Which category rows exist on a street (draws only flop/turn, backdoors only flop). */
export function rowsForStreet(street: Street): {
  made: CategoryId[];
  draws: CategoryId[];
  combo: CategoryId[];
} {
  const visible = (c: CategoryId) => street === 'flop' || !FLOP_ONLY.has(c);
  const draws = DRAW_ROWS.filter(
    (c) => visible(c) && (street !== 'river' || c === 'two-overcards' || c === 'one-overcard'),
  );
  return {
    made: [...MADE_CATEGORIES],
    draws,
    combo: street === 'river' ? [] : COMBO_DRAW_CATEGORIES.filter(visible),
  };
}

export type TableModel = {
  groups: TableGroup[];
  /** Σ start weights. */
  total: number;
  /** Σ continuation weights of the edited EV row. */
  follows: number;
  liveCombos: number;
  /** What the table counts when it is not the whole range ("su rango de apuesta"), D135. */
  baseName: string | null;
};

export function tableModel(
  view: StreetView,
  cont: ComboWeights,
  row: ActionRowState | undefined,
  eq: EqComboTable | null,
  filters: readonly CustomFilter[],
  base: ComboWeights = view.start,
  baseName: string | null = null,
): TableModel {
  const filterCtx = makeFilterContext(view.board, filters);
  const acc = new Map<string, { w: number; eqNum: number; eqDen: number }>();
  const add = (key: string, w: number, e: number) => {
    const a = acc.get(key) ?? { w: 0, eqNum: 0, eqDen: 0 };
    a.w += w;
    if (!Number.isNaN(e)) {
      a.eqNum += w * e;
      a.eqDen += w;
    }
    acc.set(key, a);
  };

  let total = 0;
  let follows = 0;
  for (const [id, cls] of view.classes) {
    const w = base[id] ?? 0;
    if (w <= 0) continue;
    total += w;
    follows += cont[id] ?? 0;
    const e = eq ? (eq[id] ?? Number.NaN) : Number.NaN;
    add(`cat:${cls.made}`, w, e);
    for (const d of cls.draws) if (d.id !== 'bdsd') add(`cat:${d.id}`, w, e);
    for (const d of cls.comboDraws) add(`cat:${d.id}`, w, e);
    for (const f of filters) {
      if (inRow(id, cls, { kind: 'custom', id: f.id }, filters, filterCtx))
        add(`custom:${f.id}`, w, e);
    }
  }

  const build = (target: RowTarget): TableRow => {
    const a = acc.get(`${target.kind}:${target.id}`);
    const combos = a?.w ?? 0;
    return {
      target,
      combos,
      share: total > 0 ? combos / total : 0,
      heroEq: a && a.eqDen > 0 ? a.eqNum / a.eqDen : Number.NaN,
      state: target.kind === 'cat' ? row?.cats[target.id] : row?.custom[target.id],
    };
  };
  const ids = rowsForStreet(view.street);
  const cat = (id: CategoryId): RowTarget => ({ kind: 'cat', id });
  const groups: TableGroup[] = [
    { id: 'made', label: 'Manos hechas', rows: ids.made.map((c) => build(cat(c))) },
    { id: 'draws', label: 'Proyectos', rows: ids.draws.map((c) => build(cat(c))) },
    { id: 'combo', label: 'Combo draws', rows: ids.combo.map((c) => build(cat(c))) },
    {
      id: 'custom',
      label: 'Personalizados',
      rows: filters.map((f) => build({ kind: 'custom', id: f.id })),
    },
  ];
  return { groups, total, follows, liveCombos: view.liveCombos, baseName };
}

/** Hero equity vs a weighted set of combos from the cached table (NaN if pending). */
export function equityOf(weights: ComboWeights, eq: EqComboTable | null): number {
  if (!eq) return Number.NaN;
  let num = 0;
  let den = 0;
  for (let id = 0; id < weights.length; id++) {
    const w = weights[id] ?? 0;
    if (w <= 0) continue;
    const e = eq[id] ?? Number.NaN;
    if (Number.isNaN(e)) return Number.NaN;
    num += w * e;
    den += w;
  }
  return den > 0 ? num / den : Number.NaN;
}

// ── 4×4 suit picker ──────────────────────────────────────────────────────────

export type ComboCell = {
  combo: ComboId;
  /** Suit index (0 ♠ · 1 ♥ · 2 ♦ · 3 ♣) of the higher-rank card (pairs: lower suit). */
  rowSuit: number;
  /** Suit index of the other card. */
  colSuit: number;
  /** "K♠8♣" */
  label: string;
  blocked: boolean;
  /** Effective weight at the start of the street (0..1). */
  inRange: number;
  /** Effective continuation weight in the edited EV row (0..1). */
  follows: number;
  /** Combo override of the edited EV row (0..100), if any. */
  override: number | undefined;
  /** Why it continues (or not), for the tooltip. */
  reason: string;
};

const SUIT_SYMBOL = ['♠', '♥', '♦', '♣'] as const;

export function classCombos(
  view: StreetView,
  cont: ComboWeights,
  row: ActionRowState | undefined,
  hand: HandNotation,
  filters: readonly CustomFilter[],
  base: ComboWeights = view.start,
): ComboCell[] {
  const ctx: ResolveContext = { filters, filterCtx: makeFilterContext(view.board, filters) };
  return combosOfClass(hand).map((combo) => {
    const [a, b] = comboCards(combo);
    // Higher rank first; for pairs the lower suit index goes on the row.
    const [hi, lo] =
      rankOf(a) > rankOf(b) || (rankOf(a) === rankOf(b) && suitOf(a) < suitOf(b)) ? [a, b] : [b, a];
    const label = `${ENGINE_RANKS[rankOf(hi)]}${SUIT_SYMBOL[suitOf(hi)]}${ENGINE_RANKS[rankOf(lo)]}${SUIT_SYMBOL[suitOf(lo)]}`;
    const cls = view.classes.get(combo);
    const blocked = !cls || view.liveMask[combo] !== 1;
    let reason = 'bloqueado';
    if (!blocked && cls && row) {
      const r = resolveComboWeight(combo, cls, row, ctx);
      reason = reasonText(r, filters);
    }
    return {
      combo,
      rowSuit: suitOf(hi),
      colSuit: suitOf(lo),
      label,
      blocked,
      inRange: blocked ? 0 : (base[combo] ?? 0),
      follows: blocked ? 0 : (cont[combo] ?? 0),
      override: row?.comboOverrides[combo],
      reason,
    };
  });
}

function reasonText(r: ResolvedWeight, filters: readonly CustomFilter[]): string {
  if (r.source === 'combo') return 'peso puesto a mano en este combo';
  if (r.source === 'class') return 'celda pintada con el pincel';
  if (!r.row) return 'ninguna fila ✓ lo incluye';
  const name = isCategoryId(r.row)
    ? CATEGORY_INFO[r.row].label
    : (filters.find((f) => f.id === r.row)?.name ?? 'filtro');
  return r.weight > 0 ? `por: ${name}` : `excluido por: ${name}`;
}

/**
 * "Dejar solo los combos con ♥": combos without the suit get override 0,
 * combos with it go back to what the rows say (override removed).
 */
export function onlySuitEntries(
  cells: readonly ComboCell[],
  suit: number,
): { combo: ComboId; weight: number | null }[] {
  return cells
    .filter((c) => !c.blocked)
    .map((c) => ({ combo: c.combo, weight: c.rowSuit === suit || c.colSuit === suit ? null : 0 }));
}

// ── Filter builder: which suits of a hand pass the draft (D108) ─────────────

export type FilterComboCell = {
  combo: ComboId;
  /** Higher card first. */
  cards: [CardId, CardId];
  /** Touches Hero's cards or the board. */
  blocked: boolean;
  /** Weight at the start of the street (0 = not in the villain's range). */
  weight: number;
  passes: boolean;
};

/** Every combo of the hand with whether the expression keeps it on this board. */
export function filterComboBreakdown(
  view: StreetView,
  expr: FilterExpr | null,
  filters: readonly CustomFilter[],
  hand: HandNotation,
): FilterComboCell[] {
  const ctx = makeFilterContext(view.board, filters);
  return combosOfClass(hand).map((combo) => {
    const [a, b] = comboCards(combo);
    const cards: [CardId, CardId] =
      rankOf(a) > rankOf(b) || (rankOf(a) === rankOf(b) && suitOf(a) < suitOf(b)) ? [a, b] : [b, a];
    const cls = view.classes.get(combo);
    const blocked = !cls || view.liveMask[combo] !== 1;
    let passes = false;
    if (!blocked && cls && expr) {
      try {
        passes = exprMatches(expr, combo, cls, ctx);
      } catch (err) {
        if (!(err instanceof CircularFilterError)) throw err;
      }
    }
    return { combo, cards, blocked, weight: blocked ? 0 : (view.start[combo] ?? 0), passes };
  });
}

// ── Suit filter for a whole table row ────────────────────────────────────────

/**
 * "Solo ♥" (0 ♠ · 1 ♥ · 2 ♦ · 3 ♣), several suits at once ("con ♣ o ♦":
 * the suit buttons toggle), suited, offsuit, or every suit back.
 */
export type SuitRule =
  | { kind: 'suit'; suit: number }
  | { kind: 'suits'; suits: readonly number[] }
  | { kind: 'suited' }
  | { kind: 'offsuit' }
  | { kind: 'all' };

export function holdsRule(combo: ComboId, rule: SuitRule): boolean {
  const [a, b] = comboCards(combo);
  switch (rule.kind) {
    case 'all':
      return true;
    case 'suit':
      return suitOf(a) === rule.suit || suitOf(b) === rule.suit;
    case 'suits':
      return rule.suits.length === 0 || rule.suits.includes(suitOf(a)) || rule.suits.includes(suitOf(b));
    case 'suited':
      return suitOf(a) === suitOf(b);
    case 'offsuit':
      return suitOf(a) !== suitOf(b);
  }
}

/**
 * Combo overrides that keep only the combos of one table row (e.g. «Top
 * pair») passing a suit rule: the others in the row get 0, the ones that pass
 * go back to what the rows say (override removed). Combos outside the row are
 * not touched.
 */
export function rowSuitEntries(
  view: StreetView,
  target: RowTarget,
  filters: readonly CustomFilter[],
  rule: SuitRule,
): { combo: ComboId; weight: number | null }[] {
  const filterCtx = makeFilterContext(view.board, filters);
  const out: { combo: ComboId; weight: number | null }[] = [];
  for (const [combo, cls] of view.classes) {
    if (view.liveMask[combo] !== 1 || (view.start[combo] ?? 0) <= 0) continue;
    if (!inRow(combo, cls, target, filters, filterCtx)) continue;
    out.push({ combo, weight: holdsRule(combo, rule) ? null : 0 });
  }
  return out;
}

/**
 * A suit button toggles that suit in the rule: from "all", ♣ = only ♣; then
 * ♦ = ♣ or ♦; turning every suit off (or all four on) is "all" again.
 */
export function toggleSuit(rule: SuitRule, suit: number): SuitRule {
  const current = rule.kind === 'suits' ? rule.suits : rule.kind === 'suit' ? [rule.suit] : [];
  const next = current.includes(suit) ? current.filter((x) => x !== suit) : [...current, suit];
  return next.length === 0 || next.length === 4
    ? { kind: 'all' }
    : { kind: 'suits', suits: [...next].sort() };
}

/** Suits the rule keeps, for the pressed state of the buttons. */
export function ruleSuits(rule: SuitRule): readonly number[] {
  return rule.kind === 'suits' ? rule.suits : rule.kind === 'suit' ? [rule.suit] : [];
}

/**
 * Category edit on the START range (grid on «Rango preflop» / «al empezar»):
 * every combo of the row that was in the range when the edit began (`base`,
 * 0..1) gets `base × w/100` if it holds the suit rule, 0 if not. From the
 * base, so 0 and back to 100 restores it, and suits can be turned back on.
 */
export function startCategoryEntries(
  base: ReadonlyMap<ComboId, number>,
  w: number,
  rule: SuitRule,
): { combo: ComboId; weight: number }[] {
  return Array.from(base, ([combo, b]) => ({
    combo,
    weight: holdsRule(combo, rule) ? (b * w) / 100 : 0,
  }));
}

// ── Edits limited to the selected table row ──────────────────────────────────

/**
 * Live combos that belong to a table row (e.g. «Top pair»): of one class when
 * `hand` is given, of the whole grid otherwise. With a row selected the brush
 * only touches these, so a stray stroke cannot edit hands outside it.
 */
export function targetCombos(
  view: StreetView,
  target: RowTarget,
  filters: readonly CustomFilter[],
  hand?: HandNotation,
): ComboId[] {
  const filterCtx = makeFilterContext(view.board, filters);
  const ids = hand ? combosOfClass(hand) : Array.from(view.classes.keys());
  return ids.filter((combo) => {
    const cls = view.classes.get(combo);
    return !!cls && view.liveMask[combo] === 1 && inRow(combo, cls, target, filters, filterCtx);
  });
}
