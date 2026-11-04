// Exact equity by full enumeration (never Monte Carlo). Pure TS, no React.
//
// The expensive part is Hero's equity against each villain combo
// (`eqCombo[comboId]`), which depends only on Hero's cards and the board — not
// on weights. It is computed once per street and cached; the equity against a
// weighted range is then a weighted average, recomputed instantly when weights
// change:
//
//   equityVsRange = Σ(w · eqCombo) / Σ(w)
//
// That average is exact because every valid villain combo faces the same
// number of runouts (e.g. C(45,2) = 990 on the flop).

import { DECK_SIZE, deadCardsOf, formatCards, type CardId } from './cards';
import { COMBO_COUNT, comboCards, isComboBlocked, type ComboId, type ComboWeights } from './combos';
import { CK_CARD, evalCk7 } from './evaluator';

export type Street = 'flop' | 'turn' | 'river';

/** Per-combo Hero equity in [0, 1]; NaN where not computed or blocked. */
export type EqComboTable = Float64Array;

export type ComboOutcome = { win: number; tie: number; lose: number; total: number };

export function streetOfBoard(board: readonly CardId[]): Street {
  if (board.length === 3) return 'flop';
  if (board.length === 4) return 'turn';
  if (board.length === 5) return 'river';
  throw new Error(`board must have 3 to 5 cards, got ${board.length}`);
}

function assertSpot(hero: readonly CardId[], board: readonly CardId[]): void {
  if (hero.length !== 2) throw new Error('hero needs exactly 2 cards');
  streetOfBoard(board);
  const all = [...hero, ...board];
  for (const c of all) {
    if (!Number.isInteger(c) || c < 0 || c >= DECK_SIZE) throw new Error(`invalid card ${c}`);
  }
  if (new Set(all).size !== all.length) throw new Error('hero and board share a card');
}

/**
 * Precomputed runouts and Hero's hand value on each one. Building it once per
 * spot means Hero is evaluated 990 times on the flop, not 990 × combos.
 */
export type SpotRunouts = {
  hero: readonly [CardId, CardId];
  board: readonly CardId[];
  /** Cards still to come per runout (0, 1 or 2), flattened. */
  cardsPerRunout: number;
  runoutCards: Uint8Array;
  heroValues: Uint16Array;
  /** 7 evaluator ints: board + runout in [0..4], villain cards in [5], [6]. */
  scratch: Int32Array;
};

export function buildSpotRunouts(hero: readonly CardId[], board: readonly CardId[]): SpotRunouts {
  assertSpot(hero, board);
  const dead = deadCardsOf([...hero, ...board]);
  const live: CardId[] = [];
  for (let c = 0; c < DECK_SIZE; c++) if (dead[c] !== 1) live.push(c);

  const cardsPerRunout = 5 - board.length;
  const runouts: number[] = [];
  if (cardsPerRunout === 0) {
    // River: one "empty" runout.
  } else if (cardsPerRunout === 1) {
    for (const r of live) runouts.push(r);
  } else {
    for (let i = 0; i < live.length; i++)
      for (let j = i + 1; j < live.length; j++) runouts.push(live[i]!, live[j]!);
  }
  const runoutCount = cardsPerRunout === 0 ? 1 : runouts.length / cardsPerRunout;

  const heroValues = new Uint16Array(runoutCount);
  const seven = new Int32Array(7);
  for (let i = 0; i < board.length; i++) seven[i] = CK_CARD[board[i]!]!;
  for (let r = 0; r < runoutCount; r++) {
    for (let k = 0; k < cardsPerRunout; k++) {
      seven[board.length + k] = CK_CARD[runouts[r * cardsPerRunout + k]!]!;
    }
    seven[5] = CK_CARD[hero[0]!]!;
    seven[6] = CK_CARD[hero[1]!]!;
    heroValues[r] = evalCk7(seven);
  }

  const scratch = new Int32Array(7);
  for (let i = 0; i < board.length; i++) scratch[i] = CK_CARD[board[i]!]!;

  return {
    hero: [hero[0]!, hero[1]!],
    board: [...board],
    cardsPerRunout,
    runoutCards: Uint8Array.from(runouts),
    heroValues,
    scratch,
  };
}

/**
 * Win / tie / lose counts of Hero vs one villain combo over every runout that
 * shares no card with Hero, the board or the combo. Null when the combo is
 * blocked by Hero or the board.
 */
export function comboOutcome(spot: SpotRunouts, combo: ComboId): ComboOutcome | null {
  const [v1, v2] = comboCards(combo);
  const { hero, board, cardsPerRunout, runoutCards, heroValues, scratch } = spot;
  if (v1 === hero[0] || v1 === hero[1] || v2 === hero[0] || v2 === hero[1]) return null;
  if (board.includes(v1) || board.includes(v2)) return null;

  scratch[5] = CK_CARD[v1]!;
  scratch[6] = CK_CARD[v2]!;
  const start = board.length;
  let win = 0;
  let tie = 0;
  let lose = 0;
  for (let r = 0; r < heroValues.length; r++) {
    if (cardsPerRunout > 0) {
      const base = r * cardsPerRunout;
      const t = runoutCards[base]!;
      if (t === v1 || t === v2) continue;
      scratch[start] = CK_CARD[t]!;
      if (cardsPerRunout === 2) {
        const rv = runoutCards[base + 1]!;
        if (rv === v1 || rv === v2) continue;
        scratch[start + 1] = CK_CARD[rv]!;
      }
    }
    const villain = evalCk7(scratch);
    const heroValue = heroValues[r]!;
    if (heroValue < villain) win++;
    else if (heroValue === villain) tie++;
    else lose++;
  }
  return { win, tie, lose, total: win + tie + lose };
}

/** Hero equity from an outcome: ties count 0.5. */
export function heroEquityOf(o: ComboOutcome): number {
  return o.total === 0 ? Number.NaN : (o.win + o.tie / 2) / o.total;
}

export function newEqComboTable(): EqComboTable {
  return new Float64Array(COMBO_COUNT).fill(Number.NaN);
}

/**
 * Fills `table` with Hero's equity for each requested combo. Blocked combos
 * stay NaN. `onProgress(done, total)` is called every `progressEvery` combos.
 */
export function computeEqCombos(
  spot: SpotRunouts,
  combos: readonly ComboId[],
  table: EqComboTable = newEqComboTable(),
  onProgress?: (done: number, total: number) => void,
  progressEvery = 25,
): EqComboTable {
  for (let i = 0; i < combos.length; i++) {
    const id = combos[i]!;
    const o = comboOutcome(spot, id);
    table[id] = o ? heroEquityOf(o) : Number.NaN;
    if (onProgress && ((i + 1) % progressEvery === 0 || i + 1 === combos.length)) {
      onProgress(i + 1, combos.length);
    }
  }
  return table;
}

export type RangeEquity = {
  /** Hero equity vs the weighted range, in [0, 1]; NaN when the range is empty. */
  hero: number;
  /** Σ weights of the combos that took part (blockers removed). */
  weight: number;
  /** Combos with weight > 0 whose eqCombo is not in the table yet. */
  missing: number;
};

/**
 * Hero equity vs a weighted range, from cached per-combo equities. Combos
 * blocked by Hero or the board are ignored whatever their weight.
 */
export function equityVsRange(
  table: EqComboTable,
  weights: ComboWeights,
  hero: readonly CardId[],
  board: readonly CardId[],
): RangeEquity {
  const dead = deadCardsOf([...hero, ...board]);
  let num = 0;
  let den = 0;
  let missing = 0;
  for (let id = 0; id < COMBO_COUNT; id++) {
    const w = weights[id] ?? 0;
    if (w <= 0 || isComboBlocked(id, dead)) continue;
    const eq = table[id] ?? Number.NaN;
    if (Number.isNaN(eq)) {
      missing++;
      continue;
    }
    num += w * eq;
    den += w;
  }
  return { hero: den > 0 ? num / den : Number.NaN, weight: den, missing };
}

/** Combos with weight > 0, not blocked, and not yet in the table. */
export function missingCombos(
  table: EqComboTable,
  weights: ComboWeights,
  hero: readonly CardId[],
  board: readonly CardId[],
): ComboId[] {
  const dead = deadCardsOf([...hero, ...board]);
  const out: ComboId[] = [];
  for (let id = 0; id < COMBO_COUNT; id++) {
    if ((weights[id] ?? 0) <= 0 || isComboBlocked(id, dead)) continue;
    if (Number.isNaN(table[id] ?? Number.NaN)) out.push(id);
  }
  return out;
}

// ── Cache ────────────────────────────────────────────────────────────────────

/** Cache key: Hero cards (order-free) + board (order-free). */
export function spotKey(hero: readonly CardId[], board: readonly CardId[]): string {
  const h = [...hero].sort((a, b) => a - b);
  const b = [...board].sort((a, c) => a - c);
  return `${formatCards(h)}|${formatCards(b)}`;
}

/**
 * Small LRU of eqCombo tables keyed by spot. Lives outside any reactive store;
 * tables are filled incrementally as new combos enter the range.
 */
export class EqComboCache {
  private readonly tables = new Map<string, EqComboTable>();
  private readonly capacity: number;

  constructor(capacity = 24) {
    this.capacity = capacity;
  }

  /** The table for a spot, created empty (all NaN) on first use. */
  table(hero: readonly CardId[], board: readonly CardId[]): EqComboTable {
    const key = spotKey(hero, board);
    let t = this.tables.get(key);
    if (t) {
      // Refresh recency.
      this.tables.delete(key);
    } else {
      t = newEqComboTable();
      if (this.tables.size >= this.capacity) {
        const oldest = this.tables.keys().next().value;
        if (oldest !== undefined) this.tables.delete(oldest);
      }
    }
    this.tables.set(key, t);
    return t;
  }

  has(hero: readonly CardId[], board: readonly CardId[]): boolean {
    return this.tables.has(spotKey(hero, board));
  }

  clear(): void {
    this.tables.clear();
  }

  get size(): number {
    return this.tables.size;
  }
}
