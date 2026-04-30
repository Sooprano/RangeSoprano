import { useMemo } from 'react';
import { Folder } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { RangeSummary } from '@/store/selectors';

type GroupChipSelectorProps = {
  summaries: readonly RangeSummary[];
  selected: readonly string[];
  onToggle: (group: string) => void;
  onClear: () => void;
};

const UNGROUPED_KEY = '__ungrouped__';

export function GroupChipSelector({
  summaries,
  selected,
  onToggle,
  onClear,
}: GroupChipSelectorProps) {
  const groups = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of summaries) {
      const key = s.group ?? UNGROUPED_KEY;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => {
        // Ungrouped last
        if (a.key === UNGROUPED_KEY) return 1;
        if (b.key === UNGROUPED_KEY) return -1;
        return a.key.localeCompare(b.key);
      });
  }, [summaries]);

  if (groups.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-content-muted">
        Folders
      </span>
      {groups.map(({ key, count }) => {
        const isUngrouped = key === UNGROUPED_KEY;
        const label = isUngrouped ? 'Ungrouped' : key;
        const value = isUngrouped ? '' : key;
        const isActive = selected.includes(value);
        return (
          <button
            key={key}
            type="button"
            onClick={() => onToggle(value)}
            aria-pressed={isActive}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-150',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light',
              isActive
                ? 'border-accent/50 bg-accent/15 text-content shadow-[inset_0_0_0_1px_rgb(var(--color-accent)/0.35)]'
                : 'border-border bg-surface text-content-muted hover:bg-surface-hover hover:text-content',
            )}
          >
            <Folder className="h-3 w-3 shrink-0" strokeWidth={2.25} />
            <span className="max-w-[160px] truncate">{label}</span>
            <span className="rounded-full bg-bg/60 px-1.5 text-[10px] tabular-nums text-content-muted">
              {count}
            </span>
          </button>
        );
      })}
      {selected.length > 0 && (
        <button
          type="button"
          onClick={onClear}
          className="ml-1 rounded-md px-2 py-1 text-[11px] font-medium text-content-muted hover:bg-surface-hover hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
        >
          Clear
        </button>
      )}
    </div>
  );
}
