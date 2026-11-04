// The action recorded in a real hand, per street, in the analyzer's terms:
// which mode ("Hero decide" / "Villano apuesta"), which row was played and how
// the other player answered. The adapter fills it; the store turns it into
// rows, the played row and presets (§12).

import type { Street } from './equity';

export type Response = 'call' | 'raise' | 'fold';

export type RecordedAction =
  /** Nobody bet. */
  | { mode: 'hero'; kind: 'check' }
  /** Hero bet `sizePct` % of the pot; the villain answered `response` (null = unknown). */
  | { mode: 'hero'; kind: 'bet'; sizePct: number; response: Response | null }
  /** The villain bet `betPct` % of the pot; Hero answered `response`
   * (a raise to `raiseMultiple` × the bet). */
  | {
      mode: 'villain';
      betPct: number;
      response: Response | null;
      raiseMultiple?: number | undefined;
    };

export type RecordedStreets = Partial<Record<Street, RecordedAction>>;
