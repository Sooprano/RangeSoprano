// Picks the spins range for one player of a spins line (D128): the first of
// their wants the catalog has. Regular: at the stack closest to the effective
// stack (a tie takes the lower one, the user's call) and, within that stack,
// the size closest to the one played. FISH (D137): the range whose stack band
// holds the effective stack and whose size band holds the size — below the
// lowest band there is no range. All-in only matches all-in ranges.

import { inBand, type SpinsRange, type SpinsRival } from '../ranges/spinsCatalog';
import type { SpinsLine, SpinsRole, SpinsWant } from './spinsSpot';

export type SpinsPick = {
  range: SpinsRange;
  want: SpinsWant;
  /** Every range of the same spot (other stacks and sizes), to switch by hand. */
  sameSpot: SpinsRange[];
};

function fits(
  r: SpinsRange,
  line: SpinsLine,
  role: SpinsRole,
  want: SpinsWant,
  rival: SpinsRival,
): boolean {
  if (r.rival !== rival) return false;
  if (r.format !== line.format || r.position !== role.position || r.action !== want.action) {
    return false;
  }
  if (r.vs !== null && r.vs !== role.vs) return false;
  // All-in wants all-in ranges; a sized raise never takes an all-in range.
  if (want.size === 'AI' ? r.size !== 'AI' : r.size === 'AI') return false;
  if (r.sizeBand) {
    if (typeof want.size !== 'number') return false;
    return want.size > r.sizeBand.min + 1e-9 && want.size <= r.sizeBand.max + 1e-9;
  }
  return true;
}

/** Lower is better: stack distance, then the lower stack on a tie. */
function byStack(eff: number) {
  return (a: SpinsRange, b: SpinsRange) =>
    Math.abs(a.stackBb - eff) - Math.abs(b.stackBb - eff) || a.stackBb - b.stackBb;
}

function sizeDistance(r: SpinsRange, want: SpinsWant): number {
  if (typeof want.size !== 'number' || typeof r.size !== 'number') return 0;
  return Math.abs(r.size - want.size);
}

/**
 * The ranges of the player's spot (first want the catalog has), whatever
 * the stack: the bar shows them to switch by hand, even when no FISH band
 * holds the effective stack.
 */
export function spinsSpotRanges(
  catalog: readonly SpinsRange[],
  line: SpinsLine,
  role: SpinsRole,
  rival: SpinsRival = 'regular',
): { want: SpinsWant; sameSpot: SpinsRange[] } | null {
  for (const want of role.wants) {
    const sameSpot = catalog.filter((r) => fits(r, line, role, want, rival));
    if (sameSpot.length > 0) return { want, sameSpot };
  }
  return null;
}

export function pickSpinsRange(
  catalog: readonly SpinsRange[],
  line: SpinsLine,
  role: SpinsRole,
  rival: SpinsRival = 'regular',
): SpinsPick | null {
  for (const want of role.wants) {
    const sameSpot = catalog.filter((r) => fits(r, line, role, want, rival));
    if (sameSpot.length === 0) continue;
    if (rival === 'fish') {
      const hit = sameSpot.find((r) => r.band && inBand(r.band, line.effectiveBb));
      // Too short for this action's bands: maybe the next want has one.
      if (hit) return { range: hit, want, sameSpot };
      continue;
    }
    const stack = [...sameSpot].sort(byStack(line.effectiveBb))[0]!.stackBb;
    const atStack = sameSpot
      .filter((r) => r.stackBb === stack)
      .sort((a, b) => sizeDistance(a, want) - sizeDistance(b, want));
    return { range: atStack[0]!, want, sameSpot };
  }
  return null;
}
