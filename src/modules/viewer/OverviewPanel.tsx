import { useMemo } from 'react';
import { useRangeStore } from '@/store/rangeStore';
import { useUiStore } from '@/store/uiStore';
import { useRangeSummaries } from '@/store/selectors';
import { GroupChipSelector } from './GroupChipSelector';
import { OverviewTile } from './OverviewTile';

type OverviewPanelProps = {
  onTileClick?: (rangeId: string) => void;
};

export function OverviewPanel({ onTileClick }: OverviewPanelProps) {
  const ranges = useRangeStore((s) => s.ranges);
  const summaries = useRangeSummaries();
  const selected = useUiStore((s) => s.overviewSelectedGroups);
  const toggleGroup = useUiStore((s) => s.toggleOverviewGroup);
  const setGroups = useUiStore((s) => s.setOverviewSelectedGroups);

  const filteredRanges = useMemo(() => {
    if (selected.length === 0) return [];
    const set = new Set(selected);
    return ranges.filter((r) => set.has(r.group ?? ''));
  }, [ranges, selected]);

  return (
    <div className="flex flex-col gap-4">
      <GroupChipSelector
        summaries={summaries}
        selected={selected}
        onToggle={toggleGroup}
        onClear={() => setGroups([])}
      />

      {selected.length === 0 ? (
        <div className="flex min-h-[40vh] items-center justify-center rounded-xl border border-dashed border-border p-6 text-center text-sm text-content-muted">
          Select one or more folders above to overview the ranges in them.
        </div>
      ) : filteredRanges.length === 0 ? (
        <div className="flex min-h-[40vh] items-center justify-center rounded-xl border border-dashed border-border p-6 text-center text-sm text-content-muted">
          No ranges in the selected folders.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filteredRanges.map((r) => (
            <OverviewTile
              key={r.id}
              range={r}
              {...(onTileClick && { onSelect: onTileClick })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
