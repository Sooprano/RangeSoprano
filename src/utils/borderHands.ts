import type { ActionId, HandNotation, Range, RangeCellData } from '@/types/poker';
import { ALL_HANDS, combosOf } from './handUtils';
import { FOLD_ID } from './actionMeta';

/**
 * Where a hand sits in the painted range, for the Classic trainer's
 * "Enfocar bordes" option. People learn a range by its edges — where an action
 * starts or stops (`Q2o+` shove → Q2o and the J2o under it) — not by the
 * middle of a block, so those hands can be drawn more often.
 *
 * - border: pure hand with a 4-neighbor (same row/column in the 13×13 grid)
 *   whose dominant action differs. Fold (outside the range, or the cell's
 *   unassigned mass) counts as an action, so the edge of the range is a border.
 * - mixed: the cell plays more than one branch. It is itself a frontier, but
 *   ranks below a pure border.
 * - interior: everything else — the "fill" of a block.
 */
export type HandTier = 'border' | 'mixed' | 'interior';

export type BorderFocus = 'off' | 'soft' | 'strong' | 'only';

/** Multiplier on a hand's combos per tier. `only` drops the fill entirely. */
export const BORDER_FOCUS_MULTIPLIERS: Record<BorderFocus, Record<HandTier, number>> = {
  off: { border: 1, mixed: 1, interior: 1 },
  soft: { border: 2, mixed: 1.5, interior: 1 },
  strong: { border: 4, mixed: 2.5, interior: 1 },
  only: { border: 3, mixed: 2, interior: 0 },
};

const SIZE = 13;
/** A branch below this (in points) is rounding residue, not a real mix. */
const MIX_MIN_WEIGHT = 1;

function branchesOf(cell: RangeCellData | undefined): Map<ActionId, number> {
  const out = new Map<ActionId, number>();
  let sum = 0;
  for (const a of cell?.actions ?? []) {
    if (a.weight <= 0) continue;
    out.set(a.action, (out.get(a.action) ?? 0) + a.weight);
    sum += a.weight;
  }
  const rest = 100 - sum;
  if (rest > 0) out.set(FOLD_ID, (out.get(FOLD_ID) ?? 0) + rest);
  return out;
}

function dominantOf(branches: Map<ActionId, number>): ActionId {
  let best: ActionId = FOLD_ID;
  let bestW = -1;
  for (const [id, w] of branches) {
    if (w > bestW) {
      best = id;
      bestW = w;
    }
  }
  return best;
}

const tierCache = new WeakMap<Range, Record<HandNotation, HandTier>>();

/** Tier of all 169 hands. Cached per range object (store ranges are immutable). */
export function handTiers(range: Range): Record<HandNotation, HandTier> {
  const cached = tierCache.get(range);
  if (cached) return cached;

  const dominant: ActionId[] = [];
  const mixed: boolean[] = [];
  for (const hand of ALL_HANDS) {
    const branches = branchesOf(range.cells[hand]);
    dominant.push(dominantOf(branches));
    let real = 0;
    for (const w of branches.values()) if (w >= MIX_MIN_WEIGHT) real++;
    mixed.push(real > 1);
  }

  const tiers: Record<HandNotation, HandTier> = {};
  ALL_HANDS.forEach((hand, i) => {
    if (mixed[i]) {
      tiers[hand] = 'mixed';
      return;
    }
    const row = Math.floor(i / SIZE);
    const col = i % SIZE;
    const own = dominant[i];
    const neighbors = [
      row > 0 ? i - SIZE : -1,
      row < SIZE - 1 ? i + SIZE : -1,
      col > 0 ? i - 1 : -1,
      col < SIZE - 1 ? i + 1 : -1,
    ];
    const isBorder = neighbors.some((n) => n >= 0 && dominant[n] !== own);
    tiers[hand] = isBorder ? 'border' : 'interior';
  });

  tierCache.set(range, tiers);
  return tiers;
}

const weightCache = new WeakMap<Range, Partial<Record<BorderFocus, number[]>>>();

/**
 * Sampling weight of every hand (aligned with `ALL_HANDS`): combos × the
 * tier multiplier. When a focus leaves nothing to draw (`only` on a range with
 * no edges at all) it falls back to plain combos.
 */
export function sampleWeights(range: Range, focus: BorderFocus): number[] {
  const byFocus = weightCache.get(range) ?? {};
  const cached = byFocus[focus];
  if (cached) return cached;

  const tiers = handTiers(range);
  const mult = BORDER_FOCUS_MULTIPLIERS[focus];
  let weights = ALL_HANDS.map((h) => combosOf(h) * mult[tiers[h] ?? 'interior']);
  if (weights.every((w) => w === 0)) weights = ALL_HANDS.map((h) => combosOf(h));

  byFocus[focus] = weights;
  weightCache.set(range, byFocus);
  return weights;
}
