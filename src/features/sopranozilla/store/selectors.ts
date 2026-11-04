// Memoized derived values of the analyzer store. Pure selectors are keyed by
// object identity (the store replaces objects on every change), and the hook
// reads the store through `useShallow` so it never builds a new object per
// render (see the /editor infinite-loop note in SPEC §2).

import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { streetView, weightsFromRecord, type StreetView } from '../engine/chain';
import type { ComboWeights } from '../engine/combos';
import type { Street } from '../engine/equity';
import type { CustomFilter } from '../engine/filterExpr';
import { useAnalyzerStore, type AnalyzerState } from './analyzerStore';

const PREFLOP_CACHE = new WeakMap<Record<number, number>, ComboWeights>();

/** Dense villain preflop weights, converted once per record object. */
export function preflopWeights(rec: Record<number, number>): ComboWeights {
  let w = PREFLOP_CACHE.get(rec);
  if (!w) {
    w = weightsFromRecord(rec);
    PREFLOP_CACHE.set(rec, w);
  }
  return w;
}

type ViewKey = Pick<AnalyzerState, 'hand' | 'villainPreflop' | 'streets'>;

type Slot = { key: ViewKey & { filters: readonly CustomFilter[] }; view: StreetView | null };

/** One memo slot per street, so showing several streets at once does not thrash. */
const SLOTS = new Map<Street, Slot>();

/** Effective ranges of one street; recomputed only when its inputs change. */
export function selectStreetView(
  state: ViewKey,
  street: Street,
  filters: readonly CustomFilter[],
): StreetView | null {
  const slot = SLOTS.get(street);
  if (
    slot &&
    slot.key.hand === state.hand &&
    slot.key.villainPreflop === state.villainPreflop &&
    slot.key.streets === state.streets &&
    slot.key.filters === filters
  ) {
    return slot.view;
  }
  const view = state.hand
    ? streetView(
        {
          hand: state.hand,
          villainPreflop: preflopWeights(state.villainPreflop),
          streets: state.streets,
          filters,
        },
        street,
      )
    : null;
  SLOTS.set(street, { key: { ...state, filters }, view });
  return view;
}

const NO_FILTERS: readonly CustomFilter[] = [];

/** React hook: the effective ranges of `street` (null without a hand or board). */
export function useStreetView(
  street: Street,
  filters: readonly CustomFilter[] = NO_FILTERS,
): StreetView | null {
  const { hand, villainPreflop, streets } = useAnalyzerStore(
    useShallow((s) => ({ hand: s.hand, villainPreflop: s.villainPreflop, streets: s.streets })),
  );
  return useMemo(
    () => selectStreetView({ hand, villainPreflop, streets }, street, filters),
    [hand, villainPreflop, streets, street, filters],
  );
}
