// Slots of the card picker (D105): Hero's 2 cards and the 5 board cards as
// fixed places, so a card goes exactly where the user points (a swapped flop
// card stays in the flop). Pure TS; the picker renders it.

import { formatCard, parseCards, type CardId } from '../engine/cards';

export type SlotKey = { kind: 'hero'; i: 0 | 1 } | { kind: 'board'; i: 0 | 1 | 2 | 3 | 4 };

export type Slots = {
  hero: [CardId | null, CardId | null];
  board: [CardId | null, CardId | null, CardId | null, CardId | null, CardId | null];
};

/** Fill order when no slot is picked: Hero first, then flop, turn, river. */
export const SLOT_ORDER: readonly SlotKey[] = [
  { kind: 'hero', i: 0 },
  { kind: 'hero', i: 1 },
  { kind: 'board', i: 0 },
  { kind: 'board', i: 1 },
  { kind: 'board', i: 2 },
  { kind: 'board', i: 3 },
  { kind: 'board', i: 4 },
];

export function sameSlot(a: SlotKey | null, b: SlotKey | null): boolean {
  return a !== null && b !== null && a.kind === b.kind && a.i === b.i;
}

export function slotsFromText(hero: string, board: string): Slots {
  const h = parseCards(hero) ?? [];
  const b = parseCards(board) ?? [];
  return {
    hero: [h[0] ?? null, h[1] ?? null],
    board: [b[0] ?? null, b[1] ?? null, b[2] ?? null, b[3] ?? null, b[4] ?? null],
  };
}

const text = (ids: readonly (CardId | null)[]) =>
  ids.filter((c): c is CardId => c !== null).map(formatCard).join(' ');

export function slotsToText(s: Slots): { hero: string; board: string } {
  return { hero: text(s.hero), board: text(s.board) };
}

export function cardAt(s: Slots, k: SlotKey): CardId | null {
  return k.kind === 'hero' ? s.hero[k.i] : s.board[k.i];
}

/** Where a card is, or null. */
export function slotOf(s: Slots, id: CardId): SlotKey | null {
  return SLOT_ORDER.find((k) => cardAt(s, k) === id) ?? null;
}

/** First empty slot from `from` on (wrapping), or null when all are full. */
export function nextEmpty(s: Slots, from: SlotKey | null = null): SlotKey | null {
  const start = from ? SLOT_ORDER.findIndex((k) => sameSlot(k, from)) : 0;
  for (let n = 0; n < SLOT_ORDER.length; n++) {
    const k = SLOT_ORDER[(start + n) % SLOT_ORDER.length]!;
    if (cardAt(s, k) === null) return k;
  }
  return null;
}

/** Puts the card in the slot (replacing what was there); it leaves any other slot. */
export function place(s: Slots, k: SlotKey, id: CardId): Slots {
  const hero = s.hero.map((c) => (c === id ? null : c)) as Slots['hero'];
  const board = s.board.map((c) => (c === id ? null : c)) as Slots['board'];
  if (k.kind === 'hero') hero[k.i] = id;
  else board[k.i] = id;
  return { hero, board };
}

export function clearSlot(s: Slots, k: SlotKey): Slots {
  const hero = [...s.hero] as Slots['hero'];
  const board = [...s.board] as Slots['board'];
  if (k.kind === 'hero') hero[k.i] = null;
  else board[k.i] = null;
  return { hero, board };
}

export type Street = 'flop' | 'turn' | 'river';

export function streetOfBoardSlot(i: number): Street {
  return i < 3 ? 'flop' : i === 3 ? 'turn' : 'river';
}
