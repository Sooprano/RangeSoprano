// The last hand loaded in Sopranozilla, saved in localStorage (D3) so a
// reload, or the "Abrir en Sopranozilla" button in /analisis, finds it.
// Only the inputs are saved (cards, pots, range text, recorded action): the
// edits of each row are not, every load starts again from the presets.

import { z } from 'zod';
import type { RangeSource } from '../adapters/villainRange';
import { formatCards, parseCards, type CardId } from '../engine/cards';
import type { AnalyzerHandInput } from '../engine/chain';
import type { ComboWeights } from '../engine/combos';
import type { RecordedStreets } from '../engine/recorded';
import { parseRangeText } from '../engine/rangeText';
import type { HandMeta } from './analyzerStore';

export const LAST_HAND_KEY = 'range-soprano/sopranozilla-last-hand';

const zResponse = z.enum(['call', 'raise', 'fold']).nullable();
const zPct = z.number().min(0).max(10000);

const zRecorded = z.union([
  z.object({ mode: z.literal('hero'), kind: z.literal('check') }).strict(),
  z
    .object({ mode: z.literal('hero'), kind: z.literal('bet'), sizePct: zPct, response: zResponse })
    .strict(),
  z
    .object({
      mode: z.literal('villain'),
      betPct: zPct,
      response: zResponse,
      raiseMultiple: z.number().min(1).max(100).optional(),
    })
    .strict(),
]);

const zPosition = z.enum(['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB']);
const zMoney = z.number().min(0).max(1e9);

const zTable = z
  .object({
    format: z.string().max(40),
    blinds: z.string().max(40).nullable(),
    currency: z.string().max(4),
    seats: z
      .array(
        z
          .object({
            name: z.string().max(60),
            position: zPosition.nullable(),
            stack: zMoney,
            stackBb: zMoney.nullable(),
            role: z.enum(['hero', 'villain']).nullable(),
            inFlop: z.boolean(),
          })
          .strict(),
      )
      .max(10),
    effectiveBb: zMoney.nullable(),
    effective: zMoney.nullable(),
  })
  .strict();

const zSpot = z
  .object({
    heroPosition: zPosition,
    villainPosition: zPosition,
    villainAction: z.enum(['open', 'call', '3bet', 'call-3bet']),
    description: z.string().max(200),
  })
  .strict();

const zStreetMap = <T extends z.ZodTypeAny>(t: T) =>
  z.object({ flop: t.optional(), turn: t.optional(), river: t.optional() }).strict();

const zOpponent = z
  .object({
    name: z.string().max(60),
    position: zPosition.nullable(),
    recorded: zStreetMap(zRecorded),
    spot: zSpot.nullable(),
    spotNote: z.string().max(300).nullable(),
  })
  .strict();

const zSavedHand = z
  .object({
    version: z.literal(1),
    hero: z.string().max(10),
    board: z.string().max(20),
    pots: zStreetMap(z.number().positive().max(1e7)),
    heroPosition: z.string().max(8).optional(),
    villainPosition: z.string().max(8).optional(),
    // Edited ranges are saved combo by combo when suits differ: room for it.
    range: z.string().max(60000),
    recorded: zStreetMap(zRecorded),
    meta: z
      .object({
        title: z.string().max(200),
        spot: z.string().max(200).nullable(),
        rangeLabel: z.string().max(200).nullable(),
        rangeMissing: z.string().max(300).nullable(),
        warnings: z.array(z.string().max(300)).max(20),
        // Optional: hands saved before the table info existed still load.
        table: zTable.optional(),
        handLabel: z.string().max(80).optional(),
        villainName: z.string().max(60).optional(),
        opponents: z.array(zOpponent).max(9).optional(),
      })
      .strict()
      .nullable(),
  })
  .strict();

export type SavedHand = {
  version: 1;
  hero: string;
  board: string;
  pots: AnalyzerHandInput['pots'] & object;
  heroPosition?: string | undefined;
  villainPosition?: string | undefined;
  /** Villain's preflop range as text (`[NN]…[/NN]` text format). */
  range: string;
  recorded: RecordedStreets;
  meta: HandMeta | null;
};

export function toSavedHand(
  hand: AnalyzerHandInput,
  range: string,
  recorded: RecordedStreets,
  meta: HandMeta | null,
): SavedHand {
  return {
    version: 1,
    hero: formatCards(hand.hero),
    board: formatCards(hand.board),
    pots: { ...hand.pots },
    ...(hand.heroPosition && { heroPosition: hand.heroPosition }),
    ...(hand.villainPosition && { villainPosition: hand.villainPosition }),
    range,
    recorded,
    meta,
  };
}

/** Saved hand → what `loadHand` takes. Null if the cards do not parse. */
export function fromSavedHand(saved: SavedHand): {
  hand: AnalyzerHandInput;
  villain: ComboWeights;
  recorded: RecordedStreets;
  meta: HandMeta | null;
} | null {
  const hero = parseCards(saved.hero);
  const board = parseCards(saved.board);
  if (!hero || hero.length !== 2 || !board || board.length < 3 || board.length > 5) return null;
  return {
    hand: {
      hero: [hero[0]!, hero[1]!] as [CardId, CardId],
      board,
      pots: { ...saved.pots },
      heroPosition: saved.heroPosition,
      villainPosition: saved.villainPosition,
    },
    villain: parseRangeText(saved.range).weights,
    recorded: saved.recorded,
    meta: saved.meta,
  };
}

export function parseSavedHand(data: unknown): SavedHand | null {
  const r = zSavedHand.safeParse(data);
  return r.success ? (r.data as SavedHand) : null;
}

export function readLastHand(): SavedHand | null {
  try {
    const raw = localStorage.getItem(LAST_HAND_KEY);
    return raw ? parseSavedHand(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function writeLastHand(saved: SavedHand): void {
  try {
    localStorage.setItem(LAST_HAND_KEY, JSON.stringify(saved));
  } catch {
    // Storage full or blocked: the hand still works, it just is not remembered.
  }
}

// Which library "Abrir / Pegar mano" searches first for the villain's range
// (D97). GTO by default; the other library is always the fallback.

export const RANGE_SOURCE_KEY = 'range-soprano/sopranozilla-range-source';

export function readRangeSource(): RangeSource {
  try {
    return localStorage.getItem(RANGE_SOURCE_KEY) === 'mine' ? 'mine' : 'gto';
  } catch {
    return 'gto';
  }
}

export function writeRangeSource(source: RangeSource): void {
  try {
    localStorage.setItem(RANGE_SOURCE_KEY, source);
  } catch {
    // Blocked storage: the choice lasts until the page reloads.
  }
}
