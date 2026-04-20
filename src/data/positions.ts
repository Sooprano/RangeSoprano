import type { Position, Situation } from '@/types/poker';

export const POSITION_LABELS: Record<Position, string> = {
  UTG: 'UTG',
  'UTG+1': 'UTG+1',
  'UTG+2': 'UTG+2',
  HJ: 'Hijack',
  CO: 'Cutoff',
  BTN: 'Button',
  SB: 'Small Blind',
  BB: 'Big Blind',
};

export const SITUATION_LABELS: Record<Situation, string> = {
  RFI: 'Raise First In',
  vs_RFI: 'vs RFI',
  vs_3BET: 'vs 3Bet',
  vs_4BET: 'vs 4Bet',
  SQUEEZE: 'Squeeze',
  DEFEND_BB: 'Defend BB',
};
