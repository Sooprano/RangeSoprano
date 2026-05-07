import { create } from 'zustand';
import { persist, type PersistStorage } from 'zustand/middleware';
import {
  CURRENT_CHRONOMETER_VERSION,
  MAX_CHRONOMETER_LAPS,
  zChronometerState,
  type ChronometerLap,
  type ChronometerPersistedState,
} from './schemas';
import { CHRONOMETER_STORE_KEY, createSafeJSONStorage } from './persist';

type ChronometerStoreState = ChronometerPersistedState & {
  toggle: () => void;
  flag: () => void;
  reset: () => void;
};

const INITIAL: ChronometerPersistedState = {
  running: false,
  elapsed: 0,
  lastStartedAt: null,
  laps: [],
};

export const useChronometerStore = create<ChronometerStoreState>()(
  persist(
    (set, get) => ({
      ...INITIAL,

      toggle: () => {
        const s = get();
        if (s.running) {
          const now = Date.now();
          const accumulated =
            s.elapsed +
            (s.lastStartedAt !== null ? now - s.lastStartedAt : 0);
          set({ running: false, elapsed: accumulated, lastStartedAt: null });
        } else {
          set({ running: true, lastStartedAt: Date.now() });
        }
      },

      flag: () => {
        const s = get();
        if (s.laps.length >= MAX_CHRONOMETER_LAPS) return;
        const now = Date.now();
        const total =
          s.running && s.lastStartedAt !== null
            ? s.elapsed + (now - s.lastStartedAt)
            : s.elapsed;
        const prevTotal =
          s.laps.length > 0 ? (s.laps[s.laps.length - 1]?.total ?? 0) : 0;
        const delta = total - prevTotal;
        const lap: ChronometerLap = { n: s.laps.length + 1, delta, total };
        set({ laps: [...s.laps, lap] });
      },

      reset: () => {
        set({ ...INITIAL });
      },
    }),
    {
      name: CHRONOMETER_STORE_KEY,
      version: CURRENT_CHRONOMETER_VERSION,
      storage: createSafeJSONStorage() as PersistStorage<ChronometerPersistedState>,
      partialize: (s) => ({
        running: s.running,
        elapsed: s.elapsed,
        lastStartedAt: s.lastStartedAt,
        laps: s.laps,
      }),
      merge: (persisted, current) => {
        if (persisted == null) return current;
        const parsed = zChronometerState.safeParse(persisted);
        if (!parsed.success) {
          if (import.meta.env.DEV) {
            console.warn(
              '[range-soprano] persisted chronometer state failed validation; using defaults.',
              parsed.error.issues,
            );
          }
          return { ...current, ...INITIAL };
        }
        const data = parsed.data;
        // If the timer was running when the page closed, resume with the
        // correct elapsed time by adding the time that passed since then.
        if (data.running && data.lastStartedAt !== null) {
          return {
            ...current,
            ...data,
            elapsed: data.elapsed + (Date.now() - data.lastStartedAt),
          };
        }
        return { ...current, ...data };
      },
    },
  ),
);
