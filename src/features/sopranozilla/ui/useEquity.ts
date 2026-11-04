// React side of the equity worker: keeps the per-combo equity table of the
// current spot filled for the combos that are in the range. Weight changes
// that do not bring new combos resolve from the cache right away.

import { useEffect, useState } from 'react';
import type { CardId } from '../engine/cards';
import type { ComboWeights } from '../engine/combos';
import type { StreetView } from '../engine/chain';
import { EqComboCache, spotKey, type EqComboTable, type Street } from '../engine/equity';
import { createEquityWorker, EquityClient, SupersededError } from '../worker/equityClient';

// Both clients share one cache: whatever one computes, the other reuses.
const sharedCache = new EqComboCache();
let sharedClient: EquityClient | null = null;
let backgroundClient: EquityClient | null = null;

/** The active street's worker; it outlives re-renders and route changes. */
function client(): EquityClient {
  sharedClient ??= new EquityClient(createEquityWorker, sharedCache);
  return sharedClient;
}

/** A second worker for the other streets, so they never delay the active one. */
function background(): EquityClient {
  backgroundClient ??= new EquityClient(createEquityWorker, sharedCache);
  return backgroundClient;
}

export type EquityState = {
  /** Filled table for the current spot, or null while it is first computed. */
  table: EqComboTable | null;
  /** Combos computed so far in the running request. */
  progress: { done: number; total: number } | null;
  error: string | null;
  /** Bumps whenever the (mutable) table gains values. */
  version: number;
};

type Internal = EquityState & { key: string | null };

const IDLE: Internal = { key: null, table: null, progress: null, error: null, version: 0 };

export function useEquity(
  hero: readonly CardId[] | null,
  board: readonly CardId[] | null,
  weights: ComboWeights | null,
): EquityState {
  const [state, setState] = useState<Internal>(IDLE);
  const key = hero && board ? spotKey(hero, board) : null;

  useEffect(() => {
    if (!hero || !board || !weights || !key) return;
    let cancelled = false;
    client()
      .ensure(hero, board, weights, (done, total) => {
        if (cancelled) return;
        setState((s) => ({
          ...s,
          table: s.key === key ? s.table : null,
          key,
          progress: { done, total },
        }));
      })
      .then((table) => {
        if (cancelled) return;
        setState((s) => ({ key, table, progress: null, error: null, version: s.version + 1 }));
      })
      .catch((err: unknown) => {
        if (cancelled || err instanceof SupersededError) return;
        setState((s) => ({
          ...s,
          table: s.key === key ? s.table : null,
          key,
          progress: null,
          error: err instanceof Error ? err.message : String(err),
        }));
      });
    return () => {
      cancelled = true;
    };
    // `key` stands for hero + board (their arrays may be rebuilt each render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, weights]);

  // Never hand out a table that belongs to another spot.
  const current = state.key === key;
  return {
    table: current ? state.table : null,
    progress: current ? state.progress : null,
    error: current ? state.error : null,
    version: state.version,
  };
}

export type StreetTables = { tables: Partial<Record<Street, EqComboTable>>; version: number };

/**
 * Equity tables of every street (for "Equity por calle"), filled one street
 * after another in the background worker. A change restarts the sequence;
 * streets already cached resolve at once.
 */
export function useStreetTables(
  hero: readonly CardId[] | null,
  /** Flop, turn and river, in that order (null where the board ends). */
  views: readonly [StreetView | null, StreetView | null, StreetView | null],
): StreetTables {
  const [state, setState] = useState<StreetTables & { key: string | null }>({
    key: null,
    tables: {},
    version: 0,
  });
  const live = views.filter((v): v is StreetView => v !== null);
  const key = hero ? live.map((v) => spotKey(hero, v.board)).join('/') : null;

  useEffect(() => {
    if (!hero || !key) return;
    let cancelled = false;
    (async () => {
      for (const v of live) {
        try {
          const table = await background().ensure(hero, v.board, v.start);
          if (cancelled) return;
          setState((s) => ({
            key,
            tables: { ...(s.key === key ? s.tables : {}), [v.street]: table },
            version: s.version + 1,
          }));
        } catch (err) {
          if (cancelled || err instanceof SupersededError) return;
          throw err;
        }
      }
    })().catch(() => {
      // A worker failure only leaves "Equity por calle" incomplete; the active
      // street reports its own errors.
    });
    return () => {
      cancelled = true;
    };
    // `key` stands for hero + boards; the start weights come with the views.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, views[0]?.start, views[1]?.start, views[2]?.start]);

  return state.key === key ? state : { tables: {}, version: state.version };
}
