import { create } from 'zustand';
import { persist, type PersistStorage } from 'zustand/middleware';
import {
  CURRENT_PUSHFOLD_LEADERBOARD_VERSION,
  PUSHFOLD_DURATIONS,
  PUSHFOLD_LEADERBOARD_TOP_N,
  zPushFoldLeaderboard,
  type PushFoldEntry,
  type PushFoldLeaderboard,
} from './schemas';
import { PUSHFOLD_LEADERBOARD_STORE_KEY, createSafeJSONStorage } from './persist';

type PushFoldLeaderboardStoreState = PushFoldLeaderboard & {
  /** Adds an entry; returns true if it landed in the top N for its duration. */
  addEntry: (entry: PushFoldEntry) => boolean;
  clearForDuration: (durationSec: number) => void;
  clearAll: () => void;
  /**
   * Merges imported entries into existing boards. Unknown durations are
   * skipped silently. Dedupes by `dateIso`. Returns the count of entries
   * actually inserted (after dedupe + cap).
   */
  mergeImport: (byDuration: Record<string, PushFoldEntry[]>) => number;
};

const VALID_DURATIONS: readonly number[] = PUSHFOLD_DURATIONS;

const INITIAL: PushFoldLeaderboard = {
  byDuration: {},
};

// Stable empty reference: returning a fresh `[]` from the selector breaks
// Zustand snapshot equality and triggers an infinite render loop.
const EMPTY_ENTRIES: readonly PushFoldEntry[] = Object.freeze([]);

function sortEntries(entries: PushFoldEntry[]): PushFoldEntry[] {
  return [...entries].sort((a, b) => {
    if (b.accuracyPct !== a.accuracyPct) return b.accuracyPct - a.accuracyPct;
    if (b.correct !== a.correct) return b.correct - a.correct;
    return b.qpm - a.qpm;
  });
}

export const usePushFoldLeaderboardStore = create<PushFoldLeaderboardStoreState>()(
  persist(
    (set, get) => ({
      ...INITIAL,

      addEntry: (entry) => {
        const state = get();
        const key = String(entry.durationSec);
        const current = state.byDuration[key] ?? [];
        const sorted = sortEntries([...current, entry]).slice(
          0,
          PUSHFOLD_LEADERBOARD_TOP_N,
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

      mergeImport: (importedByDuration) => {
        const state = get();
        const next = { ...state.byDuration };
        let inserted = 0;
        for (const [key, entries] of Object.entries(importedByDuration)) {
          const numKey = Number(key);
          if (!Number.isFinite(numKey) || !VALID_DURATIONS.includes(numKey)) {
            continue;
          }
          if (entries.length === 0) continue;
          const current = next[key] ?? [];
          const seen = new Set(current.map((e) => e.dateIso));
          const fresh = entries.filter((e) => !seen.has(e.dateIso));
          if (fresh.length === 0) continue;
          const merged = sortEntries([...current, ...fresh]).slice(
            0,
            PUSHFOLD_LEADERBOARD_TOP_N,
          );
          next[key] = merged;
          inserted += fresh.length;
        }
        if (inserted > 0) set({ byDuration: next });
        return inserted;
      },
    }),
    {
      name: PUSHFOLD_LEADERBOARD_STORE_KEY,
      version: CURRENT_PUSHFOLD_LEADERBOARD_VERSION,
      storage: createSafeJSONStorage() as PersistStorage<PushFoldLeaderboard>,
      partialize: (s) => ({ byDuration: s.byDuration }),
      merge: (persisted, current) => {
        if (persisted == null) return current;
        const parsed = zPushFoldLeaderboard.safeParse(persisted);
        if (parsed.success) return { ...current, ...parsed.data };
        if (import.meta.env.DEV) {
          console.warn(
            '[range-soprano] persisted push/fold leaderboard failed validation; using defaults.',
            parsed.error.issues,
          );
        }
        return { ...current, ...INITIAL };
      },
    },
  ),
);

export function usePushFoldBoardForDuration(
  durationSec: number,
): readonly PushFoldEntry[] {
  return usePushFoldLeaderboardStore(
    (s) => s.byDuration[String(durationSec)] ?? EMPTY_ENTRIES,
  );
}
