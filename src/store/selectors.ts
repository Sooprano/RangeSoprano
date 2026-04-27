import { useMemo } from 'react';
import type { Range } from '@/types/poker';
import { useRangeStore } from './rangeStore';
import { useUiStore } from './uiStore';

export type RangeSummary = {
  id: string;
  name: string;
  position: Range['position'];
  situation: Range['situation'];
  villainPosition?: Range['villainPosition'];
  tableFormat: Range['tableFormat'];
  group?: string;
  order?: number;
};

export function useActiveRange(): Range | null {
  return useRangeStore((s) => {
    if (!s.activeRangeId) return null;
    return s.ranges.find((r) => r.id === s.activeRangeId) ?? null;
  });
}

export function useViewerRange(): Range | null {
  const viewerRangeId = useUiStore((s) => s.viewerRangeId);
  return useRangeStore((s) => {
    if (!viewerRangeId) return null;
    return s.ranges.find((r) => r.id === viewerRangeId) ?? null;
  });
}

export function useTrainerRange(): Range | null {
  const trainerRangeId = useUiStore((s) => s.trainerRangeId);
  return useRangeStore((s) => {
    if (!trainerRangeId) return null;
    return s.ranges.find((r) => r.id === trainerRangeId) ?? null;
  });
}

export function useRangeById(id: string | null): Range | null {
  return useRangeStore((s) => (id ? s.ranges.find((r) => r.id === id) ?? null : null));
}

export function useRangeSummaries(): RangeSummary[] {
  const ranges = useRangeStore((s) => s.ranges);
  return useMemo(
    () =>
      ranges.map<RangeSummary>((r) => {
        const base: RangeSummary = {
          id: r.id,
          name: r.name,
          position: r.position,
          situation: r.situation,
          tableFormat: r.tableFormat,
        };
        if (r.villainPosition !== undefined) base.villainPosition = r.villainPosition;
        if (r.group !== undefined) base.group = r.group;
        if (r.order !== undefined) base.order = r.order;
        return base;
      }),
    [ranges],
  );
}

export function useCanUndo(): boolean {
  return useRangeStore((s) => s.past.length > 0);
}

export function useCanRedo(): boolean {
  return useRangeStore((s) => s.future.length > 0);
}

export function useHasUnsavedChanges(rangeId: string | null): boolean {
  return useRangeStore((s) => {
    if (!rangeId) return false;
    const r = s.ranges.find((x) => x.id === rangeId);
    const snap = s.snapshots[rangeId];
    if (!r || !snap) return false;
    if (r === snap) return false;
    if (r.name !== snap.name) return true;
    if (r.position !== snap.position) return true;
    if (r.situation !== snap.situation) return true;
    if (r.villainPosition !== snap.villainPosition) return true;
    if (r.group !== snap.group) return true;
    if ((r.notes ?? '') !== (snap.notes ?? '')) return true;
    const ka = Object.keys(r.cells);
    const kb = Object.keys(snap.cells);
    if (ka.length !== kb.length) return true;
    for (const k of ka) {
      const ca = r.cells[k];
      const cb = snap.cells[k];
      if (!cb || !ca) return true;
      if (ca.actions.length !== cb.actions.length) return true;
      for (let i = 0; i < ca.actions.length; i++) {
        const aa = ca.actions[i]!;
        const bb = cb.actions[i]!;
        if (aa.action !== bb.action || aa.weight !== bb.weight) return true;
      }
    }
    return false;
  });
}

export function useRangesByGroup(): Map<string | null, Range[]> {
  const ranges = useRangeStore((s) => s.ranges);
  return useMemo(() => {
    const map = new Map<string | null, Range[]>();
    for (const r of ranges) {
      const key = r.group ?? null;
      const bucket = map.get(key);
      if (bucket) bucket.push(r);
      else map.set(key, [r]);
    }
    return map;
  }, [ranges]);
}
