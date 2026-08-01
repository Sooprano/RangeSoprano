import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ActionDef, ActionId } from '@/types/poker';
import { normalizeHotkeyLabel, useHotkeyStore } from '@/store/hotkeyStore';

export interface ActionHotkeys {
  /** Display key for a button badge (uppercased); '' if none resolved. */
  effectiveKey: (actionId: ActionId) => string;
  /** Resolve a pressed key to the action it triggers, or null. */
  actionForKey: (rawKey: string) => ActionId | null;
  /** The action whose key is currently being captured (right-click assign), or null. */
  assigningId: ActionId | null;
  /** Enter capture mode for an action (bind the next key pressed). */
  beginAssign: (actionId: ActionId) => void;
}

/**
 * Custom trainer hotkeys for a range's ordered answer actions. Bindings are
 * global-by-normalized-label (see hotkeyStore), with the number key (1-9) as a
 * per-position fallback. Handles the right-click "capture a key" flow itself.
 */
export function useActionHotkeys(orderedActions: ActionDef[]): ActionHotkeys {
  const bindings = useHotkeyStore((s) => s.bindings);
  const bind = useHotkeyStore((s) => s.bind);
  const clear = useHotkeyStore((s) => s.clear);

  const [assigningId, setAssigningId] = useState<ActionId | null>(null);

  // Single-pass resolution so custom keys win and nothing collides.
  const { keyByAction, actionByKey } = useMemo(() => {
    const keyByAction = new Map<ActionId, string>();
    const actionByKey = new Map<string, ActionId>();
    const taken = new Set<string>();

    for (const def of orderedActions) {
      const k = bindings[normalizeHotkeyLabel(def.label)];
      if (k && !taken.has(k)) {
        keyByAction.set(def.id, k);
        actionByKey.set(k, def.id);
        taken.add(k);
      }
    }
    orderedActions.forEach((def, i) => {
      if (keyByAction.has(def.id) || i >= 9) return;
      const num = String(i + 1);
      if (taken.has(num)) return;
      keyByAction.set(def.id, num);
      actionByKey.set(num, def.id);
      taken.add(num);
    });

    return { keyByAction, actionByKey };
  }, [orderedActions, bindings]);

  const effectiveKey = useCallback(
    (actionId: ActionId) => keyByAction.get(actionId)?.toUpperCase() ?? '',
    [keyByAction],
  );

  const actionForKey = useCallback(
    (rawKey: string) => actionByKey.get(rawKey.toLowerCase()) ?? null,
    [actionByKey],
  );

  const beginAssign = useCallback((actionId: ActionId) => {
    setAssigningId(actionId);
  }, []);

  // Capture the next key while assigning. Capture phase + stopPropagation so it
  // never leaks to the trainer's answer handler.
  useEffect(() => {
    if (assigningId === null) return;
    const def = orderedActions.find((d) => d.id === assigningId);
    if (!def) {
      setAssigningId(null);
      return;
    }
    const siblingLabels = orderedActions
      .filter((d) => d.id !== def.id)
      .map((d) => d.label);

    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const key = e.key;
      if (key === 'Escape') {
        setAssigningId(null);
        return;
      }
      if (key === 'Backspace' || key === 'Delete') {
        clear(def.label);
        setAssigningId(null);
        return;
      }
      // Reserved / non-printable: keep waiting.
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (key === 'Enter' || key === ' ' || key === 'Tab') return;
      if (key.length !== 1) return;
      bind(def.label, key, siblingLabels);
      setAssigningId(null);
    };
    window.addEventListener('keydown', handler, { capture: true });
    return () =>
      window.removeEventListener('keydown', handler, { capture: true });
  }, [assigningId, orderedActions, bind, clear]);

  // Any pointer press outside the initiating right-click cancels capture.
  useEffect(() => {
    if (assigningId === null) return;
    const onPointerDown = () => setAssigningId(null);
    window.addEventListener('pointerdown', onPointerDown, { capture: true });
    return () =>
      window.removeEventListener('pointerdown', onPointerDown, {
        capture: true,
      });
  }, [assigningId]);

  return { effectiveKey, actionForKey, assigningId, beginAssign };
}
