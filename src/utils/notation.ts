import { RANKS, type HandNotation, type Rank } from '@/types/poker';

const RANK_SET = new Set<string>(RANKS);

/** Returns true if the string is a well-formed hand notation (e.g. "AA", "AKs", "72o"). */
export function isValidHandNotation(raw: string): raw is HandNotation {
  if (raw.length === 2) {
    return RANK_SET.has(raw[0]!) && raw[0] === raw[1];
  }
  if (raw.length === 3) {
    const [a, b, suit] = raw;
    if (!a || !b || !RANK_SET.has(a) || !RANK_SET.has(b) || a === b) return false;
    return suit === 's' || suit === 'o';
  }
  return false;
}

/** Normalises a hand notation so the higher rank comes first (e.g. "kas" -> "AKs"). */
export function normaliseHand(raw: string): HandNotation | null {
  const trimmed = raw.trim();
  if (trimmed.length < 2 || trimmed.length > 3) return null;

  const a = trimmed[0]?.toUpperCase() as Rank | undefined;
  const b = trimmed[1]?.toUpperCase() as Rank | undefined;
  if (!a || !b || !RANK_SET.has(a) || !RANK_SET.has(b)) return null;

  if (a === b) return trimmed.length === 2 ? `${a}${a}` : null;

  const suit = trimmed[2]?.toLowerCase();
  if (suit !== 's' && suit !== 'o') return null;

  const [high, low] = RANKS.indexOf(a) < RANKS.indexOf(b) ? [a, b] : [b, a];
  return `${high}${low}${suit}`;
}
