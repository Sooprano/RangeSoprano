import { beforeEach, describe, expect, it } from 'vitest';
import { parseCards, type CardId } from '../../engine/cards';
import { weightsFromHandRange } from '../../engine/combos';
import { fullActionRow } from '../../engine/weights';
import { PRESETS_ENABLED } from '../../presets';
import { resetAnalyzerStore, sameActionRow, useAnalyzerStore } from '../analyzerStore';

function cards(text: string): CardId[] {
  const out = parseCards(text);
  if (!out) throw new Error(`bad cards: ${text}`);
  return out;
}

beforeEach(() => resetAnalyzerStore());

describe('presets switched off (first public version)', () => {
  it('every action row starts at «Todo ✓ 100»', () => {
    expect(PRESETS_ENABLED).toBe(false);
    useAnalyzerStore.getState().loadHand(
      { hero: cards('AsKs') as [CardId, CardId], board: cards('Kh 9c 4d') },
      weightsFromHandRange('22+, A2s+, KTo+'),
    );
    const flop = useAnalyzerStore.getState().streets.flop;
    for (const r of flop.actionRows) {
      if (r.kind !== 'bet') continue;
      expect(sameActionRow(flop.rows[r.id]!, fullActionRow())).toBe(true);
      expect(flop.presetRefs[r.id]?.kind).toBe('none');
    }
  });
});
