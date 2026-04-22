import { create } from 'zustand';
import { persist, type PersistStorage } from 'zustand/middleware';
import type {
  HandNotation,
  Position,
  Range,
  RangeCellData,
  Situation,
} from '@/types/poker';
import {
  CURRENT_RANGE_STORE_VERSION,
  MAX_RANGES,
  zPersistedRangeState,
  zRange,
  type PersistedRangeState,
} from './schemas';
import {
  RANGE_STORE_KEY,
  byteLengthOf,
  createSafeJSONStorage,
  MAX_IMPORT_BYTES,
} from './persist';

export type ImportResult = {
  accepted: number;
  rejected: Array<{ reason: string; index?: number }>;
};

export type CreateRangeInput = {
  name: string;
  position: Position;
  situation: Situation;
  villainPosition?: Position;
  group?: string;
  cells?: Record<HandNotation, RangeCellData>;
};

type RangeStoreState = PersistedRangeState & {
  createRange: (input: CreateRangeInput) => string;
  updateRange: (
    id: string,
    patch: Partial<Omit<Range, 'id' | 'createdAt'>>,
  ) => void;
  deleteRange: (id: string) => void;
  duplicateRange: (id: string, nameSuffix?: string) => string | null;
  setActiveRange: (id: string | null) => void;
  upsertCell: (rangeId: string, cell: RangeCellData) => void;
  clearCell: (rangeId: string, hand: HandNotation) => void;
  clearAllCells: (rangeId: string) => void;
  importRanges: (
    payload: unknown,
    opts?: { replace?: boolean },
  ) => ImportResult;
  resetStore: () => void;
};

const INITIAL: PersistedRangeState = {
  ranges: [],
  activeRangeId: null,
};

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function touch(r: Range): Range {
  return { ...r, updatedAt: nowIso() };
}

function deepCloneCells(
  cells: Record<HandNotation, RangeCellData>,
): Record<HandNotation, RangeCellData> {
  const out: Record<HandNotation, RangeCellData> = {};
  for (const k in cells) {
    const c = cells[k];
    if (!c) continue;
    out[k] = { hand: c.hand, actions: c.actions.map((a) => ({ ...a })) };
  }
  return out;
}

export const useRangeStore = create<RangeStoreState>()(
  persist(
    (set, get) => ({
      ...INITIAL,

      createRange: (input) => {
        const id = newId();
        const now = nowIso();
        const range: Range = {
          id,
          name: input.name,
          position: input.position,
          situation: input.situation,
          ...(input.villainPosition !== undefined && {
            villainPosition: input.villainPosition,
          }),
          ...(input.group !== undefined && { group: input.group }),
          cells: input.cells ? deepCloneCells(input.cells) : {},
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ ranges: [...s.ranges, range] }));
        return id;
      },

      updateRange: (id, patch) => {
        set((s) => ({
          ranges: s.ranges.map((r) => {
            if (r.id !== id) return r;
            const { id: _id, createdAt: _c, ...safe } = patch as Partial<Range>;
            void _id;
            void _c;
            return touch({ ...r, ...safe });
          }),
        }));
      },

      deleteRange: (id) => {
        set((s) => {
          const ranges = s.ranges.filter((r) => r.id !== id);
          const activeRangeId = s.activeRangeId === id ? null : s.activeRangeId;
          return { ranges, activeRangeId };
        });
      },

      duplicateRange: (id, nameSuffix = ' (copy)') => {
        const src = get().ranges.find((r) => r.id === id);
        if (!src) return null;
        const newRangeId = newId();
        const now = nowIso();
        const copy: Range = {
          ...src,
          id: newRangeId,
          name: `${src.name}${nameSuffix}`.slice(0, 80),
          cells: deepCloneCells(src.cells),
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ ranges: [...s.ranges, copy] }));
        return newRangeId;
      },

      setActiveRange: (id) => {
        if (id !== null && !get().ranges.some((r) => r.id === id)) return;
        set({ activeRangeId: id });
      },

      upsertCell: (rangeId, cell) => {
        set((s) => ({
          ranges: s.ranges.map((r) => {
            if (r.id !== rangeId) return r;
            const nextCells = { ...r.cells, [cell.hand]: cell };
            return touch({ ...r, cells: nextCells });
          }),
        }));
      },

      clearCell: (rangeId, hand) => {
        set((s) => ({
          ranges: s.ranges.map((r) => {
            if (r.id !== rangeId) return r;
            if (!(hand in r.cells)) return r;
            const nextCells = { ...r.cells };
            delete nextCells[hand];
            return touch({ ...r, cells: nextCells });
          }),
        }));
      },

      clearAllCells: (rangeId) => {
        set((s) => ({
          ranges: s.ranges.map((r) =>
            r.id === rangeId ? touch({ ...r, cells: {} }) : r,
          ),
        }));
      },

      importRanges: (payload, opts) => {
        const rejected: ImportResult['rejected'] = [];
        let raw: unknown = payload;

        if (typeof payload === 'string') {
          if (byteLengthOf(payload) > MAX_IMPORT_BYTES) {
            return {
              accepted: 0,
              rejected: [{ reason: `payload exceeds ${MAX_IMPORT_BYTES} bytes` }],
            };
          }
          try {
            raw = JSON.parse(payload);
          } catch {
            return { accepted: 0, rejected: [{ reason: 'invalid JSON' }] };
          }
        } else {
          try {
            const serialized = JSON.stringify(payload);
            if (byteLengthOf(serialized) > MAX_IMPORT_BYTES) {
              return {
                accepted: 0,
                rejected: [{ reason: `payload exceeds ${MAX_IMPORT_BYTES} bytes` }],
              };
            }
          } catch {
            return { accepted: 0, rejected: [{ reason: 'payload not serializable' }] };
          }
        }

        const arr = Array.isArray(raw)
          ? raw
          : raw && typeof raw === 'object' && Array.isArray((raw as { ranges?: unknown }).ranges)
            ? (raw as { ranges: unknown[] }).ranges
            : null;

        if (!arr) {
          return { accepted: 0, rejected: [{ reason: 'expected array or { ranges }' }] };
        }

        const current = get().ranges;
        const existingIds = new Set(current.map((r) => r.id));
        const accepted: Range[] = [];
        const capacity = opts?.replace ? MAX_RANGES : MAX_RANGES - current.length;

        for (let i = 0; i < arr.length; i++) {
          if (accepted.length >= capacity) {
            rejected.push({ reason: 'range cap reached', index: i });
            continue;
          }
          const parsed = zRange.safeParse(arr[i]);
          if (!parsed.success) {
            rejected.push({ reason: parsed.error.issues[0]?.message ?? 'invalid', index: i });
            continue;
          }
          const r = parsed.data as Range;
          const finalId = existingIds.has(r.id) ? newId() : r.id;
          existingIds.add(finalId);
          accepted.push({ ...r, id: finalId });
        }

        set((s) => ({
          ranges: opts?.replace ? accepted : [...s.ranges, ...accepted],
          activeRangeId: opts?.replace ? null : s.activeRangeId,
        }));

        return { accepted: accepted.length, rejected };
      },

      resetStore: () => set({ ...INITIAL }),
    }),
    {
      name: RANGE_STORE_KEY,
      version: CURRENT_RANGE_STORE_VERSION,
      storage: createSafeJSONStorage() as PersistStorage<
        Pick<RangeStoreState, 'ranges' | 'activeRangeId'>
      >,
      partialize: (s) => ({
        ranges: s.ranges,
        activeRangeId: s.activeRangeId,
      }),
      migrate: (persisted, fromVersion) => {
        if (fromVersion < CURRENT_RANGE_STORE_VERSION) return { ...INITIAL };
        return persisted as PersistedRangeState;
      },
      merge: (persisted, current) => {
        if (persisted == null) return current;
        const parsed = zPersistedRangeState.safeParse(persisted);
        if (parsed.success) {
          const { ranges, activeRangeId } = parsed.data;
          const known = new Set(ranges.map((r) => r.id));
          return {
            ...current,
            ranges: ranges as Range[],
            activeRangeId:
              activeRangeId && known.has(activeRangeId) ? activeRangeId : null,
          };
        }

        // Root failed: try a per-range recovery (keep the good ones).
        const maybe = persisted as { ranges?: unknown; activeRangeId?: unknown };
        const keep: Range[] = [];
        if (Array.isArray(maybe.ranges)) {
          for (let i = 0; i < maybe.ranges.length && keep.length < MAX_RANGES; i++) {
            const p = zRange.safeParse(maybe.ranges[i]);
            if (p.success) keep.push(p.data as Range);
          }
        }
        const rawActive =
          typeof maybe.activeRangeId === 'string' ? maybe.activeRangeId : null;
        const known = new Set(keep.map((r) => r.id));
        if (import.meta.env.DEV) {
          console.warn(
            '[range-soprano] persisted range state failed validation; recovered',
            keep.length,
            'range(s).',
            parsed.error.issues,
          );
        }
        return {
          ...current,
          ranges: keep,
          activeRangeId: rawActive && known.has(rawActive) ? rawActive : null,
        };
      },
    },
  ),
);
