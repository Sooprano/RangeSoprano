// A real spins hand opened in Sopranozilla gets the Regular range of its
// line (D128); a spot without folder asks for one; cash hands never load the
// spins catalog.

import { describe, expect, it } from 'vitest';
import { parseHandHistory, type ParsedHand } from '@/utils/handHistory';
import { needsSpinsCatalog, openParsedHand, repickSaved } from '../openHand';
import { loadSpinsCatalog } from '../../ranges/spinsCatalog';

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

  it('Fish rival (D137): repicks the same hand with the FISH range and keeps the choice', async () => {
    const result = await openParsedHand(
      handOf('pokerstars/HU_limp_check_SB_255189531825.txt'),
      [],
      [],
    );
    if (!result.ok) throw new Error(result.error);
    const spins = await loadSpinsCatalog();
    const fish = repickSaved(result.saved, { rival: 'fish', spins }, [], []);
    expect(fish?.meta?.rangeLabel).toBe('FISH HU SB / LIMP 7-10 · Fish');
    expect(fish?.meta?.spinsRival).toBe('fish');
    expect(fish?.range.length).toBeGreaterThan(0);
    // Another repick (e.g. the library toggle) keeps the Fish rival.
    expect(repickSaved(fish!, { spins }, [], [])?.meta?.rangeLabel).toBe(
      'FISH HU SB / LIMP 7-10 · Fish',
    );
    // And back to Regular.
    expect(repickSaved(fish!, { rival: 'regular', spins }, [], [])?.meta?.rangeLabel).toBe(
      'SBHU 9bb LP · Regular',
    );
  });

  it('Fish rival below the lowest band: no range, and says which bands there are', async () => {
    const result = await openParsedHand(handOf('ipoker/HU_limp_check_SB_12088199780.xml'), [], [], {
      rival: 'fish',
    });
    if (!result.ok) throw new Error(result.error);
    const meta = result.saved.meta!;
    expect(meta.rangeLabel).toBeNull();
    expect(result.saved.range).toBe('');
    expect(meta.rangeMissing).toMatch(
      /^No hay rango de Fish para «SB limp · BB check» con 5\.5bb: sus tramos son (7-10 · 10-20 · 20\+|7-10 · 10\+) \(desde 7bb\)\./,
    );
  });
});

// The user's hand (anonymized): BU opens, SB calls, BB calls — three-way (D139).
const MULTIWAY = `GAME #12628758221 Version:26.7.1.28 Uncalled:Y Texas Hold'em NL  Tournament 2026-11-06 23:08:59/GMT
Table Info: Size: 3, Blinds: 10/20
Table Twister €20 SNG, 1183906910, 1183906909 (Tournament: Twister €20 SNG Buy-In: €18.60 + €1.40)
Seat 3: Hero (€434.00 in chips)  DEALER
Seat 6: Rival1 (€566.00 in chips)
Seat 10: Rival2 (€500.00 in chips)
Rival1: Post SB €10.00
Rival2: Post BB €20.00
*** HOLE CARDS ***
Dealt to Hero [HQ C8]
Hero: Raise (NF) €40.00
Rival1: Call €30.00
Rival2: Call €20.00
*** FLOP *** [C9 S9 SQ]
Rival1: Check
Rival2: Check
Hero: Bet €40.00
Rival1: Call €40.00
Rival2: Fold
*** TURN *** [H6]
Rival1: Bet €60.00
Hero: Call €60.00
*** RIVER *** [DK]
Rival1: Bet €224.00
Hero: Fold
*** SUMMARY ***
Total pot €320.00 Rake €0.00
Rival1: wins €320.00
`;

describe('three-way spins pot (D139)', () => {
  it('the SB who called the BU open gets the SB vs BU Fish range; the BB overcall none', async () => {
    const { hand } = parseHandHistory(MULTIWAY);
    const result = await openParsedHand(hand!, [], [], { rival: 'fish' });
    if (!result.ok) throw new Error(result.error);
    const meta = result.saved.meta!;
    expect(meta.villainName).toBe('Rival1');
    expect(meta.spot).toBe('BU abre a 2bb · SB paga · BB paga');
    expect(meta.rangeLabel).toBe('FISH 3w SBvBU / CALL vs OR 18+ · Fish');
    const spins = await loadSpinsCatalog();
    const bb = repickSaved(result.saved, { villain: 'Rival2', spins, rival: 'fish' }, [], []);
    expect(bb?.meta?.rangeLabel).toBeNull();
    expect(bb?.meta?.rangeMissing).toMatch(/^Paga contra dos rivales \(overcall\)/);
  });
});
