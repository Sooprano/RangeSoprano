import { useMemo } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { RangeGrid } from '@/components/RangeGrid';
import { RangeStats } from '@/components/RangeStats';
import { ActionLegend } from '@/components/ActionLegend';
import { SAMPLE_BTN_RFI } from '@/data/sampleRanges';
import { computeRangeStats } from '@/utils/rangeStats';

export default function ViewerPage() {
  const range = SAMPLE_BTN_RFI;
  const presentActions = useMemo(
    () => computeRangeStats(range.cells).presentActions,
    [range.cells],
  );

  return (
    <>
      <PageHeader
        eyebrow={`${range.position} · ${range.situation}`}
        title="Viewer"
        description="Explore preflop ranges by format, position, and situation."
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <RangeGrid cells={range.cells} />
        <aside className="flex flex-col gap-4">
          <RangeStats cells={range.cells} />
          <ActionLegend actions={presentActions} />
        </aside>
      </div>
    </>
  );
}
