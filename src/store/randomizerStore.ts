import { create } from 'zustand';
import { persist, type PersistStorage } from 'zustand/middleware';
import {
  CURRENT_RANDOMIZER_VERSION,
  RANDOMIZER_PRESETS_PER_SET,
  RANDOMIZER_SETS_COUNT,
  zPersistedRandomizerState,
  type PersistedRandomizerState,
  type RandomizerFrequency,
  type RandomizerPreset,
} from './schemas';
import { RANDOMIZER_STORE_KEY, createSafeJSONStorage } from './persist';

type RandomizerStoreState = Omit<PersistedRandomizerState, 'frequency'> & {
  frequency: RandomizerFrequency;
  /** Last batch of rolled values. Session-only — never persisted. */
  lastValues: number[];
  /** Whether the auto-roll loop is running. Session-only — never persisted. */
  autoEnabled: boolean;

  setActiveSet: (idx: number) => void;
  updatePreset: (
    setIdx: number,
    presetIdx: number,
    patch: Partial<Pick<RandomizerPreset, 'label' | 'value'>>,
  ) => void;
  updateSetLabel: (setIdx: number, label: string) => void;
  pushRoll: (values: number[]) => void;
  clearLastValues: () => void;
  setFrequency: (f: RandomizerFrequency) => void;
  setAutoEnabled: (v: boolean) => void;
  toggleAutoEnabled: () => void;
  setExpanded: (v: boolean) => void;
  toggleExpanded: () => void;
  setHighlightEnabled: (v: boolean) => void;
  toggleHighlightEnabled: () => void;
  resetActiveSetToDefaults: () => void;
  /**
   * Replaces the persisted slice with an imported payload. Used by the
   * profile importer to restore randomizer config bundled in a `.json`.
   * Session-only fields (`lastValues`, `autoEnabled`) are not touched.
   */
  applyImportedConfig: (payload: PersistedRandomizerState) => void;
};

function autoLabelFor(value: number): string {
  return `${value}/${100 - value}`;
}

function makePresets(values: readonly number[]): RandomizerPreset[] {
  return values.map((v, i) => ({
    id: `p${i + 1}`,
    label: `${v}/${100 - v}`,
    value: v,
  }));
}

const DEFAULT_SETS: PersistedRandomizerState['sets'] = [
  { label: 'Set 1', presets: makePresets([60, 50, 25, 10]) },
  { label: 'Set 2', presets: makePresets([75, 66, 33, 25]) },
  { label: 'Set 3', presets: makePresets([80, 60, 40, 20]) },
];

const INITIAL_PERSISTED: Omit<PersistedRandomizerState, 'frequency'> & {
  frequency: RandomizerFrequency;
} = {
  activeSet: 0,
  sets: DEFAULT_SETS,
  frequency: 1000,
  expanded: false,
  highlightEnabled: true,
};

const INITIAL_SESSION = {
  lastValues: [] as number[],
  autoEnabled: false,
};

function defaultPresetsForSet(setIdx: number): RandomizerPreset[] {
  const fallback = DEFAULT_SETS[setIdx] ?? DEFAULT_SETS[0]!;
  return fallback.presets.map((p) => ({ ...p }));
}

export const useRandomizerStore = create<RandomizerStoreState>()(
  persist(
    (set, get) => ({
      ...INITIAL_PERSISTED,
      ...INITIAL_SESSION,

      setActiveSet: (idx) => {
        if (idx < 0 || idx >= RANDOMIZER_SETS_COUNT) return;
        set({ activeSet: idx });
      },

      updatePreset: (setIdx, presetIdx, patch) => {
        if (setIdx < 0 || setIdx >= RANDOMIZER_SETS_COUNT) return;
        if (presetIdx < 0 || presetIdx >= RANDOMIZER_PRESETS_PER_SET) return;
        set((s) => {
          const sets = s.sets.map((set_, i) => {
            if (i !== setIdx) return set_;
            const presets = set_.presets.map((p, j) => {
              if (j !== presetIdx) return p;
              const next: RandomizerPreset = { ...p };
              const wasAutoLabel = p.label === autoLabelFor(p.value);
              if (patch.value !== undefined) {
                next.value = Math.max(1, Math.min(100, Math.round(patch.value)));
                // If the user hadn't customized the label, keep it in sync
                // with the new value (e.g. value=25 → "25/75").
                if (patch.label === undefined && wasAutoLabel) {
                  next.label = autoLabelFor(next.value);
                }
              }
              if (patch.label !== undefined) next.label = patch.label;
              return next;
            });
            return { ...set_, presets };
          });
          return { sets };
        });
      },

      updateSetLabel: (setIdx, label) => {
        if (setIdx < 0 || setIdx >= RANDOMIZER_SETS_COUNT) return;
        set((s) => ({
          sets: s.sets.map((set_, i) =>
            i === setIdx ? { ...set_, label } : set_,
          ),
        }));
      },

      pushRoll: (values) => set({ lastValues: [...values] }),

      clearLastValues: () => set({ lastValues: [] }),

      setFrequency: (f) => set({ frequency: f }),
      setAutoEnabled: (v) => set({ autoEnabled: v }),
      toggleAutoEnabled: () => set((s) => ({ autoEnabled: !s.autoEnabled })),
      setExpanded: (v) => set({ expanded: v }),
      toggleExpanded: () => set((s) => ({ expanded: !s.expanded })),
      setHighlightEnabled: (v) => set({ highlightEnabled: v }),
      toggleHighlightEnabled: () =>
        set((s) => ({ highlightEnabled: !s.highlightEnabled })),

      resetActiveSetToDefaults: () => {
        const idx = get().activeSet;
        set((s) => ({
          sets: s.sets.map((set_, i) =>
            i === idx
              ? {
                  label: DEFAULT_SETS[idx]?.label ?? `Set ${idx + 1}`,
                  presets: defaultPresetsForSet(idx),
                }
              : set_,
          ),
        }));
      },

      applyImportedConfig: (payload) =>
        set({
          activeSet: payload.activeSet,
          sets: payload.sets,
          frequency: payload.frequency as RandomizerFrequency,
          expanded: payload.expanded,
          highlightEnabled: payload.highlightEnabled,
        }),
    }),
    {
      name: RANDOMIZER_STORE_KEY,
      version: CURRENT_RANDOMIZER_VERSION,
      storage: createSafeJSONStorage() as PersistStorage<PersistedRandomizerState>,
      partialize: (s) => ({
        activeSet: s.activeSet,
        sets: s.sets,
        frequency: s.frequency,
        expanded: s.expanded,
        highlightEnabled: s.highlightEnabled,
      }),
      merge: (persisted, current) => {
        if (persisted == null) return current;
        const parsed = zPersistedRandomizerState.safeParse(persisted);
        if (parsed.success) {
          // Zod's refine() narrows runtime values but keeps the inferred type
          // as `number`; we re-tag here since the schema already validated
          // the literal union.
          return {
            ...current,
            ...parsed.data,
            frequency: parsed.data.frequency as RandomizerFrequency,
          };
        }
        if (import.meta.env.DEV) {
          console.warn(
            '[range-soprano] persisted randomizer state failed validation; using defaults.',
            parsed.error.issues,
          );
        }
        return { ...current, ...INITIAL_PERSISTED };
      },
    },
  ),
);
