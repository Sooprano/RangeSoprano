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
};

export type SpinsLine = {
  format: SpinsFormat;
  /** Smaller starting stack of the two players in the pot, in bb. */
  effectiveBb: number;
  /** "BU limp · BB check" (spins seat names: BU / SB / BB, HU: SB / BB). */
  description: string;
  roles: SpinsRole[];
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
  return {
    format,
    effectiveBb: result.line.effectiveBb,
    description: result.line.description,
    role: role ? { position: role.position, vs: role.vs, wants: role.wants } : null,
    reason: role ? null : 'Este jugador no tiene parte en la línea preflop.',
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
            vs: 'BB',
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
  if (inPot.length > 2)
    return { ok: false, reason: 'Bote a tres jugadores: no hay rangos para ese spot.' };
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
    firstWants = shove
      ? [want('shove', 'AI')]
      : [want('open', sizeOf(a0), pattern === 'raise raise call')];
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
