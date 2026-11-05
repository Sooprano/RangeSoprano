// Spins preflop lines of 59 real hands (anonymized: Hero / Rival1 / Rival2)
// from PokerStars (Spin & Go), Winamax (Expresso) and iPoker (Twister, XML),
// checked against the user's own index of what each hand is. «—» = no folder
// for that spot in the Regular catalog; «~» = approximate (the range of the
// player's earlier action, D128).

import { describe, expect, it } from 'vitest';
import { parseHandHistory } from '@/utils/handHistory';
import data from '../../ranges/spins-regular.json';
import { buildSpinsCatalog } from '../../ranges/spinsCatalog';
import { positionsOf } from '../positions';
import { pickSpinsRange } from '../spinsPick';
import { detectSpinsLine } from '../spinsSpot';

const files = import.meta.glob<string>('/tests/fixtures/hands/spins/**/*.{txt,xml}', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const catalog = buildSpinsCatalog(data);

/** [file, format, effective bb, line, seat=range per player in the pot]. */
const EXPECTED: [string, string, number, string, string][] = [
  [
    'ipoker_txt/HU_limp_check_turn_raise_12622361249.txt',
    'HU',
    16,
    'SB limp · BB check',
    'BTN=SBHU 16bb LP ; BB=BBHU 16bb X',
  ],
  [
    'ipoker_txt/3H_open_call_BU_12622249958.txt',
    '3H',
    23,
    'BU abre a 2bb · BB paga',
    'BTN=BU OR 22bb ; BB=BBvsBU 22bb call',
  ],
  [
    'casos_especiales/pokerstars_3H_sitting_out_SB_allin_251725119760.txt',
    '3H',
    11.17,
    'SB va all-in · todos foldean',
    'SB=—',
  ],
  [
    'ipoker/3H_3bet_call_BU_12088469526.xml',
    '3H',
    13.0,
    'BU abre a 2bb · BB 3-bet all-in · BU paga',
    'BTN=BU OR 13bb~ ; BB=—',
  ],
  [
    'ipoker/3H_3bet_call_SB_12088655107.xml',
    '3H',
    21.0,
    'SB abre a 2bb · BB 3-bet a 6bb · SB paga',
    'SB=20bb or 2.5bb~ ; BB=—',
  ],
  [
    'ipoker/3H_limp_allin_BU_12088264375.xml',
    '3H',
    19.5,
    'BU limp · SB sube all-in · BU paga',
    'BTN=— ; SB=—',
  ],
  [
    'ipoker/3H_limp_allin_SB_12088209513.xml',
    '3H',
    24.0,
    'SB limp · BB sube all-in',
    'SB=25bb limp ; BB=—',
  ],
  ['ipoker/3H_limp_check_BU_12088583911.xml', '3H', 11.5, 'BU limp · BB check', 'BTN=— ; BB=—'],
  [
    'ipoker/3H_limp_check_SB_12088253420.xml',
    '3H',
    25.0,
    'SB limp · BB check',
    'SB=25bb limp ; BB=25bb X',
  ],
  [
    'ipoker/3H_open_allin_BU_12088230025.xml',
    '3H',
    25.0,
    'BU va all-in · SB paga',
    'BTN=BU OS 16bb ; SB=—',
  ],
  ['ipoker/3H_open_allin_SB_12088175965.xml', '3H', 24.0, 'SB va all-in · todos foldean', 'SB=—'],
  [
    'ipoker/3H_open_call_BU_12088199234.xml',
    '3H',
    12.0,
    'BU abre a 2bb · BB paga',
    'BTN=BU OR 12bb ; BB=BBvsBU 12bb call',
  ],
  ['ipoker/3H_open_call_SB_12088227370.xml', '3H', 4.53, 'SB va all-in · BB paga', 'SB=— ; BB=—'],
  [
    'ipoker/3H_raise_sobre_limp_call_BU_12088670454.xml',
    '3H',
    13.33,
    'BU limp · BB sube a 6.6bb · BU paga',
    'BTN=— ; BB=—',
  ],
  [
    'ipoker/3H_raise_sobre_limp_call_SB_12088198798.xml',
    '3H',
    10.5,
    'SB limp · BB sube a 4.5bb · SB paga',
    'SB=11bb limp~ ; BB=—',
  ],
  [
    'ipoker/HU_3bet_call_SB_12088227652.xml',
    'HU',
    16.6,
    'SB abre a 2bb · BB 3-bet a 3bb · SB paga',
    'BTN=SBHU 16bb MR~ ; BB=BBHU 16bb 3B 4.25bb',
  ],
  [
    'ipoker/HU_limp_allin_SB_12088213354.xml',
    'HU',
    27.0,
    'SB limp · BB sube all-in',
    'BTN=SBHU 25bb LP ; BB=BBHU 25bb ROL AI',
  ],
  [
    'ipoker/HU_limp_check_SB_12088199780.xml',
    'HU',
    5.5,
    'SB limp · BB check',
    'BTN=SBHU 6bb LP ; BB=BBHU 5bb X',
  ],
  [
    'ipoker/HU_open_allin_SB_12088463087.xml',
    'HU',
    4.5,
    'SB va all-in · todos foldean',
    'BTN=SBHU 6bb OS',
  ],
  [
    'ipoker/HU_open_call_SB_12088232045.xml',
    'HU',
    16.8,
    'SB abre a 2bb · BB paga',
    'BTN=SBHU 16bb MR ; BB=BBHU 16bb CALL',
  ],
  [
    'ipoker/HU_raise_sobre_limp_call_SB_12088213860.xml',
    'HU',
    14.9,
    'SB limp · BB sube a 4.7bb · SB paga',
    'BTN=SBHU 14bb callvsRol 4.5bb ; BB=BBHU 14bb ROL 4.5bb',
  ],
  [
    'pokerstars/3H_3bet_call_BU_251724712673.txt',
    '3H',
    25.0,
    'BU abre a 2bb · SB 3-bet a 3bb · BU paga',
    'BTN=BU OR 25bb~ ; SB=—',
  ],
  [
    'pokerstars/3H_3bet_call_SB_251722623464.txt',
    '3H',
    24.0,
    'SB abre a 2.8bb · BB 3-bet a 5.6bb · SB paga',
    'SB=25bb or 3bb~ ; BB=—',
  ],
  [
    'pokerstars/3H_limp_allin_BU_255189485227.txt',
    '3H',
    14.67,
    'BU limp · SB sube all-in',
    'BTN=— ; SB=—',
  ],
  [
    'pokerstars/3H_limp_allin_SB_251727745073.txt',
    '3H',
    9.67,
    'SB limp · BB sube all-in',
    'SB=9bb limp ; BB=—',
  ],
  [
    'pokerstars/3H_limp_check_BU_255189493046.txt',
    '3H',
    17.13,
    'BU limp · BB check',
    'BTN=— ; BB=—',
  ],
  [
    'pokerstars/3H_limp_check_SB_259704575488.txt',
    '3H',
    25.0,
    'SB limp · BB check',
    'SB=25bb limp ; BB=25bb X',
  ],
  [
    'pokerstars/3H_open_allin_BU_255189521286.txt',
    '3H',
    5.53,
    'BU va all-in · SB paga',
    'BTN=BU OS 6bb ; SB=—',
  ],
  [
    'pokerstars/3H_open_allin_SB_255189512451.txt',
    '3H',
    10.6,
    'SB va all-in · todos foldean',
    'SB=—',
  ],
  [
    'pokerstars/3H_open_call_BU_255189464777.txt',
    '3H',
    25.0,
    'BU abre a 2bb · SB paga',
    'BTN=BU OR 25bb ; SB=—',
  ],
  [
    'pokerstars/3H_open_call_SB_255189471751.txt',
    '3H',
    24.0,
    'SB abre a 2.8bb · BB paga',
    'SB=25bb or 3bb ; BB=25bb call 3bb',
  ],
  [
    'pokerstars/3H_raise_sobre_limp_call_BU_254950952459.txt',
    '3H',
    25.0,
    'BU limp · SB sube a 3.5bb · BU paga',
    'BTN=— ; SB=—',
  ],
  [
    'pokerstars/3H_raise_sobre_limp_call_SB_251720928882.txt',
    '3H',
    25.0,
    'SB limp · BB sube a 3bb · SB paga',
    'SB=25bb limp~ ; BB=—',
  ],
  [
    'pokerstars/HU_3bet_call_SB_251724440973.txt',
    'HU',
    19.53,
    'SB abre a 2bb · BB 3-bet a 3bb · SB paga',
    'BTN=SBHU 20bb MR~ ; BB=BBHU 20bb 3B 4.5bb',
  ],
  [
    'pokerstars/HU_limp_allin_SB_255189547997.txt',
    'HU',
    4.79,
    'SB limp · BB sube all-in · SB paga',
    'BTN=SBHU 6bb LP~ ; BB=BBHU 5bb ROL AI',
  ],
  [
    'pokerstars/HU_limp_check_SB_255189531825.txt',
    'HU',
    9.38,
    'SB limp · BB check',
    'BTN=SBHU 9bb LP ; BB=BBHU 9bb X',
  ],
  [
    'pokerstars/HU_open_allin_SB_255189545475.txt',
    'HU',
    5.79,
    'SB va all-in · todos foldean',
    'BTN=SBHU 6bb OS',
  ],
  [
    'pokerstars/HU_open_call_SB_255189480779.txt',
    'HU',
    16.33,
    'SB abre a 2bb · BB paga',
    'BTN=SBHU 16bb MR ; BB=BBHU 16bb CALL',
  ],
  [
    'pokerstars/HU_raise_sobre_limp_call_SB_255067670527.txt',
    'HU',
    11.63,
    'SB limp · BB sube a 2.23bb · SB paga',
    'BTN=SBHU 12bb callvsRol 3bb ; BB=BBHU 12bb ROL 3bb',
  ],
  [
    'winamax/3H_3bet_call_BU_4572570643161153537-2-1771204461.txt',
    '3H',
    20.5,
    'BU abre a 2bb · SB 3-bet a 6bb · BU paga',
    'BTN=BU OR 20bb~ ; SB=—',
  ],
  [
    'winamax/3H_3bet_call_SB_4643794283399217153-4-1773867773.txt',
    '3H',
    25.5,
    'SB abre a 3bb · BB 3-bet a 7.5bb · SB paga',
    'SB=25bb or 3bb~ ; BB=—',
  ],
  [
    'winamax/3H_limp_allin_BU_4643818227841892353-11-1773868305.txt',
    '3H',
    11.0,
    'BU limp · SB sube all-in',
    'BTN=— ; SB=—',
  ],
  [
    'winamax/3H_limp_allin_SB_4643859038621138945-4-1773869141.txt',
    '3H',
    18.15,
    'SB limp · BB sube all-in',
    'SB=18bb limp ; BB=—',
  ],
  [
    'winamax/3H_limp_check_BU_4643893342524932097-8-1773869935.txt',
    '3H',
    17.17,
    'BU limp · BB check',
    'BTN=— ; BB=—',
  ],
  [
    'winamax/3H_limp_check_SB_4643893342524932097-3-1773869818.txt',
    '3H',
    24.5,
    'SB limp · BB check',
    'SB=25bb limp ; BB=25bb X',
  ],
  [
    'winamax/3H_open_allin_BU_4643892290257944577-12-1773869970.txt',
    '3H',
    12.85,
    'BU va all-in · todos foldean',
    'BTN=BU OS 13bb',
  ],
  [
    'winamax/3H_open_allin_SB_4643893342524932097-9-1773869980.txt',
    '3H',
    13.05,
    'SB va all-in · todos foldean',
    'SB=—',
  ],
  [
    'winamax/3H_open_call_BU_4643892290257944577-1-1773869766.txt',
    '3H',
    25.0,
    'BU abre a 2bb · BB paga',
    'BTN=BU OR 25bb ; BB=BBvsBU 25bb call',
  ],
  [
    'winamax/3H_open_call_SB_4643871970767667201-12-1773869496.txt',
    '3H',
    16.83,
    'SB abre a 2.5bb · BB paga',
    'SB=16bb or 2.5bb ; BB=16bb call 2.5bb',
  ],
  [
    'winamax/3H_raise_sobre_limp_call_BU_4643892290257944577-5-1773869835.txt',
    '3H',
    23.0,
    'BU limp · SB sube a 3.5bb · BU paga',
    'BTN=— ; SB=—',
  ],
  [
    'winamax/3H_raise_sobre_limp_call_SB_4643771090575818753-3-1773867392.txt',
    '3H',
    26.1,
    'SB limp · BB sube a 3bb · SB paga',
    'SB=25bb limp~ ; BB=—',
  ],
  [
    'winamax/HU_3bet_call_SB_4575031496213004289-8-1771293994.txt',
    'HU',
    11.75,
    'SB abre a 2bb · BB 3-bet a 3bb · SB paga',
    'BTN=SBHU 12bb MR~ ; BB=BBHU 12bb 3B 4bb',
  ],
  [
    'winamax/HU_limp_allin_SB_4643892290257944577-22-1773870160.txt',
    'HU',
    7.56,
    'SB limp · BB sube all-in',
    'BTN=SBHU 8bb LP ; BB=BBHU 8bb ROL AI',
  ],
  [
    'winamax/HU_limp_check_SB_4643887389700259841-4-1773869715.txt',
    'HU',
    23.5,
    'SB limp · BB check',
    'BTN=SBHU 22bb LP ; BB=BBHU 22bb X',
  ],
  [
    'winamax/HU_open_allin_SB_4643892290257944577-17-1773870108.txt',
    'HU',
    9.08,
    'SB va all-in · todos foldean',
    'BTN=SBHU 9bb OS',
  ],
  [
    'winamax/HU_open_call_SB_4643887406880129025-14-1773869867.txt',
    'HU',
    14.68,
    'SB abre a 2bb · BB paga',
    'BTN=SBHU 14bb MR ; BB=BBHU 14bb CALL',
  ],
  [
    'winamax/HU_raise_sobre_limp_call_SB_4643825915833352193-6-1773868454.txt',
    'HU',
    17.0,
    'SB limp · BB sube a 3bb · SB paga',
    'BTN=SBHU 16bb callvsRol 3bb ; BB=BBHU 16bb ROL 3bb',
  ],
  [
    'winamax/3H_mnr_call_SB_4643867276368412673-10-1773869400.txt',
    '3H',
    15.33,
    'SB abre a 2bb · BB paga',
    'SB=15bb or 2.5bb ; BB=15bb call 2.5bb',
  ],
  [
    'winamax/3H_mnr_call_SB_4643887406880129025-2-1773869677.txt',
    '3H',
    25,
    'SB abre a 2bb · BB paga',
    'SB=25bb or 3bb ; BB=25bb call 3bb',
  ],
];

describe('spins lines of real hands', () => {
  it('reads every fixture', () => {
    expect(Object.keys(files)).toHaveLength(EXPECTED.length);
  });

  it.each(EXPECTED)('%s', (file, format, effectiveBb, description, picks) => {
    const raw = files[`/tests/fixtures/hands/spins/${file}`];
    expect(raw, file).toBeDefined();
    const { hand } = parseHandHistory(raw!);
    const result = detectSpinsLine(hand!, positionsOf(hand!));
    if (!result.ok) throw new Error(result.reason);
    const { line } = result;
    expect(line.format).toBe(format);
    expect(line.effectiveBb).toBeCloseTo(effectiveBb, 2);
    expect(line.description).toBe(description);
    const got = line.roles
      .map((role) => {
        const p = pickSpinsRange(catalog, line, role);
        return `${role.position}=${p ? p.range.name + (p.want.approx ? '~' : '') : '—'}`;
      })
      .join(' ; ');
    expect(got).toBe(picks);
  });
});
