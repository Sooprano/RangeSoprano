// Combo classification on a board (spec §5). Pure TS, no React.
//
// Principle: classify by what the combo's OWN cards add. Made hands are
// exclusive (first match in MADE_CATEGORIES order); draws and combo draws are
// not. Every match carries its own attributes so modifiers (§6.1) can filter
// on them without knowing the board.

import { rankOf, suitOf, type CardId } from './cards';
import { comboCards, type ComboId } from './combos';
import { categoryOfValue, evaluate } from './evaluator';
import {
  AGGREGATE_MEMBERS,
  NO_MADE_CATEGORIES,
  ONE_PAIR_CATEGORIES,
  type CategoryId,
  type ComboDrawCategory,
  type DrawCategory,
  type MadeCategory,
} from './categories';

export type TwoPairKind = 'top-two' | 'top-bottom' | 'bottom-two';

/** Attributes of one match. `null` = not applicable to that category. */
export type MatchAttrs = {
  /** The card modifiers look at (§6.1): flush/flush draw → own highest card of
   * the suit; one-card pairs → kicker; pocket pairs → the pair; else highest
   * own card. Rank index 0 ('2') … 12 ('A'). */
  relevantRank: number;
  kicker: number | null;
  /** Own cards used (straights, straight draws, flushes, flush draws). */
  cardsUsed: number | null;
  /** In combo draws: cards used by the straight part / the flush part. */
  straightCardsUsed: number | null;
  flushCardsUsed: number | null;
  nutRank: number | null;
  suit: number | null;
  highHoleRankInSuit: number | null;
  twoPairKind: TwoPairKind | null;
  /** Own cards above the board's top rank (0–2). */
  overcards: number;
};

export type Match<C extends CategoryId = CategoryId> = { id: C; attrs: MatchAttrs };

export type ComboClass = {
  made: MadeCategory;
  madeAttrs: MatchAttrs;
  draws: Match<DrawCategory>[];
  comboDraws: Match<ComboDrawCategory>[];
  /** Combo-level summary (§5.4). */
  attrs: {
    kicker: number | null;
    highCard: number;
    cardsUsed: number | null;
    nutRank: number | null;
    overcards: number;
    suit: number | null;
  };
};

// ── Rank helpers ─────────────────────────────────────────────────────────────

const ACE = 12;

/** The 10 straight windows as 13-bit rank masks, highest first (wheel last). */
const STRAIGHT_WINDOWS: readonly number[] = (() => {
  const out: number[] = [];
  for (let hi = ACE; hi >= 4; hi--) out.push(0x1f << (hi - 4));
  out.push((1 << ACE) | 0xf);
  return out;
})();

function bit(rank: number): number {
  return 1 << rank;
}

function popcount(x: number): number {
  let n = 0;
  for (let v = x; v; v &= v - 1) n++;
  return n;
}

function bestStraightWindow(rankMask: number): number | null {
  for (const w of STRAIGHT_WINDOWS) if ((rankMask & w) === w) return w;
  return null;
}

type Spot = {
  board: readonly CardId[];
  boardRankCount: Uint8Array;
  boardSuitCount: Uint8Array;
  boardRankMask: number;
  /** Distinct board ranks, highest first. */
  boardRanksDesc: number[];
  topRank: number;
  /** Ranks not on the board, highest first (for topN). */
  offBoardRanksDesc: number[];
  /** Board value (river only) to detect "the board plays". */
  boardValue: number | null;
};

function makeSpot(board: readonly CardId[]): Spot {
  const boardRankCount = new Uint8Array(13);
  const boardSuitCount = new Uint8Array(4);
  let boardRankMask = 0;
  for (const c of board) {
    boardRankCount[rankOf(c)]!++;
    boardSuitCount[suitOf(c)]!++;
    boardRankMask |= bit(rankOf(c));
  }
  const boardRanksDesc: number[] = [];
  const offBoardRanksDesc: number[] = [];
  for (let r = ACE; r >= 0; r--)
    (boardRankMask & bit(r) ? boardRanksDesc : offBoardRanksDesc).push(r);
  return {
    board,
    boardRankCount,
    boardSuitCount,
    boardRankMask,
    boardRanksDesc,
    topRank: boardRanksDesc[0] ?? -1,
    offBoardRanksDesc,
    boardValue: board.length === 5 ? evaluate(board) : null,
  };
}

/** 1 = nut: position of `rank` among the ranks of its suit not on the board. */
function nutRankOf(rank: number, suit: number, spot: Spot): number {
  let above = 0;
  for (let r = ACE; r > rank; r--) {
    const onBoard = spot.board.some((c) => rankOf(c) === r && suitOf(c) === suit);
    if (!onBoard) above++;
  }
  return above + 1;
}

function emptyAttrs(relevantRank: number, overcards: number): MatchAttrs {
  return {
    relevantRank,
    kicker: null,
    cardsUsed: null,
    straightCardsUsed: null,
    flushCardsUsed: null,
    nutRank: null,
    suit: null,
    highHoleRankInSuit: null,
    twoPairKind: null,
    overcards,
  };
}

// ── Made hands ───────────────────────────────────────────────────────────────

type Hole = { cards: [CardId, CardId]; hi: number; lo: number; rankMask: number };

function madeHand(
  hole: Hole,
  spot: Spot,
  overcards: number,
): { made: MadeCategory; attrs: MatchAttrs } {
  const all = [...hole.cards, ...spot.board];
  const value = evaluate(all);
  const base = emptyAttrs(hole.hi, overcards);
  const result = (made: MadeCategory, extra: Partial<MatchAttrs> = {}) => ({
    made,
    attrs: { ...base, ...extra },
  });

  // River: if the combo's best hand is exactly the board, its cards add nothing.
  if (spot.boardValue !== null && value === spot.boardValue) return noMade(hole, spot, overcards);

  const rankCount = new Uint8Array(spot.boardRankCount);
  const suitCount = new Uint8Array(spot.boardSuitCount);
  for (const c of hole.cards) {
    rankCount[rankOf(c)]!++;
    suitCount[suitOf(c)]!++;
  }
  const holeOnlyMask = hole.rankMask & ~spot.boardRankMask;

  switch (categoryOfValue(value)) {
    case 'straight-flush': {
      for (let s = 0; s < 4; s++) {
        if (suitCount[s]! < 5) continue;
        let suitMask = 0;
        for (const c of all) if (suitOf(c) === s) suitMask |= bit(rankOf(c));
        const w = bestStraightWindow(suitMask);
        if (w === null) continue;
        const holeIn = hole.cards.filter((c) => suitOf(c) === s && (w & bit(rankOf(c))) !== 0);
        if (holeIn.length > 0) return result('sf-quads', { cardsUsed: holeIn.length, suit: s });
      }
      break;
    }
    case 'quads': {
      const quad = rankCount.findIndex((n) => n === 4);
      if (hole.hi === quad || hole.lo === quad) return result('sf-quads');
      break;
    }
    case 'full-house': {
      let trips = -1;
      let pair = -1;
      for (let r = ACE; r >= 0; r--) if (trips < 0 && rankCount[r]! >= 3) trips = r;
      for (let r = ACE; r >= 0; r--) if (pair < 0 && r !== trips && rankCount[r]! >= 2) pair = r;
      const holeIn = [hole.hi, hole.lo].some((r) => r === trips || r === pair);
      if (holeIn) return result('full-house');
      break;
    }
    case 'flush': {
      const s = suitCount.findIndex((n) => n >= 5);
      const suitRanks = all
        .filter((c) => suitOf(c) === s)
        .map(rankOf)
        .sort((a, b) => b - a)
        .slice(0, 5);
      const holeIn = hole.cards.filter((c) => suitOf(c) === s && suitRanks.includes(rankOf(c)));
      if (holeIn.length > 0) {
        const high = Math.max(...holeIn.map(rankOf));
        return result('flush', {
          relevantRank: high,
          cardsUsed: holeIn.length,
          flushCardsUsed: holeIn.length,
          suit: s,
          highHoleRankInSuit: high,
          nutRank: nutRankOf(high, s, spot),
        });
      }
      break;
    }
    case 'straight': {
      let mask = 0;
      for (let r = 0; r <= ACE; r++) if (rankCount[r]) mask |= bit(r);
      const w = bestStraightWindow(mask);
      if (w !== null && (w & holeOnlyMask) !== 0) {
        const used = popcount(w & holeOnlyMask);
        return result('straight', { cardsUsed: used, straightCardsUsed: used });
      }
      break;
    }
    default:
      break;
  }

  return rankMade(hole, spot, overcards);
}

/** Sets, trips, two pair, pairs and pocket pairs — by board rank position. */
function rankMade(
  hole: Hole,
  spot: Spot,
  overcards: number,
): { made: MadeCategory; attrs: MatchAttrs } {
  const { hi, lo } = hole;
  const pos = (r: number) => spot.boardRanksDesc.indexOf(r);

  if (hi === lo) {
    const attrs = emptyAttrs(hi, overcards);
    if (spot.boardRankCount[hi] === 1) return { made: 'set', attrs };
    const above = spot.boardRanksDesc.filter((r) => r > hi).length;
    const n = spot.boardRanksDesc.length;
    if (above === 0) return { made: 'overpair', attrs };
    if (above === n) return { made: 'pp-below-board', attrs };
    if (above === 1) return { made: 'pp-below-top', attrs };
    return { made: 'pp-below-second', attrs };
  }

  const cHi = spot.boardRankCount[hi]!;
  const cLo = spot.boardRankCount[lo]!;
  if (cHi === 2 || cLo === 2) {
    const kicker = cHi === 2 ? lo : hi;
    return { made: 'trips', attrs: { ...emptyAttrs(kicker, overcards), kicker } };
  }
  if (cHi === 1 && cLo === 1) {
    const p = [pos(hi), pos(lo)];
    const twoPairKind: TwoPairKind = p.includes(0)
      ? p.includes(1)
        ? 'top-two'
        : 'top-bottom'
      : 'bottom-two';
    return { made: 'two-pair', attrs: { ...emptyAttrs(hi, overcards), twoPairKind } };
  }
  if (cHi === 1 || cLo === 1) {
    const paired = cHi === 1 ? hi : lo;
    const kicker = cHi === 1 ? lo : hi;
    const p = pos(paired);
    const made: MadeCategory = p === 0 ? 'top-pair' : p === 1 ? 'middle-pair' : 'weak-pair';
    return { made, attrs: { ...emptyAttrs(kicker, overcards), kicker } };
  }
  return noMade(hole, spot, overcards);
}

/** "Sin hecho", exclusive by high card. Overcards are draws, not made rows. */
function noMade(
  hole: Hole,
  _spot: Spot,
  overcards: number,
): { made: MadeCategory; attrs: MatchAttrs } {
  const attrs = emptyAttrs(hole.hi, overcards);
  if (hole.hi === ACE) return { made: 'ace-high', attrs };
  if (hole.hi === ACE - 1) return { made: 'king-high', attrs };
  return { made: 'nothing', attrs };
}

// ── Draws ────────────────────────────────────────────────────────────────────

function flushDraws(hole: Hole, spot: Spot, overcards: number): Match<DrawCategory>[] {
  const out: Match<DrawCategory>[] = [];
  const flop = spot.board.length === 3;
  for (let s = 0; s < 4; s++) {
    const own = hole.cards.filter((c) => suitOf(c) === s);
    const hs = own.length;
    if (hs === 0) continue;
    const bs = spot.boardSuitCount[s]!;
    let id: DrawCategory | null = null;
    if (hs === 2 && bs === 2) id = 'fd-2';
    else if (hs === 1 && bs === 3) id = 'fd-1';
    else if (flop && hs === 2 && bs === 1) id = 'bdfd-2';
    else if (flop && hs === 1 && bs === 2) id = 'bdfd-1';
    if (!id) continue;
    const high = Math.max(...own.map(rankOf));
    out.push({
      id,
      attrs: {
        ...emptyAttrs(high, overcards),
        cardsUsed: hs,
        flushCardsUsed: hs,
        suit: s,
        highHoleRankInSuit: high,
        nutRank: nutRankOf(high, s, spot),
      },
    });
  }
  return out;
}

/** Straight draw analysis on rank masks. */
function straightDraws(hole: Hole, spot: Spot, overcards: number): Match<DrawCategory>[] {
  const all = hole.rankMask | spot.boardRankMask;
  const holeOnly = hole.rankMask & ~spot.boardRankMask;
  if (holeOnly === 0) return [];

  // One-card outs: ranks whose BEST resulting straight uses an own card (a
  // lower straight hidden under a board straight is not an out).
  let outRanks = 0;
  let minUsed = 3;
  for (let r = 0; r <= ACE; r++) {
    if (all & bit(r)) continue;
    const best = bestStraightWindow(all | bit(r));
    if (best === null || (best & holeOnly) === 0) continue;
    outRanks |= bit(r);
    minUsed = Math.min(minUsed, popcount(best & holeOnly));
  }
  const outs = popcount(outRanks);
  const attrsOf = (used: number): MatchAttrs => ({
    ...emptyAttrs(hole.hi, overcards),
    cardsUsed: used,
    straightCardsUsed: used,
  });

  if (outs >= 1) {
    const used = minUsed === 1 ? 1 : 2;
    if (outs === 1) return [{ id: used === 1 ? 'gutshot-1' : 'gutshot-2', attrs: attrsOf(used) }];
    // Open-ended: 4 consecutive ranks with a live rank on each side (2345 is
    // open: ace below, six above; JQKA is not) including an own card.
    let open = false;
    for (let i = 0; i <= 8 && !open; i++) {
      const seq = 0xf << i;
      if ((all & seq) === seq && (seq & holeOnly) !== 0) open = true;
    }
    if (open) return [{ id: used === 1 ? 'oesd-1' : 'oesd-2', attrs: attrsOf(used) }];
    return [{ id: 'double-gutshot', attrs: attrsOf(used) }];
  }

  // Backdoor (flop only): two more ranks complete a straight using an own card.
  if (spot.board.length !== 3) return [];
  // With no one-card out, any straight here needs both new ranks.
  let bdMin = 3;
  for (let r1 = 0; r1 <= ACE; r1++) {
    if (all & bit(r1)) continue;
    for (let r2 = r1 + 1; r2 <= ACE; r2++) {
      if (all & bit(r2)) continue;
      const best = bestStraightWindow(all | bit(r1) | bit(r2));
      if (best === null || (best & holeOnly) === 0) continue;
      bdMin = Math.min(bdMin, popcount(best & holeOnly));
    }
  }
  if (bdMin === 3) return [];
  return [{ id: 'bdsd', attrs: attrsOf(bdMin === 1 ? 1 : 2) }];
}

/** Overcards: non-exclusive, every street. Pocket pairs never count. */
function overcardDraws(hole: Hole, overcards: number): Match<DrawCategory>[] {
  if (overcards === 0) return [];
  return [
    {
      id: overcards === 2 ? 'two-overcards' : 'one-overcard',
      attrs: emptyAttrs(hole.hi, overcards),
    },
  ];
}

function hasFlushIn(cards: readonly CardId[]): boolean {
  const n = new Uint8Array(4);
  for (const c of cards) if (++n[suitOf(c)]! >= 5) return true;
  return false;
}

function hasStraightIn(rankMask: number): boolean {
  return bestStraightWindow(rankMask) !== null;
}

// ── Combo draws ──────────────────────────────────────────────────────────────

const ONE_PAIR = new Set<MadeCategory>(ONE_PAIR_CATEGORIES);
const NO_MADE = new Set<MadeCategory>(NO_MADE_CATEGORIES);
const STRAIGHT_LIKE = new Set<DrawCategory>(['oesd-2', 'oesd-1', 'double-gutshot']);
const GUTSHOT = new Set<DrawCategory>(['gutshot-2', 'gutshot-1']);
const FD = new Set<DrawCategory>(['fd-2', 'fd-1']);
const BDFD = new Set<DrawCategory>(['bdfd-2', 'bdfd-1']);

function comboDrawsOf(
  made: MadeCategory,
  madeAttrs: MatchAttrs,
  draws: Match<DrawCategory>[],
  overcards: number,
): Match<ComboDrawCategory>[] {
  const fd = draws.find((d) => FD.has(d.id));
  const oesd = draws.find((d) => STRAIGHT_LIKE.has(d.id));
  const gut = draws.find((d) => GUTSHOT.has(d.id));
  const bdfd = draws.find((d) => BDFD.has(d.id));
  const bdsd = draws.find((d) => d.id === 'bdsd');
  const pair = ONE_PAIR.has(made);

  const combine = (
    id: ComboDrawCategory,
    flush: Match<DrawCategory> | undefined,
    straight: Match<DrawCategory> | undefined,
  ): Match<ComboDrawCategory> => ({
    id,
    attrs: {
      ...emptyAttrs(
        flush?.attrs.relevantRank ?? straight?.attrs.relevantRank ?? madeAttrs.relevantRank,
        overcards,
      ),
      kicker: pair ? madeAttrs.kicker : null,
      straightCardsUsed: straight?.attrs.cardsUsed ?? null,
      flushCardsUsed: flush?.attrs.cardsUsed ?? null,
      nutRank: flush?.attrs.nutRank ?? null,
      suit: flush?.attrs.suit ?? null,
      highHoleRankInSuit: flush?.attrs.highHoleRankInSuit ?? null,
    },
  });

  const out: Match<ComboDrawCategory>[] = [];
  if (fd && oesd) out.push(combine('fd-oesd', fd, oesd));
  if (fd && gut) out.push(combine('fd-gutshot', fd, gut));
  if (fd && pair) out.push(combine('fd-pair', fd, undefined));
  if (oesd && pair) out.push(combine('oesd-pair', undefined, oesd));
  if (gut && pair) out.push(combine('gutshot-pair', undefined, gut));
  if (fd && NO_MADE.has(made) && overcards >= 1) out.push(combine('fd-overcards', fd, undefined));
  if (bdsd && bdfd) out.push(combine('bdsd-bdfd', bdfd, bdsd));
  if (gut && bdfd) out.push(combine('gutshot-bdfd', bdfd, gut));
  return out;
}

// ── Entry point ──────────────────────────────────────────────────────────────

function classifyWithSpot(combo: ComboId, spot: Spot): ComboClass {
  const cards = comboCards(combo);
  const r0 = rankOf(cards[0]);
  const r1 = rankOf(cards[1]);
  const hole: Hole = {
    cards,
    hi: Math.max(r0, r1),
    lo: Math.min(r0, r1),
    rankMask: bit(r0) | bit(r1),
  };
  // Pocket pairs above the board are overpairs, never "overcards".
  const overcards = r0 === r1 ? 0 : (r0 > spot.topRank ? 1 : 0) + (r1 > spot.topRank ? 1 : 0);
  const { made, attrs: madeAttrs } = madeHand(hole, spot, overcards);

  const draws: Match<DrawCategory>[] = [];
  if (spot.board.length < 5) {
    const all = [...cards, ...spot.board];
    if (!hasFlushIn(all)) draws.push(...flushDraws(hole, spot, overcards));
    if (!hasStraightIn(hole.rankMask | spot.boardRankMask)) {
      draws.push(...straightDraws(hole, spot, overcards));
    }
  }
  draws.push(...overcardDraws(hole, overcards));
  const comboDraws = comboDrawsOf(made, madeAttrs, draws, overcards);

  const flushDraw = draws.find((d) => d.attrs.nutRank !== null);
  return {
    made,
    madeAttrs,
    draws,
    comboDraws,
    attrs: {
      kicker: madeAttrs.kicker,
      highCard: hole.hi,
      cardsUsed: madeAttrs.cardsUsed,
      nutRank: madeAttrs.nutRank ?? flushDraw?.attrs.nutRank ?? null,
      overcards,
      suit: madeAttrs.suit ?? flushDraw?.attrs.suit ?? null,
    },
  };
}

/** Classifies one combo on a 3–5 card board. The combo must not share cards with it. */
export function classify(combo: ComboId, board: readonly CardId[]): ComboClass {
  if (board.length < 3 || board.length > 5) throw new Error('board must have 3 to 5 cards');
  return classifyWithSpot(combo, makeSpot(board));
}

/** Classifies many combos on the same board (board work done once). */
export function classifyAll(
  combos: readonly ComboId[],
  board: readonly CardId[],
): Map<ComboId, ComboClass> {
  if (board.length < 3 || board.length > 5) throw new Error('board must have 3 to 5 cards');
  const spot = makeSpot(board);
  const out = new Map<ComboId, ComboClass>();
  for (const id of combos) out.set(id, classifyWithSpot(id, spot));
  return out;
}

/**
 * The match for a category (aggregates resolve to their first matching
 * member), or null when the combo is not in it.
 */
export function matchOf(cls: ComboClass, category: CategoryId): MatchAttrs | null {
  if (category === cls.made) return cls.madeAttrs;
  const draw = cls.draws.find((d) => d.id === category);
  if (draw) return draw.attrs;
  const combo = cls.comboDraws.find((d) => d.id === category);
  if (combo) return combo.attrs;
  if (category in AGGREGATE_MEMBERS) {
    for (const member of AGGREGATE_MEMBERS[category as keyof typeof AGGREGATE_MEMBERS]) {
      const m = matchOf(cls, member);
      if (m) return m;
    }
  }
  return null;
}

/** Ranks not on the board, highest first — the base for the topN modifier. */
export function offBoardRanks(board: readonly CardId[]): number[] {
  return makeSpot(board).offBoardRanksDesc;
}
