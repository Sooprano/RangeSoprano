// Combo model: the 1326 two-card holdings, class ↔ combo expansion, per-combo
// weights (0..1) and blockers. Pure TS, no React.

import type { ActionId, HandNotation, Range } from '@/types/poker';
import { parseHandRange } from '@/utils/handRangeParser';
import {
  DECK_SIZE,
  ENGINE_RANKS,
  formatCard,
  makeCardId,
  rankOf,
  suitOf,
  type CardId,
  type DeadCards,
} from './cards';

export type ComboId = number;
export const COMBO_COUNT = 1326;

/** Per-combo weight in [0, 1], indexed by ComboId. */
export type ComboWeights = Float64Array;

// COMBO_A[id] < COMBO_B[id]; ids enumerate (a, b) with a < b in ascending order.
const COMBO_A = new Uint8Array(COMBO_COUNT);
const COMBO_B = new Uint8Array(COMBO_COUNT);
// Symmetric lookup: COMBO_INDEX[a * 52 + b] === COMBO_INDEX[b * 52 + a].
const COMBO_INDEX = new Int16Array(DECK_SIZE * DECK_SIZE).fill(-1);

{
  let id = 0;
  for (let a = 0; a < DECK_SIZE; a++) {
    for (let b = a + 1; b < DECK_SIZE; b++) {
      COMBO_A[id] = a;
      COMBO_B[id] = b;
      COMBO_INDEX[a * DECK_SIZE + b] = id;
      COMBO_INDEX[b * DECK_SIZE + a] = id;
      id++;
    }
  }
}

export function comboId(a: CardId, b: CardId): ComboId {
  const id = COMBO_INDEX[a * DECK_SIZE + b];
  if (id === undefined || id < 0) throw new Error(`invalid combo ${a},${b}`);
  return id;
}

/** The two cards of a combo, lower id first. */
export function comboCards(id: ComboId): [CardId, CardId] {
  return [COMBO_A[id] as CardId, COMBO_B[id] as CardId];
}

/** Display form, higher card first: "AhKd". */
export function formatCombo(id: ComboId): string {
  const [lo, hi] = comboCards(id);
  return formatCard(hi) + formatCard(lo);
}

/** The 169-class notation of a combo: "AA", "AKs", "72o". */
export function classOfCombo(id: ComboId): HandNotation {
  const [lo, hi] = comboCards(id);
  const rHi = rankOf(hi);
  const rLo = rankOf(lo);
  const top = ENGINE_RANKS[Math.max(rHi, rLo)] as string;
  const bottom = ENGINE_RANKS[Math.min(rHi, rLo)] as string;
  if (rHi === rLo) return top + bottom;
  return top + bottom + (suitOf(hi) === suitOf(lo) ? 's' : 'o');
}

const RANK_FROM_CHAR = new Map<string, number>(ENGINE_RANKS.map((r, i) => [r, i]));

const CLASS_CACHE = new Map<HandNotation, readonly ComboId[]>();

/** All combos of a class (6 pair · 4 suited · 12 offsuit). Empty if invalid. */
export function combosOfClass(hand: HandNotation): readonly ComboId[] {
  const cached = CLASS_CACHE.get(hand);
  if (cached) return cached;
  const r1 = RANK_FROM_CHAR.get(hand[0] ?? '');
  const r2 = RANK_FROM_CHAR.get(hand[1] ?? '');
  const out: ComboId[] = [];
  if (r1 !== undefined && r2 !== undefined) {
    const kind = hand.length === 2 ? 'pair' : hand[2];
    if (kind === 'pair' && r1 === r2) {
      for (let s1 = 0; s1 < 4; s1++)
        for (let s2 = s1 + 1; s2 < 4; s2++)
          out.push(comboId(makeCardId(r1, s1), makeCardId(r2, s2)));
    } else if (r1 !== r2 && (kind === 's' || kind === 'o')) {
      for (let s1 = 0; s1 < 4; s1++)
        for (let s2 = 0; s2 < 4; s2++) {
          if ((s1 === s2) !== (kind === 's')) continue;
          out.push(comboId(makeCardId(r1, s1), makeCardId(r2, s2)));
        }
    }
  }
  out.sort((x, y) => x - y);
  const frozen = Object.freeze(out);
  CLASS_CACHE.set(hand, frozen);
  return frozen;
}

export function emptyWeights(): ComboWeights {
  return new Float64Array(COMBO_COUNT);
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/** Class weights in percent (0..100) → per-combo weights (0..1). */
export function weightsFromClassWeights(
  classWeights: Readonly<Record<HandNotation, number>>,
): ComboWeights {
  const w = emptyWeights();
  for (const [hand, pct] of Object.entries(classWeights)) {
    const value = clamp01(pct / 100);
    for (const id of combosOfClass(hand)) w[id] = value;
  }
  return w;
}

/** Text range ("AKs, 22+, [50]QJs[/50]") → per-combo weights. Ignores parse errors. */
export function weightsFromHandRange(text: string): ComboWeights {
  const record: Record<HandNotation, number> = {};
  for (const { hand, weight } of parseHandRange(text).hands) record[hand] = weight;
  return weightsFromClassWeights(record);
}

/**
 * A library `Range` → per-combo weights, summing the frequency of the chosen
 * actions in each cell (e.g. only the "call" action of a BB defense range).
 * Read-only: the Range is not modified.
 */
export function weightsFromRange(range: Range, actionIds: readonly ActionId[]): ComboWeights {
  const chosen = new Set(actionIds);
  const record: Record<HandNotation, number> = {};
  for (const cell of Object.values(range.cells)) {
    let sum = 0;
    for (const a of cell.actions) if (chosen.has(a.action)) sum += a.weight;
    if (sum > 0) record[cell.hand] = sum;
  }
  return weightsFromClassWeights(record);
}

export function isComboBlocked(id: ComboId, dead: DeadCards): boolean {
  return dead[COMBO_A[id] as number] === 1 || dead[COMBO_B[id] as number] === 1;
}

/** Copy of `weights` with every combo that touches a dead card set to 0. */
export function removeBlocked(weights: ComboWeights, dead: DeadCards): ComboWeights {
  const out = new Float64Array(weights);
  for (let id = 0; id < COMBO_COUNT; id++) if (isComboBlocked(id, dead)) out[id] = 0;
  return out;
}

/** Ids of combos with weight > 0, ascending. */
export function activeCombos(weights: ComboWeights): ComboId[] {
  const out: ComboId[] = [];
  for (let id = 0; id < COMBO_COUNT; id++) if ((weights[id] ?? 0) > 0) out.push(id);
  return out;
}

/** Σ weights — the usual "combos" count (a 50% combo counts 0.5). */
export function totalWeight(weights: ComboWeights): number {
  let sum = 0;
  for (let id = 0; id < COMBO_COUNT; id++) sum += weights[id] ?? 0;
  return sum;
}
