import { describe, expect, it } from 'vitest';
import { SAMPLE_RANGES } from '@/data/sampleRanges';
import { parseHandHistory, type ParsedHand } from '@/utils/handHistory';
import { formatCards } from '../../engine/cards';
import { parseRangeText } from '../../engine/rangeText';
import { fromParsedHand } from '../fromParsedHand';
import { repickSaved, savedHandFromParsed } from '../openHand';
import { parseSavedHand } from '../../store/lastHand';
import { positionsOf } from '../positions';
import { tableInfoOf } from '../tableInfo';
import { detectPreflopSpot } from '../preflopSpot';
import { findVillainRange } from '../villainRange';

const SEATS = `Seat 1: UTGp ($10.00 in chips)
Seat 2: HJp ($10.00 in chips)
Seat 3: COp ($10.00 in chips)
Seat 4: Hero ($10.00 in chips)
Seat 5: SBp ($10.00 in chips)
Seat 6: BBp ($10.00 in chips)`;

function gg(preflop: string, postflop = ''): ParsedHand {
  const text = `Poker Hand #RC1234567: Hold'em No Limit ($0.05/$0.10) - 2026/10/01 12:00:00
Table 'RushAndCash123' 6-max Seat #4 is the button
${SEATS}
SBp: posts small blind $0.05
BBp: posts big blind $0.10
*** HOLE CARDS ***
Dealt to Hero [As Ks]
${preflop}
${postflop}`;
  const { hand } = parseHandHistory(text);
  if (!hand) throw new Error('hand did not parse');
  return hand;
}

// BTN (Hero) opens, BB calls. Flop: BB checks, Hero bets 33%, BB calls.
// Turn: BB bets ~50%, Hero raises to 4x, BB calls. River: check, check.
const BTN_VS_BB = gg(
  `UTGp: folds
HJp: folds
COp: folds
Hero: raises $0.15 to $0.25
SBp: folds
BBp: calls $0.15`,
  `*** FLOP *** [Kh 9h 4c]
BBp: checks
Hero: bets $0.18
BBp: calls $0.18
*** TURN *** [Kh 9h 4c] [7s]
BBp: bets $0.45
Hero: raises $1.35 to $1.80
BBp: calls $1.35
*** RIVER *** [Kh 9h 4c 7s] [2d]
BBp: checks
Hero: checks`,
);

describe('positions', () => {
  it('derives them from the button and the seat order', () => {
    const pos = positionsOf(BTN_VS_BB)!;
    expect(Object.fromEntries(pos)).toEqual({
      Hero: 'BTN',
      SBp: 'SB',
      BBp: 'BB',
      UTGp: 'UTG',
      HJp: 'HJ',
      COp: 'CO',
    });
  });
});

describe('fromParsedHand', () => {
  it('cards, pots in bb, positions and the recorded action of every street', () => {
    const r = fromParsedHand(BTN_VS_BB);
    if (!r.ok) throw new Error(r.error);
    const a = r.value;
    expect(formatCards(a.hand.hero)).toBe('AsKs');
    expect(formatCards(a.hand.board)).toBe('Kh9h4c7s2d');
    expect(a.hand.pots).toEqual({ flop: 5.5, turn: 9.1, river: 45.1 });
    expect(a.hand.heroPosition).toBe('BTN');
    expect(a.hand.villainPosition).toBe('BB');
    expect(a.villainName).toBe('BBp');
    expect(a.recorded.flop).toEqual({ mode: 'hero', kind: 'bet', sizePct: 33, response: 'call' });
    expect(a.recorded.turn).toEqual({
      mode: 'villain',
      betPct: 49,
      response: 'raise',
      raiseMultiple: 4,
    });
    expect(a.recorded.river).toEqual({ mode: 'hero', kind: 'check' });
    expect(a.spot?.description).toBe('Hero (BTN) abre · BB paga');
    expect(a.warnings).toEqual([]);
  });

  it("a check-raise is recorded as the villain raising Hero's bet", () => {
    const hand = gg(
      `UTGp: folds
HJp: folds
COp: folds
Hero: raises $0.15 to $0.25
SBp: folds
BBp: calls $0.15`,
      `*** FLOP *** [Kh 9h 4c]
BBp: checks
Hero: bets $0.41
BBp: raises $0.82 to $1.23
Hero: folds`,
    );
    const r = fromParsedHand(hand);
    if (!r.ok) throw new Error(r.error);
    expect(r.value.recorded.flop).toEqual({
      mode: 'hero',
      kind: 'bet',
      sizePct: 75,
      response: 'raise',
    });
  });

  it('a hand that ends preflop cannot be analyzed', () => {
    const r = fromParsedHand(
      gg(
        'UTGp: folds\nHJp: folds\nCOp: folds\nHero: raises $0.15 to $0.25\nSBp: folds\nBBp: folds',
      ),
    );
    expect(r.ok).toBe(false);
  });
});

describe('preflop spot + library', () => {
  const spotOf = (hand: ParsedHand, villain: string) =>
    detectPreflopSpot(hand, 'Hero', villain, positionsOf(hand));

  it('Hero opens, BB calls → "BB call vs BTN"', () => {
    const s = spotOf(BTN_VS_BB, 'BBp');
    if (!s.ok) throw new Error(s.reason);
    expect(s.spot).toMatchObject({
      heroPosition: 'BTN',
      villainPosition: 'BB',
      villainAction: 'call',
    });
    expect(findVillainRange(s.spot, [], SAMPLE_RANGES)?.range.name).toBe('BB call vs BTN');
  });

  it("the villain opens and Hero calls → the villain's RFI", () => {
    const hand = gg(`UTGp: folds
HJp: folds
COp: raises $0.15 to $0.25
Hero: calls $0.25
SBp: folds
BBp: folds`);
    const s = spotOf(hand, 'COp');
    if (!s.ok) throw new Error(s.reason);
    expect(s.spot.villainAction).toBe('open');
    expect(s.spot.description).toBe('CO abre · Hero (BTN) paga');
    const pick = findVillainRange(s.spot, [], SAMPLE_RANGES)!;
    expect(pick.range.situation).toBe('RFI');
    expect(pick.range.position).toBe('CO');
    expect(pick.source).toBe('gto');
  });

  it("Hero opens and the villain 3-bets → the villain's 3-bet range", () => {
    const hand = gg(
      `UTGp: folds
HJp: folds
COp: folds
Hero: raises $0.15 to $0.25
SBp: folds
BBp: raises $0.75 to $0.85
Hero: calls $0.60`,
    );
    const s = spotOf(hand, 'BBp');
    if (!s.ok) throw new Error(s.reason);
    expect(s.spot).toMatchObject({
      heroPosition: 'BTN',
      villainPosition: 'BB',
      villainAction: '3bet',
    });
    expect(findVillainRange(s.spot, [], SAMPLE_RANGES)?.range.id).toBe('demo-gto3b-bb-vs-btn');
  });

  it('GTO first by default; "Mis rangos" first when chosen; the other as fallback', () => {
    const s = spotOf(BTN_VS_BB, 'BBp');
    if (!s.ok) throw new Error(s.reason);
    const gtoCall = SAMPLE_RANGES.find((r) => r.name === 'BB call vs BTN')!;
    const mine = { ...gtoCall, id: 'mine-1', name: 'Mi defensa BB' };
    expect(findVillainRange(s.spot, [mine], SAMPLE_RANGES)!.source).toBe('gto');
    const pick = findVillainRange(s.spot, [mine], SAMPLE_RANGES, 'mine')!;
    expect(pick.source).toBe('mine');
    expect(pick.range.name).toBe('Mi defensa BB');
    expect(findVillainRange(s.spot, [], SAMPLE_RANGES, 'mine')!.source).toBe('gto');
    expect(findVillainRange(s.spot, [mine], [], 'gto')!.source).toBe('mine');
  });

  it('among ranges that fit, the table format wins, then the closest stack', () => {
    const s = spotOf(BTN_VS_BB, 'BBp');
    if (!s.ok) throw new Error(s.reason);
    const base = SAMPLE_RANGES.find((r) => r.name === 'BB call vs BTN')!;
    const fmt6 = '6max' as const;
    const r100 = { ...base, id: 'a', tableFormat: fmt6, printLabels: { stack: '100' } };
    // Stack from the name when the Editor field is empty ("… 25bb").
    const r25 = { ...base, id: 'b', name: 'BB call 25bb', tableFormat: fmt6, printLabels: {} };
    const hu = { ...base, id: 'c', tableFormat: 'HU' as const, printLabels: { stack: '24' } };
    const list = [r100, r25, hu];
    const ctx6 = { format: '6max' as const, effectiveBb: 23 };
    expect(findVillainRange(s.spot, list, [], 'mine', ctx6)!.range.id).toBe('b');
    const ctxHu = { format: 'HU' as const, effectiveBb: 90 };
    expect(findVillainRange(s.spot, list, [], 'mine', ctxHu)!.range.id).toBe('c');
    // Without context, the first one in the list.
    expect(findVillainRange(s.spot, list, [], 'mine')!.range.id).toBe('a');
  });

  it('a limped pot has no spot: the range is picked by hand', () => {
    const hand = gg(`UTGp: folds
HJp: folds
COp: folds
Hero: calls $0.10
SBp: folds
BBp: checks`);
    expect(spotOf(hand, 'BBp').ok).toBe(false);
  });
});

describe('savedHandFromParsed', () => {
  it('brings the library range as text, ready to load', () => {
    const r = savedHandFromParsed(BTN_VS_BB, [], SAMPLE_RANGES);
    if (!r.ok) throw new Error(r.error);
    expect(r.saved.meta?.rangeLabel).toBe('BB call vs BTN · Rangos GTO');
    expect(r.saved.meta?.rangeMissing).toBeNull();
    expect(parseRangeText(r.saved.range).classes).toBeGreaterThan(50);
  });

  it('without a match, the range is empty and says why', () => {
    const hand = gg(
      `UTGp: folds
HJp: folds
COp: folds
Hero: calls $0.10
SBp: folds
BBp: checks`,
      `*** FLOP *** [Kh 9h 4c]
BBp: checks
Hero: checks`,
    );
    const r = savedHandFromParsed(hand, [], SAMPLE_RANGES);
    if (!r.ok) throw new Error(r.error);
    expect(r.saved.range).toBe('');
    expect(r.saved.meta?.rangeMissing).toMatch(/limpeado/);
  });
});

describe('table info', () => {
  it('6-max: format, blinds, effective stack and seats in action order', () => {
    const r = fromParsedHand(BTN_VS_BB);
    if (!r.ok) throw new Error(r.error);
    const t = r.value.table;
    expect(t.format).toBe('6-max');
    expect(t.blinds).toBe('$0.05/$0.10');
    expect(t.effectiveBb).toBe(100);
    expect(t.seats.map((s) => s.position)).toEqual(['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB']);
    expect(t.seats.find((s) => s.role === 'hero')?.name).toBe('Hero');
    expect(t.seats.find((s) => s.role === 'villain')?.name).toBe('BBp');
    expect(t.seats.filter((s) => s.inFlop).map((s) => s.position)).toEqual(['BTN', 'BB']);
  });

  it('heads-up: HU, and the effective stack is the shorter one', () => {
    const { hand } =
      parseHandHistory(`Poker Hand #HU1: Hold'em No Limit ($0.50/$1.00) - 2026/10/01 12:00:00
Table 'Duel' 2-max Seat #1 is the button
Seat 1: Hero ($12.00 in chips)
Seat 2: Vil ($85.50 in chips)
Hero: posts small blind $0.50
Vil: posts big blind $1.00
*** HOLE CARDS ***
Dealt to Hero [As Ks]
Hero: raises $1.50 to $2.00
Vil: calls $1.00
*** FLOP *** [Kh 9h 4c]
Vil: checks
Hero: checks`);
    const r = fromParsedHand(hand!);
    if (!r.ok) throw new Error(r.error);
    const t = r.value.table;
    expect(hand!.maxSeats).toBe(2);
    expect(t.format).toBe('HU');
    expect(t.effectiveBb).toBe(12);
    expect(t.seats.map((s) => [s.position, s.stackBb])).toEqual([
      ['BTN', 12],
      ['BB', 85.5],
    ]);
  });

  it('a 6-max table with fewer players says how many were dealt in', () => {
    const hand = { ...BTN_VS_BB, players: BTN_VS_BB.players.filter((p) => p.name !== 'UTGp') };
    hand.streets = hand.streets.map((s) =>
      s.street === 'preflop'
        ? { ...s, decisions: s.decisions.filter((d) => d.actor !== 'UTGp') }
        : s,
    );
    expect(tableInfoOf(hand, 'Hero', 'BBp', positionsOf(hand)).format).toBe('6-max · 5 jugadores');
  });

  it('travels in the saved hand', () => {
    const r = savedHandFromParsed(BTN_VS_BB, [], SAMPLE_RANGES);
    if (!r.ok) throw new Error(r.error);
    expect(r.saved.meta?.table?.format).toBe('6-max');
  });
});

// The 3-way hand from the browser test ("Table Info" format): Hero opens on the BTN, SB and
// BB call; on the river the SB bets and both fold.
const THREE_WAY =
  parseHandHistory(`GAME #12614693534 Version:26.7.1.28 Uncalled:Y Texas Hold'em NL  Tournament 2026-10-31 20:35:01/GMT
Table Info: Size: 3, Blinds: 10/20
Seat 3: mousefourth92 (€500.00 in chips)
Seat 6: n1dimka (€500.00 in chips)
Seat 10: Balans3 (€500.00 in chips)  DEALER
mousefourth92: Post SB €10.00
n1dimka: Post BB €20.00
*** HOLE CARDS ***
Dealt to Balans3 [C9 D10]
Balans3: Raise (NF) €40.00
mousefourth92: Call €30.00
n1dimka: Call €20.00
*** FLOP *** [SQ S9 H6]
mousefourth92: Check
n1dimka: Check
Balans3: Bet €60.00
mousefourth92: Call €60.00
n1dimka: Call €60.00
*** TURN *** [DA]
mousefourth92: Check
n1dimka: Check
Balans3: Check
*** RIVER *** [SK]
mousefourth92: Bet €150.00
n1dimka: Fold
Balans3: Fold`).hand!;
// The same hand read as cash: these tests are about the library pick (D96).
// As the 3-handed tournament it is, it is a spin (D128) and a 3-way pot has
// no spins ranges.
const THREE_WAY_CASH: typeof THREE_WAY = { ...THREE_WAY, tournament: false };

describe('multiway (D96)', () => {
  it('keeps every flop opponent with its own spot; the first to act is the default', () => {
    const r = fromParsedHand(THREE_WAY);
    if (!r.ok) throw new Error(r.error);
    expect(r.value.villainName).toBe('mousefourth92');
    expect(r.value.opponents.map((o) => [o.name, o.position, o.spot?.villainAction])).toEqual([
      ['mousefourth92', 'SB', 'call'],
      ['n1dimka', 'BB', 'call'],
    ]);
    expect(r.value.opponents[1]!.spot?.description).toBe('Hero (BTN) abre · BB paga');
    // This format says the table size on "Table Info: Size: 3".
    expect(r.value.table.format).toBe('3-max');
  });

  it('the BB as villain loads «BB call vs BTN» from the GTO ranges', () => {
    const r = savedHandFromParsed(THREE_WAY_CASH, [], SAMPLE_RANGES, { villain: 'n1dimka' });
    if (!r.ok) throw new Error(r.error);
    expect(r.saved.villainPosition).toBe('BB');
    expect(r.saved.meta?.rangeLabel).toBe('BB call vs BTN · Rangos GTO');
    expect(r.saved.meta?.title).toBe('Mano #12614693534 · Hero BTN vs BB');
    expect(r.saved.meta?.table?.seats.find((s) => s.role === 'villain')?.name).toBe('n1dimka');
  });

  it('switching villain or library later needs only the saved hand', () => {
    const first = savedHandFromParsed(THREE_WAY_CASH, [], SAMPLE_RANGES);
    if (!first.ok) throw new Error(first.error);
    expect(first.saved.meta?.villainName).toBe('mousefourth92');
    const back = parseSavedHand(JSON.parse(JSON.stringify(first.saved)))!;
    expect(back).not.toBeNull();
    const bb = repickSaved(back, { villain: 'n1dimka' }, [], SAMPLE_RANGES)!;
    expect(bb.villainPosition).toBe('BB');
    expect(bb.meta?.rangeLabel).toBe('BB call vs BTN · Rangos GTO');
    expect(bb.recorded).toEqual(first.saved.meta?.opponents?.[1]?.recorded);
    expect(bb.meta?.table?.seats.filter((s) => s.role === 'villain').map((s) => s.name)).toEqual([
      'n1dimka',
    ]);
    const gtoCall = SAMPLE_RANGES.find((r) => r.name === 'BB call vs BTN')!;
    const mine = [{ ...gtoCall, id: 'x', name: 'Mi BB' }];
    expect(repickSaved(bb, { prefer: 'mine' }, mine, SAMPLE_RANGES)!.meta?.rangeLabel).toBe(
      'Mi BB · Mis rangos',
    );
    expect(repickSaved(bb, { villain: 'nobody' }, [], SAMPLE_RANGES)).toBeNull();
  });

  it("a squeeze by a third player is not read as the villain's 3-bet", () => {
    const hand = gg(
      `UTGp: folds
HJp: folds
COp: raises $0.15 to $0.25
Hero: calls $0.25
SBp: raises $0.85 to $1.10
BBp: folds
COp: calls $0.85
Hero: calls $0.85`,
      `*** FLOP *** [Kh 9h 4c]
SBp: checks
COp: checks
Hero: checks`,
    );
    const r = fromParsedHand(hand, 'COp');
    if (!r.ok) throw new Error(r.error);
    expect(r.value.spot).toBeNull();
    expect(r.value.spotNote).toMatch(/3-bet/);
  });
});

describe('a 3-way pot in a spin (D128)', () => {
  it('asks for a spins range instead of using the cash library', () => {
    const r = savedHandFromParsed(THREE_WAY, [], SAMPLE_RANGES, { spins: [] });
    if (!r.ok) throw new Error(r.error);
    expect(r.saved.meta?.rangeLabel).toBeNull();
    expect(r.saved.meta?.rangeMissing).toMatch(/tres jugadores/);
  });
});
