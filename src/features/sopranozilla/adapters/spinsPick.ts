// Picks the spins range for one player of a spins line (D128): the first of
// their wants the catalog has, at the stack closest to the effective stack
// (a tie takes the lower one, the user's call) and, within that stack, the
// size closest to the one played. All-in only matches all-in ranges.

import type { SpinsRange } from '../ranges/spinsCatalog';
import type { SpinsLine, SpinsRole, SpinsWant } from './spinsSpot';

export type SpinsPick = {
  range: SpinsRange;
  want: SpinsWant;
  /** Every range of the same spot (other stacks and sizes), to switch by hand. */
  sameSpot: SpinsRange[];
};

function fits(r: SpinsRange, line: SpinsLine, role: SpinsRole, want: SpinsWant): boolean {
  if (r.format !== line.format || r.position !== role.position || r.action !== want.action) {
    return false;
  }
  if (r.vs !== null && r.vs !== role.vs) return false;
  // All-in wants all-in ranges; a sized raise never takes an all-in range.
  return want.size === 'AI' ? r.size === 'AI' : r.size !== 'AI';
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

export function pickSpinsRange(
  catalog: readonly SpinsRange[],
  line: SpinsLine,
  role: SpinsRole,
): SpinsPick | null {
  for (const want of role.wants) {
    const sameSpot = catalog.filter((r) => fits(r, line, role, want));
    if (sameSpot.length === 0) continue;
    const stack = [...sameSpot].sort(byStack(line.effectiveBb))[0]!.stackBb;
    const atStack = sameSpot
      .filter((r) => r.stackBb === stack)
      .sort((a, b) => sizeDistance(a, want) - sizeDistance(b, want));
    return { range: atStack[0]!, want, sameSpot };
  }
  return null;
}
