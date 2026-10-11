import { useCallback } from 'react';
import { useRangeStore } from '@/store/rangeStore';
import { SAMPLE_RANGES } from '@/data/sampleRanges';

/** How many ranges the demo set carries — for the empty-state copy. */
export const DEMO_RANGE_COUNT = SAMPLE_RANGES.length;

/**
 * Loads the demo set into the range store and activates its first range.
 * Single source for the empty states of the Viewer and the Editor.
 */
export function useLoadDemoRanges(): () => void {
  const createRange = useRangeStore((s) => s.createRange);
  const setActiveRange = useRangeStore((s) => s.setActiveRange);

  return useCallback(() => {
    let firstId: string | null = null;
    for (const r of SAMPLE_RANGES) {
      const id = createRange({
        name: r.name,
        position: r.position,
        situation: r.situation,
        cells: r.cells,
        actions: r.actions,
        tableFormat: r.tableFormat,
        ...(r.villainPosition !== undefined && { villainPosition: r.villainPosition }),
        ...(r.group !== undefined && { group: r.group }),
      });
      if (!firstId) firstId = id;
    }
    if (firstId) setActiveRange(firstId);
  }, [createRange, setActiveRange]);
}
