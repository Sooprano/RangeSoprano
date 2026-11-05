// Cash preflop line (D138): from a real cash hand, every decision of the two
// players in the pot in the terms of the cash GTO catalog — open, call the
// open, 3-bet, call the 3-bet, 4-bet, call the 4-bet — with the size "to" in
// bb. A player's range is the one of their LAST decision (the CO who opened
// and called the 3-bet → «COvsBTN callvs3Bet»).
//
// No range (the user's rule: do not invent one): limped pots, multiway pots
// (squeeze, cold 4-bet, overcalls), 5-bets.

import type { Position } from '@/types/poker';
import type { ParsedHand } from '@/utils/handHistory';
import type { CashAction } from '../ranges/cashCatalog';

export type CashDecision = {
  name: string;
  position: Position;
  /** The other player; null for the open. */
  vs: Position | null;
  action: CashAction;
  /** Size of the bet of the spot in bb "to" (see `CashRange.size`); 'AI' = all in. */
  size: number | 'AI';
};

export type CashLine = {
  /** "CO abre 2.5bb · BTN 3-bet a 9bb · CO paga". */
  description: string;
  decisions: CashDecision[];
};

export type CashLineResult = { ok: true; line: CashLine } | { ok: false; reason: string };

/** What a cash opponent's line says, kept with the saved hand (like `SpinsInfo`). */
export type CashInfo = {
  description: string | null;
  /** This player's last decision; null when the line has none for them. */
  want: Omit<CashDecision, 'name'> | null;
  /** Why there is no want. */
  reason: string | null;
};

const round2 = (x: number) => Math.round(x * 100) / 100;

/** Cash = not a tournament and with a currency. */
export function isCashHand(hand: ParsedHand): boolean {
  return hand.tournament !== true && hand.currency !== '';
}

type Raise = { name: string; to: number; allin: boolean };

const ORDINAL = ['abre', '3-bet', '4-bet'] as const;
const FOLLOW: CashAction[] = ['open', '3bet', '4bet'];
const CALL_OF: CashAction[] = ['call-open', 'call-3bet', 'call-4bet'];

export function detectCashLine(
  hand: ParsedHand,
  positions: Map<string, Position> | null,
): CashLineResult {
  if (!positions || !isCashHand(hand)) return { ok: false, reason: 'No es una mano de cash.' };
  const bb = hand.bigBlind;
  if (!bb || bb <= 0) return { ok: false, reason: 'No encontré la ciega grande.' };

  const committed = new Map<string, number>();
  let level = 0;
  const raises: Raise[] = [];
  const voluntary = new Set<string>();
  let limped = false;
  let caller: string | null = null;
  const decisions = hand.streets.find((s) => s.street === 'preflop')?.decisions ?? [];
  for (const d of decisions) {
    if (d.isAnte) continue;
    const total = (committed.get(d.actor) ?? 0) + d.amount;
    if (d.type === 'post') {
      committed.set(d.actor, total);
      level = Math.max(level, total);
      continue;
    }
    if (d.type === 'fold' || d.type === 'check') continue;
    committed.set(d.actor, total);
    voluntary.add(d.actor);
    if (total > level + 1e-9 && d.type !== 'call') {
      level = total;
      raises.push({ name: d.actor, to: round2(total / bb), allin: d.type === 'allin' });
      caller = null;
    } else if (raises.length === 0) {
      limped = true;
    } else {
      caller = d.actor;
    }
  }

  if (limped) return { ok: false, reason: 'Bote limpeado: no hay rangos de limp.' };
  if (raises.length === 0) return { ok: false, reason: 'Nadie subió preflop.' };
  if (voluntary.size > 2) {
    return { ok: false, reason: 'Bote multiway: no hay rangos para ese spot.' };
  }
  if (raises.length > 3) return { ok: false, reason: 'Hubo 5-bet: no hay rangos para ese spot.' };
  // The raisers alternate between the two players (a 3-bet by the opener
  // himself cannot happen heads-up).
  const seat = (name: string) => positions.get(name)!;
  const players = [...voluntary];
  const other = (name: string) => players.find((p) => p !== name) ?? null;

  const out: CashDecision[] = [];
  const text: string[] = [];
  raises.forEach((r, i) => {
    const vsName = i === 0 ? null : raises[i - 1]!.name;
    const size = r.allin ? ('AI' as const) : r.to;
    out.push({
      name: r.name,
      position: seat(r.name),
      vs: vsName ? seat(vsName) : null,
      action: FOLLOW[i]!,
      size,
    });
    text.push(
      `${seat(r.name)} ${ORDINAL[i]}${i === 0 ? ' ' : ' a '}${r.allin ? 'all-in' : `${r.to}bb`}`,
    );
  });
  const last = raises[raises.length - 1]!;
  if (caller) {
    out.push({
      name: caller,
      position: seat(caller),
      vs: seat(last.name),
      action: CALL_OF[raises.length - 1]!,
      size: last.allin ? 'AI' : last.to,
    });
    text.push(`${seat(caller)} paga`);
  } else if (raises.length === 1 && !other(last.name)) {
    text.push('todos foldean');
  }
  return { ok: true, line: { description: text.join(' · '), decisions: out } };
}

/** The cash info of `name` in the hand (null when the hand is not cash). */
export function cashInfoOf(
  hand: ParsedHand,
  positions: Map<string, Position> | null,
  name: string,
): CashInfo | null {
  if (!positions || !isCashHand(hand)) return null;
  const result = detectCashLine(hand, positions);
  if (!result.ok) return { description: null, want: null, reason: result.reason };
  const mine = result.line.decisions.filter((d) => d.name === name);
  const last = mine[mine.length - 1];
  if (!last) {
    return {
      description: result.line.description,
      want: null,
      reason: 'Este jugador no tiene parte en la línea preflop.',
    };
  }
  const want = { position: last.position, vs: last.vs, action: last.action, size: last.size };
  return { description: result.line.description, want, reason: null };
}
