// Pot odds: math + question generation for the Odds trainer.
// Eight canonical bet sizings, expressed as fraction of pot.

export type Sizing = '1/4' | '1/3' | '1/2' | '2/3' | '3/4' | 'pot' | '1.5x' | '2x';

export const SIZINGS: readonly Sizing[] = [
  '1/4',
  '1/3',
  '1/2',
  '2/3',
  '3/4',
  'pot',
  '1.5x',
  '2x',
] as const;

const SIZING_FRACTION: Record<Sizing, number> = {
  '1/4': 0.25,
  '1/3': 1 / 3,
  '1/2': 0.5,
  '2/3': 2 / 3,
  '3/4': 0.75,
  pot: 1,
  '1.5x': 1.5,
  '2x': 2,
};

// Display strings used inside prompts ("Apuestas 1/2 del bote").
const SIZING_PROMPT_LABEL: Record<Sizing, string> = {
  '1/4': '1/4 del bote',
  '1/3': '1/3 del bote',
  '1/2': '1/2 del bote',
  '2/3': '2/3 del bote',
  '3/4': '3/4 del bote',
  pot: 'tamaño del bote',
  '1.5x': '1.5x el bote',
  '2x': '2x el bote',
};

// Canonical display values matching the reference table the user provided.
// Hardcoded (instead of computed) to avoid floating-point drift and to keep
// MC option matching as discrete equality on strings.
const BLUFF_FE_DISPLAY: Record<Sizing, string> = {
  '1/4': '20%',
  '1/3': '25%',
  '1/2': '33%',
  '2/3': '40%',
  '3/4': '43%',
  pot: '50%',
  '1.5x': '60%',
  '2x': '66%',
};

const CALL_EQ_DISPLAY: Record<Sizing, string> = {
  '1/4': '16%',
  '1/3': '20%',
  '1/2': '25%',
  '2/3': '28%',
  '3/4': '30%',
  pot: '33%',
  '1.5x': '37.5%',
  '2x': '40%',
};

export type QuestionKind = 'bluff-fe' | 'call-eq' | 'bluff-size' | 'call-size';

export const ALL_KINDS: readonly QuestionKind[] = [
  'bluff-fe',
  'call-eq',
  'bluff-size',
  'call-size',
] as const;

export const KIND_LABEL: Record<QuestionKind, string> = {
  'bluff-fe': 'Bluff FE',
  'call-eq': 'Call equity',
  'bluff-size': 'Bluff size',
  'call-size': 'Call size',
};

/**
 * Structured question shape for the rich prompt UI.
 * `scenarioLabel` + `scenarioValue` form a chip (label above muted, value below
 * highlighted) so the variable datum (sizing or %) is the first thing the eye
 * catches. `question.keyword` is what the player must compute — rendered in
 * accent color so the *concept asked* is the second hit. `prompt` stays as the
 * flat string for a11y / mistakes recap.
 */
type BaseQuestion = {
  kind: QuestionKind;
  prompt: string;
  scenarioLabel: string;
  scenarioValue: string;
  question: {
    lead: string;
    keyword: string;
    tail: string;
  };
  options: readonly string[]; // 4 strings, includes correct
  correct: string;
  explanation: string;
  /**
   * The bet sizing referenced in the prompt (only for direct kinds where the
   * size is given as input). `undefined` for inverse kinds where the size IS
   * the answer and revealing it would spoil the question.
   */
  visualSize?: Sizing;
};

export type OddsQuestion = BaseQuestion;

export function sizingFraction(size: Sizing): number {
  return SIZING_FRACTION[size];
}

export function bluffFoldEquity(size: Sizing): string {
  return BLUFF_FE_DISPLAY[size];
}

export function callEquity(size: Sizing): string {
  return CALL_EQ_DISPLAY[size];
}

function sizingByFoldEquity(pct: string): Sizing {
  for (const s of SIZINGS) {
    if (BLUFF_FE_DISPLAY[s] === pct) return s;
  }
  // unreachable if pct came from BLUFF_FE_DISPLAY values
  throw new Error(`No sizing maps to fold equity ${pct}`);
}

function sizingByCallEquity(pct: string): Sizing {
  for (const s of SIZINGS) {
    if (CALL_EQ_DISPLAY[s] === pct) return s;
  }
  throw new Error(`No sizing maps to call equity ${pct}`);
}

// Pick `count` indices nearest to `correctIdx` from [0, total). Ties broken
// randomly so distractors aren't always biased to one side.
function pickNeighborIndices(
  correctIdx: number,
  total: number,
  count: number,
): number[] {
  const others: number[] = [];
  for (let i = 0; i < total; i++) {
    if (i !== correctIdx) others.push(i);
  }
  others.sort((a, b) => {
    const da = Math.abs(a - correctIdx);
    const db = Math.abs(b - correctIdx);
    if (da !== db) return da - db;
    return Math.random() - 0.5;
  });
  return others.slice(0, count);
}

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

// Build 4 options around a correct value located at correctIdx in `pool`.
// Returns the 4 stringified entries shuffled.
function buildOptions(pool: readonly string[], correctIdx: number): string[] {
  const neighbors = pickNeighborIndices(correctIdx, pool.length, 3);
  const out = [pool[correctIdx]!, ...neighbors.map((i) => pool[i]!)];
  return shuffleInPlace(out);
}

function fmtFrac(n: number): string {
  // Two-decimal trimming, used inside the explanation only.
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? String(r) : String(r);
}

function buildBluffFeQuestion(size: Sizing): OddsQuestion {
  const correct = BLUFF_FE_DISPLAY[size];
  const pool = SIZINGS.map((s) => BLUFF_FE_DISPLAY[s]);
  const idx = SIZINGS.indexOf(size);
  const f = SIZING_FRACTION[size];
  return {
    kind: 'bluff-fe',
    prompt: `Apuestas ${SIZING_PROMPT_LABEL[size]}. ¿Cuánta fold equity necesitas para que el bluff sea rentable?`,
    scenarioLabel: 'Tú apuestas',
    scenarioValue: SIZING_PROMPT_LABEL[size],
    question: {
      lead: '¿Cuánta',
      keyword: 'fold equity',
      tail: 'necesitas para que el bluff sea rentable?',
    },
    options: buildOptions(pool, idx),
    correct,
    explanation: `bet / (pot + bet) = ${fmtFrac(f)} / (1 + ${fmtFrac(f)}) = ${correct}`,
    visualSize: size,
  };
}

function buildCallEqQuestion(size: Sizing): OddsQuestion {
  const correct = CALL_EQ_DISPLAY[size];
  const pool = SIZINGS.map((s) => CALL_EQ_DISPLAY[s]);
  const idx = SIZINGS.indexOf(size);
  const f = SIZING_FRACTION[size];
  return {
    kind: 'call-eq',
    prompt: `Villano apuesta ${SIZING_PROMPT_LABEL[size]}. ¿Qué equity necesitas para que pagar sea rentable?`,
    scenarioLabel: 'Villano apuesta',
    scenarioValue: SIZING_PROMPT_LABEL[size],
    question: {
      lead: '¿Qué',
      keyword: 'equity',
      tail: 'necesitas para que pagar sea rentable?',
    },
    options: buildOptions(pool, idx),
    correct,
    explanation: `call / (pot + 2·bet) = ${fmtFrac(f)} / (1 + ${fmtFrac(2 * f)}) = ${correct}`,
    visualSize: size,
  };
}

function buildBluffSizeQuestion(size: Sizing): OddsQuestion {
  // We pose: "you need villain to fold X%, what size do you bet?"
  const fe = BLUFF_FE_DISPLAY[size];
  const correct = size;
  const idx = SIZINGS.indexOf(size);
  return {
    kind: 'bluff-size',
    prompt: `Necesitas que villano foldee el ${fe} del tiempo. ¿Qué tamaño deberías apostar?`,
    scenarioLabel: 'Quieres que villano foldee',
    scenarioValue: fe,
    question: {
      lead: '¿Qué',
      keyword: 'tamaño',
      tail: 'deberías apostar?',
    },
    options: buildOptions(SIZINGS, idx),
    correct,
    explanation: `Necesitas bet/(pot+bet) = ${fe} → bet = ${SIZING_PROMPT_LABEL[size]}.`,
  };
}

function buildCallSizeQuestion(size: Sizing): OddsQuestion {
  // We pose: "you have X% equity, max bet you can profitably call?"
  const eq = CALL_EQ_DISPLAY[size];
  const correct = size;
  const idx = SIZINGS.indexOf(size);
  return {
    kind: 'call-size',
    prompt: `Tienes ${eq} de equity. ¿Hasta qué apuesta de villano puedes pagar y seguir siendo rentable?`,
    scenarioLabel: 'Tienes',
    scenarioValue: `${eq} de equity`,
    question: {
      lead: '¿Hasta qué',
      keyword: 'bet',
      tail: 'de villano puedes pagar y ser rentable?',
    },
    options: buildOptions(SIZINGS, idx),
    correct,
    explanation: `Con ${eq} de equity rompes con call/(pot+2·bet) = ${eq} → bet máximo = ${SIZING_PROMPT_LABEL[size]}.`,
  };
}

export function generateQuestion(
  enabledKinds: readonly QuestionKind[] = ALL_KINDS,
): OddsQuestion {
  const kinds = enabledKinds.length > 0 ? enabledKinds : ALL_KINDS;
  const kind = pickRandom(kinds);
  const size = pickRandom(SIZINGS);
  switch (kind) {
    case 'bluff-fe':
      return buildBluffFeQuestion(size);
    case 'call-eq':
      return buildCallEqQuestion(size);
    case 'bluff-size':
      return buildBluffSizeQuestion(size);
    case 'call-size':
      return buildCallSizeQuestion(size);
  }
}

// Exposed for unit-style verification in dev.
export const _internals = {
  SIZING_FRACTION,
  BLUFF_FE_DISPLAY,
  CALL_EQ_DISPLAY,
  sizingByFoldEquity,
  sizingByCallEquity,
};
