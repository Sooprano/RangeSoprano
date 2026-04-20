import { useMemo } from 'react';
import { cn } from '@/lib/cn';
import type { HandNotation, RangeCellData } from '@/types/poker';
import { ACTION_META, ORDERED_ACTIONS } from '@/utils/actionMeta';
import { computeRangeStats } from '@/utils/rangeStats';

type RangeStatsProps = {
  cells: Record<HandNotation, RangeCellData>;
  className?: string;
};

export function RangeStats({ cells, className }: RangeStatsProps) {
  const stats = useMemo(() => computeRangeStats(cells), [cells]);

  const visibleBreakdown = ORDERED_ACTIONS.filter(
    (a) => stats.byAction[a].combos > 0,
  );

  return (
    <section
      aria-label="Range statistics"
      className={cn(
        'rounded-xl border border-border bg-surface p-4 shadow-surface',
        className,
      )}
    >
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-content-muted">
        Range stats
      </h3>

      <div className="flex items-baseline gap-6">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-content-muted">
            Total
          </p>
          <p className="text-2xl font-semibold tabular-nums text-content">
            {stats.totalPct.toFixed(1)}%
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-content-muted">
            Combos
          </p>
          <p className="text-2xl font-semibold tabular-nums text-content">
            {Math.round(stats.activeCombos)}
          </p>
        </div>
      </div>

      {visibleBreakdown.length > 0 && (
        <ul className="mt-4 flex flex-col gap-1.5 border-t border-border pt-3">
          {visibleBreakdown.map((action) => {
            const row = stats.byAction[action];
            return (
              <li
                key={action}
                className="flex items-center justify-between gap-3 text-xs"
              >
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className={cn(
                      'inline-block h-2.5 w-2.5 rounded-sm',
                      ACTION_META[action].swatchClass,
                    )}
                  />
                  <span className="text-content">
                    {ACTION_META[action].label}
                  </span>
                </span>
                <span className="tabular-nums text-content-muted">
                  {row.pct.toFixed(1)}% · {Math.round(row.combos)} combos
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
