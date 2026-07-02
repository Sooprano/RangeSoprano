// Generator for the "Composición" drill (Rangos). Compose: dada una cifra/spot,
// ¿con qué rango se compone? Muestra 4 mini-charts. Familias:
//   · linear-3bet → "3-betea X% lineal, ¿cuál es su rango?" (dimensionar el HUD).
//   · gto-3bet    → "3bet de {pos} {vs} de un reg, ¿cuál es?" (reg vs reg, GTO).
// Elige familia uniformemente (para exponer ambas por igual) y distractores de la
// MISMA familia.

import type { WeightedHand } from '@/utils/handRangeParser';
import {
  COMPOSE_FAMILIES,
  rangeStatsOf,
  spotsIn,
  type RangeFamily,
  type RangeSpot,
} from './rangeBank';

export type ComposeQuestion = {
  spot: RangeSpot;
  hands: WeightedHand[];
  combos: number;
  pct: number;
  /** 4 notaciones (una es la correcta = spot.notation). */
  notationOptions: string[];
};

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}
function shuffle<T>(arr: readonly T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * linear-3bet: distractores = otros lineales de % distinto, cercanos pero con
 * separación mínima para que los 4 mini-charts se distingan (entrena dimensionar).
 */
function linearComposeOptions(spot: RangeSpot): string[] {
  const others = spotsIn(['linear-3bet'])
    .filter((s) => s.id !== spot.id && s.pct !== spot.pct)
    .map((s) => ({ s, d: Math.abs(s.pct - spot.pct) }))
    .sort((a, b) => a.d - b.d);

  const chosen: RangeSpot[] = [];
  const usedPct = new Set<number>([spot.pct]);
  const addWithGap = (minGap: number) => {
    for (const { s } of others) {
      if (chosen.length >= 3) break;
      if (usedPct.has(s.pct)) continue;
      if ([...usedPct].some((p) => Math.abs(p - s.pct) < minGap)) continue;
      chosen.push(s);
      usedPct.add(s.pct);
    }
  };
  addWithGap(2);
  addWithGap(1); // fallback si el banco no alcanzó

  return shuffle([spot.notation, ...chosen.map((s) => s.notation)]);
}

/** gto-3bet / open: distractores = otros rangos de la MISMA familia (otras posiciones). */
function sameFamilyOptions(spot: RangeSpot): string[] {
  const others = spotsIn([spot.family]).filter((s) => s.id !== spot.id);
  const chosen = shuffle(others).slice(0, 3);
  return shuffle([spot.notation, ...chosen.map((s) => s.notation)]);
}

function composeOptions(spot: RangeSpot): string[] {
  return spot.family === 'linear-3bet'
    ? linearComposeOptions(spot)
    : sameFamilyOptions(spot);
}

/** Familias con spots que además están permitidas por el filtro del usuario. */
function pickFamily(allowed?: readonly RangeFamily[]): RangeFamily {
  const allowSet = allowed && allowed.length > 0 ? new Set(allowed) : null;
  const available = COMPOSE_FAMILIES.filter(
    (f) => spotsIn([f]).length > 0 && (!allowSet || allowSet.has(f)),
  );
  return pick(available.length > 0 ? available : COMPOSE_FAMILIES);
}

export function generateComposeQuestion(
  allowed?: readonly RangeFamily[],
): ComposeQuestion {
  const spot = pick(spotsIn([pickFamily(allowed)]));
  const { hands, combos } = rangeStatsOf(spot.notation);
  return {
    spot,
    hands,
    combos: Math.round(combos),
    pct: spot.pct,
    notationOptions: composeOptions(spot),
  };
}
