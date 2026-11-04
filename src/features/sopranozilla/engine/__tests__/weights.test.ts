import { describe, expect, it } from 'vitest';
import { parseCards, type CardId } from '../cards';
import { classify } from '../classify';
import { comboId, type ComboId } from '../combos';
import { makeFilterContext, type CustomFilter } from '../filterExpr';
import {
  emptyActionRow,
  fullActionRow,
  resolveComboWeight,
  type ActionRowState,
  type ResolveContext,
} from '../weights';

function cards(text: string): CardId[] {
  const out = parseCards(text);
  if (!out) throw new Error(`bad cards: ${text}`);
  return out;
}

function combo(text: string): ComboId {
  const [a, b] = cards(text);
  return comboId(a!, b!);
}

// A♥ J♦ 2♣ — Q♥9♥ is "Nada" + BDFD 2 cartas + BDSD (+ the BDSD+BDFD combo draw).
const BOARD = 'Ah Jd 2c';
const Q9 = 'Qh9h';

const top3Bdfd: CustomFilter = {
  id: 'top3',
  name: 'Top 3 BDFD',
  expr: {
    type: 'leaf',
    category: 'bdfd-2',
    modifiers: [
      { kind: 'topN', n: 3 },
      { kind: 'includeMade', value: false },
    ],
  },
  createdAt: '2026-10-31T00:00:00Z',
};
const anyBdfd: CustomFilter = {
  id: 'bd',
  name: 'Cualquier BDFD',
  expr: { type: 'leaf', category: 'any-bdfd' },
  createdAt: '2026-10-31T00:00:00Z',
};

function weightOf(hand: string, row: ActionRowState, filters: CustomFilter[] = []) {
  const board = cards(BOARD);
  const id = combo(hand);
  const ctx: ResolveContext = { filters, filterCtx: makeFilterContext(board, filters) };
  return resolveComboWeight(id, classify(id, board), row, ctx);
}

function row(patch: Partial<ActionRowState>): ActionRowState {
  return { ...emptyActionRow(), ...patch };
}

describe('weight precedence (§7)', () => {
  it('sanity: Q♥9♥ classification on A♥ J♦ 2♣', () => {
    const c = classify(combo(Q9), cards(BOARD));
    expect(c.made).toBe('nothing');
    expect(c.draws.map((d) => d.id).sort()).toEqual(['bdfd-2', 'bdsd']);
    expect(c.comboDraws.map((d) => d.id)).toEqual(['bdsd-bdfd']);
  });

  it('5 · generic rows: the highest ✓ among matching rows', () => {
    const r = row({ cats: { nothing: { s: 'follow', w: 30 }, 'bdfd-2': { s: 'follow', w: 70 } } });
    expect(weightOf(Q9, r)).toMatchObject({ weight: 0.7, source: 'generic', row: 'bdfd-2' });
  });

  it('5 · no ✓ row matches → 0 (neutral rows do not count)', () => {
    expect(weightOf(Q9, row({ cats: { 'top-pair': { s: 'follow', w: 100 } } })).weight).toBe(0);
    expect(weightOf(Q9, emptyActionRow()).weight).toBe(0);
  });

  it('5 · "Nada ✗" + "BDFD ✓ 40" → 40 (✗ does not cancel ✓)', () => {
    const r = row({
      cats: { nothing: { s: 'exclude', w: 100 }, 'bdfd-2': { s: 'follow', w: 40 } },
    });
    expect(weightOf(Q9, r)).toMatchObject({ weight: 0.4, source: 'generic', row: 'bdfd-2' });
  });

  it('5 · only ✗ rows match → 0', () => {
    const r = row({
      cats: { nothing: { s: 'exclude', w: 100 }, 'bdfd-2': { s: 'exclude', w: 50 } },
    });
    expect(weightOf(Q9, r).weight).toBe(0);
  });

  it('4 · combo-draw rows win over generic rows', () => {
    const r = row({
      cats: {
        nothing: { s: 'follow', w: 100 },
        'bdfd-2': { s: 'follow', w: 40 },
        'bdsd-bdfd': { s: 'follow', w: 80 },
      },
    });
    expect(weightOf(Q9, r)).toMatchObject({ weight: 0.8, source: 'combo-draw', row: 'bdsd-bdfd' });
  });

  it('4 · a ✗ combo draw with no ✓ combo draw → 0, even if generic rows are ✓', () => {
    const r = row({
      cats: { nothing: { s: 'follow', w: 100 }, 'bdsd-bdfd': { s: 'exclude', w: 100 } },
    });
    expect(weightOf(Q9, r)).toMatchObject({ weight: 0, source: 'combo-draw' });
  });

  it('4 · a neutral combo draw falls through to generic rows', () => {
    const r = row({
      cats: { nothing: { s: 'follow', w: 100 }, 'bdsd-bdfd': { s: null, w: 10 } },
    });
    expect(weightOf(Q9, r)).toMatchObject({ weight: 1, source: 'generic' });
  });

  it('3 · custom filters win over combo draws; several ✓ → the highest', () => {
    const r = row({
      cats: { 'bdsd-bdfd': { s: 'follow', w: 80 } },
      custom: { top3: { s: 'follow', w: 90 }, bd: { s: 'follow', w: 20 } },
    });
    expect(weightOf(Q9, r, [top3Bdfd, anyBdfd])).toMatchObject({
      weight: 0.9,
      source: 'custom',
      row: 'top3',
    });
  });

  it('3 · custom ✗ + custom ✓ → ✓ wins; only ✗ → 0', () => {
    const both = row({ custom: { top3: { s: 'exclude', w: 0 }, bd: { s: 'follow', w: 20 } } });
    expect(weightOf(Q9, both, [top3Bdfd, anyBdfd]).weight).toBe(0.2);
    const onlyX = row({
      cats: { 'bdsd-bdfd': { s: 'follow', w: 80 } },
      custom: { top3: { s: 'exclude', w: 0 } },
    });
    expect(weightOf(Q9, onlyX, [top3Bdfd])).toMatchObject({ weight: 0, source: 'custom' });
  });

  it('3 · a custom filter that does not match the combo is ignored', () => {
    // 9♥8♥: BDFD but the 9 is not in the top 3 → "Top 3 BDFD" does not match.
    const r = row({
      cats: { 'bdfd-2': { s: 'follow', w: 35 } },
      custom: { top3: { s: 'follow', w: 90 } },
    });
    expect(weightOf('9h8h', r, [top3Bdfd])).toMatchObject({
      weight: 0.35,
      source: 'generic',
      row: 'bdfd-2',
    });
  });

  it('2 · class override (brush) wins over custom filters', () => {
    const r = row({ custom: { top3: { s: 'follow', w: 90 } }, classOverrides: { Q9s: 10 } });
    expect(weightOf(Q9, r, [top3Bdfd])).toMatchObject({ weight: 0.1, source: 'class' });
  });

  it('1 · combo override (4×4) wins over the class override', () => {
    const r = row({ classOverrides: { Q9s: 10 }, comboOverrides: { [combo(Q9)]: 0 } });
    expect(weightOf(Q9, r)).toMatchObject({ weight: 0, source: 'combo' });
    // Other combos of the class still use the class override.
    expect(weightOf('Qs9s', r)).toMatchObject({ weight: 0.1, source: 'class' });
  });

  it('"Todo ✓ 100" + a made row at 50 is exactly 50, even with a backdoor (D53)', () => {
    // K♥ 9♥ 4♣: 8♥8♠ is PP < 2nd card AND BDFD 1 carta; the BDFD row is neutral.
    const board = cards('Kh 9h 4c');
    const id = combo('8h8s');
    const cls = classify(id, board);
    expect(cls.made).toBe('pp-below-second');
    expect(cls.draws.map((d) => d.id)).toContain('bdfd-1');
    const r = fullActionRow();
    r.cats['pp-below-second'] = { s: 'follow', w: 50 };
    const ctx: ResolveContext = { filters: [], filterCtx: makeFilterContext(board, []) };
    expect(resolveComboWeight(id, cls, r, ctx)).toEqual({
      weight: 0.5,
      source: 'generic',
      row: 'pp-below-second',
    });
  });

  it('"Todo ✓ 100" keeps every combo at 1', () => {
    for (const h of [Q9, 'AsAd', 'KhKd', '7c6c', 'Jh2h'])
      expect(weightOf(h, fullActionRow()).weight).toBe(1);
  });

  it('weights are clamped to [0, 1]', () => {
    const r = row({ cats: { nothing: { s: 'follow', w: 250 } }, classOverrides: { AKo: -30 } });
    expect(weightOf(Q9, r).weight).toBe(1);
    expect(weightOf('KsQc', row({ classOverrides: { KQo: -30 } })).weight).toBe(0);
  });
});
