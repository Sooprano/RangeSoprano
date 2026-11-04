// Main-thread client for the equity worker. Only sends the combos that are not
// cached yet for the spot, and keeps the results in an EqComboCache outside
// any reactive store. A new request supersedes the pending one: the worker is
// restarted so a stale flop never delays the current one.

import type { CardId } from '../engine/cards';
import type { ComboWeights } from '../engine/combos';
import { EqComboCache, missingCombos, spotKey, type EqComboTable } from '../engine/equity';
import type { EqRequest, EqResponse } from './protocol';

/** The part of `Worker` the client uses — lets tests inject a fake. */
export type WorkerLike = {
  postMessage: (msg: EqRequest) => void;
  terminate: () => void;
  onmessage: ((event: MessageEvent<EqResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
};

export type ProgressFn = (done: number, total: number) => void;

export class SupersededError extends Error {
  constructor() {
    super('equity request superseded by a newer one');
    this.name = 'SupersededError';
  }
}

export function createEquityWorker(): WorkerLike {
  return new Worker(new URL('./equity.worker.ts', import.meta.url), {
    type: 'module',
  }) as unknown as WorkerLike;
}

type Pending = {
  requestId: number;
  spot: string;
  combos: ReadonlySet<number>;
  promise: Promise<EqComboTable>;
  table: EqComboTable;
  resolve: (table: EqComboTable) => void;
  reject: (err: Error) => void;
  onProgress: ProgressFn | undefined;
};

export class EquityClient {
  readonly cache: EqComboCache;
  private readonly createWorker: () => WorkerLike;
  private worker: WorkerLike | null = null;
  private pending: Pending | null = null;
  private nextId = 1;

  constructor(createWorker: () => WorkerLike = createEquityWorker, cache = new EqComboCache()) {
    this.createWorker = createWorker;
    this.cache = cache;
  }

  /**
   * Resolves with the spot's eqCombo table once every weighted, unblocked
   * combo is filled. Resolves immediately when everything is cached.
   */
  ensure(
    hero: readonly CardId[],
    board: readonly CardId[],
    weights: ComboWeights,
    onProgress?: ProgressFn,
  ): Promise<EqComboTable> {
    const table = this.cache.table(hero, board);
    const combos = missingCombos(table, weights, hero, board);
    const spot = spotKey(hero, board);
    // The running request already covers everything that is missing: share it
    // instead of restarting the worker (every edit rebuilds the weights).
    const running = this.pending;
    if (running && running.spot === spot && combos.every((id) => running.combos.has(id))) {
      if (onProgress) running.onProgress = onProgress;
      return running.promise;
    }
    this.supersede();
    if (combos.length === 0) return Promise.resolve(table);

    const requestId = this.nextId++;
    let resolve!: (t: EqComboTable) => void;
    let reject!: (e: Error) => void;
    const promise = new Promise<EqComboTable>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    this.pending = {
      requestId,
      spot,
      combos: new Set(combos),
      promise,
      table,
      resolve,
      reject,
      onProgress,
    };
    this.getWorker().postMessage({
      type: 'eqCombos',
      requestId,
      hero: [...hero],
      board: [...board],
      combos,
    });
    return promise;
  }

  dispose(): void {
    this.supersede();
    this.worker?.terminate();
    this.worker = null;
  }

  private getWorker(): WorkerLike {
    if (this.worker) return this.worker;
    const w = this.createWorker();
    w.onmessage = (event) => this.onMessage(event.data);
    w.onerror = (event) => {
      const p = this.pending;
      this.pending = null;
      p?.reject(new Error(event.message || 'equity worker crashed'));
      this.worker?.terminate();
      this.worker = null;
    };
    this.worker = w;
    return w;
  }

  /** Rejects the in-flight request and restarts the worker. */
  private supersede(): void {
    const p = this.pending;
    if (!p) return;
    this.pending = null;
    this.worker?.terminate();
    this.worker = null;
    p.reject(new SupersededError());
  }

  private onMessage(msg: EqResponse): void {
    const p = this.pending;
    if (!p || msg.requestId !== p.requestId) return;
    if (msg.type === 'progress') {
      p.onProgress?.(msg.done, msg.total);
      return;
    }
    this.pending = null;
    if (msg.type === 'error') {
      p.reject(new Error(msg.message));
      return;
    }
    msg.combos.forEach((id, i) => {
      p.table[id] = msg.eq[i] ?? Number.NaN;
    });
    p.resolve(p.table);
  }
}
