// A real spins hand opened in Sopranozilla gets the Regular range of its
// line (D128); a spot without folder asks for one; cash hands never load the
// spins catalog.

import { describe, expect, it } from 'vitest';
import { parseHandHistory, type ParsedHand } from '@/utils/handHistory';
import { needsSpinsCatalog, openParsedHand } from '../openHand';

const files = import.meta.glob<string>('/tests/fixtures/hands/spins/**/*.{txt,xml}', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const handOf = (file: string): ParsedHand =>
  parseHandHistory(files[`/tests/fixtures/hands/spins/${file}`]!).hand!;

async function open(file: string) {
  const result = await openParsedHand(handOf(file), [], []);
  if (!result.ok) throw new Error(result.error);
  return result.saved.meta!;
}

describe('opening a spins hand', () => {
  it('limp and check, HU: the villain SB who limped gets «SBHU 9bb LP»', async () => {
    const meta = await open('pokerstars/HU_limp_check_SB_255189531825.txt');
    expect(meta.rangeLabel).toBe('SBHU 9bb LP · Regular');
    expect(meta.spot).toBe('SB limp · BB check');
    expect(meta.spinsRangeId).toBe('SBHU/SBHU 9bb LP');
    expect(meta.rangeMissing).toBeNull();
  });

  it('raise over limp, HU: the villain SB who called gets «callvsRol»', async () => {
    const meta = await open('pokerstars/HU_raise_sobre_limp_call_SB_255067670527.txt');
    expect(meta.rangeLabel).toBe('SBHU 12bb callvsRol 3bb · Regular');
  });

  it('iPoker XML, 3H open and call: the villain BU gets his open range', async () => {
    const meta = await open('ipoker/3H_open_call_BU_12088199234.xml');
    expect(meta.rangeLabel).toBe('BU OR 12bb · Regular');
  });

  it('iPoker TEXT export (chips printed with €) is a spin too: BB gets «BBvsBU 22bb call»', async () => {
    const meta = await open('ipoker_txt/3H_open_call_BU_12622249958.txt');
    expect(meta.rangeLabel).toBe('BBvsBU 22bb call · Regular');
    expect(meta.spot).toBe('BU abre a 2bb · BB paga');
  });

  it('the turn of a real hand knows the stack behind (for a re-raise all-in, D133)', async () => {
    const result = await openParsedHand(
      handOf('ipoker_txt/HU_limp_check_turn_raise_12622361249.txt'),
      [],
      [],
    );
    if (!result.ok) throw new Error(result.error);
    // 480 − 5 ante − 30 BB = 445 chips behind = 14.83bb on flop and turn.
    expect(result.saved.stacks?.turn).toBeCloseTo(14.83, 2);
    expect(result.saved.stacks?.flop).toBeCloseTo(14.83, 2);
    expect(result.saved.pots.turn).toBeCloseTo(70 / 30, 2);
    expect(result.saved.meta?.rangeLabel).toBe('BBHU 16bb X · Regular');
  });

  it('a spot without folder (SB 3-bets the BU) asks for a range', async () => {
    const meta = await open('pokerstars/3H_3bet_call_BU_251724712673.txt');
    expect(meta.rangeLabel).toBeNull();
    expect(meta.rangeMissing).toMatch(/No hay rango de Regular/);
  });

  it('a cash hand does not need the spins catalog', () => {
    const hand = handOf('pokerstars/HU_limp_check_SB_255189531825.txt');
    expect(needsSpinsCatalog(hand)).toBe(true);
    expect(needsSpinsCatalog({ ...hand, currency: '€', tournament: false })).toBe(false);
  });
});
