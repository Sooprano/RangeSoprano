import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseCards, type CardId } from '../../engine/cards';
import { comboId, formatCombo, weightsFromHandRange } from '../../engine/combos';
import { describeExpr, matchingCombos, type CustomFilter, type FilterExpr } from '../../engine/filterExpr';
import { resetAnalyzerStore, useAnalyzerStore } from '../../store/analyzerStore';
import { useFiltersStore } from '../../store/filtersStore';
import { selectStreetView } from '../../store/selectors';
import {
  EMPTY_ROOT,
  EXCLUDE_PATH,
  INCLUDE_PATH,
  defaultModifier,
  ensureWorkspace,
  getAt,
  isWorkspaceGroup,
  workspaceOf,
  insertInto,
  normalizeExpr,
  removeAt,
  updateAt,
} from '../builderModel';

const leaf = (category: string): FilterExpr => ({ type: 'leaf', category });
const cards = (t: string) => parseCards(t)!;
const matching = (expr: FilterExpr, board: string, hands: string[], filters: CustomFilter[] = []) =>
  matchingCombos(
    expr,
    hands.map((h) => {
      const [a, b] = cards(h);
      return comboId(a!, b!);
    }),
    cards(board),
    filters,
  ).map(formatCombo);

/** Builds `(Top pair [kicker ≥ Q] OR Overpair) AND NOT (FD)` with builder operations. */
function buildExample(): FilterExpr {
  let root = EMPTY_ROOT;
  let r = insertInto(root, [], { type: 'or', children: [] });
  root = r.root;
  const orPath = r.path;
  r = insertInto(root, orPath, leaf('top-pair'));
  root = updateAt(r.root, r.path, (e) =>
    e.type === 'leaf' ? { ...e, modifiers: [{ kind: 'kickerMin', rank: 'Q' }] } : e,
  );
  root = insertInto(root, orPath, leaf('overpair')).root;
  r = insertInto(root, [], { type: 'not', child: EMPTY_ROOT });
  root = insertInto(r.root, r.path, leaf('any-fd')).root;
  return root;
}

describe('builder model', () => {
  it('builds the spec example with nested groups and reads it back', () => {
    const expr = normalizeExpr(buildExample())!;
    expect(expr).toEqual({
      type: 'and',
      children: [
        {
          type: 'or',
          children: [
            { type: 'leaf', category: 'top-pair', modifiers: [{ kind: 'kickerMin', rank: 'Q' }] },
            { type: 'leaf', category: 'overpair' },
          ],
        },
        { type: 'not', child: { type: 'leaf', category: 'any-fd' } },
      ],
    });
    expect(describeExpr(expr)).toBe('(Top pair con kicker ≥ Q o Overpair) y sin Flush draw');
    // K♥9♥4♣: KQ (no FD) and AA in; KJ (kicker < Q) and K♥Q♥ (FD) out.
    expect(matching(expr, 'Kh 9h 4c', ['KsQc', 'AcAd', 'KsJc', 'KhQh'])).toEqual(['KsQc', 'AcAd']);
  });

  it('D27: a single draw element leaves out pairs or better unless told otherwise', () => {
    let root = insertInto(EMPTY_ROOT, [], leaf('bdfd-2')).root;
    root = updateAt(root, [0], (e) => (e.type === 'leaf' ? { ...e, modifiers: [{ kind: 'topN', n: 3 }] } : e));
    const top3 = normalizeExpr(root)!;
    expect(top3).toEqual({
      type: 'leaf',
      category: 'bdfd-2',
      modifiers: [
        { kind: 'topN', n: 3 },
        { kind: 'includeMade', value: false },
      ],
    });
    // Spec §6.1 acceptance on A♥ J♦ 2♣.
    const B = 'Ah Jd 2c';
    expect(matching(top3, B, ['KhQh', 'KdTd', 'QcTc', 'Th9h', 'Kh3h'])).toHaveLength(5);
    expect(matching(top3, B, ['KsQs', 'KhJh', 'Kd2d', '9h8h', 'JhTh'])).toEqual([]);
    // An explicit "include made" is kept.
    const withMade = normalizeExpr(
      updateAt(root, [0], (e) =>
        e.type === 'leaf' ? { ...e, modifiers: [...(e.modifiers ?? []), defaultModifier('includeMade')] } : e,
      ),
    );
    expect(withMade).toMatchObject({ modifiers: [{ kind: 'topN' }, { kind: 'includeMade', value: true }] });
    // Inside a bigger expression the element keeps its plain meaning.
    const both = normalizeExpr(insertInto(root, [], leaf('top-pair')).root)!;
    expect(both.type).toBe('and');
    expect(JSON.stringify(both)).not.toContain('includeMade');
  });

  it('removes nodes; an emptied NOT disappears; empty groups normalize to nothing', () => {
    const root = buildExample();
    const withoutFd = removeAt(root, [1, 0]);
    expect(getAt(withoutFd, [1])).toBeNull();
    expect(normalizeExpr(removeAt(withoutFd, [0]))).toBeNull();
  });

  it('dropping into a NOT that has an element groups both with AND', () => {
    let r = insertInto(EMPTY_ROOT, [], { type: 'not', child: EMPTY_ROOT });
    const notPath = r.path;
    r = insertInto(r.root, notPath, leaf('any-fd'));
    r = insertInto(r.root, notPath, leaf('one-pair'));
    expect(normalizeExpr(r.root)).toEqual({
      type: 'not',
      child: { type: 'and', children: [leaf('any-fd'), leaf('one-pair')] },
    });
  });
});

describe('saved filters used as rows', () => {
  beforeEach(() => {
    const data = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
      removeItem: (k: string) => void data.delete(k),
    });
    useFiltersStore.setState({ filters: [] });
    resetAnalyzerStore();
  });
  afterEach(() => vi.unstubAllGlobals());

  const filter = (id: string, name: string, expr: FilterExpr): CustomFilter => ({
    id,
    name,
    expr,
    createdAt: '2026-11-01T00:00:00.000Z',
  });

  it('save, reference, refuse cycles and in-use deletes, duplicate', () => {
    const fs = () => useFiltersStore.getState();
    const example = filter('ex', 'TP Q+ u overpair sin FD', normalizeExpr(buildExample())!);
    expect(fs().saveFilter(example)).toEqual({ ok: true });
    const ref = filter('ref', 'Ejemplo con ♥', {
      type: 'suits',
      rule: { kind: 'hasSuit', suit: 'h' },
      child: { type: 'leaf', category: 'ex' },
    });
    expect(fs().saveFilter(ref)).toEqual({ ok: true });
    // ex → ref → ex would be a cycle.
    const loop = { ...example, expr: { type: 'leaf', category: 'ref' } as FilterExpr };
    expect(fs().saveFilter(loop).ok).toBe(false);
    expect(fs().deleteFilter('ex')).toEqual({ ok: false, usedBy: ['Ejemplo con ♥'] });
    const copy = fs().duplicateFilter('ex')!;
    expect(copy.name).toBe('TP Q+ u overpair sin FD (copia)');
    expect(fs().filters).toHaveLength(3);
    expect(fs().deleteFilter(copy.id)).toEqual({ ok: true });
  });

  it('a saved filter marked ✓ in a row decides the weight of its combos', () => {
    const top3 = filter('top3', 'Top 3 BDFD', {
      type: 'leaf',
      category: 'bdfd-2',
      modifiers: [
        { kind: 'topN', n: 3 },
        { kind: 'includeMade', value: false },
      ],
    });
    useFiltersStore.getState().saveFilter(top3);
    const store = useAnalyzerStore.getState();
    store.loadHand(
      { hero: cards('8s8c') as [CardId, CardId], board: cards('Ah Jd 2c') },
      weightsFromHandRange('KQs, 98s'),
    );
    useAnalyzerStore.getState().clearSelectedRow();
    useAnalyzerStore.getState().setRowState({ kind: 'custom', id: 'top3' }, { s: 'follow', w: 40 });
    const filters = useFiltersStore.getState().filters;
    const v = selectStreetView(useAnalyzerStore.getState(), 'flop', filters)!;
    const row = v.rows[useAnalyzerStore.getState().streets.flop.selectedRow]!;
    const w = (h: string) => {
      const [a, b] = cards(h);
      return row[comboId(a!, b!)];
    };
    expect(w('KhQh')).toBeCloseTo(0.4);
    expect(w('KsQs')).toBe(0);
    expect(w('9h8h')).toBe(0);
  });
});

describe('Incluir / Excluir workspace (D106)', () => {
  const tp: FilterExpr = { type: 'leaf', category: 'top-pair' };
  const fd: FilterExpr = { type: 'leaf', category: 'any-fd' };

  it('«A-high o K-high, sin gutshots» saves as (A o K) y sin (GS1 o GS2)', () => {
    let ws = workspaceOf(null);
    ws = insertInto(ws, INCLUDE_PATH, { type: 'leaf', category: 'ace-high' }).root;
    ws = insertInto(ws, INCLUDE_PATH, { type: 'leaf', category: 'king-high' }).root;
    ws = updateAt(ws, INCLUDE_PATH, (e) => (e.type === 'and' ? { ...e, type: 'or' } : e));
    ws = insertInto(ws, EXCLUDE_PATH, { type: 'leaf', category: 'gutshot-1' }).root;
    ws = insertInto(ws, EXCLUDE_PATH, { type: 'leaf', category: 'gutshot-2' }).root;
    const saved = normalizeExpr(ws)!;
    expect(describeExpr(saved)).toBe('(A-high o K-high) y sin (Gutshot 1 carta o Gutshot 2 cartas)');
  });

  it('an empty «Excluir» disappears on save', () => {
    const ws = insertInto(workspaceOf(null), INCLUDE_PATH, tp).root;
    expect(normalizeExpr(ws)).toEqual(tp);
  });

  it('a saved «X y sin Y» opens as Incluir X / Excluir Y and saves back the same', () => {
    const expr: FilterExpr = { type: 'and', children: [tp, { type: 'not', child: fd }] };
    const ws = workspaceOf(expr);
    expect(getAt(ws, INCLUDE_PATH)).toEqual({ type: 'and', children: [tp] });
    expect(getAt(ws, EXCLUDE_PATH)).toEqual({ type: 'or', children: [fd] });
    expect(normalizeExpr(ws)).toEqual(expr);
  });

  it('removing the last excluded element keeps the shape', () => {
    let ws = insertInto(workspaceOf(null), EXCLUDE_PATH, fd).root;
    ws = ensureWorkspace(removeAt(ws, [...EXCLUDE_PATH, 0]));
    expect(getAt(ws, EXCLUDE_PATH)).toEqual({ type: 'or', children: [] });
    expect(isWorkspaceGroup(INCLUDE_PATH) && isWorkspaceGroup(EXCLUDE_PATH)).toBe(true);
  });
});
