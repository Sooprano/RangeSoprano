// Preflop spot from the recorded action sequence (D3): who opened, who
// 3-bet, who called. Only the heads-up lines the library can answer are
// named; everything else falls back to the manual range picker. In a
// multiway pot it is read between Hero and the chosen villain: a third player
// who only called is ignored (D96).

import type { Position } from '@/types/poker';
import type { ParsedHand } from '@/utils/handHistory';

/** What the villain did preflop (the range we need for them). */
export type VillainPreflopAction = 'open' | 'call' | '3bet' | 'call-3bet';

export type PreflopSpot = {
  heroPosition: Position;
  villainPosition: Position;
  villainAction: VillainPreflopAction;
  /** "BTN abre · BB paga". */
  description: string;
};

const AGGRESSIVE = new Set(['raise', 'bet', 'allin']);

export type SpotResult =
  | { ok: true; spot: PreflopSpot }
  | { ok: false; reason: string; description: string | null };

export function detectPreflopSpot(
  hand: ParsedHand,
  hero: string,
  villain: string,
  positions: Map<string, Position> | null,
): SpotResult {
  const heroPos = positions?.get(hero);
  const villainPos = positions?.get(villain);
  if (!heroPos || !villainPos) {
    return {
      ok: false,
      reason: 'No pude saber las posiciones (falta el botón en la mano).',
      description: null,
    };
  }
  const name = (who: string) => (who === hero ? `Hero (${heroPos})` : villainPos);
  const decisions = hand.streets.find((s) => s.street === 'preflop')?.decisions ?? [];
  const raises = decisions.filter((d) => AGGRESSIVE.has(d.type));
  const make = (villainAction: VillainPreflopAction, description: string): SpotResult => ({
    ok: true,
    spot: { heroPosition: heroPos, villainPosition: villainPos, villainAction, description },
  });

  if (raises.length === 0) {
    return { ok: false, reason: 'Bote limpeado: no hay rangos de limp en la biblioteca.', description: 'Limp' };
  }
  const opener = raises[0]!.actor;
  if (opener !== hero && opener !== villain) {
    return {
      ok: false,
      reason: 'Abrió un tercer jugador: este spot no está en la biblioteca.',
      description: null,
    };
  }
  if (raises.length === 1) {
    return opener === hero
      ? make('call', `${name(hero)} abre · ${villainPos} paga`)
      : make('open', `${villainPos} abre · ${name(hero)} paga`);
  }
  if (raises.length === 2 && raises[1]!.actor !== hero && raises[1]!.actor !== villain) {
    // Multiway: someone else 3-bet (a squeeze). Not a line the library names.
    return {
      ok: false,
      reason: 'Otro jugador hizo 3-bet: este spot no está en la biblioteca.',
      description: null,
    };
  }
  if (raises.length === 2 && raises[1]!.actor !== opener) {
    return opener === hero
      ? make('3bet', `${name(hero)} abre · ${villainPos} hace 3-bet · Hero paga`)
      : make('call-3bet', `${villainPos} abre · ${name(hero)} hace 3-bet · ${villainPos} paga`);
  }
  return {
    ok: false,
    reason: 'Bote de 4-bet o más: este spot no está en la biblioteca.',
    description: null,
  };
}
