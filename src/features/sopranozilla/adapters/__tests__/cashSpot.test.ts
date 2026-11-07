// Cash preflop lines of 119 real hands (anonymized: Hero / Rival1…) from
// PokerStars (Zoom 6-max) and Winamax (5-max), checked against the user's own
// index of which GTO range each decision gets (`cash_gto_wizard/README.md`),
// with the user's later calls (D138): the closest size wins, so opens of
// 2–2.2bb take the demo 2bb ranges (and the BB / BTN calls against them), and
// three spots without a GTO range are filled from the demo set (BB calls the
// SB, SB cold-calls UTG / HJ). «—» = no range (the user's list: CO 4-bet
// all-in, CO / HJ calling a 4-bet vs UTG / HJ, other cold calls).

import { describe, expect, it } from 'vitest';
import { parseHandHistory } from '@/utils/handHistory';
import cash from '../../ranges/cash-gto.json';
import { buildCashCatalog } from '../../ranges/cashCatalog';
import { pickCashRange } from '../cashPick';
import { detectCashLine } from '../cashSpot';
import { positionsOf } from '../positions';

const files = import.meta.glob<string>('/tests/fixtures/hands/cash/**/*.txt', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const catalog = buildCashCatalog(cash);

/** [file, line, «folder / range» per decision in order]. */
const EXPECTED: [string, string, string][] = [
  [
    'casos_especiales/pokerstars_cash_sitting_out_SB_open_259704808127.txt',
    'SB abre 3bb · todos foldean',
    'OR / SB OR3x',
  ],
  [
    'pokerstars/3bet_call_BTN_vs_BB_255777188353.txt',
    'BTN abre 2bb · BB 3-bet a 9bb · BTN paga',
    'OR / BTN OR2.5 | 3Bet / BBvsBTN 3Bet 13bb | CALL vs3Bet / BTNvsBB callvs3Bet 13bb',
  ],
  [
    'pokerstars/3bet_call_BTN_vs_SB_259704570735.txt',
    'BTN abre 2.6bb · SB 3-bet a 4.2bb · BTN paga',
    'OR / BTN OR2.5 | 3Bet / SBvsBTN 3Bet 12bb | CALL vs3Bet / BTNvsSB callvs3Bet 12bb',
  ],
  [
    'pokerstars/3bet_call_CO_vs_BB_255776861740.txt',
    'CO abre 3bb · BB 3-bet a 13bb · CO paga',
    'OR / CO Or2.5 | 3Bet / BBvsCO 3Bet 13bb | CALL vs3Bet / COvsBB callvs3Bet 13bb',
  ],
  [
    'pokerstars/3bet_call_CO_vs_BTN_255779534143.txt',
    'CO abre 2.5bb · BTN 3-bet a 9bb · CO paga',
    'OR / CO Or2.5 | 3Bet / BTNvsCO 3Bet 7.5bb | CALL vs3Bet / COvsBTN callvs3Bet 7.5bb',
  ],
  [
    'pokerstars/3bet_call_CO_vs_SB_255775563452.txt',
    'CO abre 3bb · SB 3-bet a 11.5bb · CO paga',
    'OR / CO Or2.5 | 3Bet / SBvsCO 3Bet 12bb | CALL vs3Bet / COvsSB callvs3Bet 12bb',
  ],
  [
    'pokerstars/3bet_call_HJ_vs_BB_255777040499.txt',
    'HJ abre 2.5bb · BB 3-bet a 11bb · HJ paga',
    'OR / HJ Or 2.5 | 3Bet / BBvsHJ 3Bet 12bb | CALL vs3Bet / HJvsBB callvs3Bet 12bb',
  ],
  [
    'pokerstars/3bet_call_HJ_vs_BTN_255779706875.txt',
    'HJ abre 2.5bb · BTN 3-bet a 7.5bb · HJ paga',
    'OR / HJ Or 2.5 | 3Bet / BTNvsHJ 3Bet 7.5bb | CALL vs3Bet / HJvsBTN callvs3Bet 7.5bb',
  ],
  [
    'pokerstars/3bet_call_HJ_vs_CO_255777175810.txt',
    'HJ abre 3bb · CO 3-bet a 9.5bb · HJ paga',
    'OR / HJ Or 2.5 | 3Bet / COvsMP 3Bet 7.5bb | CALL vs3Bet / HJvsCO callvs3Bet 7.5bb',
  ],
  [
    'pokerstars/3bet_call_HJ_vs_SB_255779885693.txt',
    'HJ abre 2bb · SB 3-bet a 12bb · HJ paga',
    'Demo (open 2bb) / HJ open 2bb | 3Bet / SBvsMP 3Bet 12bb | CALL vs3Bet / HJvsSB callvs3Bet 12bb',
  ],
  [
    'pokerstars/3bet_call_SB_vs_BB_255775414525.txt',
    'SB abre 3bb · BB 3-bet a 9bb · SB paga',
    'OR / SB OR3x | 3Bet / BBvsSB 3Bet | CALL vs3Bet / SBvsBB callvs3Bet',
  ],
  [
    'pokerstars/3bet_call_UTG_vs_BB_255779515831.txt',
    'UTG abre 3bb · BB 3-bet a 9.5bb · UTG paga',
    'OR / UTG Or 2.5 | 3Bet / BBvsUTG 3Bet 12bb | CALL vs3Bet / UTGvsBB callvs3Bet 12bb',
  ],
  [
    'pokerstars/3bet_call_UTG_vs_BTN_255775534657.txt',
    'UTG abre 2.4bb · BTN 3-bet a 7.7bb · UTG paga',
    'OR / UTG Or 2.5 | 3Bet / BTNvsUTG 3Bet 7.5bb | CALL vs3Bet / UTGvsBTN callvs3Bet 7.5bb',
  ],
  [
    'pokerstars/3bet_call_UTG_vs_CO_255777021443.txt',
    'UTG abre 2.5bb · CO 3-bet a 7.5bb · UTG paga',
    'OR / UTG Or 2.5 | 3Bet / COvsUTG 3Bet 7.5bb | CALL vs3Bet / UTGvsCO callvs3Bet 7.5bb',
  ],
  [
    'pokerstars/3bet_call_UTG_vs_HJ_259704561502.txt',
    'UTG abre 2bb · HJ 3-bet a 7bb · UTG paga',
    'Demo (open 2bb) / UTG open 2bb | 3Bet / HJvsUTG 3bet 7.5bb | CALL vs3Bet / UTGvsHJ callvs3Bet 7.5bb',
  ],
  [
    'pokerstars/3bet_call_UTG_vs_SB_255779804200.txt',
    'UTG abre 2.5bb · SB 3-bet a 11.3bb · UTG paga',
    'OR / UTG Or 2.5 | 3Bet / SBvsUTG 3Bet 11bb | CALL vs3Bet / UTGvsSB callvs3Bet 11bb',
  ],
  [
    'pokerstars/3bet_fold_BTN_vs_BB_255775400609.txt',
    'BTN abre 2.5bb · BB 3-bet a 11.5bb',
    'OR / BTN OR2.5 | 3Bet / BBvsBTN 3Bet 13bb',
  ],
  [
    'pokerstars/3bet_fold_BTN_vs_SB_255779726854.txt',
    'BTN abre 2.3bb · SB 3-bet a 7.9bb',
    'OR / BTN OR2.5 | 3Bet / SBvsBTN 3Bet 12bb',
  ],
  [
    'pokerstars/3bet_fold_CO_vs_BB_255779826505.txt',
    'CO abre 2.5bb · BB 3-bet a 12bb',
    'OR / CO Or2.5 | 3Bet / BBvsCO 3Bet 13bb',
  ],
  [
    'pokerstars/3bet_fold_CO_vs_BTN_255779885322.txt',
    'CO abre 2.5bb · BTN 3-bet a 7.5bb',
    'OR / CO Or2.5 | 3Bet / BTNvsCO 3Bet 7.5bb',
  ],
  [
    'pokerstars/3bet_fold_CO_vs_SB_255776506269.txt',
    'CO abre 2.5bb · SB 3-bet a 10bb',
    'OR / CO Or2.5 | 3Bet / SBvsCO 3Bet 12bb',
  ],
  [
    'pokerstars/3bet_fold_HJ_vs_BB_255779900580.txt',
    'HJ abre 2.5bb · BB 3-bet a 8bb',
    'OR / HJ Or 2.5 | 3Bet / BBvsHJ 3Bet 12bb',
  ],
  [
    'pokerstars/3bet_fold_HJ_vs_BTN_255777197718.txt',
    'HJ abre 3bb · BTN 3-bet a 9bb',
    'OR / HJ Or 2.5 | 3Bet / BTNvsHJ 3Bet 7.5bb',
  ],
  [
    'pokerstars/3bet_fold_HJ_vs_CO_255775435040.txt',
    'HJ abre 2.5bb · CO 3-bet a 9bb',
    'OR / HJ Or 2.5 | 3Bet / COvsMP 3Bet 7.5bb',
  ],
  [
    'pokerstars/3bet_fold_HJ_vs_SB_255777142209.txt',
    'HJ abre 2.2bb · SB 3-bet a 9.4bb',
    'Demo (open 2bb) / HJ open 2bb | 3Bet / SBvsMP 3Bet 12bb',
  ],
  [
    'pokerstars/3bet_fold_SB_vs_BB_255777196638.txt',
    'SB abre 3bb · BB 3-bet a 11bb',
    'OR / SB OR3x | 3Bet / BBvsSB 3Bet',
  ],
  [
    'pokerstars/3bet_fold_UTG_vs_BB_255732604235.txt',
    'UTG abre 3.5bb · BB 3-bet a 12bb',
    'OR / UTG Or 2.5 | 3Bet / BBvsUTG 3Bet 12bb',
  ],
  [
    'pokerstars/3bet_fold_UTG_vs_BTN_255776577593.txt',
    'UTG abre 2.3bb · BTN 3-bet a 7.5bb',
    'OR / UTG Or 2.5 | 3Bet / BTNvsUTG 3Bet 7.5bb',
  ],
  [
    'pokerstars/3bet_fold_UTG_vs_CO_255779518207.txt',
    'UTG abre 2.5bb · CO 3-bet a 9bb',
    'OR / UTG Or 2.5 | 3Bet / COvsUTG 3Bet 7.5bb',
  ],
  [
    'pokerstars/3bet_fold_UTG_vs_HJ_255779788984.txt',
    'UTG abre 2.5bb · HJ 3-bet a 7.5bb',
    'OR / UTG Or 2.5 | 3Bet / HJvsUTG 3bet 7.5bb',
  ],
  [
    'pokerstars/3bet_fold_UTG_vs_SB_255780934905.txt',
    'UTG abre 2.5bb · SB 3-bet a 10.5bb',
    'OR / UTG Or 2.5 | 3Bet / SBvsUTG 3Bet 11bb',
  ],
  [
    'pokerstars/4bet_allin_call_BTN_vs_BB_255563087467.txt',
    'BTN abre 3bb · BB 3-bet a 11bb · BTN 4-bet a all-in · BB paga',
    'OR / BTN OR2.5 | 3Bet / BBvsBTN 3Bet 13bb | 4bet / BTNvsBB 4Bet All in | Call 4Bet / BBvsBTN callvs4Bet All in',
  ],
  [
    'pokerstars/4bet_allin_call_BTN_vs_SB_255593037094.txt',
    'BTN abre 3.5bb · SB 3-bet a 12bb · BTN 4-bet a all-in · SB paga',
    'OR / BTN OR2.5 | 3Bet / SBvsBTN 3Bet 12bb | 4bet / BTNvsSB 4Bet 26bb Allin | Call 4Bet / SBvsBTN callvs4Bet All in',
  ],
  [
    'pokerstars/4bet_allin_call_CO_vs_BB_249146777632.txt',
    'CO abre 2.2bb · BB 3-bet a 31bb · CO 4-bet a all-in · BB paga',
    'Demo (open 2bb) / CO open 2.3bb | 3Bet / BBvsCO 3Bet 13bb | — | Call 4Bet / BBvsCO callvs4Bet All in',
  ],
  [
    'pokerstars/4bet_allin_call_CO_vs_BTN_255476316358.txt',
    'CO abre 3bb · BTN 3-bet a 10bb · CO 4-bet a all-in · BTN paga',
    'OR / CO Or2.5 | 3Bet / BTNvsCO 3Bet 7.5bb | — | Call 4Bet / BTNvsCO call4Bet All in',
  ],
  [
    'pokerstars/4bet_allin_call_CO_vs_SB_255710472137.txt',
    'CO abre 3.5bb · SB 3-bet a 13bb · CO 4-bet a all-in · SB paga',
    'OR / CO Or2.5 | 3Bet / SBvsCO 3Bet 12bb | — | Call 4Bet / SBvsCO callvs4Bet All in',
  ],
  [
    'pokerstars/4bet_allin_call_HJ_vs_BB_255710298576.txt',
    'HJ abre 2bb · BB 3-bet a 12bb · HJ 4-bet a all-in · BB paga',
    'Demo (open 2bb) / HJ open 2bb | 3Bet / BBvsHJ 3Bet 12bb | 4bet / HJvsBB 4Bet All in | Call 4Bet / BBvsHJ callvs4Bet All in',
  ],
  [
    'pokerstars/4bet_allin_call_HJ_vs_BTN_255272975986.txt',
    'HJ abre 2bb · BTN 3-bet a 7.4bb · HJ 4-bet a all-in · BTN paga',
    'Demo (open 2bb) / HJ open 2bb | 3Bet / BTNvsHJ 3Bet 7.5bb | 4bet / HJvsBTN 4Bet All in | Call 4Bet / BTNvsHJ call4Bet All in',
  ],
  [
    'pokerstars/4bet_allin_call_HJ_vs_CO_249255140385.txt',
    'HJ abre 2.5bb · CO 3-bet a 8.7bb · HJ 4-bet a all-in · CO paga',
    'OR / HJ Or 2.5 | 3Bet / COvsMP 3Bet 7.5bb | 4bet / HJvsCO 4Bet All in | —',
  ],
  [
    'pokerstars/4bet_allin_call_HJ_vs_SB_255777462257.txt',
    'HJ abre 3bb · SB 3-bet a 22bb · HJ 4-bet a all-in · SB paga',
    'OR / HJ Or 2.5 | 3Bet / SBvsMP 3Bet 12bb | 4bet / HJvsSB 4Bet All in | Call 4Bet / SBvsHJ callvs4Bet All in',
  ],
  [
    'pokerstars/4bet_allin_call_SB_vs_BB_255620424232.txt',
    'SB abre 2.5bb · BB 3-bet a 10bb · SB 4-bet a all-in · BB paga',
    'OR / SB OR3x | 3Bet / BBvsSB 3Bet | 4bet / SBvsBB 4Bet All in | Call 4Bet / BBvsSB call4Bet All in',
  ],
  [
    'pokerstars/4bet_allin_call_UTG_vs_BB_255676545428.txt',
    'UTG abre 2bb · BB 3-bet a 12bb · UTG 4-bet a all-in · BB paga',
    'Demo (open 2bb) / UTG open 2bb | 3Bet / BBvsUTG 3Bet 12bb | 4bet / UTBvsBB 4bet All in | Call 4Bet / BBvsUTG call4Bet AI',
  ],
  [
    'pokerstars/4bet_allin_call_UTG_vs_BTN_255736060578.txt',
    'UTG abre 4bb · BTN 3-bet a 10bb · UTG 4-bet a all-in · BTN paga',
    'OR / UTG Or 2.5 | 3Bet / BTNvsUTG 3Bet 7.5bb | 4bet / UTGvsBTN 4Bet Allin | Call 4Bet / BTNvUTG call4Bet All in',
  ],
  [
    'pokerstars/4bet_allin_call_UTG_vs_CO_255563355939.txt',
    'UTG abre 3bb · CO 3-bet a 10bb · UTG 4-bet a all-in · CO paga',
    'OR / UTG Or 2.5 | 3Bet / COvsUTG 3Bet 7.5bb | 4bet / UTGvsCO 4Bet All in | —',
  ],
  [
    'pokerstars/4bet_allin_call_UTG_vs_HJ_255451362459.txt',
    'UTG abre 5bb · HJ 3-bet a 28.8bb · UTG 4-bet a all-in · HJ paga',
    'OR / UTG Or 2.5 | 3Bet / HJvsUTG 3bet 7.5bb | 4bet / UTGvsHJ 4Bet All in | —',
  ],
  [
    'pokerstars/4bet_allin_call_UTG_vs_SB_255675088611.txt',
    'UTG abre 2bb · SB 3-bet a 10bb · UTG 4-bet a all-in · SB paga',
    'Demo (open 2bb) / UTG open 2bb | 3Bet / SBvsUTG 3Bet 11bb | 4bet / UTGvsSB 4Bet All in | Call 4Bet / SBvsUTG call 4Bet All in',
  ],
  [
    'pokerstars/4bet_allin_fold_BTN_vs_BB_255496811914.txt',
    'BTN abre 2bb · BB 3-bet a 10.5bb · BTN 4-bet a all-in',
    'OR / BTN OR2.5 | 3Bet / BBvsBTN 3Bet 13bb | 4bet / BTNvsBB 4Bet All in',
  ],
  [
    'pokerstars/4bet_allin_fold_BTN_vs_SB_255710405523.txt',
    'BTN abre 2bb · SB 3-bet a 10bb · BTN 4-bet a all-in',
    'OR / BTN OR2.5 | 3Bet / SBvsBTN 3Bet 12bb | 4bet / BTNvsSB 4Bet 26bb Allin',
  ],
  [
    'pokerstars/4bet_allin_fold_CO_vs_BB_255597791822.txt',
    'CO abre 2bb · BB 3-bet a 11bb · CO 4-bet a all-in',
    'Demo (open 2bb) / CO open 2.3bb | 3Bet / BBvsCO 3Bet 13bb | —',
  ],
  [
    'pokerstars/4bet_allin_fold_CO_vs_BTN_255705114687.txt',
    'CO abre 3.5bb · BTN 3-bet a 10.5bb · CO 4-bet a all-in',
    'OR / CO Or2.5 | 3Bet / BTNvsCO 3Bet 7.5bb | —',
  ],
  [
    'pokerstars/4bet_allin_fold_CO_vs_SB_255780544167.txt',
    'CO abre 2.5bb · SB 3-bet a 11bb · CO 4-bet a all-in',
    'OR / CO Or2.5 | 3Bet / SBvsCO 3Bet 12bb | —',
  ],
  [
    'pokerstars/4bet_allin_fold_HJ_vs_BB_255776498570.txt',
    'HJ abre 2bb · BB 3-bet a 11bb · HJ 4-bet a all-in',
    'Demo (open 2bb) / HJ open 2bb | 3Bet / BBvsHJ 3Bet 12bb | 4bet / HJvsBB 4Bet All in',
  ],
  [
    'pokerstars/4bet_allin_fold_HJ_vs_BTN_255780897335.txt',
    'HJ abre 3bb · BTN 3-bet a 9bb · HJ 4-bet a all-in',
    'OR / HJ Or 2.5 | 3Bet / BTNvsHJ 3Bet 7.5bb | 4bet / HJvsBTN 4Bet All in',
  ],
  [
    'pokerstars/4bet_allin_fold_HJ_vs_CO_255475622562.txt',
    'HJ abre 3bb · CO 3-bet a 9bb · HJ 4-bet a all-in',
    'OR / HJ Or 2.5 | 3Bet / COvsMP 3Bet 7.5bb | 4bet / HJvsCO 4Bet All in',
  ],
  [
    'pokerstars/4bet_allin_fold_HJ_vs_SB_255350813181.txt',
    'HJ abre 2.4bb · SB 3-bet a 16bb · HJ 4-bet a all-in',
    'OR / HJ Or 2.5 | 3Bet / SBvsMP 3Bet 12bb | 4bet / HJvsSB 4Bet All in',
  ],
  [
    'pokerstars/4bet_allin_fold_SB_vs_BB_255674893362.txt',
    'SB abre 3bb · BB 3-bet a 11bb · SB 4-bet a all-in',
    'OR / SB OR3x | 3Bet / BBvsSB 3Bet | 4bet / SBvsBB 4Bet All in',
  ],
  [
    'pokerstars/4bet_allin_fold_UTG_vs_BB_249144761210.txt',
    'UTG abre 2bb · BB 3-bet a 24bb · UTG 4-bet a all-in',
    'Demo (open 2bb) / UTG open 2bb | 3Bet / BBvsUTG 3Bet 12bb | 4bet / UTBvsBB 4bet All in',
  ],
  [
    'pokerstars/4bet_allin_fold_UTG_vs_BTN_249310178361.txt',
    'UTG abre 2.7bb · BTN 3-bet a 9.6bb · UTG 4-bet a all-in',
    'OR / UTG Or 2.5 | 3Bet / BTNvsUTG 3Bet 7.5bb | 4bet / UTGvsBTN 4Bet Allin',
  ],
  [
    'pokerstars/4bet_allin_fold_UTG_vs_CO_255678967607.txt',
    'UTG abre 2bb · CO 3-bet a 7bb · UTG 4-bet a all-in',
    'Demo (open 2bb) / UTG open 2bb | 3Bet / COvsUTG 3Bet 7.5bb | 4bet / UTGvsCO 4Bet All in',
  ],
  [
    'pokerstars/4bet_allin_fold_UTG_vs_HJ_255775691139.txt',
    'UTG abre 2.5bb · HJ 3-bet a 7.9bb · UTG 4-bet a all-in',
    'OR / UTG Or 2.5 | 3Bet / HJvsUTG 3bet 7.5bb | 4bet / UTGvsHJ 4Bet All in',
  ],
  [
    'pokerstars/4bet_call_BTN_vs_BB_255693037010.txt',
    'BTN abre 2.5bb · BB 3-bet a 11bb · BTN 4-bet a 19.5bb · BB paga',
    'OR / BTN OR2.5 | 3Bet / BBvsBTN 3Bet 13bb | 4bet / BTNvsBB 4Bet 27bb | Call 4Bet / BBvsBTN callvs4Bet 27bb',
  ],
  [
    'pokerstars/4bet_call_BTN_vs_SB_255733200989.txt',
    'BTN abre 2.4bb · SB 3-bet a 11bb · BTN 4-bet a 24bb · SB paga',
    'OR / BTN OR2.5 | 3Bet / SBvsBTN 3Bet 12bb | 4bet / BTNvsSB 4Bet 26bb | Call 4Bet / SBvsBTN callvs4Bet 26bb',
  ],
  [
    'pokerstars/4bet_call_CO_vs_BB_255710275889.txt',
    'CO abre 3bb · BB 3-bet a 5bb · CO 4-bet a 20bb · BB paga',
    'OR / CO Or2.5 | 3Bet / BBvsCO 3Bet 13bb | 4bet / COvsBB 4Bet 27bb | Call 4Bet / BBvsCO callvs4Bet 27bb',
  ],
  [
    'pokerstars/4bet_call_CO_vs_BTN_255780206631.txt',
    'CO abre 3bb · BTN 3-bet a 9.5bb · CO 4-bet a 23bb · BTN paga',
    'OR / CO Or2.5 | 3Bet / BTNvsCO 3Bet 7.5bb | 4bet / COvsBTN 4Bet 22bb | Call 4Bet / BTNvsCO call4Bet 22bb',
  ],
  [
    'pokerstars/4bet_call_CO_vs_SB_255676883659.txt',
    'CO abre 2.5bb · SB 3-bet a 11bb · CO 4-bet a 22bb · SB paga',
    'OR / CO Or2.5 | 3Bet / SBvsCO 3Bet 12bb | 4bet / COvsSB 4Bet 24bb | Call 4Bet / SBvsCO callvs4Bet 24bb',
  ],
  [
    'pokerstars/4bet_call_HJ_vs_BB_255379043086.txt',
    'HJ abre 2.48bb · BB 3-bet a 12bb · HJ 4-bet a 26bb · BB paga',
    'OR / HJ Or 2.5 | 3Bet / BBvsHJ 3Bet 12bb | 4bet / HJvsBB 4Bet 24bb | Call 4Bet / BBvsHJ callvs4Bet 24bb',
  ],
  [
    'pokerstars/4bet_call_HJ_vs_BTN_255705645534.txt',
    'HJ abre 3bb · BTN 3-bet a 9bb · HJ 4-bet a 25bb · BTN paga',
    'OR / HJ Or 2.5 | 3Bet / BTNvsHJ 3Bet 7.5bb | 4bet / HJvsBTN 4Bet 20bb | Call 4Bet / BTNvsHJ call4Bet 20bb',
  ],
  [
    'pokerstars/4bet_call_HJ_vs_CO_255779767090.txt',
    'HJ abre 2.5bb · CO 3-bet a 7.5bb · HJ 4-bet a 19bb · CO paga',
    'OR / HJ Or 2.5 | 3Bet / COvsMP 3Bet 7.5bb | 4bet / HJvsCO 4Bet 20bb | —',
  ],
  [
    'pokerstars/4bet_call_HJ_vs_SB_255568572821.txt',
    'HJ abre 2.5bb · SB 3-bet a 4bb · HJ 4-bet a 15bb · SB paga',
    'OR / HJ Or 2.5 | 3Bet / SBvsMP 3Bet 12bb | 4bet / HJvsSB 4Bet 22bb | Call 4Bet / SBvsHJ callvs4Bet 22bb',
  ],
  [
    'pokerstars/4bet_call_SB_vs_BB_255767150121.txt',
    'SB abre 4bb · BB 3-bet a 12bb · SB 4-bet a 36bb · BB paga',
    'OR / SB OR3x | 3Bet / BBvsSB 3Bet | 4bet / SBvsBB 4Bet 21bb | Call 4Bet / BBvsSB callvs4Bet 21bb',
  ],
  [
    'pokerstars/4bet_call_UTG_vs_BB_255734556814.txt',
    'UTG abre 3bb · BB 3-bet a 12bb · UTG 4-bet a 21bb · BB paga',
    'OR / UTG Or 2.5 | 3Bet / BBvsUTG 3Bet 12bb | 4bet / UTGvsBB 4bet22bb | Call 4Bet / BBvsUTG call4bet 22bb',
  ],
  [
    'pokerstars/4bet_call_UTG_vs_BTN_255720919820.txt',
    'UTG abre 2.5bb · BTN 3-bet a 8.8bb · UTG 4-bet a 21.1bb · BTN paga',
    'OR / UTG Or 2.5 | 3Bet / BTNvsUTG 3Bet 7.5bb | 4bet / UTGvsBTN 4Bet 20bb | Call 4Bet / BTNvsUTG call4Bet 20bb',
  ],
  [
    'pokerstars/4bet_call_UTG_vs_CO_255732603338.txt',
    'UTG abre 2.5bb · CO 3-bet a 8bb · UTG 4-bet a 22bb · CO paga',
    'OR / UTG Or 2.5 | 3Bet / COvsUTG 3Bet 7.5bb | 4bet / UTGvsCO 4Bet 20bb | —',
  ],
  [
    'pokerstars/4bet_call_UTG_vs_HJ_255767210537.txt',
    'UTG abre 2.5bb · HJ 3-bet a 4bb · UTG 4-bet a 20bb · HJ paga',
    'OR / UTG Or 2.5 | 3Bet / HJvsUTG 3bet 7.5bb | 4bet / UTGvsHJ 4Bet 20bb | —',
  ],
  [
    'pokerstars/4bet_call_UTG_vs_SB_255734883670.txt',
    'UTG abre 2.5bb · SB 3-bet a 11bb · UTG 4-bet a 23bb · SB paga',
    'OR / UTG Or 2.5 | 3Bet / SBvsUTG 3Bet 11bb | 4bet / UTGvsSB 4bet 21bb | Call 4Bet / SBvsUTG call 4Bet 21bb',
  ],
  [
    'pokerstars/4bet_fold_BTN_vs_BB_255720455325.txt',
    'BTN abre 2.5bb · BB 3-bet a 12.8bb · BTN 4-bet a 30bb',
    'OR / BTN OR2.5 | 3Bet / BBvsBTN 3Bet 13bb | 4bet / BTNvsBB 4Bet 27bb',
  ],
  [
    'pokerstars/4bet_fold_BTN_vs_SB_255767001673.txt',
    'BTN abre 2.7bb · SB 3-bet a 11bb · BTN 4-bet a 25bb',
    'OR / BTN OR2.5 | 3Bet / SBvsBTN 3Bet 12bb | 4bet / BTNvsSB 4Bet 26bb',
  ],
  [
    'pokerstars/4bet_fold_CO_vs_BB_255734436215.txt',
    'CO abre 2.5bb · BB 3-bet a 10bb · CO 4-bet a 22bb',
    'OR / CO Or2.5 | 3Bet / BBvsCO 3Bet 13bb | 4bet / COvsBB 4Bet 27bb',
  ],
  [
    'pokerstars/4bet_fold_CO_vs_BTN_255779616375.txt',
    'CO abre 2.5bb · BTN 3-bet a 9bb · CO 4-bet a 22bb',
    'OR / CO Or2.5 | 3Bet / BTNvsCO 3Bet 7.5bb | 4bet / COvsBTN 4Bet 22bb',
  ],
  [
    'pokerstars/4bet_fold_CO_vs_SB_255780449575.txt',
    'CO abre 2.2bb · SB 3-bet a 11bb · CO 4-bet a 24bb',
    'Demo (open 2bb) / CO open 2.3bb | 3Bet / SBvsCO 3Bet 12bb | 4bet / COvsSB 4Bet 24bb',
  ],
  [
    'pokerstars/4bet_fold_HJ_vs_BB_255675424374.txt',
    'HJ abre 2.5bb · BB 3-bet a 8bb · HJ 4-bet a 22bb',
    'OR / HJ Or 2.5 | 3Bet / BBvsHJ 3Bet 12bb | 4bet / HJvsBB 4Bet 24bb',
  ],
  [
    'pokerstars/4bet_fold_HJ_vs_BTN_255705040799.txt',
    'HJ abre 2.5bb · BTN 3-bet a 7.5bb · HJ 4-bet a 21bb',
    'OR / HJ Or 2.5 | 3Bet / BTNvsHJ 3Bet 7.5bb | 4bet / HJvsBTN 4Bet 20bb',
  ],
  [
    'pokerstars/4bet_fold_HJ_vs_CO_255776515621.txt',
    'HJ abre 2.5bb · CO 3-bet a 7.5bb · HJ 4-bet a 21bb',
    'OR / HJ Or 2.5 | 3Bet / COvsMP 3Bet 7.5bb | 4bet / HJvsCO 4Bet 20bb',
  ],
  [
    'pokerstars/4bet_fold_HJ_vs_SB_255706473272.txt',
    'HJ abre 2.5bb · SB 3-bet a 8.5bb · HJ 4-bet a 24bb',
    'OR / HJ Or 2.5 | 3Bet / SBvsMP 3Bet 12bb | 4bet / HJvsSB 4Bet 22bb',
  ],
  [
    'pokerstars/4bet_fold_SB_vs_BB_255777328835.txt',
    'SB abre 2.5bb · BB 3-bet a 10bb · SB 4-bet a 26bb',
    'OR / SB OR3x | 3Bet / BBvsSB 3Bet | 4bet / SBvsBB 4Bet 21bb',
  ],
  [
    'pokerstars/4bet_fold_UTG_vs_BB_255642796257.txt',
    'UTG abre 2bb · BB 3-bet a 10bb · UTG 4-bet a 23.3bb',
    'Demo (open 2bb) / UTG open 2bb | 3Bet / BBvsUTG 3Bet 12bb | 4bet / UTGvsBB 4bet22bb',
  ],
  [
    'pokerstars/4bet_fold_UTG_vs_BTN_255734689128.txt',
    'UTG abre 2.5bb · BTN 3-bet a 8bb · UTG 4-bet a 25bb',
    'OR / UTG Or 2.5 | 3Bet / BTNvsUTG 3Bet 7.5bb | 4bet / UTGvsBTN 4Bet 20bb',
  ],
  [
    'pokerstars/4bet_fold_UTG_vs_CO_255779812535.txt',
    'UTG abre 2.3bb · CO 3-bet a 11bb · UTG 4-bet a 29.8bb',
    'OR / UTG Or 2.5 | 3Bet / COvsUTG 3Bet 7.5bb | 4bet / UTGvsCO 4Bet 20bb',
  ],
  [
    'pokerstars/4bet_fold_UTG_vs_HJ_255767341150.txt',
    'UTG abre 2bb · HJ 3-bet a 6bb · UTG 4-bet a 19.5bb',
    'Demo (open 2bb) / UTG open 2bb | 3Bet / HJvsUTG 3bet 7.5bb | 4bet / UTGvsHJ 4Bet 20bb',
  ],
  [
    'pokerstars/4bet_fold_UTG_vs_SB_255732257884.txt',
    'UTG abre 2.3bb · SB 3-bet a 11bb · UTG 4-bet a 29bb',
    'OR / UTG Or 2.5 | 3Bet / SBvsUTG 3Bet 11bb | 4bet / UTGvsSB 4bet 21bb',
  ],
  [
    'pokerstars/open_BBcall_BTN_vs_BB_255775430956.txt',
    'BTN abre 2.5bb · BB paga',
    'OR / BTN OR2.5 | BB defended / BBvsBTN CC',
  ],
  [
    'pokerstars/open_BBcall_CO_vs_BB_259704716231.txt',
    'CO abre 2bb · BB paga',
    'Demo (open 2bb) / CO open 2.3bb | Demo (open 2bb) / BB call vs CO (open 2.3bb)',
  ],
  [
    'pokerstars/open_BBcall_HJ_vs_BB_259704594761.txt',
    'HJ abre 3bb · BB paga',
    'OR / HJ Or 2.5 | BB defended / BBvsHJ CC',
  ],
  [
    'pokerstars/open_BBcall_SB_vs_BB_255775388838.txt',
    'SB abre 3bb · BB paga',
    'OR / SB OR3x | Demo (open 2bb) / BB call vs SB (open 3bb)',
  ],
  [
    'pokerstars/open_BBcall_UTG_vs_BB_255779642080.txt',
    'UTG abre 2.1bb · BB paga',
    'Demo (open 2bb) / UTG open 2bb | Demo (open 2bb) / BB call vs UTG (open 2bb)',
  ],
  [
    'pokerstars/open_BTNcall_CO_vs_BTN_255776600046.txt',
    'CO abre 2.5bb · BTN paga',
    'OR / CO Or2.5 | Btn CC / BTNvsCO call cold',
  ],
  [
    'pokerstars/open_BTNcall_HJ_vs_BTN_259704854016.txt',
    'HJ abre 5bb · BTN paga',
    'OR / HJ Or 2.5 | Btn CC / BTNvsHJ call cold',
  ],
  [
    'pokerstars/open_BTNcall_UTG_vs_BTN_255776940151.txt',
    'UTG abre 2bb · BTN paga',
    'Demo (open 2bb) / UTG open 2bb | Demo (open 2bb) / BTN call cold vs UTG (open 2bb)',
  ],
  [
    'pokerstars/open_fold_BTN_vs_solo_255775458235.txt',
    'BTN abre 2.2bb · todos foldean',
    'OR / BTN OR2.5',
  ],
  [
    'pokerstars/open_fold_CO_vs_solo_259704542726.txt',
    'CO abre 2bb · todos foldean',
    'Demo (open 2bb) / CO open 2.3bb',
  ],
  [
    'pokerstars/open_fold_HJ_vs_solo_259704870161.txt',
    'HJ abre 3bb · todos foldean',
    'OR / HJ Or 2.5',
  ],
  [
    'pokerstars/open_fold_SB_vs_solo_259704545166.txt',
    'SB abre 3bb · todos foldean',
    'OR / SB OR3x',
  ],
  [
    'pokerstars/open_fold_UTG_vs_solo_255775398455.txt',
    'UTG abre 2bb · todos foldean',
    'Demo (open 2bb) / UTG open 2bb',
  ],
  [
    'pokerstars/open_otrocall_BTN_vs_SB_259704631136.txt',
    'BTN abre 3bb · SB paga',
    'OR / BTN OR2.5 | —',
  ],
  [
    'pokerstars/open_otrocall_CO_vs_SB_255779862436.txt',
    'CO abre 2bb · SB paga',
    'Demo (open 2bb) / CO open 2.3bb | —',
  ],
  [
    'pokerstars/open_otrocall_HJ_vs_CO_255777161925.txt',
    'HJ abre 2.5bb · CO paga',
    'OR / HJ Or 2.5 | —',
  ],
  [
    'pokerstars/open_otrocall_HJ_vs_SB_259704757324.txt',
    'HJ abre 2bb · SB paga',
    'Demo (open 2bb) / HJ open 2bb | Demo (open 2bb) / SB call cold vs HJ (open 2bb)',
  ],
  [
    'pokerstars/open_otrocall_UTG_vs_CO_255779670085.txt',
    'UTG abre 2.2bb · CO paga',
    'Demo (open 2bb) / UTG open 2bb | —',
  ],
  [
    'pokerstars/open_otrocall_UTG_vs_HJ_255776591255.txt',
    'UTG abre 2.5bb · HJ paga',
    'OR / UTG Or 2.5 | —',
  ],
  [
    'pokerstars/open_otrocall_UTG_vs_SB_255779889779.txt',
    'UTG abre 2.5bb · SB paga',
    'OR / UTG Or 2.5 | Demo (open 2bb) / SB call cold vs UTG (open 2bb)',
  ],
  [
    'winamax/3bet_call_SB_vs_BB_19123000-1604-1701391907.txt',
    'SB abre 3bb · BB 3-bet a 11bb · SB paga',
    'OR / SB OR3x | 3Bet / BBvsSB 3Bet | CALL vs3Bet / SBvsBB callvs3Bet',
  ],
  [
    'winamax/3bet_fold_CO_vs_SB_19123000-1558-1701390258.txt',
    'CO abre 2.5bb · SB 3-bet a 11.3bb',
    'OR / CO Or2.5 | 3Bet / SBvsCO 3Bet 12bb',
  ],
  [
    'winamax/4bet_allin_call_CO_vs_SB_19072603-589-1700079280.txt',
    'CO abre 2.5bb · SB 3-bet a 11.5bb · CO 4-bet a all-in · SB paga',
    'OR / CO Or2.5 | 3Bet / SBvsCO 3Bet 12bb | — | Call 4Bet / SBvsCO callvs4Bet All in',
  ],
  [
    'winamax/4bet_call_BTN_vs_SB_19116037-1785-1701220238.txt',
    'BTN abre 3bb · SB 3-bet a 11.5bb · BTN 4-bet a 28.7bb · SB paga',
    'OR / BTN OR2.5 | 3Bet / SBvsBTN 3Bet 12bb | 4bet / BTNvsSB 4Bet 26bb | Call 4Bet / SBvsBTN callvs4Bet 26bb',
  ],
  [
    'winamax/4bet_fold_SB_vs_BB_19119617-1017-1701284189.txt',
    'SB abre 3bb · BB 3-bet a 9bb · SB 4-bet a 22.5bb',
    'OR / SB OR3x | 3Bet / BBvsSB 3Bet | 4bet / SBvsBB 4Bet 21bb',
  ],
  [
    'winamax/open_BBcall_SB_vs_BB_19123000-1551-1701389905.txt',
    'SB abre 3bb · BB paga',
    'OR / SB OR3x | Demo (open 2bb) / BB call vs SB (open 3bb)',
  ],
  [
    'winamax/open_BTNcall_CO_vs_BTN_19123000-1597-1701391595.txt',
    'CO abre 3.5bb · BTN paga',
    'OR / CO Or2.5 | Btn CC / BTNvsCO call cold',
  ],
  [
    'winamax/open_fold_HJ_vs_solo_19123000-1555-1701390112.txt',
    'HJ abre 2.5bb · todos foldean',
    'OR / HJ Or 2.5',
  ],
  [
    'winamax/open_otrocall_CO_vs_SB_19123000-1602-1701391783.txt',
    'CO abre 3.5bb · SB paga',
    'OR / CO Or2.5 | —',
  ],
];

describe('cash lines of real hands', () => {
  it('reads every fixture', () => {
    expect(Object.keys(files)).toHaveLength(EXPECTED.length);
  });

  it.each(EXPECTED)('%s', (file, description, picks) => {
    const raw = files[`/tests/fixtures/hands/cash/${file}`];
    expect(raw, file).toBeDefined();
    const { hand } = parseHandHistory(raw!);
    const result = detectCashLine(hand!, positionsOf(hand!));
    if (!result.ok) throw new Error(result.reason);
    expect(result.line.description).toBe(description);
    const got = result.line.decisions
      .map((d) => {
        const p = pickCashRange(catalog, d);
        return p ? `${p.range.group} / ${p.range.name}` : '—';
      })
      .join(' | ');
    expect(got).toBe(picks);
  });
});

describe('cash lines without a range', () => {
  const line = (text: string) => {
    const { hand } = parseHandHistory(text);
    return detectCashLine(hand!, positionsOf(hand!));
  };
  const HEAD = `PokerStars Hand #1:  Hold'em No Limit ($0.05/$0.10 USD) - 2026/01/01 10:00:00 ET
Table 'T' 6-max Seat #4 is the button
Seat 1: A ($10 in chips)
Seat 2: B ($10 in chips)
Seat 3: C ($10 in chips)
Seat 4: Hero ($10 in chips)
Seat 5: D ($10 in chips)
Seat 6: E ($10 in chips)
D: posts small blind $0.05
E: posts big blind $0.10
*** HOLE CARDS ***
Dealt to Hero [Ah Kh]
`;

  it('a limped pot', () => {
    const r = line(
      HEAD +
        'A: calls $0.10\nB: folds\nC: folds\nHero: folds\nD: folds\nE: checks\n*** FLOP *** [2c 3d 4h]\n',
    );
    expect(r).toEqual({ ok: false, reason: 'Bote limpeado: no hay rangos de limp.' });
  });

  it('a multiway pot (D139): the open and the first call have a range, the overcall does not', () => {
    const r = line(
      HEAD +
        'A: raises $0.15 to $0.25\nB: folds\nC: folds\nHero: calls $0.25\nD: folds\nE: calls $0.15\n*** FLOP *** [2c 3d 4h]\n',
    );
    if (!r.ok) throw new Error(r.reason);
    expect(r.line.description).toBe('UTG abre 2.5bb · BTN paga · BB paga');
    expect(r.line.decisions.map((d) => [d.name, d.position, d.action, d.vs, d.size])).toEqual([
      ['A', 'UTG', 'open', null, 2.5],
      ['Hero', 'BTN', 'call-open', 'UTG', 2.5],
    ]);
    expect(r.line.skipped?.map((s) => s.name)).toEqual(['E']);
    expect(pickCashRange(catalog, r.line.decisions[1]!)?.range.name).toBe('BTNvsUTG call cold');
  });

  it('a multiway pot with a squeeze has no range', () => {
    const r = line(
      HEAD +
        'A: raises $0.15 to $0.25\nB: folds\nC: folds\nHero: calls $0.25\nD: folds\nE: raises $1 to $1.10\nA: calls $0.85\nHero: calls $0.85\n*** FLOP *** [2c 3d 4h]\n',
    );
    expect(r).toEqual({
      ok: false,
      reason: 'Bote multiway con resubida (squeeze o cold 4-bet): no hay rangos para ese spot.',
    });
  });
});
