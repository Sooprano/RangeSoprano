// Hand evaluator — TS port of the classic prime-product 5-card
// algorithm, extended to 7 cards as the best of the 21 five-card subsets.
//
// Every 5-card hand maps to one of 7462 equivalence classes. Lower value =
// stronger hand: 1 = royal flush … 7462 = 7-5-4-3-2 offsuit.
//
// Card encoding (32-bit int):  xxxbbbbb bbbbbbbb ssssrrrr xxpppppp
//   b = one bit for the rank · s = one bit for the suit · r = rank 0..12 ·
//   p = the rank's prime (2, 3, 5 … 41).
// - All five cards share a suit bit → flush → table `FLUSHES[rankBits]`.
// - Five distinct ranks → straight or high card → `UNIQUE5[rankBits]`.
// - Anything else has a repeated rank → product of the five primes (unique by
//   prime factorisation) → `PAIRED` hash table.
//
// The tables are generated here at module load by enumerating the classes in
// strength order; no third-party table is copied.

import { rankOf, suitOf, type CardId } from './cards';

const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41] as const;

export type HandValue = number;

export const HAND_CATEGORIES = [
  'straight-flush',
  'quads',
  'full-house',
  'flush',
  'straight',
  'trips',
  'two-pair',
  'pair',
  'high-card',
] as const;
export type HandCategory = (typeof HAND_CATEGORIES)[number];

// Worst value of each category, in HAND_CATEGORIES order.
const CATEGORY_UPPER = [10, 166, 322, 1599, 1609, 2467, 3325, 6185, 7462] as const;

export function categoryOfValue(value: HandValue): HandCategory {
  for (let i = 0; i < CATEGORY_UPPER.length; i++) {
    if (value <= (CATEGORY_UPPER[i] as number)) return HAND_CATEGORIES[i] as HandCategory;
  }
  throw new Error(`invalid hand value ${value}`);
}

function prime(rank: number): number {
  return PRIMES[rank] as number;
}

/** evaluator int for every engine CardId. */
export const CK_CARD = new Int32Array(52);
for (let id = 0; id < 52; id++) {
  const r = rankOf(id);
  CK_CARD[id] = (1 << (16 + r)) | (1 << (12 + suitOf(id))) | (r << 8) | prime(r);
}

// ── Table generation ─────────────────────────────────────────────────────────

const FLUSHES = new Uint16Array(8192);
const UNIQUE5 = new Uint16Array(8192);

const HASH_BITS = 14;
const HASH_SIZE = 1 << HASH_BITS;
const HASH_KEYS = new Int32Array(HASH_SIZE);
const HASH_VALUES = new Uint16Array(HASH_SIZE);

function hashSlot(product: number): number {
  return Math.imul(product, 0x9e3779b1) >>> (32 - HASH_BITS);
}

function storePaired(product: number, value: number): void {
  let slot = hashSlot(product);
  while (HASH_KEYS[slot] !== 0) {
    if (HASH_KEYS[slot] === product) throw new Error('duplicate prime product');
    slot = (slot + 1) & (HASH_SIZE - 1);
  }
  HASH_KEYS[slot] = product;
  HASH_VALUES[slot] = value;
}

function lookupPaired(product: number): number {
  let slot = hashSlot(product);
  for (;;) {
    const key = HASH_KEYS[slot];
    if (key === product) return HASH_VALUES[slot] as number;
    if (key === 0) throw new Error(`unknown prime product ${product}`);
    slot = (slot + 1) & (HASH_SIZE - 1);
  }
}

function popcount13(x: number): number {
  let n = 0;
  for (let v = x; v; v &= v - 1) n++;
  return n;
}

{
  // Straights from A-high down to the wheel (A-2-3-4-5 = bits 12,0,1,2,3).
  const straights: number[] = [];
  for (let high = 12; high >= 4; high--) straights.push(0x1f << (high - 4));
  straights.push(0x100f);
  const straightSet = new Set(straights);

  // Every other 5-distinct-rank pattern, strongest first. With equal popcount,
  // numeric order of the bitset is the lexicographic order of the ranks.
  const plain: number[] = [];
  for (let bits = 8191; bits > 0; bits--) {
    if (popcount13(bits) === 5 && !straightSet.has(bits)) plain.push(bits);
  }

  straights.forEach((bits, i) => {
    FLUSHES[bits] = 1 + i; // straight flush 1..10
    UNIQUE5[bits] = 1600 + i; // straight 1600..1609
  });
  plain.forEach((bits, i) => {
    FLUSHES[bits] = 323 + i; // flush 323..1599
    UNIQUE5[bits] = 6186 + i; // high card 6186..7462
  });

  let value = 11;
  // Quads 11..166
  for (let q = 12; q >= 0; q--)
    for (let k = 12; k >= 0; k--) {
      if (k === q) continue;
      storePaired(prime(q) ** 4 * prime(k), value++);
    }
  // Full house 167..322
  for (let t = 12; t >= 0; t--)
    for (let p = 12; p >= 0; p--) {
      if (p === t) continue;
      storePaired(prime(t) ** 3 * prime(p) ** 2, value++);
    }
  // Trips 1610..2467
  value = 1610;
  for (let t = 12; t >= 0; t--)
    for (let k1 = 12; k1 >= 0; k1--) {
      if (k1 === t) continue;
      for (let k2 = k1 - 1; k2 >= 0; k2--) {
        if (k2 === t) continue;
        storePaired(prime(t) ** 3 * prime(k1) * prime(k2), value++);
      }
    }
  // Two pair 2468..3325
  for (let hi = 12; hi >= 0; hi--)
    for (let lo = hi - 1; lo >= 0; lo--)
      for (let k = 12; k >= 0; k--) {
        if (k === hi || k === lo) continue;
        storePaired(prime(hi) ** 2 * prime(lo) ** 2 * prime(k), value++);
      }
  // One pair 3326..6185
  for (let p = 12; p >= 0; p--)
    for (let k1 = 12; k1 >= 0; k1--) {
      if (k1 === p) continue;
      for (let k2 = k1 - 1; k2 >= 0; k2--) {
        if (k2 === p) continue;
        for (let k3 = k2 - 1; k3 >= 0; k3--) {
          if (k3 === p) continue;
          storePaired(prime(p) ** 2 * prime(k1) * prime(k2) * prime(k3), value++);
        }
      }
    }
  if (value !== 6186) throw new Error('evaluator table generation is inconsistent');
}

// ── Evaluation ───────────────────────────────────────────────────────────────

/** Evaluates five evaluator ints. */
export function evalCk5(c1: number, c2: number, c3: number, c4: number, c5: number): HandValue {
  const q = (c1 | c2 | c3 | c4 | c5) >>> 16;
  if (c1 & c2 & c3 & c4 & c5 & 0xf000) return FLUSHES[q] as number;
  const u = UNIQUE5[q] as number;
  if (u) return u;
  return lookupPaired((c1 & 0xff) * (c2 & 0xff) * (c3 & 0xff) * (c4 & 0xff) * (c5 & 0xff));
}

// The 21 ways to keep five of seven cards, flattened (5 indexes per subset) so
// the hot loop is a plain indexed loop.
const SUBSETS_7 = (() => {
  const out = new Uint8Array(21 * 5);
  let k = 0;
  for (let i = 0; i < 7; i++)
    for (let j = i + 1; j < 7; j++)
      for (let x = 0; x < 7; x++) if (x !== i && x !== j) out[k++] = x;
  return out;
})();

/** Best (lowest) value among the 21 five-card subsets of 7 evaluator ints. */
export function evalCk7(ck: ArrayLike<number>): HandValue {
  let best = 9999;
  for (let s = 0; s < 105; s += 5) {
    const v = evalCk5(
      ck[SUBSETS_7[s]!]!,
      ck[SUBSETS_7[s + 1]!]!,
      ck[SUBSETS_7[s + 2]!]!,
      ck[SUBSETS_7[s + 3]!]!,
      ck[SUBSETS_7[s + 4]!]!,
    );
    if (v < best) best = v;
  }
  return best;
}

/** Best (lowest) value among the 5-card subsets of 5–7 evaluator ints. */
export function evalCkBest(ck: ArrayLike<number>): HandValue {
  const n = ck.length;
  if (n === 5) return evalCk5(ck[0]!, ck[1]!, ck[2]!, ck[3]!, ck[4]!);
  if (n === 7) return evalCk7(ck);
  if (n === 6) {
    let best = 9999;
    for (let skip = 0; skip < 6; skip++) {
      const k: number[] = [];
      for (let i = 0; i < 6; i++) if (i !== skip) k.push(ck[i]!);
      const v = evalCk5(k[0]!, k[1]!, k[2]!, k[3]!, k[4]!);
      if (v < best) best = v;
    }
    return best;
  }
  throw new Error(`evaluator needs 5 to 7 cards, got ${n}`);
}

/** Evaluates 5–7 engine CardIds. Lower = stronger. */
export function evaluate(cards: readonly CardId[]): HandValue {
  return evalCkBest(cards.map((c) => CK_CARD[c] as number));
}

/** Compares two hands: > 0 when `a` wins, < 0 when `b` wins, 0 on a tie. */
export function compareHands(a: readonly CardId[], b: readonly CardId[]): number {
  return evaluate(b) - evaluate(a);
}
