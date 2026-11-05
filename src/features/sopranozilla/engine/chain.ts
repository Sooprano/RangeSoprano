// Street chaining (spec §7 effective weight, §8 state shapes). Pure TS.
//
//   effective weight = preflop × Π (weight of the row "played" on each
//                      previous street) × weight of the current street
//
// Every street is classified on its own board (flop = 3 cards, turn = 4,
// river = 5), so a row "played" on the flop keeps meaning the same thing when
// the turn is dealt. Combos that touch Hero's cards or the current board are 0.

import { deadCardsOf, formatCards, type CardId } from './cards';
import { classifyAll, type ComboClass } from './classify';
import { COMBO_COUNT, isComboBlocked, type ComboId, type ComboWeights } from './combos';
import {
  CircularFilterError,
  exprMatches,
  makeFilterContext,
  type CustomFilter,
  type CustomFilterId,
} from './filterExpr';
import type { Street } from './equity';
import { resolveRowWeights, type ActionRowState, type ResolveContext } from './weights';
import { COMBO_DRAW_CATEGORIES, DRAW_ROWS, MADE_CATEGORIES, type CategoryId } from './categories';

export const STREETS: readonly Street[] = ['flop', 'turn', 'river'];

const BOARD_LENGTH: Record<Street, number> = { flop: 3, turn: 4, river: 5 };

/** What the analyzer needs from a hand (the adapter fills more fields later). */
export type AnalyzerHandInput = {
  hero: [CardId, CardId];
  /** Known board, 3 to 5 cards. Streets beyond it are not available yet. */
  board: CardId[];
  /** Pot (in bb) when each street starts. */
  pots?: Partial<Record<Street, number>> | undefined;
  /** Effective stack behind (in bb) when each street starts: Hero vs the villain (D133). */
  stacks?: Partial<Record<Street, number>> | undefined;
  heroPosition?: string | undefined;
  villainPosition?: string | undefined;
};

/** 'reraise': the villain re-raises all-in over Hero's raise (D133); its range
 * sits on the raise row's range ("goes on vs the raise"). */
export type ActionRowKind = 'check' | 'bet' | 'fold' | 'call' | 'raise' | 'reraise';

/** "Hero decide" (check / bet) or "Villano apuesta" (fold / call / raise). */
export type AnalyzerMode = 'hero' | 'villain';

/**
 * One EV row. `size`: for a bet, % of the pot; for a raise, a multiple of the
 * villain's bet (raise to size × bet). `basedOn`: this row's range applies on
 * top of another row's range (the "calls the raise" range sits on the
 * villain's betting range).
 */
export type ActionRow = {
  id: string;
  label: string;
  kind: ActionRowKind;
  size?: number;
  mode?: AnalyzerMode;
  basedOn?: string;
};

export type StreetState = {
  actionRows: ActionRow[];
  rows: Record<string, ActionRowState>;
  /** Missing = "hero". */
  mode?: AnalyzerMode;
  /** "Villano apuesta": the villain's bet as % of the pot. */
  villainBetPct?: number;
  /** The row whose range the category table edits. Never affects chaining. */
  selectedRow: string;
  /** The row that was played: always set, and the only one that chains into
   * the next street. */
  playedRow: string;
  /** Start range set by hand on this street (grid edit or import), ComboId →
   * 0..1. It replaces what the previous streets chain into; null/missing =
   * the chained range. The flop never needs one: its start IS the preflop
   * range, which is edited directly. */
  startOverride?: Readonly<Record<number, number>> | null | undefined;
  /**
   * Rows shown inverted (D132, Flopzilla's «Inv»): what does NOT pass the
   * row's filter — e.g. the villain's checking range from his betting range.
   * An inverted played row chains its inverse into the next street.
   */
  invertedRows?: readonly string[] | undefined;
};

export function boardFor(hand: AnalyzerHandInput, street: Street): CardId[] | null {
  const n = BOARD_LENGTH[street];
  return hand.board.length >= n ? hand.board.slice(0, n) : null;
}

/** Streets the hand's board reaches, in order. */
export function availableStreets(hand: AnalyzerHandInput): Street[] {
  return STREETS.filter((s) => boardFor(hand, s) !== null);
}

// ── Caches (outside any reactive store) ──────────────────────────────────────

const CLASS_CACHE = new Map<string, Map<ComboId, ComboClass>>();
const CLASS_CACHE_SIZE = 8;

/** Classification of every combo not blocked by the board, cached per board. */
export function classifyBoard(board: readonly CardId[]): Map<ComboId, ComboClass> {
  const key = formatCards([...board].sort((a, b) => a - b));
  const hit = CLASS_CACHE.get(key);
  if (hit) {
    CLASS_CACHE.delete(key);
    CLASS_CACHE.set(key, hit);
    return hit;
  }
  const dead = deadCardsOf(board);
  const live: ComboId[] = [];
  for (let id = 0; id < COMBO_COUNT; id++) if (!isComboBlocked(id, dead)) live.push(id);
  const classes = classifyAll(live, board);
  if (CLASS_CACHE.size >= CLASS_CACHE_SIZE) {
    const oldest = CLASS_CACHE.keys().next().value;
    if (oldest !== undefined) CLASS_CACHE.delete(oldest);
  }
  CLASS_CACHE.set(key, classes);
  return classes;
}

// Row factors keyed by object identity: the store replaces an ActionRowState
// (or the filters array) whenever it changes, so stale entries are never hit.
const FACTOR_CACHE = new WeakMap<
  readonly CustomFilter[],
  WeakMap<ActionRowState, Map<string, ComboWeights>>
>();

function rowFactors(
  board: readonly CardId[],
  row: ActionRowState,
  filters: readonly CustomFilter[],
): ComboWeights {
  let byRow = FACTOR_CACHE.get(filters);
  if (!byRow) {
    byRow = new WeakMap();
    FACTOR_CACHE.set(filters, byRow);
  }
  let byBoard = byRow.get(row);
  if (!byBoard) {
    byBoard = new Map();
    byRow.set(row, byBoard);
  }
  const key = formatCards(board);
  const hit = byBoard.get(key);
  if (hit) return hit;
  const ctx: ResolveContext = { filters, filterCtx: makeFilterContext(board, filters) };
  const w = resolveRowWeights(classifyBoard(board), row, ctx);
  byBoard.set(key, w);
  return w;
}

/** Sparse record (ComboId → 0..1) → dense weights. */
export function weightsFromRecord(rec: Readonly<Record<number, number>>): ComboWeights {
  const w = new Float64Array(COMBO_COUNT);
  for (const [k, v] of Object.entries(rec)) {
    const id = Number(k);
    if (Number.isInteger(id) && id >= 0 && id < COMBO_COUNT && Number.isFinite(v)) {
      w[id] = v < 0 ? 0 : v > 1 ? 1 : v;
    }
  }
  return w;
}

const OVERRIDE_CACHE = new WeakMap<Readonly<Record<number, number>>, ComboWeights>();

function overrideWeights(rec: Readonly<Record<number, number>>): ComboWeights {
  let w = OVERRIDE_CACHE.get(rec);
  if (!w) {
    w = weightsFromRecord(rec);
    OVERRIDE_CACHE.set(rec, w);
  }
  return w;
}

/** Dense weights → sparse record with only the combos above 0. */
export function recordFromWeights(w: ComboWeights): Record<number, number> {
  const rec: Record<number, number> = {};
  for (let id = 0; id < COMBO_COUNT; id++) if ((w[id] ?? 0) > 0) rec[id] = w[id]!;
  return rec;
}

// ── Street view ──────────────────────────────────────────────────────────────

export type ChainInput = {
  hand: AnalyzerHandInput;
  /** Villain's preflop range, 0..1 per combo. */
  villainPreflop: ComboWeights;
  streets: Readonly<Record<Street, StreetState>>;
  filters: readonly CustomFilter[];
};

export type StreetView = {
  street: Street;
  board: CardId[];
  classes: Map<ComboId, ComboClass>;
  /** Effective weights when the street starts (before this street's action). */
  start: ComboWeights;
  /** Effective continuation weights of each EV row: start × row factor. */
  rows: Record<string, ComboWeights>;
  /** Inverted rows only (D132): start × (1 − row factor), what does not pass. */
  inverse: Record<string, ComboWeights>;
  /** Combos not blocked by Hero or the board. */
  liveCombos: number;
  /** liveMask[id] === 1 when the combo is not blocked by Hero or the board. */
  liveMask: Uint8Array;
};

function multiplyInto(target: ComboWeights, factor: ComboWeights): void {
  for (let id = 0; id < COMBO_COUNT; id++) target[id] = (target[id] ?? 0) * (factor[id] ?? 0);
}

/**
 * Multiplies `target` by the factor of one EV row, including the rows it is
 * based on (a raise row on the call row). A row without a range (Fold) or a
 * broken chain leaves nothing.
 */
function applyRow(
  target: ComboWeights,
  board: readonly CardId[],
  st: StreetState,
  rowId: string,
  filters: readonly CustomFilter[],
  depth = 0,
): void {
  const row = st.rows[rowId];
  if (!row || depth > 4) {
    target.fill(0);
    return;
  }
  multiplyInto(target, rowFactors(board, row, filters));
  const base = st.actionRows.find((r) => r.id === rowId)?.basedOn;
  if (base) applyRow(target, board, st, base, filters, depth + 1);
}

/**
 * `target` × (1 − this row's factor), on top of the rows it is based on: what
 * does NOT pass the row (the inverse of a raise row is what calls the bet but
 * not the raise).
 */
function applyRowInverse(
  target: ComboWeights,
  board: readonly CardId[],
  st: StreetState,
  rowId: string,
  filters: readonly CustomFilter[],
): void {
  const passing = new Float64Array(target);
  applyRow(passing, board, st, rowId, filters);
  const base = st.actionRows.find((r) => r.id === rowId)?.basedOn;
  if (base) applyRow(target, board, st, base, filters);
  for (let id = 0; id < COMBO_COUNT; id++) {
    target[id] = Math.max(0, (target[id] ?? 0) - (passing[id] ?? 0));
  }
}

const isInverted = (st: StreetState, rowId: string) => st.invertedRows?.includes(rowId) ?? false;

/** The effective ranges of one street, or null if the board does not reach it. */
export function streetView(input: ChainInput, street: Street): StreetView | null {
  const board = boardFor(input.hand, street);
  if (!board) return null;

  const dead = deadCardsOf([...input.hand.hero, ...board]);
  const start = new Float64Array(COMBO_COUNT);
  const liveMask = new Uint8Array(COMBO_COUNT);
  let liveCombos = 0;
  for (let id = 0; id < COMBO_COUNT; id++) {
    if (isComboBlocked(id, dead)) continue;
    liveCombos++;
    liveMask[id] = 1;
    const w = input.villainPreflop[id] ?? 0;
    start[id] = w < 0 ? 0 : w > 1 ? 1 : w;
  }

  for (const s of STREETS.slice(0, STREETS.indexOf(street) + 1)) {
    const st = input.streets[s];
    // A start set by hand replaces the chain up to here (blocked combos stay 0).
    if (st.startOverride) {
      const ov = overrideWeights(st.startOverride);
      for (let id = 0; id < COMBO_COUNT; id++) start[id] = liveMask[id] === 1 ? (ov[id] ?? 0) : 0;
    }
    if (s === street) break;
    const prevBoard = boardFor(input.hand, s);
    if (!prevBoard) continue;
    // A played row always exists; if it ever went missing nothing continues.
    if (isInverted(st, st.playedRow)) applyRowInverse(start, prevBoard, st, st.playedRow, input.filters);
    else applyRow(start, prevBoard, st, st.playedRow, input.filters);
  }

  const st = input.streets[street];
  const rows: Record<string, ComboWeights> = {};
  const inverse: Record<string, ComboWeights> = {};
  for (const ar of st.actionRows) {
    const w = new Float64Array(start);
    applyRow(w, board, st, ar.id, input.filters);
    rows[ar.id] = w;
    if (isInverted(st, ar.id)) {
      const inv = new Float64Array(start);
      applyRowInverse(inv, board, st, ar.id, input.filters);
      inverse[ar.id] = inv;
    }
  }

  return { street, board, classes: classifyBoard(board), start, rows, inverse, liveCombos, liveMask };
}

// ── Counts per table row ─────────────────────────────────────────────────────

export type RowTotals = {
  /** Σ weights of the range. */
  total: number;
  /** Σ weights per category row (made rows partition `total`; draws overlap). */
  byCategory: Partial<Record<CategoryId, number>>;
  byCustom: Record<CustomFilterId, number>;
};

/** Weighted combo count of each table row for a weight vector. */
export function rowTotals(
  weights: ComboWeights,
  classes: ReadonlyMap<ComboId, ComboClass>,
  board: readonly CardId[],
  filters: readonly CustomFilter[] = [],
): RowTotals {
  const byCategory: Partial<Record<CategoryId, number>> = {};
  for (const c of [...MADE_CATEGORIES, ...DRAW_ROWS, ...COMBO_DRAW_CATEGORIES]) byCategory[c] = 0;
  const byCustom: Record<CustomFilterId, number> = {};
  for (const f of filters) byCustom[f.id] = 0;
  const filterCtx = makeFilterContext(board, filters);

  let total = 0;
  for (const [id, cls] of classes) {
    const w = weights[id] ?? 0;
    if (w <= 0) continue;
    total += w;
    byCategory[cls.made] = (byCategory[cls.made] ?? 0) + w;
    for (const d of cls.draws) {
      if (d.id !== 'bdsd') byCategory[d.id] = (byCategory[d.id] ?? 0) + w;
    }
    for (const d of cls.comboDraws) byCategory[d.id] = (byCategory[d.id] ?? 0) + w;
    for (const f of filters) {
      let hit = false;
      try {
        hit = exprMatches(f.expr, id, cls, filterCtx);
      } catch (err) {
        if (!(err instanceof CircularFilterError)) throw err;
      }
      if (hit) byCustom[f.id] = (byCustom[f.id] ?? 0) + w;
    }
  }
  return { total, byCategory, byCustom };
}
