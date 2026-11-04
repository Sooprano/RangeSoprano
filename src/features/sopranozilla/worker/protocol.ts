// Messages between the main thread and the equity worker, plus the handler
// the worker runs. The handler is plain TS so it can be tested without a
// real Worker.

import { buildSpotRunouts, computeEqCombos, newEqComboTable } from '../engine/equity';
import type { CardId } from '../engine/cards';
import type { ComboId } from '../engine/combos';

export type EqRequest = {
  type: 'eqCombos';
  requestId: number;
  hero: CardId[];
  board: CardId[];
  combos: ComboId[];
};

export type EqResponse =
  | { type: 'progress'; requestId: number; done: number; total: number }
  | {
      type: 'result';
      requestId: number;
      combos: ComboId[];
      /** Same order as `combos`; NaN for blocked combos. */
      eq: number[];
      elapsedMs: number;
    }
  | { type: 'error'; requestId: number; message: string };

export function handleEqRequest(req: EqRequest, post: (msg: EqResponse) => void): void {
  const started = performance.now();
  try {
    const spot = buildSpotRunouts(req.hero, req.board);
    const table = newEqComboTable();
    computeEqCombos(spot, req.combos, table, (done, total) =>
      post({ type: 'progress', requestId: req.requestId, done, total }),
    );
    post({
      type: 'result',
      requestId: req.requestId,
      combos: req.combos,
      eq: req.combos.map((id) => table[id] ?? Number.NaN),
      elapsedMs: performance.now() - started,
    });
  } catch (err) {
    post({
      type: 'error',
      requestId: req.requestId,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
