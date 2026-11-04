// Width of an element, kept up to date with a ResizeObserver. The page layout
// depends on the room the content really has, which changes with the sidebar
// (open / collapsed), not only with the window: media queries cannot see it.
// Callback ref, so it starts measuring whenever the element mounts (the page
// shows "Cargando…" first).

import { useLayoutEffect, useState } from 'react';

export function useElementWidth(): [(el: HTMLElement | null) => void, number] {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (!el || typeof ResizeObserver === 'undefined') return;
    // The observer also reports the starting size, before the first paint.
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w !== undefined) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, width];
}
