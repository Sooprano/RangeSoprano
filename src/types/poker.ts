export const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const;
export type Rank = (typeof RANKS)[number];

export const POSITIONS = ['UTG', 'UTG+1', 'UTG+2', 'HJ', 'CO', 'BTN', 'SB', 'BB'] as const;
export type Position = (typeof POSITIONS)[number];

export const ACTIONS = ['RAISE', 'CALL', 'FOLD', '3BET', 'ALL_IN'] as const;
export type Action = (typeof ACTIONS)[number];

export type HandCategory = 'pair' | 'suited' | 'offsuit';

/** Canonical 169-hand notation, e.g. "AA", "AKs", "72o". */
export type HandNotation = string;

export type HandAction = {
  action: Action;
  /** Frequency in percent, 0..100. */
  weight: number;
};

export type RangeCell = {
  hand: HandNotation;
  actions: HandAction[];
};

export type Situation =
  | 'RFI'
  | 'vs_RFI'
  | 'vs_3BET'
  | 'vs_4BET'
  | 'SQUEEZE'
  | 'DEFEND_BB';

export type Range = {
  id: string;
  name: string;
  position: Position;
  situation: Situation;
  villainPosition?: Position;
  /** Sparse map keyed by hand notation; missing hands are implicit FOLD. */
  cells: Record<HandNotation, RangeCell>;
  createdAt: string;
  updatedAt: string;
  group?: string;
};
