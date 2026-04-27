import { useMemo } from 'react';
import { cn } from '@/lib/cn';
import { RangeGrid } from '@/components/RangeGrid';
import { RangeStats } from '@/components/RangeStats';
import { ActionLegend } from '@/components/ActionLegend';
import { computeRangeStats } from '@/utils/rangeStats';
import { buildActionDefMap } from '@/utils/actionMeta';
import type { Range } from '@/types/poker';

const SITUATION_LABEL: Record<string, string> = {
  RFI: 'RFI',
  vs_RFI: 'vs RFI',
  vs_3BET: 'vs 3-Bet',
  vs_4BET: 'vs 4-Bet',
  SQUEEZE: 'Squeeze',
  DEFEND_BB: 'Defend BB',
};

type RangePanelProps = {
  range: Range;
  badge?: string;
  className?: string;
};

export function RangePanel({ range, badge, className }: RangePanelProps) {
  const presentActions = useMemo(
    () => computeRangeStats(range.cells).presentActions,
    [range.cells],
  );
  const actionsMap = useMemo(() => buildActionDefMap(range.actions), [range.actions]);

  return (
    <section
      aria-label={`Range ${range.name}`}
      className={cn('flex min-w-0 flex-col gap-3', className)}
    >
      <header className="flex items-baseline justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <h3 className="truncate text-sm font-semibold text-content">
            {range.name}
          </h3>
          <p className="text-[10px] uppercase tracking-wider text-content-muted">
            {range.position} ·{' '}
            {SITUATION_LABEL[range.situation] ?? range.situation}
            {range.villainPosition ? ` · vs ${range.villainPosition}` : ''}
          </p>
        </div>
        {badge && (
          <span className="rounded-md border border-border bg-surface px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-content-muted">
            {badge}
          </span>
        )}
      </header>

      <RangeGrid cells={range.cells} actionsMap={actionsMap} />

      <div className="grid gap-3 sm:grid-cols-2">
        <RangeStats cells={range.cells} actionDefs={range.actions} />
        <ActionLegend actionDefs={range.actions} presentActions={presentActions} />
      </div>
    </section>
  );
}
