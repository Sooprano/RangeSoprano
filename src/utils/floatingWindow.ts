/**
 * Utilities for opening a floating, always-on-top window via the
 * Document Picture-in-Picture API (Chrome 116+, Edge, Brave, Opera).
 * Falls back to `window.open()` for unsupported browsers — same content,
 * same resizable window, but not always-on-top.
 */

interface DocumentPictureInPictureRequestWindowOptions {
  width?: number;
  height?: number;
}

interface DocumentPictureInPicture {
  requestWindow: (
    options?: DocumentPictureInPictureRequestWindowOptions,
  ) => Promise<Window>;
  window: Window | null;
}

declare global {
  interface Window {
    documentPictureInPicture?: DocumentPictureInPicture;
  }
}

export function isPipSupported(): boolean {
  return (
    typeof window !== 'undefined' && 'documentPictureInPicture' in window
  );
}

export interface OpenFloatingOptions {
  width: number;
  height: number;
  title?: string;
}

/**
 * Opens a floating window with the document fully styled to match the host page
 * (Tailwind stylesheets cloned, theme attribute mirrored, body bg).
 *
 * Returns the new Window or null if the browser blocked the popup (rare, e.g.
 * non-Chromium without user gesture).
 */
export async function openFloatingWindow(
  opts: OpenFloatingOptions,
): Promise<Window | null> {
  const { width, height, title } = opts;
  let win: Window | null = null;

  if (isPipSupported() && window.documentPictureInPicture) {
    try {
      win = await window.documentPictureInPicture.requestWindow({
        width,
        height,
      });
    } catch {
      // requestWindow can reject (e.g. user blocked); fall through to popup.
      win = null;
    }
  }

  if (!win) {
    win = window.open(
      '',
      '_blank',
      `popup=yes,width=${width},height=${height}`,
    );
  }

  if (!win) return null;

  prepareFloatingDocument(win, title);
  return win;
}

function prepareFloatingDocument(win: Window, title?: string): void {
  copyDocumentStyles(document, win.document);
  applyTheme(document, win.document);
  if (title) win.document.title = title;
  // Reset body margins so the React content fills the window edge-to-edge.
  win.document.body.style.margin = '0';
  win.document.body.style.padding = '0';
  win.document.body.style.backgroundColor = 'rgb(var(--color-bg) / 1)';
}

function copyDocumentStyles(from: Document, to: Document): void {
  const nodes = from.head.querySelectorAll('link[rel="stylesheet"], style');
  nodes.forEach((node) => {
    to.head.appendChild(node.cloneNode(true));
  });
}

function applyTheme(from: Document, to: Document): void {
  const theme = from.documentElement.getAttribute('data-theme') ?? 'dark';
  to.documentElement.setAttribute('data-theme', theme);
  to.documentElement.setAttribute('lang', from.documentElement.lang || 'es');
}
