import { create } from 'zustand';
import { persist, type PersistStorage } from 'zustand/middleware';
import {
  CURRENT_UI_STORE_VERSION,
  zPersistedUiState,
  type GroupMeta,
  type PersistedUiState,
} from './schemas';
import { UI_STORE_KEY, createSafeJSONStorage } from './persist';

export type Theme = PersistedUiState['theme'];

type UiStoreState = PersistedUiState & {
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  setShowActionLegend: (v: boolean) => void;
  setGridTooltipEnabled: (v: boolean) => void;
  setViewerRangeId: (id: string | null) => void;
  setTrainerRangeId: (id: string | null) => void;
  setGroupColor: (path: string, color: string | undefined) => void;
  toggleGroupCollapsed: (path: string) => void;
  setGroupCollapsed: (path: string, collapsed: boolean) => void;
};

const INITIAL: PersistedUiState = {
  theme: 'dark',
  showActionLegend: true,
  gridTooltipEnabled: true,
  viewerRangeId: null,
  trainerRangeId: null,
  groupMeta: {},
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
      setViewerRangeId: (id) => set({ viewerRangeId: id }),
      setTrainerRangeId: (id) => set({ trainerRangeId: id }),

      setGroupColor: (path, color) =>
        set((s) => {
          const existing = s.groupMeta[path];
          const next: GroupMeta = {};
          if (color !== undefined) next.color = color;
          const prevCollapsed = existing?.collapsed;
          if (prevCollapsed !== undefined) next.collapsed = prevCollapsed;
          return { groupMeta: { ...s.groupMeta, [path]: next } };
        }),

      toggleGroupCollapsed: (path) =>
        set((s) => {
          const existing = s.groupMeta[path];
          const next: GroupMeta = { collapsed: !(existing?.collapsed ?? false) };
          const prevColor = existing?.color;
          if (prevColor !== undefined) next.color = prevColor;
          return { groupMeta: { ...s.groupMeta, [path]: next } };
        }),

      setGroupCollapsed: (path, collapsed) =>
        set((s) => {
          const existing = s.groupMeta[path];
          const next: GroupMeta = { collapsed };
          const prevColor = existing?.color;
          if (prevColor !== undefined) next.color = prevColor;
          return { groupMeta: { ...s.groupMeta, [path]: next } };
        }),
    }),
    {
      name: UI_STORE_KEY,
      version: CURRENT_UI_STORE_VERSION,
      storage: createSafeJSONStorage() as PersistStorage<PersistedUiState>,
      partialize: (s) => ({
        theme: s.theme,
        showActionLegend: s.showActionLegend,
        gridTooltipEnabled: s.gridTooltipEnabled,
        viewerRangeId: s.viewerRangeId,
        trainerRangeId: s.trainerRangeId,
        groupMeta: s.groupMeta,
      }),
      migrate: (persisted, fromVersion) => {
        if (fromVersion < 1) return { ...INITIAL };
        if (fromVersion === 1) {
          const v1 = persisted as Omit<PersistedUiState, 'groupMeta'>;
          return { ...INITIAL, ...v1, groupMeta: {} };
        }
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
