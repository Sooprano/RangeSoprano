// Each street's filtering, saved apart from the last hand (D148), so a reload
// (Ctrl+F5) or coming back to Sopranozilla finds the rows as they were left.
// It belongs to one hand: the key is its cards, number and villain, and a
// different hand (or one opened again from /analisis) starts from scratch.

import { z } from 'zod';
import { formatCards } from '../engine/cards';
import type { AnalyzerHandInput } from '../engine/chain';
import type { Street } from '../engine/equity';
import type { AnalyzerStreetState, HandMeta } from './analyzerStore';

export const SAVED_STREETS_KEY = 'range-soprano/sopranozilla-streets';

const STREETS: readonly Street[] = ['flop', 'turn', 'river'];
const zId = z.string().max(80);
const zRowState = z
  .object({ s: z.enum(['follow', 'exclude']).nullable(), w: z.number().min(0).max(100) })
  .strict();
const zComboKey = z.string().regex(/^\d{1,4}$/);
const zActionRowState = z
  .object({
    cats: z.record(z.string().max(40), zRowState),
    custom: z.record(zId, zRowState),
    classOverrides: z.record(z.string().max(4), z.number().min(0).max(100)),
    comboOverrides: z.record(zComboKey, z.number().min(0).max(100)),
    edited: z.boolean(),
  })
  .strict();
const zActionRow = z
  .object({
    id: zId,
    label: z.string().max(80),
    kind: z.enum(['check', 'bet', 'fold', 'call', 'raise', 'reraise']),
    size: z.number().positive().max(100000).optional(),
    mode: z.enum(['hero', 'villain']).optional(),
    basedOn: zId.optional(),
  })
  .strict();
const zPresetRef = z.union([
  z.object({ kind: z.literal('check') }).strict(),
  z.object({ kind: z.literal('preset'), label: z.string().max(200) }).strict(),
  z.object({ kind: z.literal('none'), action: z.enum(['call', 'raise']).nullable() }).strict(),
]);
const zMemory = z.object({ selectedRow: zId, playedRow: zId }).strict();
const zStreet = z
  .object({
    actionRows: z.array(zActionRow).max(60),
    rows: z.record(zId, zActionRowState),
    mode: z.enum(['hero', 'villain']),
    villainBetPct: z.number().positive().max(100000),
    selectedRow: zId,
    playedRow: zId,
    startOverride: z.record(zComboKey, z.number().min(0).max(1)).nullable().optional(),
    invertedRows: z.array(zId).max(60).optional(),
    presets: z.record(zId, zActionRowState),
    presetRefs: z.record(zId, zPresetRef),
    recordedRow: zId.nullable(),
    recordedResponse: z.enum(['call', 'raise', 'fold']).nullable(),
    modeMemory: z.object({ hero: zMemory, villain: zMemory }).strict(),
    effStackBb: z.number().positive().max(1e7).nullable(),
  })
  .strict();
const zSaved = z
  .object({
    version: z.literal(1),
    key: z.string().max(400),
    activeStreet: z.enum(['flop', 'turn', 'river']),
    streets: z.object({ flop: zStreet, turn: zStreet, river: zStreet }).strict(),
  })
  .strict();

export type SavedStreets = {
  key: string;
  activeStreet: Street;
  streets: Record<Street, AnalyzerStreetState>;
};

/** Which hand the filtering belongs to: cards, hand number and villain. */
export function handKey(hand: AnalyzerHandInput, meta: HandMeta | null): string {
  return [
    formatCards(hand.hero),
    formatCards(hand.board),
    meta?.handLabel ?? '',
    meta?.villainName ?? '',
  ].join('|');
}

/** A street whose rows do not hold its selected / played row is not used. */
function consistent(st: AnalyzerStreetState): boolean {
  const ids = new Set(st.actionRows.map((r) => r.id));
  return (
    ids.has(st.playedRow) &&
    ids.has(st.selectedRow) &&
    st.rows[st.playedRow] !== undefined &&
    st.actionRows.every((r) => r.kind === 'fold' || st.rows[r.id] !== undefined)
  );
}

export function parseSavedStreets(data: unknown): SavedStreets | null {
  const r = zSaved.safeParse(data);
  if (!r.success) return null;
  const saved = r.data as unknown as SavedStreets;
  return STREETS.every((s) => consistent(saved.streets[s])) ? saved : null;
}

/** The saved filtering of the hand `key`, or null (none, another hand, corrupt). */
export function readSavedStreets(key: string): SavedStreets | null {
  try {
    const raw = localStorage.getItem(SAVED_STREETS_KEY);
    const saved = raw ? parseSavedStreets(JSON.parse(raw)) : null;
    return saved && saved.key === key ? saved : null;
  } catch {
    return null;
  }
}

export function writeSavedStreets(saved: SavedStreets): void {
  try {
    localStorage.setItem(SAVED_STREETS_KEY, JSON.stringify({ version: 1, ...saved }));
  } catch {
    // Storage full or blocked: the filtering lasts until the page reloads.
  }
}
