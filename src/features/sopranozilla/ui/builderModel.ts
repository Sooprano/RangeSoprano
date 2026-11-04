// Filter builder model (§6.2): edits a FilterExpr tree by path, and
// normalizes it before saving. Pure TS (no React) so it can be tested.
//
// A path is the list of child indexes from the root; `not` / `suits` have a
// single child at index 0.

import {
  COMBO_DRAW_CATEGORIES,
  DRAW_CATEGORIES,
  isCategoryId,
  type CategoryId,
} from '../engine/categories';
import type { FilterExpr } from '../engine/filterExpr';
import type { Modifier, ModifierKind } from '../engine/modifiers';

export type Path = readonly number[];

export const EMPTY_ROOT: FilterExpr = { type: 'and', children: [] };

/** Containers: what an element can be dropped into. */
export function isContainer(e: FilterExpr): boolean {
  return e.type === 'and' || e.type === 'or' || e.type === 'not' || e.type === 'suits';
}

function childrenOf(e: FilterExpr): FilterExpr[] {
  switch (e.type) {
    case 'and':
    case 'or':
      return e.children;
    case 'not':
      return [e.child];
    case 'suits':
      return e.child ? [e.child] : [];
    case 'leaf':
      return [];
  }
}

export function getAt(root: FilterExpr, path: Path): FilterExpr | null {
  let node: FilterExpr | undefined = root;
  for (const i of path) {
    node = node ? childrenOf(node)[i] : undefined;
    if (!node) return null;
  }
  return node ?? null;
}

/** Replaces the node at `path` with fn(node). */
export function updateAt(root: FilterExpr, path: Path, fn: (e: FilterExpr) => FilterExpr): FilterExpr {
  if (path.length === 0) return fn(root);
  const [i, ...rest] = path as [number, ...number[]];
  switch (root.type) {
    case 'and':
    case 'or':
      return {
        ...root,
        children: root.children.map((c, k) => (k === i ? updateAt(c, rest, fn) : c)),
      };
    case 'not':
      return i === 0 ? { ...root, child: updateAt(root.child, rest, fn) } : root;
    case 'suits':
      return i === 0 && root.child ? { ...root, child: updateAt(root.child, rest, fn) } : root;
    case 'leaf':
      return root;
  }
}

/**
 * Removes the node at `path`. Removing the only child of a NOT removes the NOT
 * too (a NOT without a child means nothing); a PALOS keeps its rule alone.
 */
export function removeAt(root: FilterExpr, path: Path): FilterExpr {
  if (path.length === 0) return EMPTY_ROOT;
  const parentPath = path.slice(0, -1);
  const i = path[path.length - 1]!;
  const parent = getAt(root, parentPath);
  if (!parent) return root;
  if (parent.type === 'not') return removeAt(root, parentPath);
  return updateAt(root, parentPath, (p) => {
    if (p.type === 'and' || p.type === 'or') {
      return { ...p, children: p.children.filter((_, k) => k !== i) };
    }
    if (p.type === 'suits') return { type: 'suits', rule: p.rule };
    return p;
  });
}

/**
 * Inserts `node` into the container at `path`; returns the new root and the
 * path of the inserted node. A NOT / PALOS that already has a child gets an
 * AND group with both (or the node goes into its child group).
 */
export function insertInto(
  root: FilterExpr,
  path: Path,
  node: FilterExpr,
): { root: FilterExpr; path: Path } {
  const target = getAt(root, path);
  if (!target || !isContainer(target)) return insertInto(root, [], node);
  if ('children' in target) {
    return {
      root: updateAt(root, path, () => ({ ...target, children: [...target.children, node] })),
      path: [...path, target.children.length],
    };
  }
  if (target.type === 'leaf') return insertInto(root, [], node);
  const child = target.child;
  if (!child || (target.type === 'not' && isEmptyGroup(child))) {
    return { root: updateAt(root, path, () => ({ ...target, child: node })), path: [...path, 0] };
  }
  if (child.type === 'and' || child.type === 'or') return insertInto(root, [...path, 0], node);
  return {
    root: updateAt(root, path, () => ({ ...target, child: { type: 'and', children: [child, node] } })),
    path: [...path, 0, 1],
  };
}

function isEmptyGroup(e: FilterExpr): boolean {
  return (e.type === 'and' || e.type === 'or') && e.children.length === 0;
}

export function isEmptyExpr(e: FilterExpr): boolean {
  return normalizeExpr(e) === null;
}

/** Drafts that are draws (where `includeMade` means something). */
const DRAWISH = new Set<string>([
  ...DRAW_CATEGORIES,
  ...COMBO_DRAW_CATEGORIES,
  'any-fd',
  'any-straight-draw',
  'any-bdfd',
]);

export function isDrawCategory(id: string): id is CategoryId {
  return isCategoryId(id) && DRAWISH.has(id);
}

/** Drops empty groups and unwraps single-child groups. Null = nothing left. */
function simplify(e: FilterExpr): FilterExpr | null {
  switch (e.type) {
    case 'leaf':
      return e;
    case 'and':
    case 'or': {
      const kids = e.children.map(simplify).filter((c): c is FilterExpr => c !== null);
      if (kids.length === 0) return null;
      if (kids.length === 1) return kids[0]!;
      return { type: e.type, children: kids };
    }
    case 'not': {
      const child = simplify(e.child);
      return child ? { type: 'not', child } : null;
    }
    case 'suits': {
      const child = e.child ? simplify(e.child) : null;
      return child ? { type: 'suits', rule: e.rule, child } : { type: 'suits', rule: e.rule };
    }
  }
}

/**
 * What gets saved and previewed. D27: a filter that is a single draw element
 * ("Top 3 BDFD") leaves out combos with a pair or better unless the user
 * says otherwise; inside a larger expression the element keeps its plain
 * meaning (the engine default).
 */
export function normalizeExpr(e: FilterExpr): FilterExpr | null {
  const s = simplify(e);
  if (s?.type === 'leaf' && isDrawCategory(s.category) && !hasModifier(s, 'includeMade')) {
    return { ...s, modifiers: [...(s.modifiers ?? []), { kind: 'includeMade', value: false }] };
  }
  return s;
}

export function hasModifier(e: FilterExpr, kind: ModifierKind): boolean {
  return e.type === 'leaf' && (e.modifiers ?? []).some((m) => m.kind === kind);
}

/** The value a new modifier starts with. */
export function defaultModifier(kind: ModifierKind): Modifier {
  switch (kind) {
    case 'topN':
      return { kind, n: 3 };
    case 'rankRange':
      return { kind, min: 'T', max: 'A' };
    case 'nutRankMax':
      return { kind, k: 1 };
    case 'cardsUsed':
      return { kind, value: 2 };
    case 'includeMade':
      return { kind, value: true };
    case 'kickerMin':
      return { kind, rank: 'Q' };
    case 'overcardsMin':
      return { kind, n: 2 };
  }
}

// ── Workspace: Incluir Y NO(Excluir) (D106) ─────────────────────────────────
//
// The builder edits a tree with a fixed shape: `and[include, not(exclude)]`.
// «Incluir» is a free group (Y / O); «Excluir» is an O group: a combo that
// matches any of its elements is taken out. «A-high o K-high, sin gutshots»
// is then two elements on top and two below, with no nesting to figure out.
// On save, `normalizeExpr` drops the empty «Excluir» and unwraps the rest.

export const INCLUDE_PATH: Path = [0];
export const EXCLUDE_PATH: Path = [1, 0];

const EMPTY_EXCLUDE: FilterExpr = { type: 'or', children: [] };

const asGroup = (e: FilterExpr): FilterExpr =>
  e.type === 'and' || e.type === 'or' ? e : { type: 'and', children: [e] };

const asOr = (e: FilterExpr): FilterExpr =>
  e.type === 'or' ? e : { type: 'or', children: [e] };

/** A saved expression → the workspace. `X y sin Y` opens as Incluir X / Excluir Y. */
export function workspaceOf(expr: FilterExpr | null): FilterExpr {
  let include: FilterExpr = EMPTY_ROOT;
  let exclude: FilterExpr = EMPTY_EXCLUDE;
  if (expr?.type === 'not') {
    exclude = asOr(expr.child);
  } else if (expr?.type === 'and' && expr.children.length >= 2) {
    const last = expr.children[expr.children.length - 1]!;
    if (last.type === 'not') {
      const rest = expr.children.slice(0, -1);
      include = rest.length === 1 ? asGroup(rest[0]!) : { type: 'and', children: rest };
      exclude = asOr(last.child);
    } else {
      include = expr;
    }
  } else if (expr) {
    include = asGroup(expr);
  }
  return { type: 'and', children: [include, { type: 'not', child: exclude }] };
}

/** Puts the shape back after an edit (e.g. removing the last «Excluir» element). */
export function ensureWorkspace(ws: FilterExpr): FilterExpr {
  if (ws.type !== 'and') return workspaceOf(ws);
  const [include, exclude, ...stray] = ws.children;
  const inc = include && (include.type === 'and' || include.type === 'or') ? include : EMPTY_ROOT;
  const exc =
    exclude?.type === 'not' && (exclude.child.type === 'or' || exclude.child.type === 'and')
      ? exclude
      : { type: 'not' as const, child: exclude?.type === 'not' ? asOr(exclude.child) : EMPTY_EXCLUDE };
  // Anything that ended up at the top goes into «Incluir».
  const incWithStray: FilterExpr =
    stray.length > 0 && 'children' in inc ? { ...inc, children: [...inc.children, ...stray] } : inc;
  return { type: 'and', children: [incWithStray, exc] };
}

/** Whether the path is one of the two fixed groups (they cannot be removed). */
export function isWorkspaceGroup(path: Path): boolean {
  const k = path.join('.');
  return k === INCLUDE_PATH.join('.') || k === EXCLUDE_PATH.join('.');
}
