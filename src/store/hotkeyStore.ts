import { create } from 'zustand';
import { persist, type PersistStorage } from 'zustand/middleware';
import {
  CURRENT_HOTKEY_STORE_VERSION,
  zPersistedHotkeyState,
  type PersistedHotkeyState,
} from './schemas';
import { HOTKEY_STORE_KEY, createSafeJSONStorage } from './persist';

/** Normalize an action label into the map key (global-by-name binding). */
export function normalizeHotkeyLabel(label: string): string {
  return label.trim().toLowerCase();
}

type HotkeyStoreState = PersistedHotkeyState & {
  /**
   * Bind `key` to the action `label`. Keeps keys unique within a range:
   * `siblingLabels` are the labels of the other actions in the current range;
   * if any of them already holds `key`, it is cleared first (the key moves).
   */
  bind: (label: string, key: string, siblingLabels: string[]) => void;
  clear: (label: string) => void;
  clearAll: () => void;
};

const INITIAL: PersistedHotkeyState = { bindings: {} };

export const useHotkeyStore = create<HotkeyStoreState>()(
  persist(
    (set) => ({
      ...INITIAL,

      bind: (label, key, siblingLabels) =>
        set((s) => {
          const k = key.toLowerCase();
          const target = normalizeHotkeyLabel(label);
          const siblings = new Set(siblingLabels.map(normalizeHotkeyLabel));
          const next: Record<string, string> = {};
          for (const [lbl, bound] of Object.entries(s.bindings)) {
            // Drop the key from any *sibling* action that currently holds it.
            if (bound === k && lbl !== target && siblings.has(lbl)) continue;
            next[lbl] = bound;
          }
          next[target] = k;
          return { bindings: next };
        }),

      clear: (label) =>
        set((s) => {
          const target = normalizeHotkeyLabel(label);
          if (!(target in s.bindings)) return {};
          const next = { ...s.bindings };
          delete next[target];
          return { bindings: next };
        }),

      clearAll: () => set({ bindings: {} }),
    }),
    {
      name: HOTKEY_STORE_KEY,
      version: CURRENT_HOTKEY_STORE_VERSION,
      storage: createSafeJSONStorage() as PersistStorage<PersistedHotkeyState>,
      partialize: (s) => ({ bindings: s.bindings }),
      merge: (persisted, current) => {
        if (persisted == null) return current;
        const parsed = zPersistedHotkeyState.safeParse(persisted);
        if (parsed.success) return { ...current, ...parsed.data };
        if (import.meta.env.DEV) {
          console.warn(
            '[range-soprano] persisted hotkeys failed validation; using defaults.',
            parsed.error.issues,
          );
        }
        return { ...current, ...INITIAL };
      },
    },
  ),
);
