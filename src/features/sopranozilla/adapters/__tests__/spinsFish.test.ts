// FISH picks (D137) for the same real hands as spinsSpot.test.ts, checked
// against the user's own list of what FISH range each hand must get
// (`spins_fish/README.md`), with the user's two later calls: the 3H BU gets
// the heads-up button's ranges, and the SB calling the BU's open has its own
// range from 18bb. «—» = no FISH range (no folder, or the stack is below the
// lowest band); «~» = approximate (the range of the player's earlier action).

import { describe, expect, it } from 'vitest';
import { parseHandHistory } from '@/utils/handHistory';
import regular from '../../ranges/spins-regular.json';
import fish from '../../ranges/spins-fish.json';
import { buildSpinsCatalog } from '../../ranges/spinsCatalog';
import { positionsOf } from '../positions';
import { pickSpinsRange } from '../spinsPick';
import { detectSpinsLine } from '../spinsSpot';

const files = import.meta.glob<string>('/tests/fixtures/hands/spins/**/*.{txt,xml}', {
  query: '?raw',
  import: 'default',
  eager: true,
});
// Both catalogs: a FISH pick must never return a Regular range.
const catalog = [...buildSpinsCatalog(regular), ...buildSpinsCatalog(fish, 'fish')];

/** [file, seat=«folder / range» per player in the pot]. */
const EXPECTED: [string, string][] = [
  [
    'casos_especiales/pokerstars_3H_sitting_out_SB_allin_251725119760.txt',
    'SB=FISH 3wSBvBB / OS 10-16',
  ],
  ['ipoker/3H_3bet_call_BU_12088469526.xml', 'BTN=FISH 3H BU / MNR 10-16~ ; BB=—'],
  ['ipoker/3H_3bet_call_SB_12088655107.xml', 'SB=FISH 3wSBvBB / MNR 16+~ ; BB=—'],
  ['ipoker/3H_limp_allin_BU_12088264375.xml', 'BTN=FISH 3H BU / LIMP 10-20~ ; SB=—'],
  ['ipoker/3H_limp_allin_SB_12088209513.xml', 'SB=FISH 3wSBvBB / LIMP 16+ ; BB=—'],
  ['ipoker/3H_limp_check_BU_12088583911.xml', 'BTN=FISH 3H BU / LIMP 10-20 ; BB=—'],
  [
    'ipoker/3H_limp_check_SB_12088253420.xml',
    'SB=FISH 3wSBvBB / LIMP 16+ ; BB=FISH 3wBBvSB / CHECK vs LIMP 10+',
  ],
  ['ipoker/3H_open_allin_BU_12088230025.xml', 'BTN=— ; SB=—'],
  ['ipoker/3H_open_allin_SB_12088175965.xml', 'SB=FISH 3wSBvBB / OS 16+'],
  [
    'ipoker/3H_open_call_BU_12088199234.xml',
    'BTN=FISH 3H BU / MNR 10-16 ; BB=FISH 3w BBvBU / Call vs MNR 10-20',
  ],
  ['ipoker/3H_open_call_SB_12088227370.xml', 'SB=— ; BB=—'],
  ['ipoker/3H_raise_sobre_limp_call_BU_12088670454.xml', 'BTN=FISH 3H BU / LIMP 10-20~ ; BB=—'],
  ['ipoker/3H_raise_sobre_limp_call_SB_12088198798.xml', 'SB=FISH 3wSBvBB / LIMP 10-16~ ; BB=—'],
  ['ipoker/HU_3bet_call_SB_12088227652.xml', 'BTN=FISH HU SB / CALL vs 3Bet NAI ; BB=—'],
  ['ipoker/HU_limp_allin_SB_12088213354.xml', 'BTN=FISH HU SB / LIMP 20+ ; BB=—'],
  ['ipoker/HU_limp_check_SB_12088199780.xml', 'BTN=— ; BB=—'],
  ['ipoker/HU_open_allin_SB_12088463087.xml', 'BTN=—'],
  [
    'ipoker/HU_open_call_SB_12088232045.xml',
    'BTN=FISH HU SB / MNR 16-20 ; BB=FISH HU BB / CALL vs MNR 16-20',
  ],
  [
    'ipoker/HU_raise_sobre_limp_call_SB_12088213860.xml',
    'BTN=FISH HU SB / LIMP 10-20~ ; BB=FISH HU BB / ISO v LIMP 10+',
  ],
  [
    'ipoker_txt/3H_open_call_BU_12622249958.txt',
    'BTN=FISH 3H BU / MNR 20+ ; BB=FISH 3w BBvBU / Call vs MNR 20+',
  ],
  [
    'ipoker_txt/HU_limp_check_turn_raise_12622361249.txt',
    'BTN=FISH HU SB / LIMP 10-20 ; BB=FISH HU BB / X vs LIMP 10+',
  ],
  ['pokerstars/3H_3bet_call_BU_251724712673.txt', 'BTN=FISH 3H BU / CALL vs 3Bet NAI ; SB=—'],
  ['pokerstars/3H_3bet_call_SB_251722623464.txt', 'SB=FISH 3wSBvBB / 3x 10+~ ; BB=—'],
  ['pokerstars/3H_limp_allin_BU_255189485227.txt', 'BTN=FISH 3H BU / LIMP 10-20 ; SB=—'],
  ['pokerstars/3H_limp_allin_SB_251727745073.txt', 'SB=— ; BB=—'],
  ['pokerstars/3H_limp_check_BU_255189493046.txt', 'BTN=FISH 3H BU / LIMP 10-20 ; BB=—'],
  [
    'pokerstars/3H_limp_check_SB_259704575488.txt',
    'SB=FISH 3wSBvBB / LIMP 16+ ; BB=FISH 3wBBvSB / CHECK vs LIMP 10+',
  ],
  ['pokerstars/3H_open_allin_BU_255189521286.txt', 'BTN=— ; SB=—'],
  ['pokerstars/3H_open_allin_SB_255189512451.txt', 'SB=FISH 3wSBvBB / OS 10-16'],
  [
    'pokerstars/3H_open_call_BU_255189464777.txt',
    'BTN=FISH 3H BU / MNR 20+ ; SB=FISH 3w SBvBU / CALL vs OR 18+',
  ],
  [
    'pokerstars/3H_open_call_SB_255189471751.txt',
    'SB=FISH 3wSBvBB / 3x 10+ ; BB=FISH 3wBBvSB / CALL vs 2,5-3X 16+',
  ],
  ['pokerstars/3H_raise_sobre_limp_call_BU_254950952459.txt', 'BTN=FISH 3H BU / LIMP 20+~ ; SB=—'],
  ['pokerstars/3H_raise_sobre_limp_call_SB_251720928882.txt', 'SB=FISH 3wSBvBB / LIMP 16+~ ; BB=—'],
  ['pokerstars/HU_3bet_call_SB_251724440973.txt', 'BTN=FISH HU SB / CALL vs 3Bet NAI ; BB=—'],
  ['pokerstars/HU_limp_allin_SB_255189547997.txt', 'BTN=— ; BB=—'],
  [
    'pokerstars/HU_limp_check_SB_255189531825.txt',
    'BTN=FISH HU SB / LIMP 7-10 ; BB=FISH HU BB / X vs LIMP 7-10',
  ],
  ['pokerstars/HU_open_allin_SB_255189545475.txt', 'BTN=—'],
  [
    'pokerstars/HU_open_call_SB_255189480779.txt',
    'BTN=FISH HU SB / MNR 16-20 ; BB=FISH HU BB / CALL vs MNR 16-20',
  ],
  [
    'pokerstars/HU_raise_sobre_limp_call_SB_255067670527.txt',
    'BTN=FISH HU SB / LIMP 10-20~ ; BB=FISH HU BB / ISO v LIMP 10+',
  ],
  [
    'winamax/3H_3bet_call_BU_4572570643161153537-2-1771204461.txt',
    'BTN=FISH 3H BU / CALL vs 3Bet NAI ; SB=—',
  ],
  [
    'winamax/3H_3bet_call_SB_4643794283399217153-4-1773867773.txt',
    'SB=FISH 3wSBvBB / 3x 10+~ ; BB=—',
  ],
  [
    'winamax/3H_limp_allin_BU_4643818227841892353-11-1773868305.txt',
    'BTN=FISH 3H BU / LIMP 10-20 ; SB=—',
  ],
  [
    'winamax/3H_limp_allin_SB_4643859038621138945-4-1773869141.txt',
    'SB=FISH 3wSBvBB / LIMP 16+ ; BB=—',
  ],
  [
    'winamax/3H_limp_check_BU_4643893342524932097-8-1773869935.txt',
    'BTN=FISH 3H BU / LIMP 10-20 ; BB=—',
  ],
  [
    'winamax/3H_limp_check_SB_4643893342524932097-3-1773869818.txt',
    'SB=FISH 3wSBvBB / LIMP 16+ ; BB=FISH 3wBBvSB / CHECK vs LIMP 10+',
  ],
  [
    'winamax/3H_mnr_call_SB_4643867276368412673-10-1773869400.txt',
    'SB=FISH 3wSBvBB / MNR 10-16 ; BB=FISH 3wBBvSB / CALL vs MNR 10-16',
  ],
  [
    'winamax/3H_mnr_call_SB_4643887406880129025-2-1773869677.txt',
    'SB=FISH 3wSBvBB / MNR 16+ ; BB=FISH 3wBBvSB / CALL vs MNR 16+',
  ],
  ['winamax/3H_open_allin_BU_4643892290257944577-12-1773869970.txt', 'BTN=—'],
  ['winamax/3H_open_allin_SB_4643893342524932097-9-1773869980.txt', 'SB=FISH 3wSBvBB / OS 10-16'],
  [
    'winamax/3H_open_call_BU_4643892290257944577-1-1773869766.txt',
    'BTN=FISH 3H BU / MNR 20+ ; BB=FISH 3w BBvBU / Call vs MNR 20+',
  ],
  [
    'winamax/3H_open_call_SB_4643871970767667201-12-1773869496.txt',
    'SB=FISH 3wSBvBB / 3x 10+ ; BB=FISH 3wBBvSB / CALL vs 2,5-3X 16+',
  ],
  [
    'winamax/3H_raise_sobre_limp_call_BU_4643892290257944577-5-1773869835.txt',
    'BTN=FISH 3H BU / LIMP 20+~ ; SB=—',
  ],
  [
    'winamax/3H_raise_sobre_limp_call_SB_4643771090575818753-3-1773867392.txt',
    'SB=FISH 3wSBvBB / LIMP 16+~ ; BB=—',
  ],
  [
    'winamax/HU_3bet_call_SB_4575031496213004289-8-1771293994.txt',
    'BTN=FISH HU SB / CALL vs 3Bet NAI ; BB=—',
  ],
  [
    'winamax/HU_limp_allin_SB_4643892290257944577-22-1773870160.txt',
    'BTN=FISH HU SB / LIMP 7-10 ; BB=—',
  ],
  [
    'winamax/HU_limp_check_SB_4643887389700259841-4-1773869715.txt',
    'BTN=FISH HU SB / LIMP 20+ ; BB=FISH HU BB / X vs LIMP 10+',
  ],
  ['winamax/HU_open_allin_SB_4643892290257944577-17-1773870108.txt', 'BTN=—'],
  [
    'winamax/HU_open_call_SB_4643887406880129025-14-1773869867.txt',
    'BTN=FISH HU SB / MNR 10-16 ; BB=FISH HU BB / CALL vs MNR 10-16',
  ],
  [
    'winamax/HU_raise_sobre_limp_call_SB_4643825915833352193-6-1773868454.txt',
    'BTN=FISH HU SB / LIMP 10-20~ ; BB=FISH HU BB / ISO v LIMP 10+',
  ],
];

describe('FISH spins ranges of real hands', () => {
  it('covers every fixture', () => {
    expect(Object.keys(files)).toHaveLength(EXPECTED.length);
  });

  it.each(EXPECTED)('%s', (file, picks) => {
    const raw = files[`/tests/fixtures/hands/spins/${file}`];
    expect(raw, file).toBeDefined();
    const { hand } = parseHandHistory(raw!);
    const result = detectSpinsLine(hand!, positionsOf(hand!));
    if (!result.ok) throw new Error(result.reason);
    const { line } = result;
    const got = line.roles
      .map((role) => {
        const p = pickSpinsRange(catalog, line, role, 'fish');
        if (p) expect(p.range.rival).toBe('fish');
        const label = p ? `${p.range.group} / ${p.range.name}${p.want.approx ? '~' : ''}` : '—';
        return `${role.position}=${label}`;
      })
      .join(' ; ');
    expect(got).toBe(picks);
  });
});

describe('FISH: the SB calling the BU open (3H), by stack band', () => {
  const role = {
    name: 'v',
    position: 'SB' as const,
    vs: 'BTN' as const,
    wants: [{ action: 'call-open' as const, size: 2, approx: false }],
  };
  const pick = (effectiveBb: number, size = 2) =>
    pickSpinsRange(
      catalog,
      { format: '3H', effectiveBb, description: '', roles: [] },
      { ...role, wants: [{ ...role.wants[0]!, size }] },
      'fish',
    )?.range.name ?? '—';

  it('below 14bb there is no range; 14 → 14-18; 18 → 18+', () => {
    expect(pick(13.9)).toBe('—');
    expect(pick(14)).toBe('CALL vs OR 14-18');
    expect(pick(17.99)).toBe('CALL vs OR 14-18');
    expect(pick(18)).toBe('CALL vs OR 18+');
    expect(pick(25, 3)).toBe('CALL vs OR 18+');
  });
});
