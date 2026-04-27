import { useMemo } from 'react';
import { cn } from '@/lib/cn';
import type { ActionDef, ActionId } from '@/types/poker';

type ActionLegendProps = {
  /** Per-range action defs to render in order. */
  actionDefs: ActionDef[];
  /** When provided, only legend entries whose id is present are shown. */
  presentActions?: ActionId[];
  className?: string;
};

export function ActionLegend({ actionDefs, presentActions, className }: ActionLegendProps) {
  const list = useMemo(() => {
    const sorted = [...actionDefs].sort((a, b) => a.order - b.order);
    if (!presentActions || presentActions.length === 0) return sorted;
    const present = new Set(presentActions);
    return sorted.filter((d) => present.has(d.id));
  }, [actionDefs, presentActions]);

  if (list.length === 0) return null;

  return (
    <section
      aria-label="Legend"
      className={cn(
        'rounded-xl border border-border bg-surface p-4 shadow-surface',
        className,
      )}
    >
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-content-muted">
        Legend
      </h3>
      <ul className="flex flex-wrap gap-x-4 gap-y-2 lg:flex-col lg:gap-2">
        {list.map((def) => (
          <li key={def.id} className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block h-3 w-3 rounded-sm ring-1 ring-black/20"
              style={{ backgroundColor: def.color }}
            />
            <span className="text-xs text-content">{def.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
