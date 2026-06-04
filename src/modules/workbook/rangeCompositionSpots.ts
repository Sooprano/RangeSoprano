// Generator for the "Composición + tipo" drill (drill B of the "Rangos" group).
// Dos tipos de pregunta:
//   compose: dado un % + posición, ¿con qué rango (notación) se compone?
//   type:    dado un rango mostrado, ¿qué morfología tiene?
// El % del prompt se deriva (rangeStatsOf) y siempre coincide con la notación.

import type { WeightedHand } from '@/utils/handRangeParser';
import {
  RANGE_BANK,
  rangeStatsOf,
  type Morphology,
  type RangeSpot,
} from './rangeBank';

export type CompositionKind = 'compose' | 'type';

export const ALL_MORPHOLOGIES: readonly Morphology[] = [
  'lineal',
  'polarizado',
  'mergeado',
  'condensado',
];

export type CompositionQuestion = {
  spot: RangeSpot;
  hands: WeightedHand[];
  combos: number;
  pct: number;
  kind: CompositionKind;
  /** compose: 4 notaciones (una es la correcta). */
  notationOptions: string[];
  /** type: las 4 morfologías (orden fijo). */
  morphOptions: readonly Morphology[];
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

/** 3 distractores = los rangos del banco con %-form más cercano (≠ notación). */
function composeOptions(spot: RangeSpot, correctPct: number): string[] {
  const others = RANGE_BANK.filter(
    (s) => s.id !== spot.id && s.notation !== spot.notation,
  ).map((s) => ({ s, pct: rangeStatsOf(s.notation).pctRounded }));

  // Más cercano en % primero; a igualdad, preferir otra morfología.
  others.sort((a, b) => {
    const da = Math.abs(a.pct - correctPct);
    const db = Math.abs(b.pct - correctPct);
    if (da !== db) return da - db;
    const am = a.s.morphology === spot.morphology ? 1 : 0;
    const bm = b.s.morphology === spot.morphology ? 1 : 0;
    return am - bm;
  });

  const chosen: string[] = [];
  const seen = new Set<string>([spot.notation]);
  for (const { s } of others) {
    if (chosen.length >= 3) break;
    if (seen.has(s.notation)) continue;
    chosen.push(s.notation);
    seen.add(s.notation);
  }
  return shuffle([spot.notation, ...chosen]);
}

export function generateCompositionQuestion(): CompositionQuestion {
  const spot = pick(RANGE_BANK);
  const { hands, combos, pctRounded } = rangeStatsOf(spot.notation);
  const kind: CompositionKind = Math.random() < 0.5 ? 'compose' : 'type';

  return {
    spot,
    hands,
    combos: Math.round(combos),
    pct: pctRounded,
    kind,
    notationOptions: kind === 'compose' ? composeOptions(spot, pctRounded) : [],
    morphOptions: ALL_MORPHOLOGIES,
  };
}
