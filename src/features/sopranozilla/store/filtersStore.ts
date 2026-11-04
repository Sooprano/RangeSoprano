// Saved custom filters (§6): persisted in localStorage, validated with Zod on
// load, exported / imported as JSON. Saving or importing never leaves a
// reference cycle behind.

import { create } from 'zustand';
import { persist, type PersistStorage } from 'zustand/middleware';
import { z } from 'zod';
import { createSafeJSONStorage } from '@/store/persist';
import {
  findCycle,
  referencedFilters,
  validateFilter,
  type CustomFilter,
  type CustomFilterId,
  type FilterIssue,
} from '../engine/filterExpr';
import { zCustomFilter } from '../schemas/filters';

export const FILTERS_STORE_KEY = 'range-soprano/sopranozilla-filters';

type Persisted = { filters: CustomFilter[] };

export type SaveResult = { ok: true } | { ok: false; issues: FilterIssue[] };
export type DeleteResult = { ok: true } | { ok: false; usedBy: string[] };

type FiltersStore = Persisted & {
  /** Adds the filter, or replaces the one with the same id. */
  saveFilter: (filter: CustomFilter) => SaveResult;
  /** Refused while another filter references it. */
  deleteFilter: (id: CustomFilterId) => DeleteResult;
  duplicateFilter: (id: CustomFilterId) => CustomFilter | null;
  /** Adds already-validated filters; same id = replaced. */
  importFilters: (filters: readonly CustomFilter[]) => SaveResult;
};

const zPersisted = z.object({ filters: z.array(zCustomFilter).max(500) }).strict();

export const useFiltersStore = create<FiltersStore>()(
  persist(
    (set, get) => ({
      filters: [],

      saveFilter: (filter) => {
        const { filters } = get();
        const issues = validateFilter(filter, filters);
        if (issues.length > 0) return { ok: false, issues };
        const at = filters.findIndex((f) => f.id === filter.id);
        set({
          filters:
            at >= 0 ? filters.map((f, i) => (i === at ? filter : f)) : [...filters, filter],
        });
        return { ok: true };
      },

      deleteFilter: (id) => {
        const { filters } = get();
        const usedBy = filters
          .filter((f) => f.id !== id && referencedFilters(f.expr).includes(id))
          .map((f) => f.name);
        if (usedBy.length > 0) return { ok: false, usedBy };
        set({ filters: filters.filter((f) => f.id !== id) });
        return { ok: true };
      },

      duplicateFilter: (id) => {
        const { filters } = get();
        const src = filters.find((f) => f.id === id);
        if (!src) return null;
        const copy: CustomFilter = {
          ...src,
          id: crypto.randomUUID(),
          name: `${src.name} (copia)`.slice(0, 80),
          createdAt: new Date().toISOString(),
        };
        set({ filters: [...filters, copy] });
        return copy;
      },

      importFilters: (incoming) => {
        const byId = new Map(get().filters.map((f) => [f.id, f]));
        for (const f of incoming) byId.set(f.id, f);
        const next = [...byId.values()];
        const cycle = findCycle(next);
        if (cycle) return { ok: false, issues: [{ kind: 'circular', cycle }] };
        set({ filters: next });
        return { ok: true };
      },
    }),
    {
      name: FILTERS_STORE_KEY,
      version: 1,
      storage: createSafeJSONStorage() as PersistStorage<Persisted>,
      partialize: (s) => ({ filters: s.filters }),
      merge: (persisted, current) => {
        const parsed = zPersisted.safeParse(persisted);
        if (!parsed.success || findCycle(parsed.data.filters)) return current;
        return { ...current, filters: parsed.data.filters };
      },
    },
  ),
);
