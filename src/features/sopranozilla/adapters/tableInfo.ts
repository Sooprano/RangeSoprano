// The table of a real hand, for the header: format (HU / 6-max…), blinds and
// every player dealt in with position and starting stack. Stacks and
// positions are what decide which preflop range fits the villain. Pure TS.

import { POSITIONS, type Position } from '@/types/poker';
import type { ParsedHand } from '@/utils/handHistory';

export type SeatRole = 'hero' | 'villain' | null;

export type TableSeat = {
  name: string;
  position: Position | null;
  /** Starting stack in the hand's currency. */
  stack: number;
  /** Starting stack in big blinds (2 decimals), null without a big blind. */
  stackBb: number | null;
  role: SeatRole;
  /** Saw the flop. */
  inFlop: boolean;
};

export type TableInfo = {
  /** "HU", "6-max", "6-max · 5 jugadores" or "4 jugadores". */
  format: string;
  /** "$0.05/$0.10", null when the hand does not say. */
  blinds: string | null;
  currency: string;
  /** In preflop action order (UTG … BB); unknown positions go last. */
  seats: TableSeat[];
  /** Smaller of Hero's and the villain's starting stacks, in bb (null without bb). */
  effectiveBb: number | null;
  /** Same, in the hand's currency. */
  effective: number | null;
};

const round2 = (x: number) => Math.round(x * 100) / 100;

/** Cash amounts with cents ("$0.10"); chips as they are ("50/100"). */
function money(x: number, currency: string): string {
  return currency ? `${currency}${x.toFixed(2)}` : `${round2(x)}`;
}

export function tableInfoOf(
  hand: ParsedHand,
  hero: string,
  villain: string,
  positions: Map<string, Position> | null,
): TableInfo {
  const preflop = hand.streets.find((s) => s.street === 'preflop');
  const flop = hand.streets.find((s) => s.street === 'flop');
  const acted = new Set(preflop?.decisions.map((d) => d.actor) ?? []);
  const sawFlop = new Set(flop?.decisions.map((d) => d.actor) ?? []);
  sawFlop.add(hero).add(villain);
  const bb = hand.bigBlind && hand.bigBlind > 0 ? hand.bigBlind : null;

  const order = (p: Position | null) => (p ? POSITIONS.indexOf(p) : POSITIONS.length);
  const seats: TableSeat[] = hand.players
    .filter((p) => acted.size === 0 || acted.has(p.name))
    .map((p): TableSeat => ({
      name: p.name,
      position: positions?.get(p.name) ?? null,
      stack: p.stack,
      stackBb: bb ? round2(p.stack / bb) : null,
      role: p.name === hero ? 'hero' : p.name === villain ? 'villain' : null,
      inFlop: sawFlop.has(p.name),
    }))
    .sort((a, b) => order(a.position) - order(b.position));

  const dealt = seats.length;
  const format =
    dealt === 2 || hand.maxSeats === 2
      ? 'HU'
      : hand.maxSeats
        ? `${hand.maxSeats}-max${dealt < hand.maxSeats ? ` · ${dealt} jugadores` : ''}`
        : `${dealt} jugadores`;

  const h = seats.find((s) => s.role === 'hero');
  const v = seats.find((s) => s.role === 'villain');
  const effective = h && v && h.stack > 0 && v.stack > 0 ? Math.min(h.stack, v.stack) : null;

  return {
    format,
    blinds:
      hand.smallBlind !== null && hand.bigBlind !== null
        ? `${money(hand.smallBlind, hand.currency)}/${money(hand.bigBlind, hand.currency)}`
        : null,
    currency: hand.currency,
    seats,
    effectiveBb: effective !== null && bb ? round2(effective / bb) : null,
    effective: effective !== null ? round2(effective) : null,
  };
}
