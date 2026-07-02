// Generator for the "Tipo de rango" drill (Rangos). Muestra un rango y pregunta
// su morfología (lineal / polarizado / mergeado / condensado). Requiere que el
// banco tenga variedad de formas (HAS_MORPHOLOGY_VARIETY); mientras todos sean
// lineales el drill muestra un placeholder en la UI.

import type { WeightedHand } from '@/utils/handRangeParser';
import {
  TYPE_FAMILIES,
  rangeStatsOf,
  spotsIn,
  type Morphology,
  type RangeFamily,
  type RangeSpot,
} from './rangeBank';

const TYPE_SPOTS = spotsIn(TYPE_FAMILIES);

export const ALL_MORPHOLOGIES: readonly Morphology[] = [
  'lineal',
  'polarizado',
  'mergeado',
  'condensado',
];

export type TypeQuestion = {
  spot: RangeSpot;
  hands: WeightedHand[];
  combos: number;
  pct: number;
  morphOptions: readonly Morphology[];
};

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

export function generateTypeQuestion(
  allowed?: readonly RangeFamily[],
): TypeQuestion {
  const allowSet = allowed && allowed.length > 0 ? new Set(allowed) : null;
  const pool = allowSet
    ? TYPE_SPOTS.filter((s) => allowSet.has(s.family))
    : TYPE_SPOTS;
  const spot = pick(pool.length > 0 ? pool : TYPE_SPOTS);
  const { hands, combos } = rangeStatsOf(spot.notation);
  return {
    spot,
    hands,
    combos: Math.round(combos),
    pct: spot.pct,
    morphOptions: ALL_MORPHOLOGIES,
  };
}
