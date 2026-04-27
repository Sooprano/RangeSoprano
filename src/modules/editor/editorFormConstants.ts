import type { Situation, TableFormat } from '@/types/poker';

export const SITUATION_LABELS: Record<Situation, string> = {
  RFI: 'RFI',
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

export const villainDisabledFor = (s: Situation): boolean => s === 'RFI';

export const FORM_SELECT_CLASS =
  'rounded-md border border-border bg-bg px-2 py-1.5 text-sm text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light';
