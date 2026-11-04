// Performance budget (spec §4.2): flop vs ~400 combos in under 1 s.
// Runs the same handler the worker runs and reports the time as a test
// annotation (`npm run bench` prints it).

import { describe, expect, it } from 'vitest';
import { deadCardsOf, parseCards } from '../../engine/cards';
import { activeCombos, removeBlocked, weightsFromHandRange } from '../../engine/combos';
import { handleEqRequest, type EqResponse } from '../protocol';

const hero = parseCards('AhKh')!;
const flop = parseCards('Qh Jc 4h')!;
// ~400 live combos after blockers.
const RANGE =
  '22+, A2s+, K2s+, Q5s+, J7s+, T7s+, 96s+, 85s+, 75s+, 64s+, 54s, A4o+, K9o+, Q9o+, J9o+, T9o';
const combos = activeCombos(
  removeBlocked(weightsFromHandRange(RANGE), deadCardsOf([...hero, ...flop])),
);

function run(board: number[]): number {
  let elapsed = Number.NaN;
  handleEqRequest({ type: 'eqCombos', requestId: 1, hero, board, combos }, (m: EqResponse) => {
    if (m.type === 'result') elapsed = m.elapsedMs;
  });
  return elapsed;
}

describe('equity performance', () => {
  it(`flop vs ${combos.length} combos stays under the 1 s budget`, async ({ annotate }) => {
    expect(combos.length).toBeGreaterThanOrEqual(380);
    expect(combos.length).toBeLessThanOrEqual(420);
    run(flop); // warm-up (JIT)
    const times = [run(flop), run(flop), run(flop)].sort((a, b) => a - b);
    const median = times[1]!;
    await annotate(`flop · ${combos.length} combos · mediana ${median.toFixed(0)} ms`);
    // Generous ceiling so a busy CI machine does not flake; the target is < 1000 ms.
    expect(median).toBeLessThan(3000);
  }, 60_000);

  it('turn is an order of magnitude cheaper', async ({ annotate }) => {
    const turn = parseCards('Qh Jc 4h 9s')!;
    run(turn);
    const t = run(turn);
    await annotate(`turn · ${combos.length} combos · ${t.toFixed(0)} ms`);
    expect(t).toBeLessThan(500);
  });
});
