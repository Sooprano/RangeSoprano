// Card model for the Sopranozilla engine. Pure TS, no React.
//
// Inside the engine a card is an integer id 0..51:
//   id = rankIdx * 4 + suitIdx
//   rankIdx 0 = '2' … 12 = 'A' (ascending, so bigger id → bigger rank)
//   suitIdx 0 = ♠, 1 = ♥, 2 = ♦, 3 = ♣ (same order as `SUITS` in comboMath)
// The app-wide `Card` ({ rank, suit }) from handHistory.ts is the boundary type
// for UI and adapters; convert with `toCardId` / `fromCardId`.

import type { Card, Suit } from '@/utils/handHistory';

export type CardId = number;

/** Ranks in ascending engine order: index = rankIdx. */
export const ENGINE_RANKS = [
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  'T',
  'J',
  'Q',
  'K',
  'A',
] as const;
export type EngineRank = (typeof ENGINE_RANKS)[number];

export const ENGINE_SUITS: readonly Suit[] = ['♠', '♥', '♦', '♣'];
const SUIT_LETTERS = ['s', 'h', 'd', 'c'] as const;

export const DECK_SIZE = 52;

export function rankOf(id: CardId): number {
  return id >> 2;
}

export function suitOf(id: CardId): number {
  return id & 3;
}

export function makeCardId(rankIdx: number, suitIdx: number): CardId {
  return rankIdx * 4 + suitIdx;
}

const RANK_INDEX = new Map<string, number>(ENGINE_RANKS.map((r, i) => [r, i]));

function suitIndexOf(ch: string): number {
  switch (ch) {
    case 's':
    case 'S':
    case '♠':
      return 0;
    case 'h':
    case 'H':
    case '♥':
      return 1;
    case 'd':
    case 'D':
    case '♦':
      return 2;
    case 'c':
    case 'C':
    case '♣':
      return 3;
    default:
      return -1;
  }
}

/**
 * Parses "As", "Td", "10h", "K♥" (rank first). Returns null when invalid.
 * Case-insensitive for the rank letter.
 */
export function parseCard(token: string): CardId | null {
  const t = token.trim();
  if (t.length < 2) return null;
  const suitIdx = suitIndexOf(t.slice(-1));
  if (suitIdx < 0) return null;
  let rank = t.slice(0, -1).toUpperCase();
  if (rank === '10') rank = 'T';
  const rankIdx = RANK_INDEX.get(rank);
  if (rankIdx === undefined) return null;
  return makeCardId(rankIdx, suitIdx);
}

/**
 * Parses a run of cards: "AhKd", "Ah Kd 2c", "A♥K♦". Returns null if any card
 * is invalid or repeated.
 */
export function parseCards(text: string): CardId[] | null {
  const compact = text.replace(/[\s,]+/g, '');
  const out: CardId[] = [];
  let i = 0;
  while (i < compact.length) {
    // "10x" is the only 3-char card.
    const len = compact.startsWith('10', i) ? 3 : 2;
    const id = parseCard(compact.slice(i, i + len));
    if (id === null || out.includes(id)) return null;
    out.push(id);
    i += len;
  }
  return out;
}

/** Engine notation, e.g. "Ah". */
export function formatCard(id: CardId): string {
  return `${ENGINE_RANKS[rankOf(id)]}${SUIT_LETTERS[suitOf(id)]}`;
}

/** Display notation with suit symbol, e.g. "A♥". */
export function formatCardSymbol(id: CardId): string {
  return `${ENGINE_RANKS[rankOf(id)]}${ENGINE_SUITS[suitOf(id)]}`;
}

export function formatCards(ids: readonly CardId[]): string {
  return ids.map(formatCard).join('');
}

/** App `Card` → engine id. Null when the rank is not a valid rank. */
export function toCardId(card: Card): CardId | null {
  const rankIdx = RANK_INDEX.get(card.rank);
  if (rankIdx === undefined) return null;
  return makeCardId(rankIdx, suitIndexOf(card.suit));
}

/** Engine id → app `Card`. */
export function fromCardId(id: CardId): Card {
  return { rank: ENGINE_RANKS[rankOf(id)] as string, suit: ENGINE_SUITS[suitOf(id)] as Suit };
}

/** 52-slot flag array: dead[id] === 1 when the card is out of the deck. */
export type DeadCards = Uint8Array;

export function deadCardsOf(cards: readonly CardId[]): DeadCards {
  const dead = new Uint8Array(DECK_SIZE);
  for (const c of cards) dead[c] = 1;
  return dead;
}

/** Cards still in the deck, ascending. */
export function liveCards(dead: DeadCards): CardId[] {
  const out: CardId[] = [];
  for (let c = 0; c < DECK_SIZE; c++) if (dead[c] !== 1) out.push(c);
  return out;
}
