import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { RangeGrid } from '@/components/RangeGrid';
import { RangeStats } from '@/components/RangeStats';
import { ActionLegend } from '@/components/ActionLegend';
import { computeRangeStats } from '@/utils/rangeStats';
import { useRangeStore } from '@/store/rangeStore';
import { useUiStore } from '@/store/uiStore';
import { useRangeSummaries, useViewerRange } from '@/store/selectors';
import { EmptyState } from './EmptyState';
import { ViewerRangeList } from './ViewerRangeList';
import {
  EMPTY_FILTERS,
  SituationSelector,
  hasAnyFilter,
  matchesFilters,
  type ViewerFilters,
} from './SituationSelector';

const SITUATION_LABEL: Record<string, string> = {
  RFI: 'RFI',
  vs_RFI: 'vs RFI',
  vs_3BET: 'vs 3-Bet',
  vs_4BET: 'vs 4-Bet',
  SQUEEZE: 'Squeeze',
  DEFEND_BB: 'Defend BB',
};

export default function ViewerPage() {
  const ranges = useRangeStore((s) => s.ranges);
  const summaries = useRangeSummaries();
  const viewerRangeId = useUiStore((s) => s.viewerRangeId);
  const setViewerRangeId = useUiStore((s) => s.setViewerRangeId);
  const range = useViewerRange();

  const [filters, setFilters] = useState<ViewerFilters>(EMPTY_FILTERS);

  const filteredSummaries = useMemo(
    () =>
      hasAnyFilter(filters)
        ? summaries.filter((s) => matchesFilters(s, filters))
        : summaries,
    [summaries, filters],
  );

  useEffect(() => {
    if (ranges.length === 0) {
      if (viewerRangeId !== null) setViewerRangeId(null);
      return;
    }
    const stillValid = viewerRangeId
      ? ranges.some((r) => r.id === viewerRangeId)
      : false;
    if (!stillValid) {
      setViewerRangeId(ranges[0]!.id);
    }
  }, [ranges, viewerRangeId, setViewerRangeId]);

  const presentActions = useMemo(
    () => (range ? computeRangeStats(range.cells).presentActions : []),
    [range],
  );

  if (ranges.length === 0) {
    return (
      <>
        <PageHeader
          title="Viewer"
          description="Explore preflop ranges by format, position, and situation."
        />
        <EmptyState />
      </>
    );
  }

  const selectionInFilter =
    range !== null && matchesFilters(range, filters);

  return (
    <>
      <PageHeader
        eyebrow={
          range
            ? `${range.position} · ${SITUATION_LABEL[range.situation] ?? range.situation}`
            : 'Module'
        }
        title={range ? range.name : 'Viewer'}
        description="Explore preflop ranges by format, position, and situation."
      />

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)_300px]">
        <ViewerRangeList
          summaries={filteredSummaries}
          selectedId={viewerRangeId}
          onSelect={setViewerRangeId}
          emptyMessage={
            hasAnyFilter(filters)
              ? 'No ranges match the current filters.'
              : 'No ranges yet. Create one in the Editor.'
          }
        />

        <div className="flex flex-col gap-4">
          <SituationSelector filters={filters} onChange={setFilters} />
          {range ? (
            <>
              {!selectionInFilter && hasAnyFilter(filters) && (
                <p className="rounded-md border border-dashed border-border px-3 py-2 text-center text-xs text-content-muted">
                  Showing a range that does not match the current filters.
                </p>
              )}
              <RangeGrid cells={range.cells} />
            </>
          ) : (
            <div className="flex min-h-[40vh] items-center justify-center rounded-xl border border-dashed border-border p-6 text-center text-sm text-content-muted">
              Select a range from the list to view it.
            </div>
          )}
        </div>

        {range && (
          <aside className="flex flex-col gap-4">
            <RangeStats cells={range.cells} />
            <ActionLegend actions={presentActions} />
          </aside>
        )}
      </div>
    </>
  );
}
