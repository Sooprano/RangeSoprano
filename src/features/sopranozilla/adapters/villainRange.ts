// Picks the villain's preflop range from the library for a detected spot.
// The user picks which library is searched first (D97: GTO by default); the
// other one is the fallback. Among the ranges that fit the spot, the one with
// the hand's table format wins, then the one with the closest stack.

import type { ActionId, Range, TableFormat } from '@/types/poker';
import { deriveStack } from '@/utils/rangeStack';
import type { PreflopSpot } from './preflopSpot';

export type RangeSource = 'gto' | 'mine';

/** What the hand says about the table, to break ties between ranges. */
export type RangeContext = {
  format?: TableFormat | undefined;
  /** Effective stack in bb. */
  effectiveBb?: number | null | undefined;
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Action labels / ids that mean the villain's preflop action. */
const ACTION_NAMES: Record<PreflopSpot['villainAction'], readonly string[]> = {
  open: ['raise', 'open', 'or', 'rfi'],
  call: ['call', 'flat'],
  '3bet': ['3bet'],
  'call-3bet': ['call', 'flat'],
};

function situationMatches(range: Range, spot: PreflopSpot): boolean {
  if (range.position !== spot.villainPosition) return false;
  switch (spot.villainAction) {
    case 'open':
      return range.situation === 'RFI';
    case 'call':
      return (
        (range.situation === 'vs_RFI' || range.situation === 'DEFEND_BB') &&
        range.villainPosition === spot.heroPosition
      );
    case '3bet':
      return range.situation === 'vs_RFI' && range.villainPosition === spot.heroPosition;
    case 'call-3bet':
      return range.situation === 'vs_3BET' && range.villainPosition === spot.heroPosition;
  }
}

function actionIdsFor(range: Range, spot: PreflopSpot): ActionId[] {
  const names = ACTION_NAMES[spot.villainAction];
  const ids = range.actions
    .filter((a) => names.includes(norm(a.id)) || names.includes(norm(a.label)))
    .map((a) => a.id);
  const painted = new Set<ActionId>();
  for (const cell of Object.values(range.cells)) {
    for (const a of cell.actions) if (a.weight > 0) painted.add(a.action);
  }
  return ids.filter((id) => painted.has(id));
}

export type LibraryPick = { range: Range; actionIds: ActionId[]; source: RangeSource };

/** Stack of a range in bb (Editor field or name, "BBvsBU 12bb"); null if unknown. */
function stackOf(range: Range): number | null {
  const n = Number.parseFloat(deriveStack(range).replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Lower is better: [format mismatch, stack distance]. */
function rank(range: Range, ctx: RangeContext): [number, number] {
  const formatMiss = ctx.format && range.tableFormat !== ctx.format ? 1 : 0;
  const stack = stackOf(range);
  const dist =
    ctx.effectiveBb != null && stack !== null ? Math.abs(stack - ctx.effectiveBb) : Infinity;
  return [formatMiss, dist];
}

function bestIn(
  list: readonly Range[],
  spot: PreflopSpot,
  ctx: RangeContext,
  source: RangeSource,
): LibraryPick | null {
  let best: { pick: LibraryPick; key: [number, number] } | null = null;
  for (const range of list) {
    if (!situationMatches(range, spot)) continue;
    const actionIds = actionIdsFor(range, spot);
    if (actionIds.length === 0) continue;
    const key = rank(range, ctx);
    // Strictly better only: on a tie the first range in the list stays.
    if (!best || key[0] < best.key[0] || (key[0] === best.key[0] && key[1] < best.key[1])) {
      best = { pick: { range, actionIds, source }, key };
    }
  }
  return best?.pick ?? null;
}

export function findVillainRange(
  spot: PreflopSpot,
  mine: readonly Range[],
  gto: readonly Range[],
  prefer: RangeSource = 'gto',
  ctx: RangeContext = {},
): LibraryPick | null {
  const lists = { mine, gto };
  const order: RangeSource[] = prefer === 'gto' ? ['gto', 'mine'] : ['mine', 'gto'];
  for (const source of order) {
    const pick = bestIn(lists[source], spot, ctx, source);
    if (pick) return pick;
  }
  return null;
}
