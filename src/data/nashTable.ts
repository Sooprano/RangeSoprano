import { ALL_HANDS, gridCoordsToHand } from '@/utils/handUtils';
import type { HandNotation } from '@/types/poker';

/**
 * Nash equilibrium HU push/fold thresholds in big blinds.
 *
 * - PUSH: maximum effective stack (in BB) at which jamming from BTN is correct.
 * - CALL: maximum effective stack at which calling a BTN jam is correct from BB.
 *
 * Convention:
 *   - Threshold > 0 means "push/call when stack <= threshold".
 *   - Threshold === 0 means "never push/call at any stack in [1, NASH_MAX_BB]".
 *   - 20 acts as a saturation cap (always push/call within the studied range).
 *
 * Tables are encoded as 13×13 arrays read row-major, mirroring the source
 * image: rows go A K Q J T 9 8 7 6 5 4 3 2, columns the same. The cell at
 * (row r, col c) is the hand returned by `gridCoordsToHand(r, c)` —
 * suited above diagonal, pair on diagonal, offsuit below.
 *
 * Footnotes from the source image (exclusion zones for the *-marked cells):
 *   *63s push only outside 2.4-5.0 BB band  (chart shows 7.1)
 *   *53s push only outside 2.5-3.7 BB band  (chart shows 12.9)
 *   *43s push only outside 2.3-4.8 BB band  (chart shows 10.0)
 * The exclusion bands are not modeled here — we use the upper bound only,
 * which matches the chart cells. A future revision can teach the helpers
 * about the gap if desired.
 */

export const NASH_MAX_BB = 20;
export const NASH_MIN_BB = 1;

// Each row has 13 values, columns ordered A K Q J T 9 8 7 6 5 4 3 2.
// Row 9 col 2 (92s) is not legible in the source image; placeholder marked.
const PUSH_GRID: readonly (readonly number[])[] = [
  // A
  [20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20],
  // K
  [20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 19.9, 19.3],
  // Q
  [20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 16.3, 13.5, 12.7],
  // J
  [20, 20, 20, 20, 20, 20, 20, 20, 18.6, 14.7, 13.5, 10.6, 8.5],
  // T
  [20, 20, 20, 20, 20, 20, 20, 20, 20, 11.9, 10.5, 7.7, 6.5],
  // 9       (92s = approx, not legible in source image)
  [20, 20, 20, 20, 20, 20, 20, 20, 14.4, 6.9, 4.9, 3.7, 3.0],
  // 8
  [20, 18.0, 13.0, 13.3, 17.5, 20, 20, 20, 20, 18.8, 10.1, 2.7, 2.5],
  // 7
  [20, 16.1, 10.3, 8.5, 9.0, 10.8, 14.7, 20, 20, 20, 13.9, 2.5, 2.1],
  // 6                                               (63s* gap 2.4-5.0)
  [20, 15.1, 9.6, 6.5, 5.7, 5.2, 7.0, 10.7, 20, 20, 16.3, 7.1, 2.0],
  // 5                                               (53s* gap 2.5-3.7)
  [20, 14.2, 8.9, 6.0, 4.1, 3.5, 3.0, 2.6, 2.4, 20, 20, 12.9, 2.0],
  // 4                                               (43s* gap 2.3-4.8)
  [20, 13.1, 7.9, 5.4, 3.8, 2.7, 2.3, 2.1, 2.0, 2.1, 20, 10.0, 1.8],
  // 3
  [20, 12.2, 7.5, 5.0, 3.4, 2.5, 1.9, 1.8, 1.7, 1.8, 1.6, 20, 1.7],
  // 2
  [20, 11.6, 7.0, 4.6, 2.9, 2.2, 1.8, 1.6, 1.5, 1.5, 1.4, 1.4, 20],
];

const CALL_GRID: readonly (readonly number[])[] = [
  // A
  [20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20],
  // K
  [20, 20, 20, 20, 20, 20, 17.6, 15.2, 14.3, 13.2, 12.1, 11.4, 10.7],
  // Q
  [20, 20, 20, 20, 20, 16.1, 13.0, 10.5, 9.9, 8.9, 8.4, 7.8, 7.2],
  // J
  [20, 20, 19.5, 20, 18.0, 13.4, 10.6, 8.8, 7.0, 6.9, 6.1, 5.8, 5.6],
  // T
  [20, 20, 15.3, 12.7, 20, 11.5, 9.3, 7.4, 6.3, 5.2, 5.2, 4.8, 4.5],
  // 9
  [20, 17.1, 11.7, 9.5, 8.4, 20, 8.2, 7.0, 5.8, 5.0, 4.3, 4.1, 3.9],
  // 8
  [20, 13.8, 9.7, 7.6, 6.6, 6.0, 20, 6.5, 5.6, 4.8, 4.1, 3.6, 3.5],
  // 7
  [20, 12.4, 8.0, 6.4, 5.5, 5.0, 4.7, 20, 5.4, 4.8, 4.1, 3.6, 3.3],
  // 6
  [20, 11.0, 7.3, 5.4, 4.6, 4.2, 4.1, 4.0, 20, 4.9, 4.3, 3.8, 3.3],
  // 5
  [20, 10.2, 6.8, 5.1, 4.0, 3.7, 3.6, 3.6, 3.7, 20, 4.6, 4.0, 3.6],
  // 4
  [18.3, 9.1, 6.2, 4.7, 3.8, 3.3, 3.2, 3.2, 3.3, 3.5, 20, 3.8, 3.4],
  // 3
  [16.6, 8.7, 5.9, 4.5, 3.6, 3.1, 2.9, 2.9, 2.9, 3.1, 3.0, 20, 3.3],
  // 2
  [15.8, 8.1, 5.6, 4.2, 3.5, 3.0, 2.8, 2.6, 2.7, 2.8, 2.7, 2.6, 15.0],
];

function gridToRecord(
  grid: readonly (readonly number[])[],
): Record<HandNotation, number> {
  const out: Record<HandNotation, number> = {};
  for (let r = 0; r < grid.length; r++) {
    const row = grid[r]!;
    for (let c = 0; c < row.length; c++) {
      const hand = gridCoordsToHand(r, c);
      out[hand] = row[c]!;
    }
  }
  return out;
}

const PUSH_TABLE = gridToRecord(PUSH_GRID);
const CALL_TABLE = gridToRecord(CALL_GRID);

// Defensive: ensure every one of the 169 hands has an entry, falling back
// to 0 (never push/call) if a row was malformed.
function buildFullTable(
  partial: Record<HandNotation, number>,
): Record<HandNotation, number> {
  const out: Record<HandNotation, number> = {};
  for (const hand of ALL_HANDS) {
    out[hand] = partial[hand] ?? 0;
  }
  return out;
}

export const NASH_HU = {
  push: buildFullTable(PUSH_TABLE),
  call: buildFullTable(CALL_TABLE),
} as const;

export function nashPushBB(hand: HandNotation): number {
  return NASH_HU.push[hand] ?? 0;
}

export function nashCallBB(hand: HandNotation): number {
  return NASH_HU.call[hand] ?? 0;
}
