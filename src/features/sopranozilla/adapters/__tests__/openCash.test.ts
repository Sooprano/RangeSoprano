// A real cash hand opened in Sopranozilla gets the GTO range of the villain's
// last preflop decision (D138); a spot without one says so and never invents.

import { describe, expect, it } from 'vitest';
import { parseHandHistory } from '@/utils/handHistory';
import { openParsedHand } from '../openHand';

const files = import.meta.glob<string>('/tests/fixtures/hands/cash/**/*.txt', {
  query: '?raw',
  import: 'default',
  eager: true,
});

async function open(file: string) {
  const { hand } = parseHandHistory(files[`/tests/fixtures/hands/cash/${file}`]!);
  const result = await openParsedHand(hand!, [], []);
  if (!result.ok) throw new Error(result.error);
  return result.saved.meta!;
}

describe('opening a cash hand', () => {
  it('3-bet pot: the villain gets the range of his last decision', async () => {
    const meta = await open('pokerstars/3bet_call_CO_vs_BTN_255779534143.txt');
    expect(meta.spot).toBe('CO abre 2.5bb · BTN 3-bet a 9bb · CO paga');
    expect(meta.rangeLabel).toMatch(/· Rangos GTO$/);
    expect(meta.cashRangeId).toBeDefined();
    expect(meta.rangeMissing).toBeNull();
  });

  it('Winamax cash (€ after the amount) is cash too', async () => {
    const meta = await open('winamax/3bet_call_SB_vs_BB_19123000-1604-1701391907.txt');
    expect(meta.spot).toBe('SB abre 3bb · BB 3-bet a 11bb · SB paga');
    expect(meta.rangeLabel).toMatch(/· Rangos GTO$/);
  });

  it('a cold call outside the BTN has no GTO range: says so, no invented range', async () => {
    const meta = await open('pokerstars/open_otrocall_BTN_vs_SB_259704631136.txt');
    expect(meta.spot).toBe('BTN abre 3bb · SB paga');
    expect(meta.rangeLabel).toBeNull();
    expect(meta.cashRangeId).toBeUndefined();
    expect(meta.rangeMissing).toBe(
      'No hay rango GTO para «BTN abre 3bb · SB paga». Elige uno de la lista de cash o de la biblioteca.',
    );
  });
});
