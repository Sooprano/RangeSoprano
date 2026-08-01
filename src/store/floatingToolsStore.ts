import { create } from 'zustand';
import { openFloatingWindow } from '@/utils/floatingWindow';

const FLOATING_WIDTH = 460;
const FLOATING_HEIGHT = 340;
const FLOATING_TITLE = 'Range Soprano · Tools';

/**
 * App-level controller for the single floating tools window (chronometer +
 * randomizer). Lives above the router so it can be opened from the sidebar and
 * persists across route changes; `FloatingToolsHost` renders the portal into
 * `container`. `open()` must be called from a user gesture (click) — the PiP
 * `requestWindow` runs synchronously before the first await.
 */
interface FloatingToolsState {
  pipWin: Window | null;
  container: HTMLElement | null;
  open: () => Promise<void>;
  close: () => void;
}

export const useFloatingToolsStore = create<FloatingToolsState>((set, get) => ({
  pipWin: null,
  container: null,
  open: async () => {
    const existing = get().pipWin;
    if (existing) {
      existing.focus?.();
      return;
    }
    const win = await openFloatingWindow({
      width: FLOATING_WIDTH,
      height: FLOATING_HEIGHT,
      title: FLOATING_TITLE,
    });
    if (!win) return;

    const div = win.document.createElement('div');
    win.document.body.appendChild(div);
    win.addEventListener('pagehide', () =>
      set({ pipWin: null, container: null }),
    );

    set({ pipWin: win, container: div });
  },
  close: () => {
    get().pipWin?.close();
    set({ pipWin: null, container: null });
  },
}));
