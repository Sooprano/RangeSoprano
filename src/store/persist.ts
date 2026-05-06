import type { PersistStorage, StorageValue } from 'zustand/middleware';

type AnyPersistStorage = PersistStorage<unknown>;

export const MAX_IMPORT_BYTES = 3.8 * 1024 * 1024;
export const RANGE_STORE_KEY = 'range-soprano/ranges';
export const UI_STORE_KEY = 'range-soprano/ui';
export const LEADERBOARD_STORE_KEY = 'range-soprano/leaderboard';
export const ODDS_LEADERBOARD_STORE_KEY = 'range-soprano/odds-leaderboard';
export const PUSHFOLD_LEADERBOARD_STORE_KEY = 'range-soprano/pushfold-leaderboard';
export const RANDOMIZER_STORE_KEY = 'range-soprano/randomizer';

/**
 * Tolerant storage wrapper: falls back to an in-memory map if localStorage
 * is unavailable (SSR, privacy mode, quota exceeded, disabled by policy).
 */
function buildWebStorage(): Storage {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const probe = '__range_soprano_probe__';
      window.localStorage.setItem(probe, '1');
      window.localStorage.removeItem(probe);
      return window.localStorage;
    }
  } catch {
    /* fall through to memory */
  }

  const mem = new Map<string, string>();
  const shim: Storage = {
    get length() {
      return mem.size;
    },
    clear: () => mem.clear(),
    getItem: (k) => (mem.has(k) ? (mem.get(k) as string) : null),
    key: (i) => Array.from(mem.keys())[i] ?? null,
    removeItem: (k) => {
      mem.delete(k);
    },
    setItem: (k, v) => {
      mem.set(k, String(v));
    },
  };
  return shim;
}

let cachedStorage: Storage | null = null;
export function safeLocalStorage(): Storage {
  if (!cachedStorage) cachedStorage = buildWebStorage();
  return cachedStorage;
}

/**
 * JSON storage adapter for zustand's persist middleware that tolerates
 * write failures (quota exceeded) instead of crashing the app.
 *
 * Returned as `PersistStorage<unknown>` so it can be reused across stores
 * with different partialized shapes. Each store casts at the usage site.
 */
export function createSafeJSONStorage(): AnyPersistStorage {
  const storage = safeLocalStorage();
  return {
    getItem: (name) => {
      try {
        const raw = storage.getItem(name);
        if (raw == null) return null;
        return JSON.parse(raw) as StorageValue<unknown>;
      } catch (err) {
        if (import.meta.env.DEV) {
          console.warn(`[range-soprano] failed to read "${name}":`, err);
        }
        return null;
      }
    },
    setItem: (name, value) => {
      try {
        storage.setItem(name, JSON.stringify(value));
      } catch (err) {
        if (import.meta.env.DEV) {
          console.warn(`[range-soprano] failed to write "${name}":`, err);
        }
      }
    },
    removeItem: (name) => {
      try {
        storage.removeItem(name);
      } catch {
        /* noop */
      }
    },
  };
}

export function byteLengthOf(s: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(s).length;
  }
  return s.length;
}
