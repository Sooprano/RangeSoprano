// Modifiers (spec §6.1): predicates over the attributes of one match.
// Pure TS, no React.
//
// A modifier whose attribute does not apply to the match (e.g. kickerMin on
// an overpair) is NOT satisfied — strict, so `Top pair [kicker ≥ Q] OR
// Overpair` stays unambiguous. `modifierAppliesTo` lets the UI warn early.

import { ENGINE_RANKS, type EngineRank } from './cards';
import {
  COMBO_DRAW_CATEGORIES,
  DRAW_CATEGORIES,
  NO_MADE_CATEGORIES,
  type CategoryId,
} from './categories';
import type { ComboClass, MatchAttrs } from './classify';

export type Modifier =
  /** Relevant card among the N highest ranks that are not on the board. */
  | { kind: 'topN'; n: number }
  /** Relevant card within [min, max] (inclusive). */
  | { kind: 'rankRange'; min: EngineRank; max: EngineRank }
  /** Flush or flush draw with nutRank ≤ k. */
  | { kind: 'nutRankMax'; k: number }
  /** Own cards used. In combo draws `part` picks the straight or flush half;
   * without it every half that reports cards used must match. */
  | { kind: 'cardsUsed'; value: 1 | 2; part?: 'straight' | 'flush' | undefined }
  /** Draws: false drops combos that also hold a pair or better. */
  | { kind: 'includeMade'; value: boolean }
  /** One-card pairs (and trips): kicker ≥ rank. */
  | { kind: 'kickerMin'; rank: EngineRank }
  /** At least n own cards above the board's top rank. */
  | { kind: 'overcardsMin'; n: 1 | 2 };

export type ModifierKind = Modifier['kind'];

export function rankIndex(rank: EngineRank): number {
  return ENGINE_RANKS.indexOf(rank);
}

const NO_MADE = new Set<string>(NO_MADE_CATEGORIES);

export type ModifierContext = {
  /** Ranks not on the board, highest first. */
  offBoardRanksDesc: readonly number[];
};

export function modifierHolds(
  mod: Modifier,
  match: MatchAttrs,
  cls: ComboClass,
  ctx: ModifierContext,
): boolean {
  switch (mod.kind) {
    case 'topN': {
      const idx = ctx.offBoardRanksDesc.indexOf(match.relevantRank);
      return idx >= 0 && idx < mod.n;
    }
    case 'rankRange':
      return match.relevantRank >= rankIndex(mod.min) && match.relevantRank <= rankIndex(mod.max);
    case 'nutRankMax':
      return match.nutRank !== null && match.nutRank <= mod.k;
    case 'cardsUsed': {
      if (mod.part === 'straight') return match.straightCardsUsed === mod.value;
      if (mod.part === 'flush') return match.flushCardsUsed === mod.value;
      if (match.cardsUsed !== null) return match.cardsUsed === mod.value;
      const parts = [match.straightCardsUsed, match.flushCardsUsed].filter(
        (v): v is number => v !== null,
      );
      return parts.length > 0 && parts.every((v) => v === mod.value);
    }
    case 'includeMade':
      return mod.value || NO_MADE.has(cls.made);
    case 'kickerMin':
      return match.kicker !== null && match.kicker >= rankIndex(mod.rank);
    case 'overcardsMin':
      return match.overcards >= mod.n;
  }
}

// ── Applicability (for UI validation) ────────────────────────────────────────

const DRAWISH = new Set<string>([
  ...DRAW_CATEGORIES,
  ...COMBO_DRAW_CATEGORIES,
  'any-fd',
  'any-straight-draw',
  'any-bdfd',
]);
const FLUSHY = new Set<string>([
  'flush',
  'fd-2',
  'fd-1',
  'bdfd-2',
  'bdfd-1',
  'fd-oesd',
  'fd-gutshot',
  'fd-pair',
  'fd-overcards',
  'bdsd-bdfd',
  'gutshot-bdfd',
  'any-fd',
  'any-bdfd',
]);
const KICKERED = new Set<string>([
  'top-pair',
  'middle-pair',
  'weak-pair',
  'trips',
  'fd-pair',
  'oesd-pair',
  'gutshot-pair',
]);
const CARDS_USED = new Set<string>([
  'straight',
  'flush',
  'sf-quads',
  ...DRAW_CATEGORIES.filter((c) => c !== 'two-overcards' && c !== 'one-overcard'),
  ...COMBO_DRAW_CATEGORIES,
  'any-fd',
  'any-straight-draw',
  'any-bdfd',
]);

/** Whether a modifier can ever be satisfied by a category. */
export function modifierAppliesTo(kind: ModifierKind, category: CategoryId): boolean {
  switch (kind) {
    case 'topN':
    case 'rankRange':
    case 'overcardsMin':
      return true;
    case 'nutRankMax':
      return FLUSHY.has(category);
    case 'cardsUsed':
      return CARDS_USED.has(category);
    case 'includeMade':
      return DRAWISH.has(category);
    case 'kickerMin':
      return KICKERED.has(category) || category === 'one-pair';
  }
}
