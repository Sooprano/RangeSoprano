// Shared dataset + helpers for the "Rangos" drills (phase 47).
//
// "Range Building: Percentage Form" del workbook: leer un rango y saber su
// %-form y combos, y entender cómo un % por posición se compone de manos
// concretas (y qué morfología tiene).
//
// El %-form y los combos se DERIVAN de la notación vía parseHandRange + combosOf
// (single source of truth, en ev/handUtils) — nunca se tipean, no pueden
// divergir. Las notaciones son originales/estándar (charts canónicos), NO
// transcritas de las imágenes del libro.

import type { ActionDef, HandNotation, RangeCellData } from '@/types/poker';
import { parseHandRange, type WeightedHand } from '@/utils/handRangeParser';
import { categoryOf, combosOf, TOTAL_COMBOS } from '@/utils/handUtils';
import { buildActionDefMap } from '@/utils/actionMeta';

export type Morphology = 'lineal' | 'polarizado' | 'mergeado' | 'condensado';
export type RangeAction = 'open' | '3bet' | '4bet' | 'cold-call' | 'call';

export type RangeSpot = {
  id: string;
  /** parseHandRange input. */
  notation: string;
  /** Posición del héroe que arma el rango (ej. "SB"). */
  position: string;
  /** Contexto (ej. "vs open del BTN"). "" para RFI. */
  vs: string;
  action: RangeAction;
  morphology: Morphology;
  /** Por qué el rango tiene esa forma en este spot (feedback). */
  rationale: string;
};

// ── Banco curado (~24 spots, notaciones originales) ──────────────────────────
export const RANGE_BANK: readonly RangeSpot[] = [
  // Opens (RFI)
  {
    id: 'utg-open',
    notation: '77+,ATs+,KTs+,QTs+,JTs,AQo+,KQo',
    position: 'UTG',
    vs: '',
    action: 'open',
    morphology: 'lineal',
    rationale:
      'Apertura desde UTG: solo manos fuertes y suited de gama alta, de arriba hacia abajo. Sin faroles ni manos especulativas — rango lineal de valor.',
  },
  {
    id: 'mp-open',
    notation: '66+,A9s+,KTs+,QTs+,J9s+,T9s,98s,AJo+,KQo',
    position: 'MP',
    vs: '',
    action: 'open',
    morphology: 'lineal',
    rationale:
      'Apertura desde MP: un poco más ancho que UTG pero sigue siendo top-down, manos de valor y suited conectados. Lineal.',
  },
  {
    id: 'co-open',
    notation: '44+,A2s+,K9s+,Q9s+,J9s+,T8s+,97s+,87s,76s,65s,A9o+,KJo+,QJo',
    position: 'CO',
    vs: '',
    action: 'open',
    morphology: 'lineal',
    rationale:
      'Apertura desde CO: rango lineal (depolarizado). Es tu mejor X% de manos de arriba hacia abajo, sin estructura de valor/farol. Más ancha que en posición temprana, pero igual un bloque contiguo desde el tope. Una apertura RFI es el ejemplo de manual de rango lineal.',
  },
  {
    id: 'btn-open',
    notation:
      '22+,A2s+,K6s+,Q8s+,J8s+,T8s+,97s+,86s+,76s,65s,54s,A4o+,K9o+,Q9o+,JTo,T9o',
    position: 'BTN',
    vs: '',
    action: 'open',
    morphology: 'lineal',
    rationale:
      'Apertura desde BTN: rango lineal, muy ancho. Todos los pares, todos los suited de as, broadways y conectores. No tiene estructura de valor/farol: es tu mejor X% de manos top-down. Ancho pero lineal.',
  },
  {
    id: 'sb-open',
    notation: '22+,A2s+,K9s+,Q9s+,J9s+,T9s,98s,87s,76s,A8o+,KTo+,QTo+,JTo',
    position: 'SB',
    vs: '',
    action: 'open',
    morphology: 'lineal',
    rationale:
      'Apertura (RFI) desde SB: rango lineal. Ancho porque solo queda la BB por actuar, pero es top-down por fuerza, sin faroles dedicados. Una apertura siempre es lineal (depolarizada).',
  },

  // 3bets lineales (valor, top-down)
  {
    id: 'ep-3bet-linear',
    notation: 'JJ+,AKs,AKo',
    position: 'MP',
    vs: 'vs open de UTG',
    action: '3bet',
    morphology: 'lineal',
    rationale:
      '3bet de valor lineal vs una apertura temprana: solo las manos más fuertes, de arriba hacia abajo, sin faroles. Típico 3bet por valor vs un reg sólido.',
  },
  {
    id: 'sb-3bet-value-vs-utg',
    notation: 'QQ+,AKs,AKo',
    position: 'SB',
    vs: 'vs open de UTG',
    action: '3bet',
    morphology: 'lineal',
    rationale:
      '3bet por valor muy cerrado fuera de posición vs un rango temprano fuerte: solo lo más nuteado. Lineal/condensado al tope.',
  },
  {
    id: 'co-3bet-linear-vs-mp',
    notation: 'TT+,AQs+,AKo,KQs',
    position: 'CO',
    vs: 'vs open de MP',
    action: '3bet',
    morphology: 'lineal',
    rationale:
      '3bet lineal vs MP: valor de arriba hacia abajo (TT+, AQ+) con KQs como la peor de valor. Sin faroles dedicados.',
  },

  // 3bets mergeados
  {
    id: 'btn-3bet-merged-vs-co',
    notation: 'TT+,AJs+,KQs,AKo,AQo,A5s,A4s',
    position: 'BTN',
    vs: 'vs open de CO',
    action: '3bet',
    morphology: 'mergeado',
    rationale:
      '3bet mergeado en posición: valor (TT+, AQ+) + manos medias fuertes (AJs, KQs) + un par de faroles bloqueadores (A5s, A4s). Sin hueco marcado.',
  },
  {
    id: 'btn-3bet-merged-vs-mp',
    notation: '99+,AJs+,KQs,AKo,AQo,A5s,A4s',
    position: 'BTN',
    vs: 'vs open de MP',
    action: '3bet',
    morphology: 'mergeado',
    rationale:
      '3bet mergeado en posición vs MP: valor (99+, AQ+) + manos medias (AJs, KQs) + faroles bloqueadores (A5s, A4s). Lo que lo distingue de un lineal son esos faroles dedicados; lo que lo distingue de un polarizado es que el medio está lleno (no hay hueco).',
  },

  // 3bets polarizados (valor tope + faroles, hueco en el medio)
  {
    id: 'sb-3bet-polar-vs-btn',
    notation: 'QQ+,AKs,AKo,A5s,A4s,A3s,A2s,76s,65s,54s',
    position: 'SB',
    vs: 'vs open del BTN',
    action: '3bet',
    morphology: 'polarizado',
    rationale:
      '3bet polarizado vs un robo del BTN: valor tope (QQ+, AK) + faroles (Ax suited bloqueadores y conectores). Las manos medias (JJ, TT, AQ) se flotan, no se 3betean — hueco en el medio.',
  },
  {
    id: 'bb-3bet-polar-vs-btn',
    notation: 'JJ+,AKs,AKo,A5s,A4s,A3s,A2s,K9s,Q9s,J9s,T8s',
    position: 'BB',
    vs: 'vs open del BTN',
    action: '3bet',
    morphology: 'polarizado',
    rationale:
      '3bet polarizado fuera de posición: valor (JJ+, AK) + faroles suited (ruedas de as, suited de un gap). El medio se paga, no se sube.',
  },

  // 4bets
  {
    id: 'btn-4bet-polar-vs-sb',
    notation: 'AA,KK,AKs,A5s,A4s',
    position: 'BTN',
    vs: 'vs 3bet de la SB',
    action: '4bet',
    morphology: 'polarizado',
    rationale:
      '4bet polarizado: valor puro (AA, KK, AKs) + un par de faroles con bloqueador de as (A5s, A4s). Nada en el medio.',
  },
  {
    id: 'utg-4bet-value-vs-co',
    notation: 'AA,KK,AKs',
    position: 'UTG',
    vs: 'vs 3bet del CO',
    action: '4bet',
    morphology: 'lineal',
    rationale:
      '4bet por valor puro desde posición temprana: solo lo más nuteado, sin faroles. Lineal/condensado al tope.',
  },

  // Flats / cold-calls (medios, capados — condensados)
  {
    id: 'bb-call-vs-btn',
    notation:
      '99-22,ATs-A2s,KTs-K9s,Q9s,J9s,T9s,98s,87s,76s,65s,KJo,QJo,JTo,ATo,A9o',
    position: 'BB',
    vs: 'vs open del BTN',
    action: 'call',
    morphology: 'condensado',
    rationale:
      'Rango de pago de la BB vs robo del BTN: pares medios-bajos, suited conectados y broadways flojos. Las premium (AA, KK, AK) 3betean, así que el rango de call queda CAPADO — sin lo más nuteado ni puro aire: condensado.',
  },
  {
    id: 'bb-call-vs-co',
    notation: '88-22,ATs-A4s,KTs-K9s,Q9s,J9s,T9s,98s,87s,76s,KJo,QJo,JTo',
    position: 'BB',
    vs: 'vs open del CO',
    action: 'call',
    morphology: 'condensado',
    rationale:
      'Pago de BB vs CO: banda media de pares y suited. Las fuertes se 3betean — el call es condensado (capado).',
  },
  {
    id: 'btn-coldcall-vs-utg',
    notation: 'TT-22,AQs-ATs,KJs-KTs,QTs+,JTs,T9s,AQo',
    position: 'BTN',
    vs: 'vs open de UTG',
    action: 'cold-call',
    morphology: 'condensado',
    rationale:
      'Cold-call del BTN vs un open de UTG: pares medios y suited de gama media. Las manos top (QQ+, AK) re-suben; el resto foldea. Queda una banda media — condensado.',
  },
  {
    id: 'co-coldcall-vs-mp',
    notation: 'TT-22,AJs-ATs,KTs+,QJs,JTs,T9s',
    position: 'CO',
    vs: 'vs open de MP',
    action: 'cold-call',
    morphology: 'condensado',
    rationale:
      'Cold-call del CO vs MP: pares medios y suited de conexión, sin premiums (que 3betean) ni basura. Condensado.',
  },
  {
    id: 'bb-call-vs-sb',
    notation:
      '99-22,A9s-A2s,K8s+,Q8s+,J8s+,T8s+,97s+,86s+,76s,65s,54s,A7o-A2o,K9o+,Q9o+,J9o+,T9o',
    position: 'BB',
    vs: 'vs open de SB',
    action: 'call',
    morphology: 'condensado',
    rationale:
      'Defensa de la BB vs robo de SB: muy ancha por el descuento de ciega y la posición, pero las premium se 3betean → capada. Condensado (ancho).',
  },

  // Extras para enriquecer clusters (mismo %, distinta morfología)
  {
    id: 'lj-open',
    notation: '66+,A8s+,KTs+,QTs+,JTs,T9s,98s,ATo+,KJo+',
    position: 'LJ',
    vs: '',
    action: 'open',
    morphology: 'lineal',
    rationale:
      'Apertura desde LJ (early): manos de valor y suited conectados, top-down. Lineal.',
  },
  {
    id: 'btn-3bet-linear-vs-co',
    notation: 'TT+,AQs+,AKo,AQo',
    position: 'BTN',
    vs: 'vs open de CO',
    action: '3bet',
    morphology: 'lineal',
    rationale:
      '3bet lineal por valor en posición vs CO: TT+, AQ+ de arriba hacia abajo, sin faroles dedicados. (Compara con la versión mergeada, que suma faroles A5s/A4s.)',
  },
  {
    id: 'mp-3bet-merged-vs-lj',
    notation: 'TT+,AQs+,KQs,AKo,A5s,A4s',
    position: 'MP',
    vs: 'vs open de LJ',
    action: '3bet',
    morphology: 'mergeado',
    rationale:
      '3bet mergeado: valor (TT+, AQ+) + KQs medio + faroles bloqueadores A5s/A4s.',
  },
  {
    id: 'bb-3bet-polar-wide-vs-co',
    notation: 'JJ+,AKs,AKo,A5s,A4s,A3s,A2s,K8s,Q8s,J8s,T8s,97s',
    position: 'BB',
    vs: 'vs open del CO',
    action: '3bet',
    morphology: 'polarizado',
    rationale:
      '3bet polarizado más ancho vs un robo de CO: valor (JJ+, AK) + más faroles suited. El medio se paga.',
  },
  {
    id: 'bb-call-vs-mp',
    notation: '88-22,ATs-A8s,KTs+,QTs+,JTs,T9s,98s,AJo,KQo',
    position: 'BB',
    vs: 'vs open de MP',
    action: 'call',
    morphology: 'condensado',
    rationale:
      'Pago de BB vs un open de MP (rango más fuerte): banda media y suited, premiums fuera (3betean). Condensado.',
  },
  {
    id: 'btn-coldcall-vs-co',
    notation: '99-22,AJs-ATs,KTs+,QTs+,JTs,T9s,98s,AQo',
    position: 'BTN',
    vs: 'vs open de CO',
    action: 'cold-call',
    morphology: 'condensado',
    rationale:
      'Cold-call del BTN vs CO: pares medios y suited de conexión; las top re-suben. Banda media — condensado.',
  },
  {
    id: 'co-3bet-merged-vs-utg',
    notation: 'TT+,AJs+,KQs,KJs,AKo,AQo,A5s,A4s',
    position: 'CO',
    vs: 'vs open de UTG',
    action: '3bet',
    morphology: 'mergeado',
    rationale:
      '3bet mergeado en posición vs UTG: valor (TT+, AQ+) + broadways medios (AJs, KQs, KJs) + faroles bloqueadores (A5s, A4s). El medio está lleno (sin hueco) y hay faroles — eso lo separa del lineal y del polarizado.',
  },
];

// ── Helpers (single source of truth: % y combos derivados) ───────────────────

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
      return 'paga en frío (cold-call)';
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

export const MORPHOLOGY_DEF: Record<Morphology, string> = {
  lineal:
    'Lineal (depolarizado): tus mejores manos de arriba hacia abajo por fuerza, SIN faroles dedicados. Es la forma de una apertura (RFI) o un 3bet de puro valor.',
  polarizado:
    'Polarizado: manos nuteadas + faroles, con un HUECO en el medio (las manos medias se pagan, no se suben). Típico de un 3bet desde la ciega.',
  mergeado:
    'Mergeado: como un polarizado pero con el medio LLENO. Valor + manos medias + algunos faroles, sin hueco. Típico 3bet en posición en cash. La señal vs lineal: tiene faroles dedicados (A5s, A4s).',
  condensado:
    'Condensado (capado): solo manos de fuerza media, sin lo más nuteado (que sube) ni aire. Típico rango de pago/flat.',
};
