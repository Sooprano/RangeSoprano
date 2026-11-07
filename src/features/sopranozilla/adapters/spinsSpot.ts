// Spins preflop line (D128): from a real 3-handed or heads-up hand, what
// each of the two players in the pot did, in the terms of the spins range
// catalog (D127) — limp, check, open, raise over limp, 3-bet, shove, call —
// with sizes "to" in bb and the effective stack.
//
// Each player gets a list of WANTS in order of preference: the exact range
// first and, when the catalog has no folder for their last action, the range
// of their first one, marked approximate (the user's own reading of the spots,
// e.g. "BU opens, SB 3-bets, BU calls" → the BU's open range). The picker
// (`spinsPick.ts`) takes the first want the catalog has.

import type { Position } from '@/types/poker';
import type { ParsedHand } from '@/utils/handHistory';
import type { SpinsAction, SpinsFormat } from '../ranges/spinsCatalog';

export type SpinsWant = {
  action: SpinsAction;
  /** Raise "to" in bb, 'AI' for an all-in, null when the range has no size. */
  size: number | 'AI' | null;
  /** The range of an earlier action, used because the last one has no folder. */
  approx: boolean;
};

export type SpinsRole = {
  name: string;
  position: Position;
  /** The other player in the pot. */
  vs: Position;
  wants: SpinsWant[];
  /** Multiway (D139): the effective stack vs the player they faced, if not the line's. */
  effectiveBb?: number;
};

export type SpinsLine = {
  format: SpinsFormat;
  /** Smaller starting stack of the two players in the pot, in bb. */
  effectiveBb: number;
  /** "BU limp · BB check" (spins seat names: BU / SB / BB, HU: SB / BB). */
  description: string;
  roles: SpinsRole[];
  /** Multiway (D139): players in the pot with no range, and why. */
  skipped?: { name: string; reason: string }[];
};

/**
 * What an opponent's spins line says, kept with the saved hand so the range
 * can be picked again (another villain, another stack) without the history.
 */
export type SpinsInfo = {
  format: SpinsFormat;
  effectiveBb: number | null;
  /** "SB limp · BB check"; null when the line could not be read. */
  description: string | null;
  /** This player's seat and wants; null when the line has no part for them. */
  role: Omit<SpinsRole, 'name'> | null;
  /** Why there is no role (multiway, unknown line…). */
  reason: string | null;
};

/** The spins info of `name` in the hand (null when the hand is not a spin). */
export function spinsInfoOf(
  hand: ParsedHand,
  positions: Map<string, Position> | null,
  name: string,
): SpinsInfo | null {
  if (!positions || !isSpinsHand(hand, positions)) return null;
  const format: SpinsFormat = positions.size === 2 ? 'HU' : '3H';
  const result = detectSpinsLine(hand, positions);
  if (!result.ok) {
    return { format, effectiveBb: null, description: null, role: null, reason: result.reason };
  }
  const role = result.line.roles.find((r) => r.name === name) ?? null;
  const skipped = result.line.skipped?.find((s) => s.name === name);
  return {
    format,
    effectiveBb: role?.effectiveBb ?? result.line.effectiveBb,
    description: result.line.description,
    role: role ? { position: role.position, vs: role.vs, wants: role.wants } : null,
    reason: role ? null : (skipped?.reason ?? 'Este jugador no tiene parte en la línea preflop.'),
  };
}

export type SpinsLineResult = { ok: true; line: SpinsLine } | { ok: false; reason: string };

type Act =
  | { name: string; kind: 'limp' | 'call' | 'check' }
  | { name: string; kind: 'raise'; to: number; allin: boolean };

const round2 = (x: number) => Math.round(x * 100) / 100;

/** Seat as the user names it: BU / SB / BB 3-handed, SB / BB heads-up. */
export function spinsSeat(position: Position, format: SpinsFormat): string {
  if (position === 'BTN') return format === 'HU' ? 'SB' : 'BU';
  return position;
}

/**
 * Is this hand a spin? A tournament hand (or tournament chips, with no
 * currency) with 2 or 3 players dealt. iPoker's text export prints the chips
 * with "€", so the tournament flag decides there.
 */
export function isSpinsHand(hand: ParsedHand, positions: Map<string, Position> | null): boolean {
  const tournament = hand.tournament === true || hand.currency === '';
  return tournament && positions !== null && (positions.size === 2 || positions.size === 3);
}

export function detectSpinsLine(
  hand: ParsedHand,
  positions: Map<string, Position> | null,
): SpinsLineResult {
  if (!positions || !isSpinsHand(hand, positions)) {
    return { ok: false, reason: 'No es una mano de spins (torneo de 2 o 3 jugadores).' };
  }
  const bb = hand.bigBlind;
  if (!bb || bb <= 0) return { ok: false, reason: 'No encontré la ciega grande.' };
  const format: SpinsFormat = positions.size === 2 ? 'HU' : '3H';
  const seat = (name: string) => spinsSeat(positions.get(name)!, format);

  // Voluntary actions with the street total each one reaches ("to").
  const committed = new Map<string, number>();
  let level = 0;
  let raised = false;
  const acts: Act[] = [];
  const decisions = hand.streets.find((s) => s.street === 'preflop')?.decisions ?? [];
  for (const d of decisions) {
    if (d.isAnte) continue;
    const total = (committed.get(d.actor) ?? 0) + d.amount;
    if (d.type === 'post') {
      committed.set(d.actor, total);
      level = Math.max(level, total);
      continue;
    }
    if (d.type === 'fold') continue;
    if (d.type === 'check') {
      acts.push({ name: d.actor, kind: 'check' });
      continue;
    }
    committed.set(d.actor, total);
    if (total > level + 1e-9 && d.type !== 'call') {
      level = total;
      raised = true;
      acts.push({
        name: d.actor,
        kind: 'raise',
        to: round2(total / bb),
        allin: d.type === 'allin',
      });
    } else {
      acts.push({ name: d.actor, kind: raised ? 'call' : 'limp' });
    }
  }

  const inPot = [...new Set(acts.map((a) => a.name))];
  const stackBb = (name: string) => (hand.players.find((p) => p.name === name)?.stack ?? 0) / bb;
  const lone = acts.length === 1 ? acts[0]! : null;
  if (inPot.length < 2 && lone?.kind === 'raise') {
    // Raise first in and everyone folds: the raiser still has a range. The
    // effective stack is against the biggest stack left to act.
    const others = [...positions.keys()].filter((n) => n !== lone.name);
    const deepest = Math.max(...others.map(stackBb));
    const position = positions.get(lone.name)!;
    return {
      ok: true,
      line: {
        format,
        effectiveBb: round2(Math.min(stackBb(lone.name), deepest)),
        description: `${seat(lone.name)} ${lone.allin ? 'va all-in' : `abre a ${lone.to}bb`} · todos foldean`,
        roles: [
          {
            name: lone.name,
            position,
            // The player left to act behind: BB, or the SB when the BB raised.
            vs: position === 'BB' ? (format === 'HU' ? 'BTN' : 'SB') : 'BB',
            wants: [
              lone.allin
                ? { action: 'shove', size: 'AI', approx: false }
                : { action: 'open', size: lone.to, approx: false },
            ],
          },
        ],
      },
    };
  }
  if (inPot.length < 2) return { ok: false, reason: 'Nadie más entró en el bote.' };
  if (inPot.length > 2) return multiwayLine(acts, format, positions, seat, stackBb);
  const [first, other] = inPot as [string, string];
  const effectiveBb = round2(Math.min(stackBb(first), stackBb(other)));

  const sizeOf = (a: Act): number | 'AI' => (a.kind === 'raise' ? (a.allin ? 'AI' : a.to) : 0);
  const want = (action: SpinsAction, size: number | 'AI' | null, approx = false): SpinsWant => ({
    action,
    size,
    approx,
  });
  const pattern = acts.map((a) => a.kind).join(' ');
  const a0 = acts[0]!;
  const a1 = acts[1];
  const a2 = acts[2];
  let firstWants: SpinsWant[];
  let otherWants: SpinsWant[];
  let text: string;
  const F = seat(first);
  const O = seat(other);
  const sizeText = (a: Act | undefined) =>
    a && a.kind === 'raise' ? (a.allin ? 'all-in' : `a ${a.to}bb`) : '';

  if (pattern === 'limp check') {
    firstWants = [want('limp', null)];
    otherWants = [want('check', null)];
    text = `${F} limp · ${O} check`;
  } else if (pattern === 'limp raise' || pattern === 'limp raise call') {
    const r = sizeOf(a1!);
    firstWants =
      pattern === 'limp raise call'
        ? [want('call-rol', r), want('limp', null, true)]
        : [want('limp', null)];
    otherWants = [want('rol', r)];
    text = `${F} limp · ${O} sube ${sizeText(a1)}${a2 ? ` · ${F} paga` : ''}`;
  } else if (pattern === 'raise' || pattern === 'raise call') {
    const shove = a0.kind === 'raise' && a0.allin;
    const r = sizeOf(a0);
    firstWants = [shove ? want('shove', 'AI') : want('open', r)];
    // Calling a shove has no folder: nothing to fall back to.
    otherWants = shove ? [] : [want('call-open', r)];
    text = `${F} ${shove ? 'va all-in' : `abre ${sizeText(a0)}`}${a1 ? ` · ${O} paga` : ''}`;
  } else if (pattern === 'raise raise' || pattern === 'raise raise call') {
    const shove = a0.kind === 'raise' && a0.allin;
    // Calling the 3-bet: FISH has that range (D137); Regular falls back to the open.
    firstWants = shove
      ? [want('shove', 'AI')]
      : pattern === 'raise raise call'
        ? [want('call-3bet', sizeOf(a1!)), want('open', sizeOf(a0), true)]
        : [want('open', sizeOf(a0))];
    otherWants = [want('3bet', sizeOf(a1!))];
    text = `${F} abre ${sizeText(a0)} · ${O} 3-bet ${sizeText(a1)}${a2 ? ` · ${F} paga` : ''}`;
  } else {
    return {
      ok: false,
      reason: `Línea preflop sin rangos de spins (${acts.map((a) => `${seat(a.name)} ${a.kind}`).join(' → ')}).`,
    };
  }

  return {
    ok: true,
    line: {
      format,
      effectiveBb,
      description: text,
      roles: [
        {
          name: first,
          position: positions.get(first)!,
          vs: positions.get(other)!,
          wants: firstWants,
        },
        {
          name: other,
          position: positions.get(other)!,
          vs: positions.get(first)!,
          wants: otherWants,
        },
      ],
    },
  };
}

export const OVERCALL_REASON =
  'Paga contra dos rivales (overcall): sus rangos son de un call contra uno solo, no hay rango para este spot.';

/**
 * Three players in the pot (D139). A decision made against ONE opponent action
 * is the same as heads-up, whatever comes after: the opener's open (or the
 * first limp) and the FIRST call of the open (the SB vs the BU, with the BB
 * still to act — exactly the spot its range is for). Calling after someone
 * already called (an overcall: it plays vs two ranges) has no range, nor
 * anything after a re-raise (squeeze / ROL in a three-way pot).
 */
function multiwayLine(
  acts: Act[],
  format: SpinsFormat,
  positions: Map<string, Position>,
  seat: (name: string) => string,
  stackBb: (name: string) => number,
): SpinsLineResult {
  const raises = acts.filter((a) => a.kind === 'raise');
  const names = [...new Set(acts.map((a) => a.name))];
  const deepest = (but: string) => Math.max(...names.filter((n) => n !== but).map(stackBb));

  if (raises.length === 0) {
    // Limped three ways: only the first limper made a heads-up-like decision.
    const first = acts[0]!.name;
    const others = names.filter((n) => n !== first);
    return {
      ok: true,
      line: {
        format,
        effectiveBb: round2(Math.min(stackBb(first), deepest(first))),
        description: `${acts.map((a) => `${seat(a.name)} ${a.kind === 'check' ? 'check' : 'limp'}`).join(' · ')}`,
        roles: [
          {
            name: first,
            position: positions.get(first)!,
            vs: positions.get(others[0]!)!,
            wants: [{ action: 'limp', size: null, approx: false }],
          },
        ],
        skipped: others.map((name) => ({
          name,
          reason: 'Bote limpeado a tres: solo el primero que limpea tiene rango.',
        })),
      },
    };
  }

  const open = acts[0];
  if (raises.length > 1 || !open || open.kind !== 'raise') {
    return {
      ok: false,
      reason: 'Bote a tres con resubida (squeeze o raise sobre limp): no hay rangos para ese spot.',
    };
  }
  const callers = acts.filter((a) => a.kind === 'call').map((a) => a.name);
  const firstCaller = callers[0]!;
  const opener = open.name;
  const size: number | 'AI' = open.allin ? 'AI' : open.to;
  const sizeText = open.allin ? 'va all-in' : `abre a ${open.to}bb`;
  return {
    ok: true,
    line: {
      format,
      effectiveBb: round2(Math.min(stackBb(opener), deepest(opener))),
      description: `${seat(opener)} ${sizeText} · ${callers.map((c) => `${seat(c)} paga`).join(' · ')}`,
      roles: [
        {
          name: opener,
          position: positions.get(opener)!,
          vs: positions.get(firstCaller)!,
          wants: [
            open.allin
              ? { action: 'shove', size: 'AI', approx: false }
              : { action: 'open', size, approx: false },
          ],
        },
        {
          name: firstCaller,
          position: positions.get(firstCaller)!,
          vs: positions.get(opener)!,
          // Calling a shove has no folder (same as heads-up).
          wants: open.allin ? [] : [{ action: 'call-open', size, approx: false }],
          effectiveBb: round2(Math.min(stackBb(firstCaller), stackBb(opener))),
        },
      ],
      skipped: callers.slice(1).map((name) => ({ name, reason: OVERCALL_REASON })),
    },
  };
}
