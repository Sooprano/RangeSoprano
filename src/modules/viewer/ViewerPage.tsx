import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { CompareToolbar } from './CompareToolbar';
import { RangePanel } from './RangePanel';

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
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [compareRangeId, setCompareRangeId] = useState<string | null>(null);

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

  useEffect(() => {
    if (compareRangeId && !ranges.some((r) => r.id === compareRangeId)) {
      setCompareRangeId(null);
    }
  }, [ranges, compareRangeId]);

  const compareRange = useMemo(
    () => ranges.find((r) => r.id === compareRangeId) ?? null,
    [ranges, compareRangeId],
  );

  const handleToggleCompare = useCallback(
    (next: boolean) => {
      setCompareEnabled(next);
      if (next && !compareRangeId) {
        const candidate = ranges.find((r) => r.id !== viewerRangeId);
        if (candidate) setCompareRangeId(candidate.id);
      }
    },
    [compareRangeId, ranges, viewerRangeId],
  );

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

  const selectionInFilter = range !== null && matchesFilters(range, filters);

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

      <div
        className={
          compareEnabled
            ? 'grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]'
            : 'grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)_300px]'
        }
      >
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

        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <SituationSelector filters={filters} onChange={setFilters} />
            <CompareToolbar
              enabled={compareEnabled}
              onToggle={handleToggleCompare}
              summaries={summaries}
              compareId={compareRangeId}
              onChangeCompareId={setCompareRangeId}
            />
          </div>

          {compareEnabled ? (
            <div className="grid gap-6 xl:grid-cols-2">
              {range ? (
                <RangePanel range={range} badge="A" />
              ) : (
                <CompareSlot label="Pick a range from the list" />
              )}
              {compareRange ? (
                <RangePanel range={compareRange} badge="B" />
              ) : (
                <CompareSlot label="Pick a range to compare with" />
              )}
            </div>
          ) : range ? (
            <>
              {!selectionInFilter && hasAnyFilter(filters) && (
                <p className="rounded-md border border-dashed border-border px-3 py-2 text-center text-xs text-content-muted">
                  Showing a range that does not match the current filters.
                </p>
              )}
              <RangeGrid cells={range.cells} />
            </>
          ) : (
            <CompareSlot label="Select a range from the list to view it." />
          )}
        </div>

        {!compareEnabled && range && (
          <aside className="flex flex-col gap-4">
            <RangeStats cells={range.cells} />
            <ActionLegend actions={presentActions} />
          </aside>
        )}
      </div>
    </>
  );
}

function CompareSlot({ label }: { label: string }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center rounded-xl border border-dashed border-border p-6 text-center text-sm text-content-muted">
      {label}
    </div>
  );
}
