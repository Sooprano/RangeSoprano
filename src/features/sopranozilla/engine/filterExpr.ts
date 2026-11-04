// Filter expressions for the custom-filter builder (spec §6.2): nested
// AND / OR / NOT / PALOS over category leaves with modifiers, plus references
// to other saved filters. Board-independent: leaves are evaluated on the
// classification of the current board. Pure TS, no React.

import { suitOf, type CardId } from './cards';
import { CATEGORY_INFO, isCategoryId, type CategoryId } from './categories';
import { classifyAll, matchOf, offBoardRanks, type ComboClass } from './classify';
import { comboCards, type ComboId } from './combos';
import { modifierHolds, type Modifier, type ModifierContext } from './modifiers';

export type SuitLetter = 's' | 'h' | 'd' | 'c';
const SUIT_INDEX: Record<SuitLetter, number> = { s: 0, h: 1, d: 2, c: 3 };
const SUIT_LABEL: Record<SuitLetter, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };

export type SuitRule =
  | { kind: 'suited' }
  | { kind: 'offsuit' }
  /** At least one own card of this suit. */
  | { kind: 'hasSuit'; suit: SuitLetter }
  /** At least one own card of a suit present on the board. */
  | { kind: 'suitOnBoard' }
  /** At least one own card of a suit that appears twice or more on the board. */
  | { kind: 'suitTwiceOnBoard' };

export type CustomFilterId = string;

export type FilterExpr =
  | { type: 'leaf'; category: CategoryId | CustomFilterId; modifiers?: Modifier[] | undefined }
  | { type: 'and' | 'or'; children: FilterExpr[] }
  | { type: 'not'; child: FilterExpr }
  | { type: 'suits'; rule: SuitRule; child?: FilterExpr | undefined };

export type CustomFilter = {
  id: CustomFilterId;
  name: string;
  expr: FilterExpr;
  createdAt: string;
};

export class CircularFilterError extends Error {
  readonly cycle: CustomFilterId[];
  constructor(cycle: CustomFilterId[]) {
    super(`circular filter reference: ${cycle.join(' → ')}`);
    this.name = 'CircularFilterError';
    this.cycle = cycle;
  }
}

// ── Evaluation ───────────────────────────────────────────────────────────────

export type FilterContext = ModifierContext & {
  boardSuitCount: Uint8Array;
  filters: ReadonlyMap<CustomFilterId, CustomFilter>;
};

export function makeFilterContext(
  board: readonly CardId[],
  filters: readonly CustomFilter[] = [],
): FilterContext {
  const boardSuitCount = new Uint8Array(4);
  for (const c of board) boardSuitCount[suitOf(c)]!++;
  return {
    offBoardRanksDesc: offBoardRanks(board),
    boardSuitCount,
    filters: new Map(filters.map((f) => [f.id, f])),
  };
}

function suitRuleHolds(rule: SuitRule, combo: ComboId, ctx: FilterContext): boolean {
  const [a, b] = comboCards(combo);
  const sa = suitOf(a);
  const sb = suitOf(b);
  switch (rule.kind) {
    case 'suited':
      return sa === sb;
    case 'offsuit':
      return sa !== sb;
    case 'hasSuit':
      return sa === SUIT_INDEX[rule.suit] || sb === SUIT_INDEX[rule.suit];
    case 'suitOnBoard':
      return ctx.boardSuitCount[sa]! >= 1 || ctx.boardSuitCount[sb]! >= 1;
    case 'suitTwiceOnBoard':
      return ctx.boardSuitCount[sa]! >= 2 || ctx.boardSuitCount[sb]! >= 2;
  }
}

/**
 * Whether a classified combo satisfies the expression. Throws
 * CircularFilterError if saved filters reference each other in a loop.
 * A reference to a filter that no longer exists matches nothing.
 */
export function exprMatches(
  expr: FilterExpr,
  combo: ComboId,
  cls: ComboClass,
  ctx: FilterContext,
  stack: readonly CustomFilterId[] = [],
): boolean {
  switch (expr.type) {
    case 'and':
      return expr.children.every((c) => exprMatches(c, combo, cls, ctx, stack));
    case 'or':
      return expr.children.some((c) => exprMatches(c, combo, cls, ctx, stack));
    case 'not':
      return !exprMatches(expr.child, combo, cls, ctx, stack);
    case 'suits':
      return (
        suitRuleHolds(expr.rule, combo, ctx) &&
        (expr.child === undefined || exprMatches(expr.child, combo, cls, ctx, stack))
      );
    case 'leaf': {
      if (isCategoryId(expr.category)) {
        const match = matchOf(cls, expr.category);
        if (!match) return false;
        return (expr.modifiers ?? []).every((m) => modifierHolds(m, match, cls, ctx));
      }
      const id = expr.category;
      if (stack.includes(id)) throw new CircularFilterError([...stack, id]);
      const ref = ctx.filters.get(id);
      if (!ref) return false;
      return exprMatches(ref.expr, combo, cls, ctx, [...stack, id]);
    }
  }
}

/** Combos (from `combos`) that match the expression on this board. */
export function matchingCombos(
  expr: FilterExpr,
  combos: readonly ComboId[],
  board: readonly CardId[],
  filters: readonly CustomFilter[] = [],
  classes: ReadonlyMap<ComboId, ComboClass> = classifyAll(combos, board),
): ComboId[] {
  const ctx = makeFilterContext(board, filters);
  return combos.filter((id) => {
    const cls = classes.get(id);
    return cls !== undefined && exprMatches(expr, id, cls, ctx);
  });
}

// ── Validation ───────────────────────────────────────────────────────────────

/** Saved-filter ids referenced anywhere in the expression. */
export function referencedFilters(expr: FilterExpr): CustomFilterId[] {
  switch (expr.type) {
    case 'leaf':
      return isCategoryId(expr.category) ? [] : [expr.category];
    case 'and':
    case 'or':
      return expr.children.flatMap(referencedFilters);
    case 'not':
      return referencedFilters(expr.child);
    case 'suits':
      return expr.child ? referencedFilters(expr.child) : [];
  }
}

/** First reference cycle among the filters, as a path of ids, or null. */
export function findCycle(filters: readonly CustomFilter[]): CustomFilterId[] | null {
  const byId = new Map(filters.map((f) => [f.id, f]));
  const done = new Set<CustomFilterId>();
  const visit = (id: CustomFilterId, path: CustomFilterId[]): CustomFilterId[] | null => {
    const at = path.indexOf(id);
    if (at >= 0) return [...path.slice(at), id];
    if (done.has(id)) return null;
    const f = byId.get(id);
    if (f) {
      for (const ref of referencedFilters(f.expr)) {
        const cycle = visit(ref, [...path, id]);
        if (cycle) return cycle;
      }
    }
    done.add(id);
    return null;
  };
  for (const f of filters) {
    const cycle = visit(f.id, []);
    if (cycle) return cycle;
  }
  return null;
}

export type FilterIssue =
  | { kind: 'circular'; cycle: CustomFilterId[] }
  | { kind: 'unknownReference'; id: CustomFilterId }
  | { kind: 'modifierOnReference'; id: CustomFilterId };

/**
 * Problems that block saving `filter` next to `existing` (it may replace a
 * filter with the same id). Matching nothing on the current board is NOT an
 * issue here — the UI only warns about it (§6.2).
 */
export function validateFilter(
  filter: CustomFilter,
  existing: readonly CustomFilter[],
): FilterIssue[] {
  const all = [...existing.filter((f) => f.id !== filter.id), filter];
  const ids = new Set(all.map((f) => f.id));
  const issues: FilterIssue[] = [];
  for (const id of referencedFilters(filter.expr)) {
    if (!ids.has(id)) issues.push({ kind: 'unknownReference', id });
  }
  const walk = (e: FilterExpr): void => {
    switch (e.type) {
      case 'leaf':
        if (!isCategoryId(e.category) && (e.modifiers?.length ?? 0) > 0) {
          issues.push({ kind: 'modifierOnReference', id: e.category });
        }
        return;
      case 'and':
      case 'or':
        e.children.forEach(walk);
        return;
      case 'not':
        walk(e.child);
        return;
      case 'suits':
        if (e.child) walk(e.child);
    }
  };
  walk(filter.expr);
  const cycle = findCycle(all);
  if (cycle) issues.push({ kind: 'circular', cycle });
  return issues;
}

// ── Readable text ────────────────────────────────────────────────────────────

export function describeModifier(m: Modifier): string {
  switch (m.kind) {
    case 'topN':
      return `carta en el top ${m.n} fuera del board`;
    case 'rankRange':
      return `carta entre ${m.min} y ${m.max}`;
    case 'nutRankMax':
      return m.k === 1 ? 'al nuts' : `top ${m.k} al nuts`;
    case 'cardsUsed': {
      const part =
        m.part === 'straight' ? ' en la escalera' : m.part === 'flush' ? ' en el color' : '';
      return `${m.value} carta${m.value === 2 ? 's' : ''} propia${m.value === 2 ? 's' : ''}${part}`;
    }
    case 'includeMade':
      return m.value ? 'aunque tenga mano hecha' : 'sin par o mejor';
    case 'kickerMin':
      return `kicker ≥ ${m.rank}`;
    case 'overcardsMin':
      return `${m.n === 2 ? 'dos' : 'al menos una'} overcard${m.n === 2 ? 's' : ''}`;
  }
}

function describeSuitRule(r: SuitRule): string {
  switch (r.kind) {
    case 'suited':
      return 'suited';
    case 'offsuit':
      return 'offsuit';
    case 'hasSuit':
      return `con ${SUIT_LABEL[r.suit]}`;
    case 'suitOnBoard':
      return 'con un palo del board';
    case 'suitTwiceOnBoard':
      return 'con un palo que está 2 veces en el board';
  }
}

/** Human-readable Spanish text, e.g. "(Top pair con kicker ≥ Q o Overpair) y sin Flush draw". */
export function describeExpr(
  expr: FilterExpr,
  filters: readonly CustomFilter[] = [],
  nested = false,
): string {
  switch (expr.type) {
    case 'leaf': {
      const name = isCategoryId(expr.category)
        ? CATEGORY_INFO[expr.category].label
        : `«${filters.find((f) => f.id === expr.category)?.name ?? 'filtro borrado'}»`;
      const mods = (expr.modifiers ?? []).map(describeModifier);
      return mods.length > 0 ? `${name} con ${mods.join(', ')}` : name;
    }
    case 'and':
    case 'or': {
      if (expr.children.length === 0) return expr.type === 'and' ? 'todo' : 'nada';
      const text = expr.children
        .map((c) => describeExpr(c, filters, true))
        .join(expr.type === 'and' ? ' y ' : ' o ');
      return nested && expr.children.length > 1 ? `(${text})` : text;
    }
    case 'not':
      return `sin ${describeExpr(expr.child, filters, true)}`;
    case 'suits': {
      const rule = describeSuitRule(expr.rule);
      // Alone, the rule needs a noun: «sin combos con ♣», not «sin con ♣».
      return expr.child ? `${describeExpr(expr.child, filters, true)}, ${rule}` : `combos ${rule}`;
    }
  }
}
