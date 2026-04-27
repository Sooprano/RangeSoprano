import { useMemo } from 'react';
import { cn } from '@/lib/cn';
import type { ActionDef, HandNotation, RangeCellData } from '@/types/poker';
import { computeRangeStats } from '@/utils/rangeStats';

type RangeStatsProps = {
  cells: Record<HandNotation, RangeCellData>;
  /** Per-range action defs (controls order, labels, colors of the breakdown rows). */
  actionDefs: ActionDef[];
  className?: string;
};

export function RangeStats({ cells, actionDefs, className }: RangeStatsProps) {
  const stats = useMemo(() => computeRangeStats(cells), [cells]);

  const visibleBreakdown = useMemo(() => {
    const orderedDefs = [...actionDefs].sort((a, b) => a.order - b.order);
    const known = new Set(orderedDefs.map((d) => d.id));
    const rows: Array<{ def: ActionDef; combos: number; pct: number }> = [];
    for (const def of orderedDefs) {
      const slot = stats.byAction[def.id];
      if (slot && slot.combos > 0) rows.push({ def, combos: slot.combos, pct: slot.pct });
    }
    // Orphan ids (used in cells but not in actionDefs) are still visualized.
    for (const id of stats.presentActions) {
      if (known.has(id)) continue;
      const slot = stats.byAction[id]!;
      rows.push({
        def: { id, label: id, color: '#9ca3af', order: Number.POSITIVE_INFINITY },
        combos: slot.combos,
        pct: slot.pct,
      });
    }
    return rows;
  }, [actionDefs, stats]);

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
          {visibleBreakdown.map(({ def, combos, pct }) => (
            <li
              key={def.id}
              className="flex items-center justify-between gap-3 text-xs"
            >
              <span className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: def.color }}
                />
                <span className="text-content">{def.label}</span>
              </span>
              <span className="tabular-nums text-content-muted">
                {pct.toFixed(1)}% · {Math.round(combos)} combos
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
