// Zod schemas for custom filters (§6.2): what is persisted in localStorage and
// exchanged as JSON. Imports go through `parseFiltersExport`, which also
// rejects reference cycles.

import { z } from 'zod';
import { ENGINE_RANKS } from '../engine/cards';
import { ALL_CATEGORIES } from '../engine/categories';
import { findCycle, type CustomFilter, type FilterExpr, type SuitRule } from '../engine/filterExpr';
import type { Modifier } from '../engine/modifiers';

const zRank = z.enum(ENGINE_RANKS);

export const zModifier: z.ZodType<Modifier> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('topN'), n: z.number().int().min(1).max(13) }).strict(),
  z.object({ kind: z.literal('rankRange'), min: zRank, max: zRank }).strict(),
  z.object({ kind: z.literal('nutRankMax'), k: z.number().int().min(1).max(13) }).strict(),
  z
    .object({
      kind: z.literal('cardsUsed'),
      value: z.union([z.literal(1), z.literal(2)]),
      part: z.enum(['straight', 'flush']).optional(),
    })
    .strict(),
  z.object({ kind: z.literal('includeMade'), value: z.boolean() }).strict(),
  z.object({ kind: z.literal('kickerMin'), rank: zRank }).strict(),
  z.object({ kind: z.literal('overcardsMin'), n: z.union([z.literal(1), z.literal(2)]) }).strict(),
]);

export const zSuitRule: z.ZodType<SuitRule> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('suited') }).strict(),
  z.object({ kind: z.literal('offsuit') }).strict(),
  z.object({ kind: z.literal('hasSuit'), suit: z.enum(['s', 'h', 'd', 'c']) }).strict(),
  z.object({ kind: z.literal('suitOnBoard') }).strict(),
  z.object({ kind: z.literal('suitTwiceOnBoard') }).strict(),
]);

const CATEGORY_SET = new Set<string>(ALL_CATEGORIES);
const zFilterId = z.string().min(1).max(64);

/** Leaf target: a known category or a saved-filter id. */
const zLeafTarget = z.union([z.string().refine((s) => CATEGORY_SET.has(s)), zFilterId]);

/** Max nesting depth accepted on import — a guard against hostile JSON. */
const MAX_DEPTH = 32;

function depthOf(e: FilterExpr): number {
  switch (e.type) {
    case 'leaf':
      return 1;
    case 'and':
    case 'or':
      return 1 + Math.max(0, ...e.children.map(depthOf));
    case 'not':
      return 1 + depthOf(e.child);
    case 'suits':
      return 1 + (e.child ? depthOf(e.child) : 0);
  }
}

const zFilterExprNode: z.ZodType<FilterExpr> = z.lazy(() =>
  z.union([
    z
      .object({
        type: z.literal('leaf'),
        category: zLeafTarget,
        modifiers: z.array(zModifier).max(16).optional(),
      })
      .strict(),
    z.object({ type: z.enum(['and', 'or']), children: z.array(zFilterExprNode).max(64) }).strict(),
    z.object({ type: z.literal('not'), child: zFilterExprNode }).strict(),
    z
      .object({ type: z.literal('suits'), rule: zSuitRule, child: zFilterExprNode.optional() })
      .strict(),
  ]),
);

export const zFilterExpr: z.ZodType<FilterExpr> = zFilterExprNode.refine(
  (e) => depthOf(e) <= MAX_DEPTH,
  { message: `la expresión supera ${MAX_DEPTH} niveles` },
);

export const zCustomFilter: z.ZodType<CustomFilter> = z
  .object({
    id: zFilterId,
    name: z.string().trim().min(1).max(80),
    expr: zFilterExpr,
    createdAt: z.string().max(40),
  })
  .strict();

export const zFiltersExport = z
  .object({
    kind: z.literal('sopranozilla-filters'),
    version: z.literal(1),
    filters: z.array(zCustomFilter).max(500),
  })
  .strict();
export type FiltersExport = z.infer<typeof zFiltersExport>;

export function exportFilters(filters: readonly CustomFilter[]): FiltersExport {
  return { kind: 'sopranozilla-filters', version: 1, filters: [...filters] };
}

export type ParseFiltersResult =
  | { ok: true; filters: CustomFilter[] }
  | { ok: false; error: string };

/** Validates an imported JSON value: shape, unique ids and no reference cycles. */
export function parseFiltersExport(raw: unknown): ParseFiltersResult {
  const parsed = zFiltersExport.safeParse(raw);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'JSON inválido' };
  const filters = parsed.data.filters;
  if (new Set(filters.map((f) => f.id)).size !== filters.length) {
    return { ok: false, error: 'hay filtros con el mismo id' };
  }
  const cycle = findCycle(filters);
  if (cycle) return { ok: false, error: `referencia circular entre filtros: ${cycle.join(' → ')}` };
  return { ok: true, filters };
}
