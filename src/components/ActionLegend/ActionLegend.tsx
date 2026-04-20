import { cn } from '@/lib/cn';
import type { Action } from '@/types/poker';
import { ACTION_META, ORDERED_ACTIONS } from '@/utils/actionMeta';

type ActionLegendProps = {
  actions?: Action[];
  className?: string;
};

export function ActionLegend({ actions, className }: ActionLegendProps) {
  const list = (actions && actions.length > 0 ? actions : ORDERED_ACTIONS)
    .slice()
    .sort((a, b) => ACTION_META[a].order - ACTION_META[b].order);

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
        {list.map((action) => (
          <li key={action} className="flex items-center gap-2">
            <span
              aria-hidden
              className={cn(
                'inline-block h-3 w-3 rounded-sm ring-1 ring-black/20',
                ACTION_META[action].swatchClass,
              )}
            />
            <span className="text-xs text-content">
              {ACTION_META[action].label}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
