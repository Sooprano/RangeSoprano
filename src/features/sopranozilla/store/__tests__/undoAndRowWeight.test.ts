import { beforeEach, describe, expect, it } from 'vitest';
import { parseCards, type CardId } from '../../engine/cards';
import { comboId, weightsFromHandRange } from '../../engine/combos';
import { targetCombos } from '../../ui/viewModel';
import { resetAnalyzerStore, useAnalyzerStore } from '../analyzerStore';
import { selectStreetView } from '../selectors';

function cards(text: string): CardId[] {
  const out = parseCards(text);
  if (!out) throw new Error(`bad cards: ${text}`);
  return out;
}
const id = (s: string) => {
  const c = cards(s);
  return comboId(c[0]!, c[1]!);
};
const TOP_PAIR = { kind: 'cat', id: 'top-pair' } as const;

const row = () => {
  const s = useAnalyzerStore.getState();
  const st = s.streets[s.activeStreet];
  return st.rows[st.selectedRow]!;
};
const view = () => selectStreetView(useAnalyzerStore.getState(), 'flop', [])!;

beforeEach(() => {
  resetAnalyzerStore();
  useAnalyzerStore.getState().loadHand(
    { hero: cards('2s2d') as [CardId, CardId], board: cards('Kh 9c 4d') },
    weightsFromHandRange('KQs, KQo, QQ'),
  );
});

describe('targetCombos', () => {
  it('only the combos of the row: KQ is top pair on K94, QQ is not', () => {
    expect(targetCombos(view(), TOP_PAIR, [], 'KQo').length).toBeGreaterThan(0);
    expect(targetCombos(view(), TOP_PAIR, [], 'QQ')).toEqual([]);
    const all = targetCombos(view(), TOP_PAIR, []);
    expect(all).toContain(id('KsQh'));
    expect(all).not.toContain(id('QsQh'));
  });
});

describe('applyRowWeight', () => {
  it('sets the row weight and drops the hand edits on its combos only', () => {
    const s = useAnalyzerStore.getState();
    s.setClassOverride('KQo', 0);
    s.setComboOverrides([{ combo: id('KsQs'), weight: 25 }]);
    s.applyRowWeight(TOP_PAIR, 50, targetCombos(view(), TOP_PAIR, []));
    const r = row();
    expect(r.cats['top-pair']).toEqual({ s: 'follow', w: 50 });
    expect(r.classOverrides.KQo).toBeUndefined();
    expect(r.comboOverrides[id('KsQs')]).toBeUndefined();
    // Every top-pair combo continues at 50%.
    expect(view().rows[useAnalyzerStore.getState().streets.flop.selectedRow]![id('KsQh')]).toBeCloseTo(0.5);
  });
});

describe('undo', () => {
  it('goes back to the last checkpoint, and a slider drag is one step', () => {
    const s = useAnalyzerStore.getState();
    const before = row();
    s.checkpoint('w:cat:top-pair');
    s.setRowState(TOP_PAIR, { w: 40, s: 'follow' });
    s.checkpoint('w:cat:top-pair');
    s.setRowState(TOP_PAIR, { w: 30, s: 'follow' });
    expect(useAnalyzerStore.getState().undoDepth).toBe(1);
    expect(useAnalyzerStore.getState().undo()).toBe(true);
    expect(row()).toBe(before);
    expect(useAnalyzerStore.getState().undo()).toBe(false);
  });

  it('skips checkpoints whose edit changed nothing', () => {
    const s = useAnalyzerStore.getState();
    s.checkpoint();
    s.setClassOverride('KQo', 0);
    const painted = row();
    s.checkpoint(); // a stroke that hit nothing
    expect(useAnalyzerStore.getState().undo()).toBe(true);
    expect(row()).not.toBe(painted);
    expect(row().classOverrides.KQo).toBeUndefined();
  });

  it('undoes a preflop edit and loading a hand clears the history', () => {
    const s = useAnalyzerStore.getState();
    const pre = s.villainPreflop;
    s.checkpoint();
    s.editStart('flop', [{ combo: id('7s2c'), weight: 1 }], view().start);
    expect(useAnalyzerStore.getState().villainPreflop).not.toBe(pre);
    useAnalyzerStore.getState().undo();
    expect(useAnalyzerStore.getState().villainPreflop).toBe(pre);

    s.checkpoint();
    s.loadHand(
      { hero: cards('2s2d') as [CardId, CardId], board: cards('Kh 9c 4d') },
      weightsFromHandRange('AA'),
    );
    expect(useAnalyzerStore.getState().undoDepth).toBe(0);
  });
});
