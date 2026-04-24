import { useEffect, useMemo } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { RangeGrid } from '@/components/RangeGrid';
import { RangeStats } from '@/components/RangeStats';
import { ActionLegend } from '@/components/ActionLegend';
import { computeRangeStats } from '@/utils/rangeStats';
import { useRangeStore } from '@/store/rangeStore';
import { useUiStore } from '@/store/uiStore';
import { useViewerRange } from '@/store/selectors';
import { EmptyState } from './EmptyState';
import { ViewerRangeList } from './ViewerRangeList';

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
  const viewerRangeId = useUiStore((s) => s.viewerRangeId);
  const setViewerRangeId = useUiStore((s) => s.setViewerRangeId);
  const range = useViewerRange();

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
          selectedId={viewerRangeId}
          onSelect={setViewerRangeId}
        />

        {range ? (
          <div className="flex flex-col gap-4">
            <RangeGrid cells={range.cells} />
          </div>
        ) : (
          <div className="flex min-h-[40vh] items-center justify-center rounded-xl border border-dashed border-border p-6 text-center text-sm text-content-muted">
            Select a range from the list to view it.
          </div>
        )}

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
