// Generator for the "% y combos" drill (drill A of the "Rangos" group, phase 47).
// Muestra un rango del banco y pregunta su %-form O sus combos. La respuesta se
// deriva de la notación (rangeStatsOf) — single source of truth.

import { categoryOf, combosOf, TOTAL_COMBOS } from '@/utils/handUtils';
import type { WeightedHand } from '@/utils/handRangeParser';
import {
  STATS_FAMILIES,
  comboBreakdown,
  rangeStatsOf,
  spotsIn,
  type ComboBreakdown,
  type RangeSpot,
} from './rangeBank';

const STATS_SPOTS = spotsIn(STATS_FAMILIES);

export type StatsKind = 'pct' | 'combos';

export type StatsQuestion = {
  spot: RangeSpot;
  hands: WeightedHand[];
  combos: number;
  pct: number;
  breakdown: ComboBreakdown;
  kind: StatsKind;
  /** Valor correcto según kind (pct entero, o combos entero). */
  correct: number;
  /** 4 opciones MC (una es correct). */
  options: number[];
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

/** Combos si (error de novato) se cuenta el offsuit como 4 en vez de 12. */
function combosOffsuitAs4(hands: WeightedHand[]): number {
  let total = 0;
  for (const { hand, weight } of hands) {
    const w = weight / 100;
    const cat = categoryOf(hand);
    total += (cat === 'offsuit' ? 4 : combosOf(hand)) * w;
  }
  return Math.round(total);
}

/** Construye 4 opciones enteras únicas: correcta + trampas + vecinos. */
function buildOptions(
  correct: number,
  traps: number[],
  step: number,
  max: number,
): number[] {
  const clamp = (n: number) => Math.max(0, Math.min(max, Math.round(n)));
  const opts = new Set<number>([correct]);
  for (const t of traps) {
    if (opts.size >= 4) break;
    const c = clamp(t);
    if (c !== correct) opts.add(c);
  }
  let k = 1;
  while (opts.size < 4) {
    const up = clamp(correct + k * step);
    const down = clamp(correct - k * step);
    if (up !== correct && !opts.has(up)) opts.add(up);
    if (opts.size < 4 && down !== correct && !opts.has(down)) opts.add(down);
    k += 1;
    if (k > 60) {
      // safety: fill with any distinct values
      let v = 0;
      while (opts.size < 4) {
        if (!opts.has(v)) opts.add(v);
        v += 1;
      }
    }
  }
  return shuffle([...opts]);
}

const ALL_KINDS: readonly StatsKind[] = ['pct', 'combos'];

export function generateStatsQuestion(
  allowedKinds?: readonly StatsKind[],
): StatsQuestion {
  const spot = pick(STATS_SPOTS);
  const { hands, combos, pctRounded } = rangeStatsOf(spot.notation);
  const breakdown = comboBreakdown(hands);
  const kindPool = allowedKinds && allowedKinds.length > 0 ? allowedKinds : ALL_KINDS;
  const kind: StatsKind = pick(kindPool);

  // "% y combos" enseña la matemática exacta (combos / 1326), así que usa el %
  // DERIVADO y redondeado — no la etiqueta del HUD del spot (esa es para el drill
  // "Composición"). Ej.: AA-QQ,AKs = 22 combos → 22/1326 = 1.66% → 2%.
  const combosInt = Math.round(combos);
  let options: number[];
  if (kind === 'pct') {
    const trapCombos = combosOffsuitAs4(hands);
    const trapPct = Math.round((trapCombos / TOTAL_COMBOS) * 100);
    options = buildOptions(pctRounded, [trapPct, pctRounded + 2, pctRounded - 3], 1, 100);
  } else {
    options = buildOptions(
      combosInt,
      [combosOffsuitAs4(hands), combosInt + 6, combosInt - 8],
      4,
      TOTAL_COMBOS,
    );
  }

  return {
    spot,
    hands,
    combos: combosInt,
    pct: pctRounded,
    breakdown,
    kind,
    correct: kind === 'pct' ? pctRounded : combosInt,
    options,
  };
}

/** Comprueba una respuesta de Modo experto con tolerancia (% ±1, combos exacto). */
export function checkExpert(kind: StatsKind, value: number, correct: number): boolean {
  return kind === 'pct' ? Math.abs(value - correct) <= 1 : value === correct;
}
