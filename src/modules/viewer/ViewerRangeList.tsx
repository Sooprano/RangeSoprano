import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { RangeSummary } from '@/store/selectors';

const SITUATION_LABEL: Record<string, string> = {
  RFI: 'RFI',
  vs_RFI: 'vs RFI',
  vs_3BET: 'vs 3-Bet',
  vs_4BET: 'vs 4-Bet',
  SQUEEZE: 'Squeeze',
  DEFEND_BB: 'Defend BB',
};

type ViewerRangeListProps = {
  summaries: RangeSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  emptyMessage?: string;
  className?: string;
};

type Grouped = {
  ungrouped: RangeSummary[];
  groups: Array<{ name: string; items: RangeSummary[] }>;
};

export function ViewerRangeList({
  summaries,
  selectedId,
  onSelect,
  emptyMessage = 'No ranges yet. Create one in the Editor.',
  className,
}: ViewerRangeListProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length === 0) return summaries;
    return summaries.filter((s) => s.name.toLowerCase().includes(q));
  }, [summaries, query]);

  const { ungrouped, groups }: Grouped = useMemo(() => {
    const byGroup = new Map<string, RangeSummary[]>();
    const un: RangeSummary[] = [];
    for (const s of filtered) {
      if (s.group) {
        const bucket = byGroup.get(s.group);
        if (bucket) bucket.push(s);
        else byGroup.set(s.group, [s]);
      } else {
        un.push(s);
      }
    }
    const sortedNames = Array.from(byGroup.keys()).sort((a, b) =>
      a.localeCompare(b),
    );
    return {
      ungrouped: un,
      groups: sortedNames.map((name) => ({ name, items: byGroup.get(name)! })),
    };
  }, [filtered]);

  const renderRow = (s: RangeSummary) => {
    const isSelected = s.id === selectedId;
    return (
      <li key={s.id}>
        <button
          type="button"
          onClick={() => onSelect(s.id)}
          aria-current={isSelected || undefined}
          className={cn(
            'flex min-w-0 w-full flex-col items-start gap-0.5 rounded-lg border border-transparent px-2.5 py-2 text-left text-sm transition-colors',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light',
            isSelected
              ? 'border-accent/40 bg-accent/10 text-content'
              : 'text-content-muted hover:bg-surface-hover hover:text-content',
          )}
        >
          <span className="w-full truncate font-medium">{s.name}</span>
          <span className="text-[10px] uppercase tracking-wider text-content-muted">
            {s.position} · {SITUATION_LABEL[s.situation] ?? s.situation}
          </span>
        </button>
      </li>
    );
  };

  return (
    <aside
      aria-label="Ranges"
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-border bg-surface/40 p-3',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-content-muted">
          Ranges
        </h2>
        <span className="text-[10px] uppercase tracking-wider text-content-muted">
          {filtered.length}/{summaries.length}
        </span>
      </div>

      <label className="relative block">
        <span className="sr-only">Search ranges</span>
        <Search
          className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-content-muted"
          strokeWidth={2}
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search…"
          className="w-full rounded-md border border-border bg-bg px-7 py-1.5 text-xs text-content placeholder:text-content-disabled focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light"
        />
      </label>

      {summaries.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-content-muted">
          {emptyMessage}
        </p>
      ) : filtered.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-content-muted">
          No ranges match "{query}".
        </p>
      ) : (
        <>
          {ungrouped.length > 0 && (
            <ul className="flex flex-col gap-1">{ungrouped.map(renderRow)}</ul>
          )}
          {groups.map((g) => (
            <section key={g.name} className="flex flex-col gap-1">
              <h3 className="px-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-content-muted">
                {g.name}
              </h3>
              <ul className="flex flex-col gap-1">{g.items.map(renderRow)}</ul>
            </section>
          ))}
        </>
      )}
    </aside>
  );
}
