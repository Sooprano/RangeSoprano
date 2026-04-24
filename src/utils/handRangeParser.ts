import { RANKS, type HandNotation, type Rank } from '@/types/poker';
import { isPair } from './handUtils';

export type WeightedHand = { hand: HandNotation; weight: number };
export type ParseError = { token: string; reason: string };
export type ParseResult = { hands: WeightedHand[]; errors: ParseError[] };

const RANK_INDEX: Record<Rank, number> = RANKS.reduce(
  (acc, r, i) => {
    acc[r] = i;
    return acc;
  },
  {} as Record<Rank, number>,
);

// Accepts e.g. "[98%]AQs[/98%]" or "[12.5%]KK-88[/12.5%]".
const WRAPPER_RE = /^\[(\d+(?:\.\d+)?)%\](.+?)\[\/\1%\]$/;

function isRankChar(c: string): c is Rank {
  return Object.prototype.hasOwnProperty.call(RANK_INDEX, c);
}

/** A higher than B iff its position in the A..2 table is earlier. */
function isHigher(a: Rank, b: Rank): boolean {
  return RANK_INDEX[a] < RANK_INDEX[b];
}

function parseSingle(input: string): HandNotation | null {
  if (input.length === 2) {
    const a = input[0];
    const b = input[1];
    if (!a || !b || !isRankChar(a) || !isRankChar(b) || a !== b) return null;
    return `${a}${b}`;
  }
  if (input.length === 3) {
    const a = input[0];
    const b = input[1];
    const s = input[2];
    if (!a || !b || !s || !isRankChar(a) || !isRankChar(b)) return null;
    if (s !== 's' && s !== 'o') return null;
    if (a === b) return null;
    const [hi, lo] = isHigher(a, b) ? [a, b] : [b, a];
    return `${hi}${lo}${s}`;
  }
  return null;
}

function rankAt(idx: number): Rank | null {
  return RANKS[idx] ?? null;
}

function parseRange(input: string): HandNotation[] | null {
  const dash = input.indexOf('-');
  if (dash <= 0 || dash >= input.length - 1) return null;
  const lHand = parseSingle(input.slice(0, dash));
  const rHand = parseSingle(input.slice(dash + 1));
  if (!lHand || !rHand) return null;

  // Pair range: KK-88 (any order)
  if (isPair(lHand) && isPair(rHand)) {
    const li = RANK_INDEX[lHand[0] as Rank];
    const ri = RANK_INDEX[rHand[0] as Rank];
    const lo = Math.min(li, ri);
    const hi = Math.max(li, ri);
    const out: HandNotation[] = [];
    for (let i = lo; i <= hi; i++) {
      const r = rankAt(i);
      if (r) out.push(`${r}${r}`);
    }
    return out;
  }

  // Both suited or both offsuit
  if (lHand.length === 3 && rHand.length === 3 && lHand[2] === rHand[2]) {
    const suffix = lHand[2] as 's' | 'o';
    const lHi = lHand[0] as Rank;
    const lLo = lHand[1] as Rank;
    const rHi = rHand[0] as Rank;
    const rLo = rHand[1] as Rank;

    // Same high card → kicker sweep: A2s-A5s, KTs-KQs
    if (lHi === rHi) {
      const hiIdx = RANK_INDEX[lHi];
      const a = RANK_INDEX[lLo];
      const b = RANK_INDEX[rLo];
      const kMin = Math.min(a, b);
      const kMax = Math.max(a, b);
      const out: HandNotation[] = [];
      for (let i = kMin; i <= kMax; i++) {
        if (i <= hiIdx) continue; // kicker must be strictly lower than high card
        const lo = rankAt(i);
        if (lo) out.push(`${lHi}${lo}${suffix}`);
      }
      return out;
    }

    // Connector/gap sweep: same gap on both ends (98s-65s, JTs-54s)
    const lGap = Math.abs(RANK_INDEX[lHi] - RANK_INDEX[lLo]);
    const rGap = Math.abs(RANK_INDEX[rHi] - RANK_INDEX[rLo]);
    if (lGap === rGap && lGap > 0) {
      const gap = lGap;
      const lhi = RANK_INDEX[lHi];
      const rhi = RANK_INDEX[rHi];
      const hiMin = Math.min(lhi, rhi);
      const hiMax = Math.max(lhi, rhi);
      const out: HandNotation[] = [];
      for (let i = hiMin; i <= hiMax; i++) {
        const hi = rankAt(i);
        const lo = rankAt(i + gap);
        if (hi && lo) out.push(`${hi}${lo}${suffix}`);
      }
      return out;
    }
  }
  return null;
}

function parsePlus(input: string): HandNotation[] | null {
  if (!input.endsWith('+')) return null;
  const base = parseSingle(input.slice(0, -1));
  if (!base) return null;

  if (isPair(base)) {
    const startIdx = RANK_INDEX[base[0] as Rank];
    const out: HandNotation[] = [];
    for (let i = 0; i <= startIdx; i++) {
      const r = rankAt(i);
      if (r) out.push(`${r}${r}`);
    }
    return out;
  }

  // Suited/offsuit "+" means same high card, kicker climbs up to (high card - 1).
  // Higher rank = lower index, so we iterate from loIdx DOWN to hiIdx+1.
  const hi = base[0] as Rank;
  const lo = base[1] as Rank;
  const suffix = base[2] as 's' | 'o';
  const hiIdx = RANK_INDEX[hi];
  const loIdx = RANK_INDEX[lo];
  const out: HandNotation[] = [];
  for (let i = loIdx; i > hiIdx; i--) {
    const r = rankAt(i);
    if (r) out.push(`${hi}${r}${suffix}`);
  }
  return out;
}

export function parseHandRange(input: string): ParseResult {
  const errors: ParseError[] = [];
  const seen = new Map<HandNotation, number>();

  const tokens = input
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  for (const rawToken of tokens) {
    let weight = 100;
    let inner = rawToken;

    const m = rawToken.match(WRAPPER_RE);
    if (m) {
      const wStr = m[1];
      const payload = m[2];
      if (wStr === undefined || payload === undefined) {
        errors.push({ token: rawToken, reason: 'malformed weight tag' });
        continue;
      }
      const w = Number(wStr);
      if (!Number.isFinite(w) || w <= 0 || w > 100) {
        errors.push({ token: rawToken, reason: 'weight must be in (0, 100]' });
        continue;
      }
      weight = w;
      inner = payload.trim();
    }

    let expanded: HandNotation[] | null = parseSingle(inner)
      ? [parseSingle(inner)!]
      : null;
    if (!expanded) expanded = parseRange(inner);
    if (!expanded) expanded = parsePlus(inner);

    if (!expanded || expanded.length === 0) {
      errors.push({ token: rawToken, reason: 'unrecognized notation' });
      continue;
    }

    for (const h of expanded) {
      // Later occurrences override earlier ones.
      seen.set(h, weight);
    }
  }

  const hands: WeightedHand[] = [];
  for (const [hand, weight] of seen) {
    hands.push({ hand, weight });
  }

  return { hands, errors };
}
