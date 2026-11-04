// "Mano de prueba": a hand typed by hand, without going through /analisis
// (D3c). Pure data + validation; the form lives in TestHandForm.tsx.

import { parseCards, type CardId } from '../engine/cards';
import type { AnalyzerHandInput } from '../engine/chain';
import type { ComboWeights } from '../engine/combos';
import type { Street } from '../engine/equity';
import { parseRangeText } from '../engine/rangeText';

export type TestHandValues = {
  hero: string;
  board: string;
  range: string;
  heroPosition: string;
  villainPosition: string;
  pots: Record<Street, string>;
};

export const DEFAULT_TEST_HAND: TestHandValues = {
  hero: 'AsKs',
  board: 'Kh 9h 4c 7s 2d',
  range:
    '22-JJ, QQ:50, A2s-AJs, AQs:50, AQo, AJo-A8o, A7o-A2o:50, K2s-KQs, KQo, KJo-K9o, K8o:50, Q2s-QJs, QJo-Q9o, J4s-JTs, JTo-J9o, T6s-T9s, T9o-T8o, 96s-98s, 98o, 85s-87s, 87o, 74s-76s, 63s-65s, 52s-54s, 42s-43s',
  heroPosition: 'BTN',
  villainPosition: 'BB',
  pots: { flop: '5.5', turn: '9.1', river: '22.7' },
};

export type BuiltTestHand =
  | { ok: true; hand: AnalyzerHandInput; villain: ComboWeights; warnings: string[] }
  | { ok: false; errors: string[] };

function parsePot(raw: string): number | undefined {
  const n = Number(raw.replace(',', '.'));
  return raw.trim() !== '' && Number.isFinite(n) && n > 0 ? n : undefined;
}

export function buildTestHand(v: TestHandValues): BuiltTestHand {
  const errors: string[] = [];
  const hero = parseCards(v.hero);
  const board = parseCards(v.board);
  if (!hero || hero.length !== 2) errors.push('Hero necesita exactamente 2 cartas (ej.: AsKs).');
  if (!board || board.length < 3 || board.length > 5) {
    errors.push('El board necesita de 3 a 5 cartas (ej.: Kh 9h 4c 7s 2d).');
  }
  if (hero && board) {
    const all: CardId[] = [...hero, ...board];
    if (new Set(all).size !== all.length) errors.push('Hero y el board repiten una carta.');
  }
  const range = parseRangeText(v.range);
  if (range.classes === 0) errors.push('El rango del villano está vacío o no se pudo leer.');
  if (errors.length > 0 || !hero || !board) return { ok: false, errors };

  const pots: Partial<Record<Street, number>> = {};
  for (const s of ['flop', 'turn', 'river'] as const) {
    const p = parsePot(v.pots[s]);
    if (p !== undefined) pots[s] = p;
  }
  return {
    ok: true,
    hand: {
      hero: [hero[0]!, hero[1]!],
      board,
      pots,
      heroPosition: v.heroPosition.trim() || undefined,
      villainPosition: v.villainPosition.trim() || undefined,
    },
    villain: range.weights,
    warnings: range.errors.map((e) => `No se leyó «${e.token}» (${e.reason}).`),
  };
}
