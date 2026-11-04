import { describe, expect, it } from 'vitest';
import { parseCards, type CardId } from '../cards';
import { comboId, formatCombo, type ComboId } from '../combos';
import {
  CircularFilterError,
  describeExpr,
  findCycle,
  matchingCombos,
  validateFilter,
  type CustomFilter,
  type FilterExpr,
} from '../filterExpr';
import { modifierAppliesTo } from '../modifiers';
import { exportFilters, parseFiltersExport, zFilterExpr } from '../../schemas/filters';

function cards(text: string): CardId[] {
  const out = parseCards(text);
  if (!out) throw new Error(`bad cards: ${text}`);
  return out;
}

function combo(text: string): ComboId {
  const [a, b] = cards(text);
  return comboId(a!, b!);
}

/** Which of `hands` match `expr` on `board`, as text. */
function matching(
  expr: FilterExpr,
  board: string,
  hands: string[],
  filters: CustomFilter[] = [],
): string[] {
  const ids = hands.map(combo);
  return matchingCombos(expr, ids, cards(board), filters).map(formatCombo);
}

type Mods = Extract<FilterExpr, { type: 'leaf' }>['modifiers'];

function leaf(category: string, modifiers?: Mods): FilterExpr {
  return modifiers ? { type: 'leaf', category, modifiers } : { type: 'leaf', category };
}

describe('acceptance: "Top 3 BDFD" on A♥ J♦ 2♣', () => {
  const top3Bdfd = leaf('bdfd-2', [
    { kind: 'topN', n: 3 },
    { kind: 'includeMade', value: false },
  ]);
  const B = 'Ah Jd 2c';

  it('includes K♥Q♥, K♦T♦, Q♣T♣, T♥9♥, K♥3♥', () => {
    const hands = ['KhQh', 'KdTd', 'QcTc', 'Th9h', 'Kh3h'];
    expect(matching(top3Bdfd, B, hands)).toEqual(hands);
  });

  it('excludes K♠Q♠, K♥J♥, K♦2♦, 9♥8♥, J♥T♥', () => {
    expect(matching(top3Bdfd, B, ['KsQs', 'KhJh', 'Kd2d', '9h8h', 'JhTh'])).toEqual([]);
  });

  it('with includeMade = true the paired ones come back', () => {
    const withMade = leaf('bdfd-2', [
      { kind: 'topN', n: 3 },
      { kind: 'includeMade', value: true },
    ]);
    expect(matching(withMade, B, ['KhJh', 'Kd2d', 'KsQs'])).toEqual(['KhJh', 'Kd2d']);
  });
});

describe('acceptance: BDSD + BDFD on A♥ J♦ 2♣', () => {
  it('Q♥9♥ in, Q♠9♠ out', () => {
    expect(matching(leaf('bdsd-bdfd'), 'Ah Jd 2c', ['Qh9h', 'Qs9s'])).toEqual(['Qh9h']);
  });

  it('modifiers reach each backdoor', () => {
    const B = 'Ah Jd 2c';
    // Q♥9♥: straight backdoor uses 1 card (the Q), flush backdoor uses 2.
    expect(
      matching(leaf('bdsd-bdfd', [{ kind: 'cardsUsed', value: 1, part: 'straight' }]), B, ['Qh9h']),
    ).toEqual(['Qh9h']);
    expect(
      matching(leaf('bdsd-bdfd', [{ kind: 'cardsUsed', value: 1, part: 'flush' }]), B, ['Qh9h']),
    ).toEqual([]);
    expect(matching(leaf('bdsd-bdfd', [{ kind: 'nutRankMax', k: 2 }]), B, ['Qh9h'])).toEqual([
      'Qh9h',
    ]);
    expect(matching(leaf('bdsd-bdfd', [{ kind: 'nutRankMax', k: 1 }]), B, ['Qh9h'])).toEqual([]);
  });
});

describe('modifiers', () => {
  const B = 'Ks 9h 4h';
  it('kickerMin on top pair; strict on categories without kicker', () => {
    const tpQ = leaf('top-pair', [{ kind: 'kickerMin', rank: 'Q' }]);
    expect(matching(tpQ, B, ['KdQd', 'KdAc', 'KdJc'])).toEqual(['KdQd', 'AcKd']);
    expect(matching(leaf('overpair', [{ kind: 'kickerMin', rank: '2' }]), B, ['AcAd'])).toEqual([]);
    expect(modifierAppliesTo('kickerMin', 'overpair')).toBe(false);
    expect(modifierAppliesTo('kickerMin', 'top-pair')).toBe(true);
  });

  it('rankRange and nutRankMax on flush draws', () => {
    const fd = (mods: Mods) => leaf('fd-2', mods);
    const hands = ['AhQh', 'QhJh', '8h7h'];
    expect(matching(fd([{ kind: 'nutRankMax', k: 1 }]), B, hands)).toEqual(['AhQh']);
    expect(matching(fd([{ kind: 'rankRange', min: '8', max: 'Q' }]), B, hands)).toEqual([
      'QhJh',
      '8h7h',
    ]);
  });

  it('cardsUsed and overcardsMin', () => {
    const board = '9s 8d 7c';
    expect(
      matching(leaf('oesd-1', [{ kind: 'cardsUsed', value: 1 }]), board, ['Ts2h', 'Ah6d']),
    ).toEqual(['Ts2h', 'Ah6d']);
    expect(
      matching(leaf('no-made', [{ kind: 'overcardsMin', n: 2 }]), board, ['AhKd', 'Ah2d', '3h2d']),
    ).toEqual(['AhKd']);
  });
});

describe('operators', () => {
  const B = 'Ks 9h 4h';
  const hands = ['KhQh', 'KdQd', 'KdJc', 'AcAs', 'AhQh', 'QcQd', '5h3h', 'Tc8c'];

  it('AND / OR / NOT', () => {
    expect(
      matching({ type: 'or', children: [leaf('top-pair'), leaf('overpair')] }, B, hands),
    ).toEqual(['KhQh', 'KdQd', 'KdJc', 'AcAs']);
    expect(
      matching({ type: 'and', children: [leaf('top-pair'), leaf('any-fd')] }, B, hands),
    ).toEqual(['KhQh']);
    expect(matching({ type: 'not', child: leaf('pair-or-better') }, B, hands)).toEqual([
      'AhQh',
      '5h3h',
      'Tc8c',
    ]);
  });

  it('the spec example: (Top pair [kicker ≥ Q] OR Overpair) AND NOT (FD)', () => {
    const expr: FilterExpr = {
      type: 'and',
      children: [
        {
          type: 'or',
          children: [leaf('top-pair', [{ kind: 'kickerMin', rank: 'Q' }]), leaf('overpair')],
        },
        { type: 'not', child: leaf('any-fd') },
      ],
    };
    // KhQh has a flush draw; KdJc has a low kicker.
    expect(matching(expr, B, hands)).toEqual(['KdQd', 'AcAs']);
    expect(describeExpr(expr)).toBe('(Top pair con kicker ≥ Q o Overpair) y sin Flush draw');
  });

  it('empty groups: AND of nothing is everything, OR of nothing is nothing', () => {
    expect(matching({ type: 'and', children: [] }, B, ['AcAs'])).toEqual(['AcAs']);
    expect(matching({ type: 'or', children: [] }, B, ['AcAs'])).toEqual([]);
  });

  it('deeply nested groups', () => {
    let expr: FilterExpr = leaf('top-pair');
    for (let i = 0; i < 20; i++) expr = { type: i % 2 ? 'and' : 'or', children: [expr] };
    expr = { type: 'not', child: { type: 'not', child: expr } };
    expect(matching(expr, B, hands)).toEqual(['KhQh', 'KdQd', 'KdJc']);
  });
});

describe('PALOS', () => {
  const B = 'Ks 9h 4h';
  const hands = ['AhQh', 'AsQs', 'AcQd', 'Ah2c', 'AdQd'];
  const suits = (
    rule: Extract<FilterExpr, { type: 'suits' }>['rule'],
    child?: FilterExpr,
  ): FilterExpr => (child ? { type: 'suits', rule, child } : { type: 'suits', rule });

  it('suited / offsuit / a concrete suit', () => {
    expect(matching(suits({ kind: 'suited' }), B, hands)).toEqual(['AhQh', 'AsQs', 'AdQd']);
    expect(matching(suits({ kind: 'offsuit' }), B, hands)).toEqual(['AcQd', 'Ah2c']);
    expect(matching(suits({ kind: 'hasSuit', suit: 'h' }), B, hands)).toEqual(['AhQh', 'Ah2c']);
  });

  it('suit present on the board / twice on the board', () => {
    expect(matching(suits({ kind: 'suitOnBoard' }), B, hands)).toEqual(['AhQh', 'AsQs', 'Ah2c']);
    expect(matching(suits({ kind: 'suitTwiceOnBoard' }), B, hands)).toEqual(['AhQh', 'Ah2c']);
  });

  it('restricts a child expression', () => {
    expect(
      matching(suits({ kind: 'suited' }, leaf('no-made')), B, ['AhQh', 'AcQd', 'KhQh']),
    ).toEqual(['AhQh']);
  });
});

describe('saved filters referencing saved filters', () => {
  const now = '2026-10-31T00:00:00Z';
  const tp: CustomFilter = { id: 'tp', name: 'Top pair', expr: leaf('top-pair'), createdAt: now };
  const strong: CustomFilter = {
    id: 'strong',
    name: 'Fuertes',
    expr: { type: 'or', children: [leaf('tp'), leaf('overpair')] },
    createdAt: now,
  };

  it('a reference evaluates the referenced expression', () => {
    expect(matching(leaf('strong'), 'Ks 9h 4h', ['KdQd', 'AcAs', 'QcQd'], [tp, strong])).toEqual([
      'KdQd',
      'AcAs',
    ]);
  });

  it('a reference to a deleted filter matches nothing and blocks saving', () => {
    expect(matching(leaf('gone'), 'Ks 9h 4h', ['KdQd'])).toEqual([]);
    const f: CustomFilter = { id: 'x', name: 'x', expr: leaf('gone'), createdAt: now };
    expect(validateFilter(f, [])).toEqual([{ kind: 'unknownReference', id: 'gone' }]);
  });

  it('detects and rejects circular references', () => {
    const a: CustomFilter = {
      id: 'a',
      name: 'A',
      expr: { type: 'not', child: leaf('b') },
      createdAt: now,
    };
    const b: CustomFilter = { id: 'b', name: 'B', expr: leaf('a'), createdAt: now };
    expect(findCycle([a, b])).toEqual(['a', 'b', 'a']);
    expect(validateFilter(b, [a])).toContainEqual({ kind: 'circular', cycle: ['a', 'b', 'a'] });
    expect(() => matching(leaf('a'), 'Ks 9h 4h', ['KdQd'], [a, b])).toThrow(CircularFilterError);

    const self: CustomFilter = { id: 's', name: 'S', expr: leaf('s'), createdAt: now };
    expect(findCycle([self])).toEqual(['s', 's']);
  });

  it('modifiers on a reference are flagged', () => {
    const f: CustomFilter = {
      id: 'y',
      name: 'y',
      expr: leaf('tp', [{ kind: 'topN', n: 2 }]),
      createdAt: now,
    };
    expect(validateFilter(f, [tp])).toEqual([{ kind: 'modifierOnReference', id: 'tp' }]);
  });

  it('describes references by name', () => {
    expect(describeExpr(strong.expr, [tp])).toBe('«Top pair» o Overpair');
  });
});

describe('schemas: save, export, import', () => {
  const now = '2026-10-31T00:00:00Z';
  const top3: CustomFilter = {
    id: 'top3',
    name: 'Top 3 BDFD',
    expr: leaf('bdfd-2', [
      { kind: 'topN', n: 3 },
      { kind: 'includeMade', value: false },
    ]),
    createdAt: now,
  };

  it('round-trips through JSON', () => {
    const json = JSON.parse(JSON.stringify(exportFilters([top3])));
    expect(parseFiltersExport(json)).toEqual({ ok: true, filters: [top3] });
  });

  it('rejects unknown modifiers, bad ranks and cycles', () => {
    const bad = (expr: unknown) => zFilterExpr.safeParse(expr).success;
    expect(bad({ type: 'leaf', category: 'top-pair', modifiers: [{ kind: 'nope' }] })).toBe(false);
    expect(
      bad({ type: 'leaf', category: 'top-pair', modifiers: [{ kind: 'kickerMin', rank: 'Z' }] }),
    ).toBe(false);
    expect(bad({ type: 'xor', children: [] })).toBe(false);

    const cyc = exportFilters([
      { id: 'a', name: 'A', expr: leaf('b'), createdAt: now },
      { id: 'b', name: 'B', expr: leaf('a'), createdAt: now },
    ]);
    expect(parseFiltersExport(JSON.parse(JSON.stringify(cyc))).ok).toBe(false);
  });

  it('rejects absurdly deep expressions', () => {
    let expr: FilterExpr = leaf('top-pair');
    for (let i = 0; i < 40; i++) expr = { type: 'not', child: expr };
    expect(zFilterExpr.safeParse(expr).success).toBe(false);
  });
});

describe('describeExpr: PALOS alone', () => {
  it('reads with a noun, also inside a NOT', () => {
    const clubs: FilterExpr = { type: 'suits', rule: { kind: 'hasSuit', suit: 'c' } };
    expect(describeExpr({ type: 'not', child: clubs })).toBe('sin combos con ♣');
    expect(describeExpr({ type: 'suits', rule: { kind: 'suited' } })).toBe('combos suited');
  });
});
