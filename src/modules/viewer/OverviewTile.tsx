import { memo, useCallback, useMemo } from 'react';
import { RangeGrid } from '@/components/RangeGrid';
import { buildActionDefMap } from '@/utils/actionMeta';
import { computeRangeStats } from '@/utils/rangeStats';
import type { Range } from '@/types/poker';
import { SITUATION_LABELS } from '@/data/positions';

type OverviewTileProps = {
  range: Range;
  /** Stable callback — receives the range id so the parent can keep one reference for all tiles. */
  onSelect?: (rangeId: string) => void;
};

function OverviewTileBase({ range, onSelect }: OverviewTileProps) {
  const actionsMap = useMemo(() => buildActionDefMap(range.actions), [range.actions]);
  const stats = useMemo(() => computeRangeStats(range.cells), [range.cells]);

  const subtitle = `${range.position} · ${
    SITUATION_LABELS[range.situation] ?? range.situation
  }${range.villainPosition ? ` · vs ${range.villainPosition}` : ''}${
    range.tableFormat === 'HU' ? ' · HU' : ''
  }`;

  const handleClick = useCallback(() => {
    onSelect?.(range.id);
  }, [onSelect, range.id]);

  const Wrapper = onSelect ? 'button' : 'div';

  return (
    <Wrapper
      {...(onSelect && {
        onClick: handleClick,
        type: 'button' as const,
        'aria-label': `Open ${range.name}`,
      })}
      className={
        'flex flex-col gap-2 rounded-xl border border-border bg-surface/60 p-3 text-left transition-colors ' +
        (onSelect
          ? 'hover:border-accent/40 hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light'
          : '')
      }
    >
      <header className="flex min-w-0 flex-col">
        <h3 className="truncate text-[13px] font-semibold leading-tight text-content">
          {range.name}
        </h3>
        <p className="truncate text-[10px] uppercase tracking-wider text-content-muted">
          {subtitle}
        </p>
      </header>

      <RangeGrid cells={range.cells} actionsMap={actionsMap} variant="compact" />

      <footer className="flex items-center justify-between text-[11px] text-content-muted tabular-nums">
        <span>{stats.totalPct.toFixed(1)}%</span>
        <span>{Math.round(stats.activeCombos)} combos</span>
      </footer>
    </Wrapper>
  );
}

export const OverviewTile = memo(OverviewTileBase);
