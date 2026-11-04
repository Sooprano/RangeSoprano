// Keyboard shortcuts (§10): ↑/↓ rows, 1–9 / 0 weight (the selected row's, or
// the brush's with no row selected), F ✓, X ✗,
// [ / ] street. The key → action map is pure; `useAnalyzerShortcuts` applies
// it to the store and stays out of inputs, dialogs and the filter builder.

import { useEffect, useRef } from 'react';
import type { Street } from '../engine/equity';
import { useAnalyzerStore, type RowTarget } from '../store/analyzerStore';

export type ShortcutAction =
  | { kind: 'move'; dir: 1 | -1 }
  | { kind: 'weight'; w: number }
  | { kind: 'mark'; mark: 'follow' | 'exclude' }
  | { kind: 'street'; dir: 1 | -1 };

type KeyLike = { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean };

export function keyToAction(e: KeyLike): ShortcutAction | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  switch (e.key) {
    case 'ArrowUp':
      return { kind: 'move', dir: -1 };
    case 'ArrowDown':
      return { kind: 'move', dir: 1 };
    case 'f':
    case 'F':
      return { kind: 'mark', mark: 'follow' };
    case 'x':
    case 'X':
      return { kind: 'mark', mark: 'exclude' };
    case '[':
      return { kind: 'street', dir: -1 };
    case ']':
      return { kind: 'street', dir: 1 };
    case '0':
      return { kind: 'weight', w: 100 };
  }
  return /^[1-9]$/.test(e.key) ? { kind: 'weight', w: Number(e.key) * 10 } : null;
}

const same = (a: RowTarget | null, b: RowTarget) => a !== null && a.kind === b.kind && a.id === b.id;

/** Next row up / down; from nothing, the first (down) or the last (up). */
export function moveSelection(
  rows: readonly RowTarget[],
  current: RowTarget | null,
  dir: 1 | -1,
): RowTarget | null {
  if (rows.length === 0) return null;
  const at = rows.findIndex((r) => same(current, r));
  if (at < 0) return dir === 1 ? rows[0]! : rows[rows.length - 1]!;
  return rows[Math.min(rows.length - 1, Math.max(0, at + dir))]!;
}

function typingIn(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

/**
 * `rows` = table rows in order; `streets` = available streets. Disabled while
 * `enabled` is false (filter builder or a dialog open). `onCategoryWeight`:
 * the page's whole-row edit (it follows what the grid shows); without it the
 * digits set the row weight of the EV row.
 */
export function useAnalyzerShortcuts(
  enabled: boolean,
  rows: readonly RowTarget[],
  streets: readonly Street[],
  onCategoryWeight?: (w: number) => void,
): void {
  const ref = useRef({ rows, streets, onCategoryWeight });
  useEffect(() => {
    ref.current = { rows, streets, onCategoryWeight };
  });

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || typingIn(e.target)) return;
      if (document.querySelector('[role="dialog"]')) return;
      const action = keyToAction(e);
      if (!action) return;
      const s = useAnalyzerStore.getState();
      const sel = s.selectedCategory;
      switch (action.kind) {
        case 'move': {
          const next = moveSelection(ref.current.rows, sel, action.dir);
          if (!next) return;
          s.selectCategory(next);
          document
            .querySelector(`[data-row="${next.kind}:${next.id}"]`)
            ?.scrollIntoView({ block: 'nearest' });
          break;
        }
        case 'weight':
          if (sel && ref.current.onCategoryWeight) ref.current.onCategoryWeight(action.w);
          else if (sel) s.setRowState(sel, { w: action.w, s: 'follow' });
          else s.setBrush(action.w);
          break;
        case 'mark': {
          if (!sel) return;
          const st = s.streets[s.activeStreet];
          const row = st.rows[st.selectedRow];
          const cur = sel.kind === 'cat' ? row?.cats[sel.id]?.s : row?.custom[sel.id]?.s;
          s.setRowState(sel, { s: cur === action.mark ? null : action.mark });
          break;
        }
        case 'street': {
          const list = ref.current.streets;
          const at = list.indexOf(s.activeStreet);
          const next = list[at + action.dir];
          if (!next) return;
          s.setActiveStreet(next);
          break;
        }
      }
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
