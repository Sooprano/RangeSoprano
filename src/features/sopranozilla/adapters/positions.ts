// Table positions derived from the button and the seat order (ParsedHand only
// has `seat` + `isDealer`). Pure TS.

import type { Position } from '@/types/poker';
import type { ParsedHand } from '@/utils/handHistory';

/**
 * Name → position. Only players dealt in (any preflop action, folds included)
 * count, so a seat sitting out does not shift the positions. Heads-up the
 * button posts the small blind and is called BTN. With more than 6 players the
 * extra early seats are UTG too. Null when the button is unknown.
 */
export function positionsOf(hand: ParsedHand): Map<string, Position> | null {
  const preflop = hand.streets.find((s) => s.street === 'preflop');
  const acted = new Set(preflop?.decisions.map((d) => d.actor) ?? []);
  const dealt = hand.players
    .filter((p) => acted.size === 0 || acted.has(p.name))
    .sort((a, b) => a.seat - b.seat);
  const btn = dealt.findIndex((p) => p.isDealer);
  if (btn < 0 || dealt.length < 2) return null;
  // Clockwise from the button.
  const order = [...dealt.slice(btn), ...dealt.slice(0, btn)].map((p) => p.name);
  const out = new Map<string, Position>();
  if (order.length === 2) {
    out.set(order[0]!, 'BTN');
    out.set(order[1]!, 'BB');
    return out;
  }
  out.set(order[0]!, 'BTN');
  out.set(order[1]!, 'SB');
  out.set(order[2]!, 'BB');
  // The rest, counted back from the button: CO, HJ, then UTG.
  const rest = order.slice(3);
  const fromEnd: Position[] = ['CO', 'HJ', 'UTG'];
  rest.forEach((name, i) => {
    const back = rest.length - 1 - i;
    out.set(name, fromEnd[Math.min(back, fromEnd.length - 1)]!);
  });
  return out;
}
