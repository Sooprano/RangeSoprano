// Range weights → text other range apps read. Pure TS.
//
// - 'flopzilla': `[NN]…[/NN]` weight tags (integer %), the format of the
//   main app's "Copiar para Flopzilla".
// - 'gtowizard': one combo per token, weight as a fraction ("AhKd: 0.5").
// - 'notation': the app's own `[NN%]…[/NN%]` notation.
//
// A class whose live combos all share one weight is written as the class
// ("AQs", "88+"); a class with different weights per suit is written combo by
// combo, so exporting a range filtered by suit does not lose which suits stay.
// Blocked combos (Hero's cards, the board) do not count: they cannot be dealt.

import { serializeWeightedHands } from '@/utils/handRangeSerializer';
import type { WeightedHand } from '@/utils/handRangeParser';
import { ALL_HANDS } from '@/utils/handUtils';
import { combosOfClass, formatCombo, type ComboId, type ComboWeights } from './combos';

export type RangeExportFormat = 'flopzilla' | 'gtowizard' | 'notation';

const EPS = 1e-6;

function pctOf(w: number): number {
  return Math.round(w * 10000) / 100;
}

function fraction(w: number): string {
  return (Math.round(w * 1000) / 1000).toString();
}

function wrapCombo(label: string, pct: number, format: 'flopzilla' | 'notation'): string {
  if (format === 'flopzilla') {
    const w = Math.round(pct);
    return w >= 100 ? label : `[${w}]${label}[/${w}]`;
  }
  return pct >= 100 ? label : `[${pct}%]${label}[/${pct}%]`;
}

/**
 * `live`: 1 = the combo can be dealt. Without it every combo counts (a range
 * with no board, e.g. the saved preflop range).
 */
export function exportRange(
  weights: ComboWeights,
  format: RangeExportFormat,
  live?: Uint8Array,
): string {
  const isLive = (id: ComboId) => !live || live[id] === 1;

  if (format === 'gtowizard') {
    const out: string[] = [];
    for (const hand of ALL_HANDS) {
      for (const id of combosOfClass(hand)) {
        const w = weights[id] ?? 0;
        if (isLive(id) && w > EPS) out.push(`${formatCombo(id)}: ${fraction(w)}`);
      }
    }
    return out.join(',');
  }

  const classes: WeightedHand[] = [];
  const singles: string[] = [];
  for (const hand of ALL_HANDS) {
    const ids = combosOfClass(hand).filter(isLive);
    const ws = ids.map((id) => weights[id] ?? 0);
    if (ws.every((w) => w <= EPS)) continue;
    const first = ws[0]!;
    if (ws.every((w) => Math.abs(w - first) <= EPS)) {
      const pct = pctOf(first);
      // Flopzilla tags are integers: a class that rounds to 0 is dropped.
      if (format === 'flopzilla' && Math.round(pct) === 0) continue;
      classes.push({ hand, weight: Math.min(100, pct) });
      continue;
    }
    ids.forEach((id, i) => {
      const pct = pctOf(ws[i]!);
      if (pct <= 0 || (format === 'flopzilla' && Math.round(pct) === 0)) return;
      singles.push(wrapCombo(formatCombo(id), Math.min(100, pct), format));
    });
  }

  const head = serializeWeightedHands(classes, {
    weightTag: format === 'flopzilla' ? 'flopzilla' : 'percent',
  });
  return [head, ...singles].filter((s) => s.length > 0).join(',');
}

/** Text to save a range with (exact per combo, read back by `parseRangeText`). */
export function rangeToSavedText(weights: ComboWeights): string {
  return exportRange(weights, 'notation');
}
