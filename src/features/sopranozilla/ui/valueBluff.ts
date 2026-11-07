// «Valor / Farol» (D140): the villain's range split by what each combo does
// against Hero's hand. On the river it is exact — value = combos that beat
// Hero, bluff = combos Hero beats, tie = split pot. On the flop and the turn
// nothing is decided yet, so the same three groups come from Hero's equity
// vs each combo: «te va ganando» (< 35 %), «disputada», «vas ganando»
// (> 65 %). The per-combo equity is the table the worker already fills.

import type { HandNotation } from '@/types/poker';
import { ALL_HANDS } from '@/utils/handUtils';
import type { StreetView } from '../engine/chain';
import { combosOfClass, type ComboWeights } from '../engine/combos';
import type { EqComboTable, Street } from '../engine/equity';

export type VbKind = 'value' | 'tie' | 'bluff';

/** Soft enough to look at for a while on a dark background. */
export const VB_COLORS = {
  value: 'rgb(248 113 113 / 0.8)', // red-400
  tie: 'rgb(148 163 184 / 0.55)', // slate-400
  bluff: 'rgb(52 211 153 / 0.75)', // emerald-400
} as const;

/** Hero equity below / above these on the flop and turn: villain / Hero ahead. */
export const VB_BEHIND = 0.35;
export const VB_AHEAD = 0.65;

/** What a combo is for Hero; null while its equity is not computed. */
export function vbKindOf(heroEq: number, street: Street): VbKind | null {
  if (Number.isNaN(heroEq)) return null;
  if (street === 'river') {
    if (heroEq < 0.5 - 1e-9) return 'value';
    if (heroEq > 0.5 + 1e-9) return 'bluff';
    return 'tie';
  }
  if (heroEq < VB_BEHIND) return 'value';
  if (heroEq > VB_AHEAD) return 'bluff';
  return 'tie';
}

export type VbSummary = {
  /** Weighted combos per group. */
  value: number;
  tie: number;
  bluff: number;
  /** Weighted combos whose equity is still being computed. */
  pending: number;
};

/** The groups of a weighted range (only combos dealt: not blocked). */
export function valueBluffSummary(
  view: StreetView,
  weights: ComboWeights,
  eq: EqComboTable | null,
  street: Street,
): VbSummary {
  const out: VbSummary = { value: 0, tie: 0, bluff: 0, pending: 0 };
  for (let id = 0; id < weights.length; id++) {
    const w = weights[id] ?? 0;
    if (w <= 0 || view.liveMask[id] !== 1) continue;
    const kind = eq ? vbKindOf(eq[id] ?? Number.NaN, street) : null;
    if (kind) out[kind] += w;
    else out.pending += w;
  }
  return out;
}

export type VbCell = { value: number; tie: number; bluff: number };

/** Per hand class: each group's weight / live combos (how much of the cell to fill). */
export function valueBluffCells(
  view: StreetView,
  weights: ComboWeights,
  eq: EqComboTable | null,
  street: Street,
): Map<HandNotation, VbCell> {
  const out = new Map<HandNotation, VbCell>();
  for (const hand of ALL_HANDS) {
    const cell: VbCell = { value: 0, tie: 0, bluff: 0 };
    let live = 0;
    for (const id of combosOfClass(hand)) {
      if (view.liveMask[id] !== 1) continue;
      live++;
      const w = weights[id] ?? 0;
      if (w <= 0) continue;
      const kind = eq ? vbKindOf(eq[id] ?? Number.NaN, street) : null;
      if (kind) cell[kind] += w;
    }
    if (live > 0) {
      cell.value /= live;
      cell.tie /= live;
      cell.bluff /= live;
    }
    out.set(hand, cell);
  }
  return out;
}

/**
 * Bluff combos the range needs so that calling breaks even, given the value
 * and tie combos it already has and the equity the call needs (pot odds).
 * Hero's equity vs the range = (bluff + tie / 2) / (value + tie + bluff), so
 * bluff ≥ (need · (value + tie) − tie / 2) / (1 − need). Never negative.
 */
export function bluffsNeeded(s: Pick<VbSummary, 'value' | 'tie'>, need: number): number {
  if (!(need > 0) || need >= 1) return Number.NaN;
  return Math.max(0, (need * (s.value + s.tie) - s.tie / 2) / (1 - need));
}
