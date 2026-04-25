import { create } from 'zustand';

export type ToastKind = 'success' | 'error' | 'info';

export type Toast = {
  id: string;
  kind: ToastKind;
  message: string;
  duration: number;
};

type PushInput = {
  kind: ToastKind;
  message: string;
  duration?: number;
};

type ToastStoreState = {
  toasts: Toast[];
  pushToast: (input: PushInput) => string;
  dismissToast: (id: string) => void;
  clearToasts: () => void;
};

const DEFAULT_DURATION = 3500;
const MAX_TOASTS = 4;

function newToastId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useToastStore = create<ToastStoreState>()((set) => ({
  toasts: [],

  pushToast: ({ kind, message, duration = DEFAULT_DURATION }) => {
    const id = newToastId();
    set((s) => {
      const next = [...s.toasts, { id, kind, message, duration }];
      return { toasts: next.length > MAX_TOASTS ? next.slice(-MAX_TOASTS) : next };
    });
    return id;
  },

  dismissToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },

  clearToasts: () => set({ toasts: [] }),
}));

export function pushToast(input: PushInput): string {
  return useToastStore.getState().pushToast(input);
}
