import { create } from 'zustand';
import { persist, type PersistStorage } from 'zustand/middleware';
import {
  CURRENT_UI_STORE_VERSION,
  zPersistedUiState,
  type PersistedUiState,
} from './schemas';
import { UI_STORE_KEY, createSafeJSONStorage } from './persist';

export type Theme = PersistedUiState['theme'];

type UiStoreState = PersistedUiState & {
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  setShowActionLegend: (v: boolean) => void;
  setGridTooltipEnabled: (v: boolean) => void;
};

const INITIAL: PersistedUiState = {
  theme: 'dark',
  showActionLegend: true,
  gridTooltipEnabled: true,
};

export const useUiStore = create<UiStoreState>()(
  persist(
    (set, get) => ({
      ...INITIAL,

      setTheme: (t) => set({ theme: t }),

      toggleTheme: () => {
        const current = get().theme;
        set({ theme: current === 'light' ? 'dark' : 'light' });
      },

      setShowActionLegend: (v) => set({ showActionLegend: v }),
      setGridTooltipEnabled: (v) => set({ gridTooltipEnabled: v }),
    }),
    {
      name: UI_STORE_KEY,
      version: CURRENT_UI_STORE_VERSION,
      storage: createSafeJSONStorage() as PersistStorage<PersistedUiState>,
      partialize: (s) => ({
        theme: s.theme,
        showActionLegend: s.showActionLegend,
        gridTooltipEnabled: s.gridTooltipEnabled,
      }),
      migrate: (persisted, fromVersion) => {
        if (fromVersion < CURRENT_UI_STORE_VERSION) return { ...INITIAL };
        return persisted as PersistedUiState;
      },
      merge: (persisted, current) => {
        if (persisted == null) return current;
        const parsed = zPersistedUiState.safeParse(persisted);
        if (parsed.success) return { ...current, ...parsed.data };
        if (import.meta.env.DEV) {
          console.warn(
            '[range-soprano] persisted ui state failed validation; using defaults.',
            parsed.error.issues,
          );
        }
        return { ...current, ...INITIAL };
      },
    },
  ),
);
