import { RANKS, type HandNotation, type Rank } from '@/types/poker';
import { ALL_HANDS, isPair } from './handUtils';
import type { WeightedHand } from './handRangeParser';

const RANK_INDEX: Record<Rank, number> = RANKS.reduce(
  (acc, r, i) => {
    acc[r] = i;
    return acc;
  },
  {} as Record<Rank, number>,
);

type Grouped = {
  hand: HandNotation;
  hi: Rank;
  loIdx: number;
  weight: number;
};

function formatWeight(w: number): string {
  if (Number.isInteger(w)) return String(w);
  return w.toFixed(2).replace(/\.?0+$/, '');
}

function wrap(inner: string, weight: number): string {
  if (weight === 100) return inner;
  const w = formatWeight(weight);
  return `[${w}%]${inner}[/${w}%]`;
}

/**
 * Inverse of parseHandRange: emits a compact range string with pair and
 * same-high-card suited/offsuit runs collapsed into X-Y or Y+ notation.
 * Tokens are ordered by the anchor hand's position in the 13x13 grid
 * (row-major, A..2) so the output reads roughly like a solver sheet.
 * Connector/gap sweeps are NOT collapsed and roundtrip as individual
 * hands when re-parsed.
 */
export function serializeWeightedHands(entries: WeightedHand[]): string {
  const bucket = new Map<string, Grouped[]>();

  for (const { hand, weight } of entries) {
    if (isPair(hand)) {
      const r = hand[0] as Rank;
      if (!(r in RANK_INDEX)) continue;
      const key = `p|${weight}`;
      const entry: Grouped = { hand, hi: r, loIdx: RANK_INDEX[r], weight };
      const g = bucket.get(key);
      if (g) g.push(entry);
      else bucket.set(key, [entry]);
      continue;
    }
    if (hand.length === 3) {
      const hi = hand[0] as Rank;
      const lo = hand[1] as Rank;
      const s = hand[2];
      if (!(hi in RANK_INDEX) || !(lo in RANK_INDEX)) continue;
      if (s !== 's' && s !== 'o') continue;
      const key = `${s}|${hi}|${weight}`;
      const entry: Grouped = { hand, hi, loIdx: RANK_INDEX[lo], weight };
      const g = bucket.get(key);
      if (g) g.push(entry);
      else bucket.set(key, [entry]);
    }
  }

  type Token = { anchorIdx: number; text: string };
  const tokens: Token[] = [];
  const handOrder = new Map<HandNotation, number>();
  ALL_HANDS.forEach((h, i) => handOrder.set(h, i));

  for (const [key, list] of bucket) {
    list.sort((a, b) => a.loIdx - b.loIdx);
    const first = list[0];
    if (!first) continue;
    const weight = first.weight;
    const isPairGroup = key.startsWith('p|');
    const hi = first.hi;
    const topIdx = isPairGroup ? 0 : RANK_INDEX[hi] + 1;

    let runStart: Grouped = first;
    let runEnd: Grouped = first;

    const flush = () => {
      let inner: string;
      if (runStart === runEnd) {
        inner = runStart.hand;
      } else if (runStart.loIdx === topIdx) {
        inner = `${runEnd.hand}+`;
      } else {
        inner = `${runStart.hand}-${runEnd.hand}`;
      }
      tokens.push({
        anchorIdx: handOrder.get(runStart.hand) ?? 0,
        text: wrap(inner, weight),
      });
    };

    for (let i = 1; i < list.length; i++) {
      const cur = list[i];
      if (!cur) continue;
      if (cur.loIdx === runEnd.loIdx + 1) {
        runEnd = cur;
      } else {
        flush();
        runStart = cur;
        runEnd = cur;
      }
    }
    flush();
  }

  tokens.sort((a, b) => a.anchorIdx - b.anchorIdx);
  return tokens.map((t) => t.text).join(',');
}
