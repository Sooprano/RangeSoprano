import { useMemo } from 'react';
import type { Range } from '@/types/poker';
import { useRangeStore } from './rangeStore';

export type RangeSummary = {
  id: string;
  name: string;
  position: Range['position'];
  situation: Range['situation'];
  villainPosition?: Range['villainPosition'];
  group?: string;
};

export function useActiveRange(): Range | null {
  return useRangeStore((s) => {
    if (!s.activeRangeId) return null;
    return s.ranges.find((r) => r.id === s.activeRangeId) ?? null;
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
        };
        if (r.villainPosition !== undefined) base.villainPosition = r.villainPosition;
        if (r.group !== undefined) base.group = r.group;
        return base;
      }),
    [ranges],
  );
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
