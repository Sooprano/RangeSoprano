export const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const;
export type Rank = (typeof RANKS)[number];

export const POSITIONS = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'] as const;
export type Position = (typeof POSITIONS)[number];

/**
 * Legacy fixed action ids, used as the seed for new ranges and as fallback
 * IDs when an old range has no `actions` field on hydration. Custom actions
 * created by the user are arbitrary strings, so prefer `ActionId` over this
 * union in new code.
 */
export const LEGACY_ACTIONS = ['RAISE', 'CALL', 'FOLD', '3BET', 'ALL_IN'] as const;
export type LegacyAction = (typeof LEGACY_ACTIONS)[number];

/** Identifier of a per-range action — opaque string set by the user (or seed). */
export type ActionId = string;
/** Backwards-compatible alias. New code should use ActionId. */
export type Action = ActionId;

/** Per-range definition of an action: how it is named, colored, and ordered. */
export type ActionDef = {
  id: ActionId;
  label: string;
  /** Any CSS color string (typically a hex like "#06b6d4"). */
  color: string;
  /** Sort/render order. */
  order: number;
};

export type HandCategory = 'pair' | 'suited' | 'offsuit';

/** Canonical 169-hand notation, e.g. "AA", "AKs", "72o". */
export type HandNotation = string;

export type HandAction = {
  action: ActionId;
  /** Frequency in percent, 0..100. */
  weight: number;
};

export type RangeCellData = {
  hand: HandNotation;
  actions: HandAction[];
};

export const SITUATIONS = [
  'RFI',
  'vs_LIMP',
  'vs_RFI',
  'vs_OS',
  'vs_3BET',
  'vs_4BET',
  'SQUEEZE',
  'DEFEND_BB',
] as const;
export type Situation = (typeof SITUATIONS)[number];

export const TABLE_FORMATS = ['6max', 'HU'] as const;
export type TableFormat = (typeof TABLE_FORMATS)[number];

export const HU_POSITIONS = ['BTN', 'BB'] as const satisfies readonly Position[];

/** Returns the implicit villain seat in heads-up given the hero's seat. */
export function huVillainOf(hero: Position): Position {
  return hero === 'BTN' ? 'BB' : 'BTN';
}

/** Optional labels rendered above the grid when printing. */
export type PrintLabels = {
  /** Top-left label, typically stack size in BB (e.g. "25", "20.5"). */
  stack?: string;
  /** Top-middle label, typically a raise sizing (e.g. "5.78"). */
  sizing1?: string;
  /** Top-right label, secondary sizing (e.g. "3"). */
  sizing2?: string;
};

export type Range = {
  id: string;
  name: string;
  position: Position;
  situation: Situation;
  villainPosition?: Position;
  /** Sparse map keyed by hand notation; missing hands are implicit FOLD. */
  cells: Record<HandNotation, RangeCellData>;
  createdAt: string;
  updatedAt: string;
  group?: string;
  /** Free-form notes about the range. */
  notes?: string;
  /** Manual sort order within the range's parent scope (group or ungrouped). */
  order?: number;
  /** User-defined actions (custom labels and colors) available in this range. */
  actions: ActionDef[];
  /** Table format used by the trainer to render the seat layout. Defaults to '6max'. */
  tableFormat: TableFormat;
  /** Optional labels for PDF print layout (stack, sizings). */
  printLabels?: PrintLabels;
};
