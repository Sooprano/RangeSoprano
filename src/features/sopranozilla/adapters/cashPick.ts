// Picks the cash GTO range for one decision (D138): same seat, rival and
// action; an all-in only takes an all-in range (and a sized bet never takes
// one); then the size closest to the one played (a tie takes the lower, like
// spins). Sizes not in the name match any size.

import type { CashRange } from '../ranges/cashCatalog';
import type { CashDecision } from './cashSpot';

export type CashWant = Omit<CashDecision, 'name'>;

export type CashPick = {
  range: CashRange;
  /** Every range of the same spot (other sizes), to switch by hand. */
  sameSpot: CashRange[];
};

function fits(r: CashRange, want: CashWant): boolean {
  if (r.position !== want.position || r.action !== want.action) return false;
  if (r.vs !== null && r.vs !== want.vs) return false;
  if (r.size === null) return true;
  return want.size === 'AI' ? r.size === 'AI' : r.size !== 'AI';
}

function distance(r: CashRange, want: CashWant): number {
  if (typeof r.size !== 'number' || typeof want.size !== 'number') return 0;
  // Rounded: 2.4 is exactly as far from 2.3 as from 2.5 (a tie → the lower).
  return Math.round(Math.abs(r.size - want.size) * 1000) / 1000;
}

export function pickCashRange(catalog: readonly CashRange[], want: CashWant): CashPick | null {
  const sameSpot = catalog.filter((r) => fits(r, want));
  if (sameSpot.length === 0) return null;
  const best = [...sameSpot].sort(
    (a, b) =>
      distance(a, want) - distance(b, want) ||
      (typeof a.size === 'number' ? a.size : 0) - (typeof b.size === 'number' ? b.size : 0),
  )[0]!;
  return { range: best, sameSpot };
}
