import { create } from 'zustand';
import { persist, type PersistStorage } from 'zustand/middleware';
import {
  CURRENT_LEADERBOARD_STORE_VERSION,
  LEADERBOARD_TOP_N,
  zPersistedLeaderboardState,
  type PersistedLeaderboardState,
  type RangeLeaderboard,
  type SpeedClassicEntry,
  type SpeedDrawingEntry,
  type SpeedEntry,
} from './schemas';
import { LEADERBOARD_STORE_KEY, createSafeJSONStorage } from './persist';

type LeaderboardStoreState = PersistedLeaderboardState & {
  /** Adds an entry; returns true if it landed in the top N for its style. */
  addEntry: (rangeId: string, entry: SpeedEntry) => boolean;
  clearForRange: (rangeId: string) => void;
};

const INITIAL: PersistedLeaderboardState = {
  byRangeId: {},
};

const EMPTY_BOARD: RangeLeaderboard = { classic: [], drawing: [] };

function sortClassic(entries: SpeedClassicEntry[]): SpeedClassicEntry[] {
  return [...entries].sort((a, b) => {
    if (b.accuracyPct !== a.accuracyPct) return b.accuracyPct - a.accuracyPct;
    if (b.correct !== a.correct) return b.correct - a.correct;
    return b.hpm - a.hpm;
  });
}

function sortDrawing(entries: SpeedDrawingEntry[]): SpeedDrawingEntry[] {
  return [...entries].sort((a, b) => {
    if (b.accuracyPct !== a.accuracyPct) return b.accuracyPct - a.accuracyPct;
    return b.matchCombos - a.matchCombos;
  });
}

export const useLeaderboardStore = create<LeaderboardStoreState>()(
  persist(
    (set, get) => ({
      ...INITIAL,

      addEntry: (rangeId, entry) => {
        const state = get();
        const current = state.byRangeId[rangeId] ?? EMPTY_BOARD;
        let next: RangeLeaderboard;
        let madeTop: boolean;
        if (entry.style === 'classic') {
          const sorted = sortClassic([...current.classic, entry]).slice(0, LEADERBOARD_TOP_N);
          madeTop = sorted.some(
            (e) => e.dateIso === entry.dateIso && e.correct === entry.correct,
          );
          next = { classic: sorted, drawing: current.drawing };
        } else {
          const sorted = sortDrawing([...current.drawing, entry]).slice(0, LEADERBOARD_TOP_N);
          madeTop = sorted.some(
            (e) => e.dateIso === entry.dateIso && e.matchCombos === entry.matchCombos,
          );
          next = { classic: current.classic, drawing: sorted };
        }
        set({ byRangeId: { ...state.byRangeId, [rangeId]: next } });
        return madeTop;
      },

      clearForRange: (rangeId) =>
        set((s) => {
          if (!(rangeId in s.byRangeId)) return {};
          const next = { ...s.byRangeId };
          delete next[rangeId];
          return { byRangeId: next };
        }),
    }),
    {
      name: LEADERBOARD_STORE_KEY,
      version: CURRENT_LEADERBOARD_STORE_VERSION,
      storage: createSafeJSONStorage() as PersistStorage<PersistedLeaderboardState>,
      partialize: (s) => ({ byRangeId: s.byRangeId }),
      merge: (persisted, current) => {
        if (persisted == null) return current;
        const parsed = zPersistedLeaderboardState.safeParse(persisted);
        if (parsed.success) return { ...current, ...parsed.data };
        if (import.meta.env.DEV) {
          console.warn(
            '[range-soprano] persisted leaderboard failed validation; using defaults.',
            parsed.error.issues,
          );
        }
        return { ...current, ...INITIAL };
      },
    },
  ),
);

export function useRangeLeaderboard(rangeId: string | null): RangeLeaderboard {
  return useLeaderboardStore((s) =>
    rangeId ? (s.byRangeId[rangeId] ?? EMPTY_BOARD) : EMPTY_BOARD,
  );
}
