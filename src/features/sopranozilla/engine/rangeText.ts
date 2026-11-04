// Villain range text → per-combo weights. Accepts everything the app's shared
// parser reads (`parseHandRange`: "AKs, 22+, A2s-AJs, [50]QJs[/50]") plus the
// "hand:weight" shorthand ("QQ:50", "A7o-A2o:50"), rewritten to the bracket
// form here so the shared parser is not touched. A weight ≤ 1 written with a
// decimal point is read as a fraction ("QQ:0.5" = 50%).
//
// Single combos are read EXACTLY, suit by suit: solver lists ("AhKd: 0.5",
// "AdKc: 1" — weight 0..1) and plain or bracketed combos ("AhKh",
// "[50]AhKh[/50]"). The shared parser folds a solver list into whole classes,
// which would lose which suits are in the range.

import { parseHandRange, type ParseError } from '@/utils/handRangeParser';
import { parseCards } from './cards';
import { comboId, weightsFromClassWeights, type ComboId, type ComboWeights } from './combos';

const COMBO = /^[2-9TJQKA][cdhs][2-9TJQKA][cdhs]$/i;
const COMBO_WEIGHTED = /^([2-9TJQKA][cdhs][2-9TJQKA][cdhs])\s*:\s*(\d+(?:\.\d+)?)$/i;
const WEIGHTED = /^(.+?):\s*(\d+(?:\.\d+)?)$/;
// "[50]…[/50]" or "[50%]…[/50%]", possibly spanning several tokens.
const BRACKET_GROUP = /\[(\d+(?:\.\d+)?)%?\]([\s\S]*?)\[\/\1%?\]/g;

/** "AhKd" → combo id (case-insensitive ranks, lower-case suits). */
function comboOf(token: string): ComboId | null {
  const norm = token.slice(0, 1).toUpperCase() + token.slice(1, 2).toLowerCase()
    + token.slice(2, 3).toUpperCase() + token.slice(3, 4).toLowerCase();
  const cards = parseCards(norm);
  if (!cards || cards.length !== 2) return null;
  return comboId(cards[0]!, cards[1]!);
}

function rewriteToken(token: string): string {
  const t = token.trim();
  if (!t) return t;
  const m = WEIGHTED.exec(t);
  if (!m) return t;
  const hand = m[1]!.trim();
  const raw = m[2]!;
  let pct = Number(raw);
  if (raw.includes('.') && pct <= 1) pct *= 100;
  return `[${pct}]${hand}[/${pct}]`;
}

export type RangeTextResult = { weights: ComboWeights; classes: number; errors: ParseError[] };

export function parseRangeText(text: string): RangeTextResult {
  const combos = new Map<ComboId, number>();
  const errors: ParseError[] = [];

  const takeCombo = (token: string, pct: number): boolean => {
    const id = comboOf(token);
    if (id === null) {
      errors.push({ token, reason: 'invalid combo' });
      return true;
    }
    combos.set(id, Math.min(100, Math.max(0, pct)) / 100);
    return true;
  };

  // 1. Bracket groups: combos inside are taken one by one, classes are
  //    re-wrapped individually for the shared parser.
  const flattened = text.replace(BRACKET_GROUP, (_all, w: string, inner: string) => {
    const pct = Number(w);
    return inner
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
      .filter((t) => !(COMBO.test(t) && takeCombo(t, pct)))
      .map((t) => `[${w}]${t}[/${w}]`)
      .join(', ');
  });

  // 2. Loose tokens: solver combos and plain combos here, the rest as classes.
  const classTokens: string[] = [];
  for (const raw of flattened.split(',')) {
    const t = raw.trim();
    if (!t) continue;
    const cw = COMBO_WEIGHTED.exec(t);
    if (cw) {
      const w = Number(cw[2]);
      // Solver weights are fractions ("AdKc: 1" = 100%); above 1 it is a %.
      takeCombo(cw[1]!, w <= 1 ? w * 100 : w);
      continue;
    }
    if (COMBO.test(t)) {
      takeCombo(t, 100);
      continue;
    }
    classTokens.push(rewriteToken(t));
  }

  const record: Record<string, number> = {};
  let classes = 0;
  if (classTokens.length > 0) {
    const parsed = parseHandRange(classTokens.join(', '));
    errors.push(...parsed.errors);
    for (const { hand, weight } of parsed.hands) record[hand] = weight;
    classes = parsed.hands.length;
  }
  const weights = weightsFromClassWeights(record);
  for (const [id, w] of combos) weights[id] = w;
  return { weights, classes: classes + combos.size, errors };
}
