import type { Position, Situation, TableFormat } from '@/types/poker';

export const SITUATION_LABELS: Record<Situation, string> = {
  RFI: 'RFI',
  vs_LIMP: 'vs Limp',
  vs_RFI: 'vs RFI',
  vs_OS: 'vs Open Shove',
  vs_3BET: 'vs 3-Bet',
  vs_4BET: 'vs 4-Bet',
  SQUEEZE: 'Squeeze',
  DEFEND_BB: 'Defend BB',
};

/**
 * What the villain already did when the hand reaches you, drawn as chips in
 * front of their seat. `null` = nobody acted (it folds to you), which on a real
 * table looks exactly like an empty spot in front of the seat.
 *
 * Amounts are only stated when they are true by definition (a limp matches the
 * big blind). The Editor's `printLabels.sizing1/2` are free-form fields whose
 * meaning the user decides — they may well be the HERO's sizing — so they are
 * deliberately NOT used to claim how much the villain bet.
 */
export const VILLAIN_ACTION_LABELS: Record<Situation, string | null> = {
  RFI: null,
  vs_LIMP: 'Limp 1bb',
  vs_RFI: 'Raise',
  vs_OS: 'All in',
  vs_3BET: '3-Bet',
  vs_4BET: '4-Bet',
  SQUEEZE: 'Raise + Call',
  DEFEND_BB: 'Raise',
};

/**
 * The forced bets already in front of the blinds when the hand reaches you.
 * Only the amount: the seat badge right next to the chips already says SB/BB.
 *
 * Antes are deliberately not modelled — a range carries no ante field, so
 * drawing one would be inventing the structure.
 */
export const BLIND_LABELS: Partial<Record<Position, string>> = {
  SB: '0.5bb',
  BB: '1bb',
};

export const TABLE_FORMAT_LABELS: Record<TableFormat, string> = {
  '6max': '3-max / 6-max',
  HU: 'Heads-Up',
};
