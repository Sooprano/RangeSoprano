// Presets (spec §12): the initial state of an EV row's continuation range,
// chosen by street + the villain's response + Hero's bet size (% of the pot).
// A preset is not a separate system: it becomes an ordinary ActionRowState.

import type { CategoryId } from './categories';
import type { Street } from './equity';
import { emptyActionRow, type ActionRowState } from './weights';

/** The villain's response to Hero's bet. "check" = Hero checked (full range). */
export type PresetAction = 'call' | 'raise';

/** Per category: a follow weight 0..100, or "x" = exclude (✗). Missing = neutral. */
export type PresetRowValue = number | 'x';

export type Preset = {
  id: string;
  label: string;
  street: Street;
  villainAction: PresetAction;
  /** Inclusive bounds of Hero's bet, % of the pot. No max = open-ended ("100%+"). */
  sizeMin: number;
  sizeMax?: number | undefined;
  rows: Partial<Record<CategoryId, PresetRowValue>>;
};

export type PresetFile = { version: 1; presets: Preset[] };

/** First preset (file order) whose sizing range contains the bet. */
export function matchPreset(
  presets: readonly Preset[],
  street: Street,
  action: PresetAction,
  sizePct: number,
): Preset | null {
  for (const p of presets) {
    if (p.street !== street || p.villainAction !== action) continue;
    if (sizePct < p.sizeMin) continue;
    if (p.sizeMax !== undefined && sizePct > p.sizeMax) continue;
    return p;
  }
  return null;
}

export function presetToActionRow(preset: Preset): ActionRowState {
  const row = emptyActionRow();
  for (const [cat, v] of Object.entries(preset.rows) as [CategoryId, PresetRowValue][]) {
    row.cats[cat] = v === 'x' ? { s: 'exclude', w: 100 } : { s: 'follow', w: v };
  }
  return row;
}
