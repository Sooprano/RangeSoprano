import type { Situation, TableFormat } from '@/types/poker';

export const SITUATION_LABELS: Record<Situation, string> = {
  RFI: 'RFI',
  vs_LIMP: 'vs Limp',
  vs_RFI: 'vs RFI',
  vs_3BET: 'vs 3-Bet',
  vs_4BET: 'vs 4-Bet',
  SQUEEZE: 'Squeeze',
  DEFEND_BB: 'Defend BB',
};

export const TABLE_FORMAT_LABELS: Record<TableFormat, string> = {
  '6max': '3-max / 6-max',
  HU: 'Heads-Up',
};
