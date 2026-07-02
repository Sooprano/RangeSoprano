// Shared dataset + helpers for the "Rangos" drills (phase 47+).
//
// Objetivo pedagógico: que el alumno aprenda a DIMENSIONAR una cifra del HUD y a
// reconocer cómo un reg construye sus rangos.
//   · familia `linear-3bet` (29): 3bet lineal por %, "si 3-betea X% lineal, qué manos".
//   · familia `gto-3bet` (GTO Wizard, reg vs reg): 3bet posición-vs-posición.
//   · (futuro) `open` / `call`: aperturas y rangos de pago (traen morfología variada).
//
// El % y los combos se DERIVAN de la notación (rangeStatsOf) como single source of
// truth. `pct` en linear-3bet es la ETIQUETA del HUD (puede diferir 0.X% del
// derivado, intencional); en gto-3bet es el % derivado. Las notaciones GTO están
// en formato combo-por-combo (parseHandRange las autodetecta y agrega a peso/mano).

import type { ActionDef, HandNotation, RangeCellData } from '@/types/poker';
import { parseHandRange, type WeightedHand } from '@/utils/handRangeParser';
import { categoryOf, combosOf, TOTAL_COMBOS } from '@/utils/handUtils';
import { buildActionDefMap } from '@/utils/actionMeta';
import { GTO_3BET_RAW } from './gto3betRanges';
import { GTO_OPEN_RAW } from './gtoOpenRanges';
import { GTO_CALL_RAW } from './gtoCallRanges';
import { GTO_COLD_CALL_RAW } from './gtoColdCallRanges';

export type Morphology = 'lineal' | 'polarizado' | 'mergeado' | 'condensado';
export type RangeAction = 'open' | '3bet' | '4bet' | 'cold-call' | 'call';

/** Familia del spot: define cómo se redacta el enunciado y qué distractores usar. */
export type RangeFamily = 'linear-3bet' | 'gto-3bet' | 'open' | 'call' | 'cold-call';

export type RangeSpot = {
  id: string;
  /** parseHandRange input (notación estándar o GTO combo-por-combo). */
  notation: string;
  family: RangeFamily;
  /** % que ve el alumno. linear-3bet: etiqueta del HUD; gto-3bet: derivado. */
  pct: number;
  /** Posición del héroe que arma el rango (ej. "HJ"). "" para genéricos. */
  position: string;
  /** Contexto (ej. "vs UTG"). "" si no aplica. */
  vs: string;
  action: RangeAction;
  morphology: Morphology;
  /** Sizing informativo (ej. "6.5bb"), opcional. */
  sizing?: string;
  /** Por qué el rango tiene esa forma (feedback). Si falta, se deriva por familia. */
  rationale?: string;
};

// ── Derivación de stats (single source of truth) ─────────────────────────────

export type RangeStats = {
  hands: WeightedHand[];
  /** Suma ponderada de combos (entero para rangos full-weight). */
  combos: number;
  /** combos / 1326 · 100, redondeado al entero. */
  pctRounded: number;
};

export function rangeStatsOf(notation: string): RangeStats {
  const { hands } = parseHandRange(notation);
  let combos = 0;
  for (const { hand, weight } of hands) {
    combos += combosOf(hand) * (weight / 100);
  }
  const combosRounded = Math.round(combos * 100) / 100;
  return {
    hands,
    combos: combosRounded,
    pctRounded: Math.round((combos / TOTAL_COMBOS) * 100),
  };
}

// ── Familia linear-3bet: 3bet lineal por % (notaciones de Flopzilla) ──────────
const LINEAR_3BET: readonly { id: string; pct: number; notation: string }[] = [
  { id: 'lin3b-1_6', pct: 1.6, notation: 'AA-QQ,AKs' },
  { id: 'lin3b-3', pct: 3, notation: 'AA-JJ,AKs,AKo' },
  { id: 'lin3b-5', pct: 5, notation: 'AA-TT,AKs-AJs,AKo-AQo' },
  { id: 'lin3b-6', pct: 6, notation: 'AA-JJ,AKs-ATs,KQs-KTs,QJs-QTs,JTs,AKo' },
  { id: 'lin3b-7', pct: 7, notation: 'AA-TT,AKs-ATs,KQs-KTs,QJs-QTs,JTs,AKo-AQo' },
  { id: 'lin3b-8', pct: 8, notation: 'AA-TT,AKs-ATs,KQs-KTs,QJs-QTs,JTs,AKo-AJo' },
  { id: 'lin3b-9', pct: 9, notation: 'AA-TT,AKs-ATs,KQs-KTs,QJs-QTs,JTs,AKo-AJo,KQo' },
  { id: 'lin3b-10', pct: 10, notation: 'AA-99,AKs-A9s,KQs-KTs,QJs-QTs,JTs,AKo-AJo,KQo' },
  { id: 'lin3b-11a', pct: 11, notation: 'AA-99,AKs-A9s,KQs-K9s,QJs-Q9s,JTs-J9s,T9s,AKo-AJo,KQo' },
  { id: 'lin3b-11b', pct: 11, notation: 'AA-99,AKs-A8s,KQs-KTs,QJs-QTs,JTs,AKo-ATo,KQo' },
  { id: 'lin3b-12a', pct: 12, notation: 'AA-99,AKs-A8s,KQs-K9s,QJs-Q9s,JTs-J9s,T9s,AKo-ATo,KQo' },
  { id: 'lin3b-12b', pct: 12, notation: 'AA-99,AKs-A8s,KQs-KTs,QJs-QTs,JTs,AKo-ATo,KQo-KJo' },
  { id: 'lin3b-13', pct: 13, notation: 'AA-99,AKs-A8s,KQs-K9s,QJs-Q9s,JTs-J9s,T9s,AKo-ATo,KQo-KJo' },
  { id: 'lin3b-14', pct: 14, notation: 'AA-99,AKs-A5s,KQs-K9s,QJs-Q9s,JTs-J9s,T9s,AKo-ATo,KQo-KJo' },
  { id: 'lin3b-15', pct: 15, notation: 'AA-88,AKs-A3s,KQs-K9s,QJs-Q9s,JTs-J9s,T9s,AKo-ATo,KQo-KJo' },
  { id: 'lin3b-16', pct: 16, notation: 'AA-88,AKs-A3s,KQs-K8s,QJs-Q9s,JTs-J9s,T9s-T8s,98s,AKo-ATo,KQo-KJo' },
  { id: 'lin3b-17', pct: 17, notation: 'AA-88,AKs-A2s,KQs-K9s,QJs-Q9s,JTs-J9s,T9s,AKo-ATo,KQo-KTo,QJo' },
  { id: 'lin3b-18', pct: 18, notation: 'AA-88,AKs-A2s,KQs-K8s,QJs-Q9s,JTs-J9s,T9s-T8s,98s,AKo-ATo,KQo-KTo,QJo' },
  { id: 'lin3b-19', pct: 19, notation: 'AA-88,AKs-A2s,KQs-K6s,QJs-Q9s,JTs-J8s,T9s-T8s,98s,AKo-ATo,KQo-KTo,QJo' },
  { id: 'lin3b-20', pct: 20, notation: 'AA-77,AKs-A2s,KQs-K5s,QJs-Q8s,JTs-J8s,T9s-T8s,98s,AKo-ATo,KQo-KTo,QJo' },
  { id: 'lin3b-21', pct: 21, notation: 'AA-66,AKs-A2s,KQs-K5s,QJs-Q8s,JTs-J8s,T9s-T8s,98s,87s,76s,65s,AKo-ATo,KQo-KTo,QJo' },
  { id: 'lin3b-22', pct: 22, notation: 'AA-66,AKs-A2s,KQs-K6s,QJs-Q8s,JTs-J8s,T9s-T8s,98s,87s,76s,65s,AKo-A9o,KQo-KTo,QJo' },
  { id: 'lin3b-23', pct: 23, notation: 'AA-66,AKs-A2s,KQs-K5s,QJs-Q8s,JTs-J8s,T9s-T8s,98s,87s,76s,65s,AKo-A9o,KQo-KTo,QJo-QTo' },
  { id: 'lin3b-24', pct: 24, notation: 'AA-66,AKs-A2s,KQs-K5s,QJs-Q8s,JTs-J8s,T9s-T8s,98s,87s,76s,65s,54s,AKo-A8o,KQo-KTo,QJo-QTo' },
  { id: 'lin3b-25', pct: 25, notation: 'AA-66,AKs-A2s,KQs-K5s,QJs-Q8s,JTs-J8s,T9s-T8s,98s,87s,76s,65s,54s,AKo-A8o,KQo-KTo,QJo-QTo,JTo' },
  { id: 'lin3b-26', pct: 26, notation: 'AA-66,AKs-A2s,KQs-K3s,QJs-Q8s,JTs-J8s,T9s-T8s,98s-97s,87s,76s,65s,54s,AKo-A8o,KQo-KTo,QJo-QTo,JTo' },
  { id: 'lin3b-27', pct: 27, notation: 'AA-55,AKs-A2s,KQs-K2s,QJs-Q8s,JTs-J8s,T9s-T8s,98s-97s,87s,76s,65s,54s,AKo-A8o,KQo-KTo,QJo-QTo,JTo' },
  { id: 'lin3b-28', pct: 28, notation: 'AA-55,AKs-A2s,KQs-K2s,QJs-Q8s,JTs-J8s,T9s-T7s,98s-97s,87s,76s,65s,54s,AKo-A8o,KQo-K9o,QJo-QTo,JTo' },
  { id: 'lin3b-32', pct: 32, notation: 'AA-44,AKs-A2s,KQs-K2s,QJs-Q2s,JTs-J7s,T9s-T7s,98s-96s,87s-86s,76s-75s,65s-64s,54s,43s,AKo-A8o,KQo-K9o,QJo-QTo,JTo' },
];

const LINEAR_3BET_SPOTS: readonly RangeSpot[] = LINEAR_3BET.map((r) => ({
  ...r,
  family: 'linear-3bet' as const,
  position: '',
  vs: '',
  action: '3bet' as const,
  morphology: 'lineal' as const,
}));

// ── Familia gto-3bet: reg vs reg (peso derivado del rango GTO) ────────────────
// Morfología según posición del 3bettor (verificado con la data + GTO Wizard):
//  · BB → POLARIZADO: la BB paga barato y cierra la acción, manda las manos medias
//    al call y reserva el 3bet para valor + faroles → hueco en el medio.
//  · resto (HJ/CO/BTN/SB) → MERGEADO: sin un buen flat (rivales por detrás / la BB
//    puede squeezear), las medias se quedan en el 3bet → valor + medias + faroles.
const GTO_3BET_SPOTS: readonly RangeSpot[] = GTO_3BET_RAW.map((r) => ({
  id: r.id,
  notation: r.notation,
  family: 'gto-3bet' as const,
  pct: rangeStatsOf(r.notation).pctRounded,
  position: r.position,
  vs: r.vs,
  action: '3bet' as const,
  morphology: (r.position === 'BB' ? 'polarizado' : 'mergeado') as Morphology,
  sizing: r.sizing,
}));

// ── Familia open: aperturas (RFI) GTO por posición — siempre LINEAL ──────────
const OPEN_SPOTS: readonly RangeSpot[] = GTO_OPEN_RAW.map((r) => ({
  id: r.id,
  notation: r.notation,
  family: 'open' as const,
  pct: rangeStatsOf(r.notation).pctRounded,
  position: r.position,
  vs: '',
  action: 'open' as const,
  morphology: 'lineal' as const,
  sizing: r.sizing,
}));

// ── Familia call: pago (call) de la BB vs una apertura — CONDENSADO (capado) ──
const CALL_SPOTS: readonly RangeSpot[] = GTO_CALL_RAW.map((r) => ({
  id: r.id,
  notation: r.notation,
  family: 'call' as const,
  pct: rangeStatsOf(r.notation).pctRounded,
  position: r.position,
  vs: r.vs,
  action: 'call' as const,
  morphology: 'condensado' as const,
}));

// ── Familia cold-call: pago en frío de BTN/SB vs una apertura — CONDENSADO ────
const COLD_CALL_SPOTS: readonly RangeSpot[] = GTO_COLD_CALL_RAW.map((r) => ({
  id: r.id,
  notation: r.notation,
  family: 'cold-call' as const,
  pct: rangeStatsOf(r.notation).pctRounded,
  position: r.position,
  vs: r.vs,
  action: 'cold-call' as const,
  morphology: 'condensado' as const,
}));

export const RANGE_BANK: readonly RangeSpot[] = [
  ...LINEAR_3BET_SPOTS,
  ...GTO_3BET_SPOTS,
  ...OPEN_SPOTS,
  ...CALL_SPOTS,
  ...COLD_CALL_SPOTS,
];

// ── Scopes por drill (qué familias alimentan cada ejercicio de "Rangos") ──────
export const STATS_FAMILIES: readonly RangeFamily[] = ['linear-3bet'];
export const COMPOSE_FAMILIES: readonly RangeFamily[] = [
  'linear-3bet',
  'gto-3bet',
  'open',
  'call',
  'cold-call',
];
/**
 * Morfología real y variada para el drill "Tipo de rango": opens (lineal) +
 * gto-3bet (mergeado posicional / polarizado BB) + calls/cold-calls (condensado).
 * Orden = progresión pedagógica de formas.
 */
export const TYPE_FAMILIES: readonly RangeFamily[] = [
  'open',
  'gto-3bet',
  'call',
  'cold-call',
];

export function spotsIn(families: readonly RangeFamily[]): RangeSpot[] {
  return RANGE_BANK.filter((s) => families.includes(s.family));
}

/** True si el drill "Tipo de rango" tiene datos con ≥2 formas distintas. */
export const HAS_TYPE_SPOTS = (() => {
  const spots = spotsIn(TYPE_FAMILIES);
  return spots.length > 0 && new Set(spots.map((s) => s.morphology)).size > 1;
})();

// ── Helpers de presentación ──────────────────────────────────────────────────

export type ComboBreakdown = { pairs: number; suited: number; offsuit: number };

export function comboBreakdown(hands: WeightedHand[]): ComboBreakdown {
  let pairs = 0;
  let suited = 0;
  let offsuit = 0;
  for (const { hand, weight } of hands) {
    const c = combosOf(hand) * (weight / 100);
    const cat = categoryOf(hand);
    if (cat === 'pair') pairs += c;
    else if (cat === 'suited') suited += c;
    else offsuit += c;
  }
  return {
    pairs: Math.round(pairs * 100) / 100,
    suited: Math.round(suited * 100) / 100,
    offsuit: Math.round(offsuit * 100) / 100,
  };
}

/** Formatea el % etiqueta (entero → "11%", decimal → "1.6%"). */
export function formatPct(n: number): string {
  return `${n}%`;
}

/** Action def + map color para resaltar el rango en el RangeGrid (modo lectura). */
export const RANGE_ACTION_DEF: ActionDef = {
  id: 'IN',
  label: 'En rango',
  color: '#a855f7',
  order: 0,
};

/** Map estable (un solo color) para pasar a RangeGrid sin reconstruir por render. */
export const RANGE_ACTIONS_MAP = buildActionDefMap([RANGE_ACTION_DEF]);

export function handsToCells(
  hands: WeightedHand[],
  actionId: string = RANGE_ACTION_DEF.id,
): Record<HandNotation, RangeCellData> {
  const cells: Record<HandNotation, RangeCellData> = {};
  for (const { hand, weight } of hands) {
    cells[hand] = { hand, actions: [{ action: actionId, weight }] };
  }
  return cells;
}

/** Verbo + sufijo para el prompt de "composición" según la acción. */
export function actionPhrase(action: RangeAction): string {
  switch (action) {
    case 'open':
      return 'abre';
    case '3bet':
      return '3-betea';
    case '4bet':
      return '4-betea';
    case 'cold-call':
      return 'hace cold call';
    case 'call':
      return 'paga';
  }
}

export const MORPHOLOGY_LABEL: Record<Morphology, string> = {
  lineal: 'Lineal',
  polarizado: 'Polarizado',
  mergeado: 'Mergeado',
  condensado: 'Condensado',
};

/** Glosa corta de cada forma para el enunciado del drill compose. */
export const MORPHOLOGY_HINT: Record<Morphology, string> = {
  lineal: 'sus mejores manos, de arriba hacia abajo',
  polarizado: 'valor arriba + faroles, con hueco en el medio',
  mergeado: 'sube: valor nuteado + medias + algún farol, sin hueco',
  condensado: 'paga: solo manos medias, capado (sin nuts ni aire)',
};

/**
 * Sujeto del enunciado "compose": quién arma ese rango.
 * Opens y calls no dependen del arquetipo (una apertura siempre es lineal; un
 * pago siempre condensado). En 3bet/4bet la FORMA delata el tipo de jugador:
 * lineal = fish (solo valor, no farolea); polar/mergeado = reg (construcción pensada).
 */
export function builderSubject(action: RangeAction, morphology: Morphology): string {
  if (action === 'open' || action === 'call' || action === 'cold-call') return 'Un jugador';
  return morphology === 'lineal' ? 'Un fish' : 'Un reg';
}

/**
 * Línea de contraste para el feedback: enseña a dimensionar la misma cifra del
 * HUD según el tipo de jugador (fish lineal vs reg polar), o la regla fija de
 * opens (siempre lineal) y calls (siempre condensados/capados).
 */
export function dimensioningTip(
  action: RangeAction,
  morphology: Morphology,
  pct: number,
): string {
  if (action === 'open') {
    return `Una apertura siempre es lineal: es su mejor ${pct}% de manos, de arriba hacia abajo (no hay faroles dedicados).`;
  }
  if (action === 'call' || action === 'cold-call') {
    return `Un rango de pago es condensado: las premium se 3-betean, así que ese ${pct}% queda capado (sin lo más nuteado ni puro aire).`;
  }
  if ((action === '3bet' || action === '4bet') && morphology === 'polarizado') {
    return `Polarizado = 3bet de la BB: paga barato y cierra la acción, así que manda las manos medias al call y 3-betea valor + faroles → hueco en el medio.`;
  }
  if ((action === '3bet' || action === '4bet') && morphology === 'mergeado') {
    return `Mergeado = 3bet posicional (no-BB): sin un buen flat (rivales por detrás / la BB squeezea), las manos medias se quedan en el 3bet → valor + medias + faroles, sin hueco.`;
  }
  if (morphology === 'lineal') {
    return `Ojo con el HUD: un fish con ese ${pct}% juega su mejor ${pct}% (lineal). Un reg podría 3-betear la misma cifra polarizada (valor + faroles).`;
  }
  return `Esa forma (${MORPHOLOGY_LABEL[morphology].toLowerCase()}) es de un reg. Un fish con ese mismo ${pct}% lo armaría lineal: su mejor ${pct}% de manos.`;
}

export const MORPHOLOGY_DEF: Record<Morphology, string> = {
  lineal:
    'Lineal (depolarizado): tus mejores manos de arriba hacia abajo por fuerza, SIN faroles dedicados. Es la forma de una apertura (RFI) o un 3bet de puro valor.',
  polarizado:
    'Polarizado: manos nuteadas + faroles, con un HUECO en el medio (las manos medias se pagan, no se suben). Típico de un 3bet desde la ciega.',
  mergeado:
    'Mergeado: valor nuteado + manos medias + algunos faroles, sin hueco (como un polarizado con el medio LLENO). Es un rango que SUBE (3bet/raise) — por eso incluye lo nuteado. Típico 3bet en posición en cash. Ojo: que sea ancho y variado NO lo hace mergeado; lo define tener nuts + faroles.',
  condensado:
    'Condensado (capado): solo manos de fuerza media, sin lo más nuteado (que se 3-betea) ni aire (que se foldea). Es un rango que PAGA (call/cold-call, defensa de BB). Aunque sea ancho (pares + suited + algún offsuit), sigue condensado porque capea las premium. Regla corta: mergeado SUBE, condensado PAGA.',
};

/** Explicación de la composición según la familia (feedback). */
export function rationaleOf(spot: RangeSpot): string {
  if (spot.rationale) return spot.rationale;
  if (spot.family === 'linear-3bet') {
    return `Un 3bet lineal es tu mejor ${spot.pct}% de manos, de arriba hacia abajo: pares de mayor a menor, los mejores Ax/Kx suited y broadways, más algún offsuit fuerte — sin faroles dedicados ni hueco. Cuanto más alto el %, más abajo baja el bloque.`;
  }
  if (spot.family === 'gto-3bet') {
    const spotTag = `${spot.position} ${spot.vs}${spot.sizing ? `, ${spot.sizing}` : ''}`;
    if (spot.morphology === 'polarizado') {
      return `3bet de la BB ${spot.vs}: rango POLARIZADO. La BB paga barato y cierra la acción → sus manos medias (AJ, KQ, pares medios) van al call, y el 3bet queda valor nuteado (QQ+, AK) + faroles suited (ruedas de as, conectores), con hueco en el medio. Los pesos parciales son la mezcla del solver.`;
    }
    return `3bet posicional de un reg competente (${spotTag}): rango MERGEADO — valor puro (QQ+, AK) + manos medias mezcladas (pares medios, AJs/KQs a frecuencia) + algunos faroles suited (ruedas de as, suited connectors), SIN hueco. Sin un buen flat (rivales por detrás / la BB puede squeezear), las medias se quedan en el 3bet. Los pesos parciales son la mezcla del solver.`;
  }
  if (spot.family === 'open') {
    return `Apertura (RFI) de ${spot.position}${spot.sizing ? ` a ${spot.sizing}` : ''}: rango LINEAL — su mejor ${spot.pct}% de manos de arriba hacia abajo (pares, suited de as, broadways, conectores), sin faroles dedicados. Cuanto más tarde la posición, más ancha la apertura.`;
  }
  if (spot.family === 'call') {
    return `Defensa (call) de la BB ${spot.vs}: rango CONDENSADO (capado). Muy ancho por el descuento de ciega, pero las premium (AA-QQ, AK) se 3-betean → sin lo más nuteado. Banda media de pares, suited y broadways flojos.`;
  }
  if (spot.family === 'cold-call') {
    return `Cold Call de ${spot.position} ${spot.vs}: rango CONDENSADO. Sin descuento de ciega y con jugadores por detrás, se paga apretado con pares medios, suited connectors y broadways suited; las premium se 3-betean y la basura se foldea → sin nuts ni aire.`;
  }
  return MORPHOLOGY_DEF[spot.morphology];
}

/** Etiqueta corta de la familia (para chips de filtro y feedback). */
export const FAMILY_LABEL: Record<RangeFamily, string> = {
  'linear-3bet': '3bet lineal',
  'gto-3bet': '3bet vs reg',
  open: 'Apertura (RFI)',
  call: 'Defensa BB',
  'cold-call': 'Cold-call',
};
