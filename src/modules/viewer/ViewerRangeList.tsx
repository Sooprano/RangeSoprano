import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { RangeSummary } from '@/store/selectors';
import { useUiStore } from '@/store/uiStore';
import type { GroupMeta } from '@/store/schemas';
import { buildGroupTree, flattenVisibleTree, type GroupTreeNode } from '@/utils/groupUtils';
import { FolderRow } from '@/components/FolderRow';

export function displayOrderFor(
  summaries: RangeSummary[],
  groupMeta: Record<string, GroupMeta> = {},
): RangeSummary[] {
  const tree = buildGroupTree(summaries, groupMeta);
  const byId = new Map(summaries.map((s) => [s.id, s]));
  return flattenVisibleTree(tree, byId, groupMeta);
}

const SITUATION_LABEL: Record<string, string> = {
  RFI: 'RFI',
  vs_LIMP: 'vs Limp',
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

export function ViewerRangeList({
  summaries,
  selectedId,
  onSelect,
  emptyMessage = 'No ranges yet. Create one in the Editor.',
  className,
}: ViewerRangeListProps) {
  const [query, setQuery] = useState('');
  const groupMeta = useUiStore((s) => s.groupMeta);
  const toggleGroupCollapsed = useUiStore((s) => s.toggleGroupCollapsed);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length === 0) return summaries;
    return summaries.filter((s) => s.name.toLowerCase().includes(q));
  }, [summaries, query]);

  const tree = useMemo(() => buildGroupTree(filtered, groupMeta), [filtered, groupMeta]);
  const summaryById = useMemo(
    () => new Map(filtered.map((s) => [s.id, s])),
    [filtered],
  );
  const isSearching = query.trim().length > 0;

  const renderRangeRow = (s: RangeSummary) => {
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

  const renderFolder = (node: GroupTreeNode): React.ReactNode => {
    const meta = groupMeta[node.path];
    const isCollapsed = !isSearching && (meta?.collapsed ?? false);

    return (
      <li key={node.path} className="flex flex-col">
        <FolderRow
          node={node}
          meta={meta}
          forceExpand={isSearching}
          onToggleCollapse={() => toggleGroupCollapsed(node.path)}
        />
        {!isCollapsed && (
          <div
            className="border-l border-border"
            style={{ marginLeft: (node.depth + 1) * 16 + 4, paddingLeft: 8 }}
          >
            {node.rangeIds.length > 0 && (
              <ul className="flex flex-col gap-0.5">
                {node.rangeIds.map((id) => {
                  const s = summaryById.get(id);
                  return s ? renderRangeRow(s) : null;
                })}
              </ul>
            )}
            {node.children.length > 0 && (
              <ul className="mt-0.5 flex flex-col gap-0.5">
                {node.children.map(renderFolder)}
              </ul>
            )}
          </div>
        )}
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
          No ranges match &ldquo;{query}&rdquo;.
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {tree.ungrouped.length > 0 && (
            <ul className="flex flex-col gap-1">
              {tree.ungrouped.map(renderRangeRow)}
            </ul>
          )}
          {tree.roots.length > 0 && (
            <ul className="flex flex-col gap-1">
              {tree.roots.map(renderFolder)}
            </ul>
          )}
        </div>
      )}
    </aside>
  );
}
