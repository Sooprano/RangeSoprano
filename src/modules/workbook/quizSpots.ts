// Spot bank + question generator for the "¿Qué calculadora?" drill.
//
// Goal: train the reflex of picking the right EV calculator for a spot. Earlier
// this pool was derived from real hand histories via `suggestCalcForDecision`,
// but that engine only ever returns 6 of the 17 calcs as a primary answer (it
// maps an action → one calc). To cover ALL 17 calculators — one designated
// answer each — this is now a hand-authored scenario bank: 3 distinct scenarios
// per calculator (51 spots), each with illustrative cards/board, the spot in
// prose, the correct calc and a teaching rationale.
//
// The /analisis worksheet is unaffected: it still uses `suggestCalcForDecision`
// to pre-fill a calc from a parsed hand. This bank is drill-only.

import { CALC_GROUPS, type CalcMode } from '@/modules/calculators/calcMeta';
import type { Card, Suit } from '@/utils/handHistory';

export type SpotChip = { label: string; value: string; accent?: boolean };

export type QuizSpot = {
  id: string;
  /** The calculator this scenario is designed for. */
  correct: CalcMode;
  /** Also-valid calcs; excluded from distractors so wrong options are truly wrong. */
  alternatives: CalcMode[];
  /** Explanation shown after answering. */
  rationale: string;
  /** Short eyebrow context, e.g. 'River · en posición'. */
  context: string;
  /** One- or two-sentence description of the spot. */
  prompt: string;
  /** Illustrative hole cards (may be empty). */
  hero: Card[];
  /** Illustrative board (may be empty). */
  board: Card[];
  /** Pot / sizing chips shown above the prose (may be empty). */
  chips: SpotChip[];
};

export type QuizQuestion = {
  spot: QuizSpot;
  /** 4 options, shuffled, exactly one is `spot.correct`. */
  options: CalcMode[];
};

// ── Card helper ────────────────────────────────────────────────────────────
const SUIT: Record<string, Suit> = { s: '♠', h: '♥', d: '♦', c: '♣' };
/** "Ah Kh" → [{rank:'A',suit:'♥'}, {rank:'K',suit:'♥'}]. Rank 'T' = ten. */
function cards(spec: string): Card[] {
  if (!spec) return [];
  return spec
    .split(/\s+/)
    .filter(Boolean)
    .map((tok) => ({
      rank: tok.slice(0, -1).toUpperCase(),
      suit: SUIT[tok.slice(-1).toLowerCase()]!,
    }));
}
function chip(label: string, value: string, accent = false): SpotChip {
  return { label, value, accent };
}

// ── Scenario bank: 3 per calculator, covering all 17 ─────────────────────────
type Scenario = Omit<QuizSpot, 'id' | 'correct'>;

const BANK: Record<CalcMode, Scenario[]> = {
  // ════════════════════════ Fundamentos ════════════════════════
  'ev-basic': [
    {
      context: 'River · pagar o foldear',
      prompt:
        'El rival apuesta el river y tenés top pair como bluff-catcher. Sin proyecto ni opción de subir, solo importa tu % de ganar el showdown contra el precio del call.',
      hero: cards('Ah Jc'),
      board: cards('Jd 8c 4h 2s 7d'),
      chips: [chip('Bote', '$120'), chip('A pagar', '$40', true)],
      alternatives: [],
      rationale:
        'La decisión de pagar más simple: EV = bote·(% que ganás) − call·(% que perdés). Si tuvieras un proyecto serían Implied Odds; si pudieras resubir, Call vs Raise.',
    },
    {
      context: 'River · pagar un all-in',
      prompt:
        'Pagás un all-in en el river con tu equity ya estimada en Flopzilla. Querés el EV crudo de pagar: ganás el bote tu W%, perdés el call el resto.',
      hero: cards('Tc Td'),
      board: cards('Ah 9d 6s 2c 5h'),
      chips: [chip('Bote', '$90'), chip('A pagar', '$60', true)],
      alternatives: [],
      rationale:
        'Equity vs precio, sin más opciones: EV = bote·W% − call·L%. El breakeven es L/(W+L), tu equity mínima para que el call sea +EV.',
    },
    {
      context: 'River · mano de valor medio',
      prompt:
        'Mano de valor medio enfrentando una apuesta de river, sin proyecto ni opción de subir. ¿Pagar es +EV a secas según tu equity y el precio?',
      hero: cards('Kh Qd'),
      board: cards('Qs 7h 3c 9d 2s'),
      chips: [chip('Bote', '$80'), chip('A pagar', '$50', true)],
      alternatives: [],
      rationale:
        'EV básico = bote·W% − call·L%. Es la forma cruda de chequear si un call simple gana dinero a largo plazo.',
    },
  ],
  'ev-complex': [
    {
      context: 'Flop · semibluff',
      prompt:
        'Apostás un semibluff fuerte en el flop: a veces se tira (ganás el bote ya), a veces te paga y vas a showdown con la equity de tu proyecto.',
      hero: cards('Ah Kh'),
      board: cards('Qh 7h 2c'),
      chips: [chip('Bote', '$60'), chip('Tu apuesta', '$45', true)],
      alternatives: [],
      rationale:
        'Combina fold equity (cuando se tira) + tu equity cuando te pagan. Si tu mano no ganara nunca al showdown sería EV de bluff; si fueras all-in, All-in EV.',
    },
    {
      context: 'Turn · valor + folds',
      prompt:
        'Apostás una mano de valor en el turn que igual hace foldear a algunas manos: a veces se tira (ganás), a veces te paga y ganás o perdés según tu equity al showdown.',
      hero: cards('Ad Qc'),
      board: cards('Qd 8s 5h 3c'),
      chips: [chip('Bote', '$100'), chip('Tu apuesta', '$70', true)],
      alternatives: [],
      rationale:
        'EV con fold equity = Fold%·bote + Pagan%·(W·(bote+apuesta) − (1−W)·apuesta). Junta el valor cuando te pagan con los folds que te llevan el bote.',
    },
    {
      context: 'Flop · proyecto con outs',
      prompt:
        'Apostás un open-ender con dos overs: hay fold equity y, cuando te pagan, todavía tenés equity real para ganar en el showdown.',
      hero: cards('Jh Th'),
      board: cards('9c 8d 2s'),
      chips: [chip('Bote', '$50'), chip('Tu apuesta', '$35', true)],
      alternatives: [],
      rationale:
        'Dos fuentes de EV: que se tire + que ligues cuando te paga. Esa equity de respaldo es lo que la separa del EV de bluff puro.',
    },
  ],
  'bluff-ev': [
    {
      context: 'River · farol puro',
      prompt:
        'Apostás el river como farol puro: si te pagan no ganás nunca (tu mano falló). Solo ganás cuando el rival se tira.',
      hero: cards('6c 5c'),
      board: cards('Ah Kd 9s 2h Jc'),
      chips: [chip('Bote', '$100'), chip('Tu apuesta', '$75', true)],
      alternatives: [],
      rationale:
        'Farol puro: EV = fold%·bote − (1−fold%)·apuesta. Sin equity al showdown (con equity de respaldo sería EV con fold equity). El breakeven es apuesta/(bote+apuesta).',
    },
    {
      context: 'River · blocker bet de farol',
      prompt:
        'Tu proyecto no ligó y tirás una blocker bet chica como farol en el river. Solo capturás el bote las veces que el rival foldea.',
      hero: cards('7h 6h'),
      board: cards('As Qd 9c 4s 2d'),
      chips: [chip('Bote', '$80'), chip('Tu apuesta', '$25', true)],
      alternatives: [],
      rationale:
        'Sin showdown value, el único camino a ganar es el fold. EV = fold%·bote − (1−fold%)·apuesta: cuánta fold equity necesitás para break-even.',
    },
    {
      context: 'River · triple barrel',
      prompt:
        'Triple barrel de farol: apostás el river con aire total después de barrelear flop y turn. Si te pagan, perdés.',
      hero: cards('Qc Jc'),
      board: cards('Ts 7d 4h 2c 8s'),
      chips: [chip('Bote', '$150'), chip('Tu apuesta', '$110', true)],
      alternatives: [],
      rationale:
        'Aire = EV de bluff. Lo único que importa es con qué frecuencia se tira el rival vs el precio de tu apuesta.',
    },
  ],
  // ════════════════════════ Cuando apuestas tú ════════════════════════
  'check-vs-bet': [
    {
      context: 'River · en posición',
      prompt:
        'El rival checkea el river y estás en posición con un valor fino. ¿Apostás (por valor o de farol) para que pague peor, o hacés check behind?',
      hero: cards('Ah Qc'),
      board: cards('Qd 9s 4h 2c 7d'),
      chips: [chip('Bote', '$90', true)],
      alternatives: [],
      rationale:
        'En posición comparás el EV de checkear atrás (ir a showdown) contra apostar. La calc maneja Win% = 0 si bluffeás. Fuera de posición sería EV de checkear.',
    },
    {
      context: 'River · en posición',
      prompt:
        'En posición, el rival checkea el river. Tenés un valor delgado y dudás entre sacar una apuesta fina o checkear atrás y cerrar la acción.',
      hero: cards('Kd Jd'),
      board: cards('Ks 8c 5d 3h 2s'),
      chips: [chip('Bote', '$70', true)],
      alternatives: [],
      rationale:
        'Check vs Bet: ¿el valuebet fino gana más de lo que perdés cuando te pagan mejor, comparado con checkear? Decisión clásica de río en posición.',
    },
    {
      context: 'River · en posición',
      prompt:
        'En posición tras el check del rival, tu proyecto falló. ¿Apostás de farol o hacés check behind y te rendís?',
      hero: cards('Tc 9c'),
      board: cards('As Kd 6h 4s 2c'),
      chips: [chip('Bote', '$60', true)],
      alternatives: ['bluff-ev'],
      rationale:
        'Comparás apostar (de farol, Win% = 0) contra checkear atrás y rendirte. En posición esta comparación bet-vs-check es Check vs Bet; el lado farol puro también se ve con EV de bluff.',
    },
  ],
  'check-ev': [
    {
      context: 'River · fuera de posición',
      prompt:
        'Fuera de posición checkeás tu mano marginal. El rival puede apostar de farol (le pagás) o checkear atrás e ir a showdown. ¿Cuánto vale checkear?',
      hero: cards('Ah Jc'),
      board: cards('Js 8c 4h 2d 7s'),
      chips: [chip('Bote', '$80', true)],
      alternatives: [],
      rationale:
        'Apostar fino OOP solo hace que el villano tire faroles y te pague peor. La herramienta es EV de checkear: las veces que checkea atrás (sin valor) vs las que farolea y le pagás.',
    },
    {
      context: 'River · fuera de posición',
      prompt:
        'Checkeás OOP para inducir faroles con un bluff-catcher. Comparás las veces que el rival checkea atrás contra las que apuesta y le pagás.',
      hero: cards('Kh Qs'),
      board: cards('Qc 9d 5s 3h 2c'),
      chips: [chip('Bote', '$100', true)],
      alternatives: [],
      rationale:
        'EV de checkear junta las dos ramas del check OOP: check-check (showdown) y check-call cuando apuesta. Es la calc del check fuera de posición.',
    },
    {
      context: 'River · fuera de posición',
      prompt:
        'Tu mano gana a los faroles pero pierde al valor. Checkeás OOP y querés el EV de la línea de check, no de apostar.',
      hero: cards('9d 9c'),
      board: cards('Ah Ks 7d 4c 2s'),
      chips: [chip('Bote', '$60', true)],
      alternatives: [],
      rationale:
        'Fuera de posición no podés check behind: evaluás el EV de checkear (rival apuesta → pagás, rival checkea → showdown), no Check vs Bet.',
    },
  ],
  'value-bluff': [
    {
      context: 'River · balance del rango',
      prompt:
        'Tenés 18 combos de valor apostando 75% del bote en el river. ¿Cuántos faroles podés agregar para quedar balanceado?',
      hero: [],
      board: cards('As Kd 7h 3c 2s'),
      chips: [chip('Bote', '$100'), chip('Apuesta', '$75', true), chip('Combos de valor', '18')],
      alternatives: [],
      rationale:
        'Faroles = valor · apuesta/(bote+apuesta). El tamaño de la apuesta fija la proporción valor:farol óptima de tu rango de apuesta.',
    },
    {
      context: 'River · proporción valor:farol',
      prompt:
        'Apostás medio bote en el river con tus manos de valor. Querés la cantidad de faroles que mantiene el rango balanceado (ni explotable por foldear ni por pagar).',
      hero: [],
      board: cards('Qh Jd 8s 4c 2h'),
      chips: [chip('Bote', '$120'), chip('Apuesta', '$60', true), chip('Combos de valor', '24')],
      alternatives: [],
      rationale:
        'A medio bote la proporción es ~2:1 valor:farol. Value / Bluff cuenta cuántos combos de farol corresponden a tus combos de valor.',
    },
    {
      context: 'River · armar el rango',
      prompt:
        'Armás tu rango de apuesta de river: con tus combos de valor y el tamaño elegido, ¿cuántos bluffs sumás sin pasarte?',
      hero: [],
      board: cards('9s 8d 5c 3h 2d'),
      chips: [chip('Bote', '$80'), chip('Apuesta', '$80', true), chip('Combos de valor', '12')],
      alternatives: [],
      rationale:
        'Value / Bluff = valor · apuesta/(bote+apuesta). Al tamaño bote la proporción es ~1:1; el conteo te dice cuántos faroles meter.',
    },
  ],
  'double-barrel': [
    {
      context: 'Flop · plan de dos barriles',
      prompt:
        'Cbeteás el flop y planeás volver a apostar el turn (segundo barril). Querés el EV de la línea completa de dos barriles, no de un barril suelto.',
      hero: cards('Ad Kc'),
      board: cards('Qh 7s 2d'),
      chips: [chip('Bote', '$50'), chip('Apuesta flop', '$35', true)],
      alternatives: ['bluff-ev'],
      rationale:
        'La línea completa puede ser +EV aunque el barril del flop solo sea −EV, porque sumás los folds del turn. Eso es Doble barrel; un barril aislado se ve con EV de bluff.',
    },
    {
      context: 'Flop → Turn · barrel',
      prompt:
        'Apostás el flop y pensás disparar de nuevo en el turn si llega una carta que asuste al rival. Evaluás las dos calles juntas.',
      hero: cards('As Js'),
      board: cards('Kd 8h 3c'),
      chips: [chip('Bote', '$60'), chip('Apuesta flop', '$40', true)],
      alternatives: ['bluff-ev'],
      rationale:
        'Doble barrel cuenta los folds del flop más los del turn: la suma rescata barriles que sueltos no cierran.',
    },
    {
      context: 'Flop → Turn · farol',
      prompt:
        'Doble barril de farol: flop + turn con aire, contando el fold extra que conseguís en la segunda apuesta.',
      hero: cards('Tc 9d'),
      board: cards('Ah 6s 2c'),
      chips: [chip('Bote', '$40'), chip('Apuesta flop', '$28', true)],
      alternatives: ['bluff-ev'],
      rationale:
        'Modelás la fold equity acumulada de las dos calles. Por eso Doble barrel y no un EV de bluff de una sola apuesta.',
    },
  ],
  'multi-street': [
    {
      context: 'Turn → River · EV encadenado',
      prompt:
        'Querés un solo número de EV que encadene tu jugada del turn con la del river, ponderando cuántas veces llegás a ver el river.',
      hero: [],
      board: cards('Kd 9s 4h'),
      chips: [chip('EV turn', '+$12'), chip('Ver river', '70%', true), chip('EV river', '−$8')],
      alternatives: [],
      rationale:
        'EV multi-calle = EV_turn + P(ver river)·EV_river. Une dos calles de un plan en un único EV.',
    },
    {
      context: 'Plan de dos calles',
      prompt:
        'Tu plan tiene dos decisiones (turn y river). Combinás el EV de cada calle según la probabilidad de seguir en la mano.',
      hero: [],
      board: cards('Qs 8d 5c'),
      chips: [chip('EV turn', '+$20'), chip('Ver river', '50%', true), chip('EV river', '−$30')],
      alternatives: [],
      rationale:
        'El aporte del river entra ponderado por cuántas veces lo ves. Es exactamente lo que calcula EV multi-calle.',
    },
    {
      context: 'Turn → River · combinar',
      prompt:
        'Ya estimaste el EV del turn y el del river por separado. Querés unirlos en un solo EV de la línea completa.',
      hero: [],
      board: cards('Ah Td 6s'),
      chips: [chip('EV turn', '−$5'), chip('Ver river', '60%', true), chip('EV river', '+$18')],
      alternatives: [],
      rationale:
        'EV total = EV_turn + (% ver river)·EV_river. Encadena calles; no es el EV de una sola apuesta.',
    },
  ],
  // ════════════════════════ Cuando enfrentas una apuesta ════════════════════════
  'implied-odds': [
    {
      context: 'Turn · proyecto fuera de odds',
      prompt:
        'Tenés proyecto de color y las odds directas no alcanzan para pagar, pero esperás cobrar más del stack del rival si ligás. ¿Cuánto extra necesitás ganar después?',
      hero: cards('9h 8h'),
      board: cards('Ks 7h 2h'),
      chips: [chip('Bote', '$60'), chip('A pagar', '$30', true)],
      alternatives: [],
      rationale:
        'Implied Odds: cuando el precio inmediato no justifica el call, calculás cuánto necesitás cobrar en calles futuras al completar. EV básico ignoraría ese cobro extra.',
    },
    {
      context: 'Preflop · set mining',
      prompt:
        'Pagás preflop con un par chico esperando cobrar grande las veces que ligás set. Las odds directas no alcanzan; dependés de lo que ganás después.',
      hero: cards('5c 5d'),
      board: [],
      chips: [chip('Bote', '$15'), chip('A pagar', '$9', true)],
      alternatives: [],
      rationale:
        'Set mining es el caso típico de Implied Odds: pagás fuera de odds directas por el stack que cobrás cuando ligás.',
    },
    {
      context: 'Flop · escalera abierta',
      prompt:
        'Tenés escalera abierta enfrentando una apuesta que no te da precio directo. ¿Justifica el call lo que esperás cobrar si completás en el turn/river?',
      hero: cards('Jd Tc'),
      board: cards('9s 8c 2h'),
      chips: [chip('Bote', '$50'), chip('A pagar', '$35', true)],
      alternatives: [],
      rationale:
        'Implied Odds = call/equity − call − bote: cuánto extra te tienen que pagar para que el proyecto valga el call ahora.',
    },
  ],
  'float-ev': [
    {
      context: 'Flop · flotar',
      prompt:
        'Pagás el cbet del flop con aire (float) para apostar el turn cuando te checkean. ¿Es rentable según cuánto barrelea vs checkea el rival?',
      hero: cards('Tc 9c'),
      board: cards('Ks 7d 2h'),
      chips: [chip('Bote', '$60'), chip('A pagar', '$40', true), chip('Tu apuesta turn', '$75')],
      alternatives: [],
      rationale:
        'EV de flotar: 3 ramas — el rival check/foldea el turn (ganás), barrelea (foldeás), o check/continúa (perdés call+apuesta). Las frecuencias del rival deciden si el float gana.',
    },
    {
      context: 'Flop · float para robar',
      prompt:
        'Flotás el cbet del flop con un gutshot planeando robar el bote en el turn si el rival muestra debilidad y checkea.',
      hero: cards('Qd Jd'),
      board: cards('8s 5c 2h'),
      chips: [chip('Bote', '$40'), chip('A pagar', '$28', true), chip('Tu apuesta turn', '$50')],
      alternatives: [],
      rationale:
        'Flotar = pagar liviano una calle para atacar la siguiente. El EV depende de barrel% y check-fold% del rival en el turn.',
    },
    {
      context: 'Flop · call liviano',
      prompt:
        'Call liviano del flop con la intención de apostar el turn cuando te checkean. Querés el EV de esa línea de float.',
      hero: cards('Ac 4c'),
      board: cards('Jh 9d 3s'),
      chips: [chip('Bote', '$70'), chip('A pagar', '$45', true), chip('Tu apuesta turn', '$80')],
      alternatives: [],
      rationale:
        'EV de flotar pesa las tres respuestas del rival al turn. Es distinto de un call simple por valor o implied odds: el plan es apostar después.',
    },
  ],
  'call-vs-raise': [
    {
      context: 'Turn · pagar o resubir',
      prompt:
        'Enfrentás una apuesta con una mano fuerte y dudás entre solo pagar o resubir all-in. Comparás el EV de cada opción.',
      hero: cards('Kd Kc'),
      board: cards('Qs 8h 3d'),
      chips: [chip('Bote', '$80'), chip('Apuesta villano', '$50'), chip('Tu all-in', '$300', true)],
      alternatives: [],
      rationale:
        'Lo que define Call vs Raise es la opción de subir: comparás el EV de pagar contra el de resubir all-in (con su fold equity). Sin la opción de subir sería EV básico.',
    },
    {
      context: 'River · valor: pagar o subir',
      prompt:
        'Tenés una mano fuerte enfrentando una apuesta de river. ¿Solo pagás o subís por valor buscando más fichas?',
      hero: cards('Ah Qh'),
      board: cards('Ad Qc 9h 5s 2d'),
      chips: [chip('Bote', '$120'), chip('Apuesta villano', '$80'), chip('Tu raise', '$240', true)],
      alternatives: [],
      rationale:
        'Call vs Raise compara las dos líneas activas: pagar vs subir. La mejor de {Call, Raise, Fold} es tu jugada.',
    },
    {
      context: 'Flop · proyecto fuerte',
      prompt:
        'Con un proyecto fuerte enfrentando una apuesta, evaluás pagar para ver otra carta o resubir all-in como semibluff.',
      hero: cards('9h 8h'),
      board: cards('7h 6c 2h'),
      chips: [chip('Bote', '$50'), chip('Apuesta villano', '$35'), chip('Tu all-in', '$200', true)],
      alternatives: [],
      rationale:
        'Pagar vs resubir all-in: el raise suma fold equity a tu equity de proyecto. Comparar ambas es Call vs Raise.',
    },
  ],
  'raise-bluff': [
    {
      context: 'Flop · raise de farol',
      prompt:
        'Subís de farol la apuesta del rival (raise sin equity). Solo ganás cuando se tira a tu subida; si te paga, perdés.',
      hero: cards('Tc 9c'),
      board: cards('As 9d 4c'),
      chips: [chip('Bote', '$50'), chip('Apuesta villano', '$30'), chip('Costo de tu raise', '$90', true)],
      alternatives: [],
      rationale:
        'EV del raise (farol) = fold%·(bote+apuesta) − (1−fold%)·costo del raise. Es un farol, pero enfrentando una apuesta ya hecha — no un bet a bote vacío (eso sería EV de bluff).',
    },
    {
      context: 'Flop · check-raise de farol',
      prompt:
        'Check-raiseás de farol el cbet del rival. Querés cuánta fold equity necesita la subida para ser rentable.',
      hero: cards('Jh Th'),
      board: cards('Kd 7s 3c'),
      chips: [chip('Bote', '$40'), chip('Apuesta villano', '$25'), chip('Costo de tu raise', '$80', true)],
      alternatives: [],
      rationale:
        'EV del raise como farol: el breakeven de fold es costo/(costo+bote+apuesta). Distinto de EV de bluff porque hay una apuesta del rival en el bote.',
    },
    {
      context: 'Turn · resubir de farol',
      prompt:
        'Resubís de farol un cbet chico para robar el bote. Solo capturás las fichas cuando el rival foldea a tu raise.',
      hero: cards('Qs Jd'),
      board: cards('Ah Ks 6c 2d'),
      chips: [chip('Bote', '$60'), chip('Apuesta villano', '$30'), chip('Costo de tu raise', '$110', true)],
      alternatives: [],
      rationale:
        'EV del raise mide la fold equity de tu subida de farol frente a una apuesta existente, no la de un bet inicial.',
    },
  ],
  'raise-sizing': [
    {
      context: 'Flop · dimensionar el raise',
      prompt:
        'Querés saber qué % del bote representa tu raise sobre la apuesta del rival y qué odds le das para pagar.',
      hero: [],
      board: cards('Th 8s 3d'),
      chips: [chip('Bote', '$10'), chip('Apuesta', '$3'), chip('Tu raise', '$9', true)],
      alternatives: [],
      rationale:
        'Raise sizing: % del bote = raise/(3·apuesta+bote) y las pot odds que ofrecés = (raise−apuesta)/(2·raise+bote). Pura geometría del bote, sin equity.',
    },
    {
      context: 'Flop · raise en fichas',
      prompt:
        'Querés dimensionar tu check-raise: cuántas fichas equivalen a un raise de cierto % del bote sobre la apuesta del rival.',
      hero: [],
      board: cards('9c 7d 4s'),
      chips: [chip('Bote', '$20'), chip('Apuesta', '$6'), chip('% objetivo', '50%', true)],
      alternatives: [],
      rationale:
        'El conversor inverso: fichas = (3·apuesta+bote)·% objetivo. Raise sizing traduce entre % del bote y fichas.',
    },
    {
      context: 'Flop · odds que ofrecés',
      prompt:
        'Resubís y querés saber qué pot odds le estás ofreciendo al rival para pagar tu raise (qué equity necesita).',
      hero: [],
      board: cards('Ks Qd 5c'),
      chips: [chip('Bote', '$30'), chip('Apuesta', '$10'), chip('Tu raise', '$30', true)],
      alternatives: [],
      rationale:
        'Pot odds vs raise = (raise−apuesta)/(2·raise+bote): la equity mínima que el rival necesita para pagar. Es geometría del bote → Raise sizing.',
    },
  ],
  // ════════════════════════ All-in ════════════════════════
  'all-in-ev': [
    {
      context: 'Flop · shove con combo draw',
      prompt:
        'Vas all-in en el flop con un combo draw: a veces se tira (ganás el bote), a veces te paga y vas a showdown con tu equity. Querés el EV del shove.',
      hero: cards('Jh Th'),
      board: cards('9h 8c 2h'),
      chips: [chip('Bote', '$60'), chip('Tu all-in', '$150', true)],
      alternatives: ['ev-complex', 'fold-equity-required'],
      rationale:
        'All-in EV junta fold equity + tu equity cuando te pagan, y te da el breakeven de fold. Es el shove completo; el umbral mínimo de fold lo aísla FE requerida.',
    },
    {
      context: 'Turn · shove sobre la apuesta',
      prompt:
        'Shoveás all-in sobre la apuesta del rival con un draw fuerte: combinás las veces que foldea con tu equity cuando paga.',
      hero: cards('Ad Kd'),
      board: cards('Qd 7d 3s 2c'),
      chips: [chip('Bote', '$90'), chip('A pagar', '$50'), chip('Tu all-in', '$320', true)],
      alternatives: ['ev-complex', 'fold-equity-required'],
      rationale:
        'EV del all-in = Fold·bote + (1−Fold)·[eq·(bote+shove−call) − (1−eq)·shove]. Mezcla fold equity y equity al showdown.',
    },
    {
      context: 'Flop · push con par + proyecto',
      prompt:
        'Empujás all-in con par + proyecto de color: fold equity más una equity de respaldo sólida cuando te pagan.',
      hero: cards('9s 8s'),
      board: cards('8h 6s 5s'),
      chips: [chip('Bote', '$45'), chip('Tu all-in', '$120', true)],
      alternatives: ['ev-complex', 'fold-equity-required'],
      rationale:
        'All-in EV es la herramienta del shove: cuantifica el valor combinado de los folds y de tu equity cuando hay showdown.',
    },
  ],
  'fold-equity-required': [
    {
      context: 'Flop · umbral de fold del shove',
      prompt:
        'Vas all-in con equity de proyecto y querés el fold% MÍNIMO para break-even — baja respecto a un farol puro gracias a tus outs.',
      hero: cards('Ah 5h'),
      board: cards('Kh 9h 2c'),
      chips: [chip('Bote', '$50'), chip('Shove', '$120', true), chip('Equity', '30%')],
      alternatives: [],
      rationale:
        'FE requerida despeja el fold% de break-even contando tu equity: con outs, el umbral baja respecto al shove sin equity (bet/(bote+bet)).',
    },
    {
      context: 'Turn · semibluff shove',
      prompt:
        'Tu semibluff all-in necesita cierta fold equity para ser rentable. ¿Cuál es el fold% mínimo dado que a veces ligás cuando te pagan?',
      hero: cards('Td 9d'),
      board: cards('Js 8c 4d 2h'),
      chips: [chip('Bote', '$70'), chip('Shove', '$140', true), chip('Equity', '25%')],
      alternatives: [],
      rationale:
        'FE requerida = el break-even de fold cuando tenés equity de respaldo. Aísla el umbral; el EV completo del shove lo da All-in EV.',
    },
    {
      context: 'Flop · ¿necesito que foldeen?',
      prompt:
        'Shoveás un proyecto fuerte y querés saber qué tan seguido necesitás que el rival se tire para que el all-in sea break-even.',
      hero: cards('Qc Jc'),
      board: cards('Tc 9s 3c'),
      chips: [chip('Bote', '$40'), chip('Shove', '$100', true), chip('Equity', '38%')],
      alternatives: [],
      rationale:
        'Con mucha equity de proyecto, el fold% mínimo puede ser muy bajo (incluso ≤ 0). FE requerida es la calc que lo despeja.',
    },
  ],
  // ════════════════════════ Multi-way ════════════════════════
  'combined-fold': [
    {
      context: 'Multi-way · farol',
      prompt:
        'Apostás de farol en un bote multiway y necesitás que TODOS se tiren para que funcione. Combinás las frecuencias de fold de cada rival.',
      hero: [],
      board: cards('Ks 9d 4c'),
      chips: [chip('Fold A', '60%'), chip('Fold B', '55%'), chip('Fold C', '70%', true)],
      alternatives: [],
      rationale:
        'Fold equity combinada = producto de los folds individuales. Con varios rivales la probabilidad de que todos foldeen cae rápido.',
    },
    {
      context: 'Multi-way · cbet de farol',
      prompt:
        'Cbeteás de farol contra dos rivales. Tu fold equity total es la probabilidad de que ambos se tiren a la vez.',
      hero: [],
      board: cards('Qh 8s 3d'),
      chips: [chip('Fold A', '65%'), chip('Fold B', '60%', true)],
      alternatives: [],
      rationale:
        'En multiway los folds se multiplican: 65%·60% ≈ 39%. Fold equity combinada modela ese producto.',
    },
    {
      context: 'Multi-way · robar el bote',
      prompt:
        'Querés robar un bote con tres jugadores: la jugada solo gana si los tres foldean. ¿Cuál es la fold equity conjunta?',
      hero: [],
      board: cards('Ad Td 6s'),
      chips: [chip('Fold A', '70%'), chip('Fold B', '50%'), chip('Fold C', '80%', true)],
      alternatives: [],
      rationale:
        'Fold equity combinada multiplica las frecuencias de fold de los jugadores con dato; los vacíos se ignoran.',
    },
  ],
  'multiway-call': [
    {
      context: 'Multi-way · pagar',
      prompt:
        'Te toca pagar en un bote multiway: tu equity se reparte distinto que heads-up porque hay varias manos vivas. Comparás el split HU vs multiway.',
      hero: cards('Ah Kc'),
      board: cards('Kd 9s 4h'),
      chips: [chip('Bote', '$90'), chip('A pagar', '$30', true)],
      alternatives: [],
      rationale:
        'Call multi-way modela el EV de pagar cuando hay más de un rival: tu equity contra dos manos no es la misma que HU, y el bote final cambia.',
    },
    {
      context: 'Multi-way · proyecto',
      prompt:
        'Pagás con un proyecto en un bote de tres jugadores. Querés el EV del call considerando que tu equity se diluye entre varios rivales.',
      hero: cards('Jh Th'),
      board: cards('9h 8c 2d'),
      chips: [chip('Bote', '$60'), chip('A pagar', '$20', true)],
      alternatives: [],
      rationale:
        'Con varios jugadores vivos el EV de pagar cambia: Call multi-way separa la equity HU de la multiway y pondera cada rama.',
    },
    {
      context: 'Multi-way · enfrentás una apuesta',
      prompt:
        'Enfrentás una apuesta con dos rivales aún en mano. ¿Cuánto cambia el EV de pagar respecto a un escenario heads-up?',
      hero: cards('Qd Qs'),
      board: cards('Js 7d 3c'),
      chips: [chip('Bote', '$75'), chip('A pagar', '$25', true)],
      alternatives: [],
      rationale:
        'Call multi-way: tu equity y el split del bote dependen de cuántas manos siguen. Por eso no alcanza con un EV básico heads-up.',
    },
  ],
};

// ── Pool + generator ─────────────────────────────────────────────────────────
function buildPool(): QuizSpot[] {
  const pool: QuizSpot[] = [];
  for (const group of CALC_GROUPS) {
    for (const item of group.items) {
      const scenarios = BANK[item.mode];
      scenarios.forEach((sc, i) => {
        pool.push({ id: `${item.mode}-${i}`, correct: item.mode, ...sc });
      });
    }
  }
  return pool;
}

export const QUIZ_POOL: readonly QuizSpot[] = buildPool();

const ALL_MODES: readonly CalcMode[] = CALC_GROUPS.flatMap((g) =>
  g.items.map((i) => i.mode),
);

/** The pedagogical group's modes for a given mode (for hard, near-miss distractors). */
function groupModesOf(mode: CalcMode): CalcMode[] {
  const group = CALC_GROUPS.find((g) => g.items.some((i) => i.mode === mode));
  return group ? group.items.map((i) => i.mode) : [];
}

function shuffle<T>(arr: readonly T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Builds one multiple-choice question: correct calc + 3 truly-wrong distractors. */
export function generateQuizQuestion(
  pool: readonly QuizSpot[] = QUIZ_POOL,
): QuizQuestion {
  const spot = pool[Math.floor(Math.random() * pool.length)]!;
  const exclude = new Set<CalcMode>([spot.correct, ...spot.alternatives]);
  const sameGroup = groupModesOf(spot.correct).filter((m) => !exclude.has(m));
  const others = ALL_MODES.filter(
    (m) => !exclude.has(m) && !sameGroup.includes(m),
  );
  // Prefer same-group distractors (harder), then fill from the rest.
  const distractors = [...shuffle(sameGroup), ...shuffle(others)].slice(0, 3);
  return { spot, options: shuffle([spot.correct, ...distractors]) };
}
