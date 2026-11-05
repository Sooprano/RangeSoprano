// Adapter: a hand captured in /analisis (ParsedHand) → what the analyzer
// needs. Pure TS: cards, board, pots in bb, positions, the preflop spot and
// the recorded action of every postflop street.

import type { Position } from '@/types/poker';
import type { Decision, ParsedHand, StreetData } from '@/utils/handHistory';
import { toCardId, type CardId } from '../engine/cards';
import type { AnalyzerHandInput } from '../engine/chain';
import type { Street } from '../engine/equity';
import type { RecordedAction, RecordedStreets, Response } from '../engine/recorded';
import { positionsOf } from './positions';
import { detectPreflopSpot, type PreflopSpot } from './preflopSpot';
import { spinsInfoOf, type SpinsInfo } from './spinsSpot';
import { cashInfoOf, type CashInfo } from './cashSpot';
import { tableInfoOf, type TableInfo } from './tableInfo';

/** One opponent who saw the flop: everything that changes with the villain. */
export type OpponentOption = {
  name: string;
  position: Position | null;
  recorded: RecordedStreets;
  /** Null when the spot could not be named. */
  spot: PreflopSpot | null;
  spotNote: string | null;
  /** Spins hands only (D128): the line and this player's wants. */
  spins?: SpinsInfo | null | undefined;
  /** Cash hands only (D138): the line and this player's last decision. */
  cash?: CashInfo | null | undefined;
  /** Effective stack behind (bb) at the start of each street vs Hero (D133). */
  stacks?: Partial<Record<Street, number>> | undefined;
};

export type AdaptedHand = {
  hand: AnalyzerHandInput;
  recorded: RecordedStreets;
  villainName: string;
  /** Null when the spot could not be named: the range is picked by hand. */
  spot: PreflopSpot | null;
  /** Why there is no spot, or a short text of the line ("Limp"). */
  spotNote: string | null;
  title: string;
  /** "Mano #123", to rebuild the title when the villain changes. */
  handLabel: string;
  /** Every opponent who saw the flop, in the order they act (D96). */
  opponents: OpponentOption[];
  /** Format, blinds, positions and stacks of everyone dealt in. */
  table: TableInfo;
  warnings: string[];
};

export type AdaptResult = { ok: true; value: AdaptedHand } | { ok: false; error: string };

const POSTFLOP: readonly Street[] = ['flop', 'turn', 'river'];
const AGGRESSIVE = new Set<Decision['type']>(['bet', 'raise', 'allin']);

function responseOf(d: Decision | undefined): Response | null {
  if (!d) return null;
  if (d.type === 'call') return 'call';
  if (d.type === 'fold') return 'fold';
  if (AGGRESSIVE.has(d.type)) return 'raise';
  return null;
}

/** The recorded action of one street between Hero and the villain. */
export function recordedActionOf(
  sd: StreetData,
  hero: string,
  villain: string,
): RecordedAction | null {
  const ds = sd.decisions.filter(
    (d) => (d.actor === hero || d.actor === villain) && d.type !== 'post',
  );
  if (ds.length === 0 || sd.potStart <= 0) return null;
  const first = ds.findIndex((d) => AGGRESSIVE.has(d.type));
  if (first < 0) return { mode: 'hero', kind: 'check' };
  const bet = ds[first]!;
  const pct = Math.round((bet.amount / sd.potStart) * 100);
  const other = bet.actor === hero ? villain : hero;
  const answerIdx = ds.findIndex((d, i) => i > first && d.actor === other);
  const answer = answerIdx >= 0 ? ds[answerIdx] : undefined;
  const response = responseOf(answer);
  if (bet.actor === hero) return { mode: 'hero', kind: 'bet', sizePct: pct, response };
  if (response !== 'raise' || bet.amount <= 0) return { mode: 'villain', betPct: pct, response };
  // Hero's raise total on the street = everything Hero put in up to the raise.
  const heroTotal = ds
    .slice(0, answerIdx + 1)
    .filter((d) => d.actor === hero)
    .reduce((s, d) => s + d.amount, 0);
  return {
    mode: 'villain',
    betPct: pct,
    response,
    raiseMultiple: Math.round((heroTotal / bet.amount) * 10) / 10,
  };
}

function cardIds(cards: ParsedHand['board']): CardId[] | null {
  const ids = cards.map(toCardId);
  return ids.every((c): c is CardId => c !== null) ? ids : null;
}

/**
 * Smaller of the two stacks behind (in bb) when each postflop street starts:
 * the most a re-raise all-in can put in on that street.
 */
export function stacksBehind(
  hand: ParsedHand,
  hero: string,
  villain: string,
): Partial<Record<Street, number>> {
  const bb = hand.bigBlind;
  if (!bb || bb <= 0) return {};
  const start = (name: string) => hand.players.find((p) => p.name === name)?.stack ?? 0;
  const left = new Map([
    [hero, start(hero)],
    [villain, start(villain)],
  ]);
  const out: Partial<Record<Street, number>> = {};
  for (const sd of hand.streets) {
    if (sd.street !== 'preflop') {
      const eff = Math.min(left.get(hero)!, left.get(villain)!);
      out[sd.street] = Math.max(0, Math.round((eff / bb) * 100) / 100);
    }
    for (const d of sd.decisions) {
      if (left.has(d.actor)) left.set(d.actor, left.get(d.actor)! - d.amount);
    }
  }
  return out;
}

function opponentOf(
  hand: ParsedHand,
  hero: string,
  name: string,
  positions: Map<string, Position> | null,
): OpponentOption {
  const recorded: RecordedStreets = {};
  for (const street of POSTFLOP) {
    const sd = hand.streets.find((s) => s.street === street);
    if (!sd) continue;
    const rec = recordedActionOf(sd, hero, name);
    if (rec) recorded[street] = rec;
  }
  const spot = detectPreflopSpot(hand, hero, name, positions);
  return {
    name,
    position: positions?.get(name) ?? null,
    recorded,
    spot: spot.ok ? spot.spot : null,
    spotNote: spot.ok ? null : spot.reason,
    spins: spinsInfoOf(hand, positions, name),
    cash: cashInfoOf(hand, positions, name),
    stacks: stacksBehind(hand, hero, name),
  };
}

/** "Mano #1 · Hero BTN vs BB". */
export function handTitle(
  handLabel: string,
  heroPosition: Position | undefined,
  villain: { name: string; position: Position | null },
): string {
  const vs = villain.position
    ? `${heroPosition ?? '?'} vs ${villain.position}`
    : `vs ${villain.name}`;
  return `${handLabel} · Hero ${vs}`;
}

/**
 * `villainName` picks the rival in a multiway pot; by default (or if that
 * name did not see the flop) it is the first opponent to act on the flop.
 */
export function fromParsedHand(hand: ParsedHand, villainName?: string): AdaptResult {
  const hero = hand.hero;
  if (!hero) return { ok: false, error: 'La mano no dice quién es Hero.' };
  const heroCards = cardIds(hand.heroCards);
  if (!heroCards || heroCards.length !== 2) {
    return { ok: false, error: 'Faltan las cartas de Hero.' };
  }
  const board = cardIds(hand.board);
  if (!board || board.length < 3) {
    return { ok: false, error: 'La mano no llegó al flop: no hay nada que analizar.' };
  }
  const flop = hand.streets.find((s) => s.street === 'flop');
  const names = [
    ...new Set(
      (flop?.decisions ?? []).filter((d) => d.actor !== hero && d.type !== 'post').map((d) => d.actor),
    ),
  ];
  if (names.length === 0) {
    return { ok: false, error: 'No encontré al villano en el flop.' };
  }
  const positions = positionsOf(hand);
  const opponents = names.map((n) => opponentOf(hand, hero, n, positions));
  const villain = opponents.find((o) => o.name === villainName) ?? opponents[0]!;
  const heroPosition: Position | undefined = positions?.get(hero);

  const warnings: string[] = [];
  const bb = hand.bigBlind;
  const pots: Partial<Record<Street, number>> = {};
  for (const street of POSTFLOP) {
    const sd = hand.streets.find((s) => s.street === street);
    if (sd && bb && bb > 0) pots[street] = Math.round((sd.potStart / bb) * 100) / 100;
  }
  if (!bb) warnings.push('La mano no trae la ciega grande: la EV se muestra solo en % del bote.');

  const handLabel = hand.gameId ? `Mano #${hand.gameId}` : 'Mano';
  return {
    ok: true,
    value: {
      hand: {
        hero: [heroCards[0]!, heroCards[1]!],
        board: board.slice(0, 5),
        pots,
        stacks: villain.stacks,
        heroPosition,
        villainPosition: villain.position ?? undefined,
      },
      recorded: villain.recorded,
      villainName: villain.name,
      spot: villain.spot,
      spotNote: villain.spotNote,
      title: handTitle(handLabel, heroPosition, villain),
      handLabel,
      opponents,
      table: tableInfoOf(hand, hero, villain.name, positions),
      warnings,
    },
  };
}
