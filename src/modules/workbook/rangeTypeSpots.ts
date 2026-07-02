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

export function generateTypeQuestion(): TypeQuestion {
  const spot = pick(TYPE_SPOTS);
  const { hands, combos } = rangeStatsOf(spot.notation);
  return {
    spot,
    hands,
    combos: Math.round(combos),
    pct: spot.pct,
    morphOptions: ALL_MORPHOLOGIES,
  };
}
