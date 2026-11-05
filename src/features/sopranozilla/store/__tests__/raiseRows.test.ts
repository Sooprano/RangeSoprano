import { beforeEach, describe, expect, it } from 'vitest';
import { parseCards, type CardId } from '../../engine/cards';
import { weightsFromHandRange } from '../../engine/combos';
import { gridCells } from '../../ui/viewModel';
import {
  CALL_ROW_ID,
  raiseRowId,
  reraiseRowId,
  resetAnalyzerStore,
  useAnalyzerStore,
} from '../analyzerStore';
import { selectStreetView } from '../selectors';

function cards(text: string): CardId[] {
  const out = parseCards(text);
  if (!out) throw new Error(`bad cards: ${text}`);
  return out;
}
const s = () => useAnalyzerStore.getState();
const flop = () => s().streets.flop;

beforeEach(() => {
  resetAnalyzerStore();
  s().loadHand(
    { hero: cards('2s2d') as [CardId, CardId], board: cards('Kh 9c 4d') },
    weightsFromHandRange('KQs, KQo, QQ, 76s'),
  );
  s().setMode('villain');
});

describe('raise rows (D133, D135)', () => {
  it('each raise brings its re-raise row, and removing the raise takes both', () => {
    s().addRaiseSize(5);
    expect(flop().actionRows.map((r) => r.id)).toContain(reraiseRowId(5));
    expect(s().removeRow(raiseRowId(5))).toBe(true);
    const ids = flop().actionRows.map((r) => r.id);
    expect(ids).not.toContain(raiseRowId(5));
    expect(ids).not.toContain(reraiseRowId(5));
    expect(flop().rows[reraiseRowId(5)]).toBeUndefined();
  });

  it('the played row and the fixed rows cannot be removed', () => {
    expect(s().removeRow(flop().playedRow)).toBe(false);
    expect(s().removeRow(CALL_ROW_ID)).toBe(false);
  });

  it('a removed selected row falls back to the played one', () => {
    s().addRaiseSize(5);
    s().selectRow(reraiseRowId(5));
    s().removeRow(raiseRowId(5));
    expect(flop().selectedRow).toBe(flop().playedRow);
  });

  it('the grid of a raise row counts the all-in part inside what goes on', () => {
    const view = selectStreetView(s(), 'flop', [])!;
    const raise = view.rows[raiseRowId(3)]!;
    // Pretend every combo that goes on shoves.
    const cells = gridCells(view, raise, undefined, null, [], view.rows[CALL_ROW_ID], raise);
    const kq = cells.find((c) => c.hand === 'KQo')!;
    expect(kq.shove).toBeCloseTo(kq.follows, 9);
    expect(kq.inRange).toBeGreaterThan(0);
  });
});
