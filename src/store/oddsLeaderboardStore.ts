import { create } from 'zustand';
import { persist, type PersistStorage } from 'zustand/middleware';
import {
  CURRENT_ODDS_LEADERBOARD_VERSION,
  ODDS_LEADERBOARD_TOP_N,
  zOddsLeaderboard,
  type OddsEntry,
  type OddsLeaderboard,
} from './schemas';
import { ODDS_LEADERBOARD_STORE_KEY, createSafeJSONStorage } from './persist';

type OddsLeaderboardStoreState = OddsLeaderboard & {
  /** Adds an entry; returns true if it landed in the top N for its duration. */
  addEntry: (entry: OddsEntry) => boolean;
  clearForDuration: (durationSec: number) => void;
  clearAll: () => void;
};

const INITIAL: OddsLeaderboard = {
  byDuration: {},
};

// Stable empty reference: returning a fresh `[]` from the selector breaks
// Zustand snapshot equality and triggers an infinite render loop.
const EMPTY_ENTRIES: readonly OddsEntry[] = Object.freeze([]);

function sortEntries(entries: OddsEntry[]): OddsEntry[] {
  return [...entries].sort((a, b) => {
    if (b.accuracyPct !== a.accuracyPct) return b.accuracyPct - a.accuracyPct;
    if (b.correct !== a.correct) return b.correct - a.correct;
    return b.qpm - a.qpm;
  });
}

export const useOddsLeaderboardStore = create<OddsLeaderboardStoreState>()(
  persist(
    (set, get) => ({
      ...INITIAL,

      addEntry: (entry) => {
        const state = get();
        const key = String(entry.durationSec);
        const current = state.byDuration[key] ?? [];
        const sorted = sortEntries([...current, entry]).slice(
          0,
          ODDS_LEADERBOARD_TOP_N,
        );
        const madeTop = sorted.some(
          (e) =>
            e.dateIso === entry.dateIso &&
            e.correct === entry.correct &&
            e.total === entry.total,
        );
        set({ byDuration: { ...state.byDuration, [key]: sorted } });
        return madeTop;
      },

      clearForDuration: (durationSec) =>
        set((s) => {
          const key = String(durationSec);
          if (!(key in s.byDuration)) return {};
          const next = { ...s.byDuration };
          delete next[key];
          return { byDuration: next };
        }),

      clearAll: () => set({ byDuration: {} }),
    }),
    {
      name: ODDS_LEADERBOARD_STORE_KEY,
      version: CURRENT_ODDS_LEADERBOARD_VERSION,
      storage: createSafeJSONStorage() as PersistStorage<OddsLeaderboard>,
      partialize: (s) => ({ byDuration: s.byDuration }),
      merge: (persisted, current) => {
        if (persisted == null) return current;
        const parsed = zOddsLeaderboard.safeParse(persisted);
        if (parsed.success) return { ...current, ...parsed.data };
        if (import.meta.env.DEV) {
          console.warn(
            '[range-soprano] persisted odds leaderboard failed validation; using defaults.',
            parsed.error.issues,
          );
        }
        return { ...current, ...INITIAL };
      },
    },
  ),
);

export function useOddsBoardForDuration(
  durationSec: number,
): readonly OddsEntry[] {
  return useOddsLeaderboardStore(
    (s) => s.byDuration[String(durationSec)] ?? EMPTY_ENTRIES,
  );
}
