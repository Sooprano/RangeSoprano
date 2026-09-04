import { useMemo, useState } from 'react';
import { Dices, Search } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { RangeSummary } from '@/store/selectors';
import { useUiStore } from '@/store/uiStore';
import type { GroupMeta } from '@/store/schemas';
import {
  buildGroupTree,
  collectRangeIds,
  flattenVisibleTree,
  type GroupTreeNode,
} from '@/utils/groupUtils';
import { FolderRow } from '@/components/FolderRow';
import { TruncatedLabel } from '@/components/TruncatedLabel';
import { SITUATION_LABELS } from '@/data/positions';

export function displayOrderFor(
  summaries: RangeSummary[],
  groupMeta: Record<string, GroupMeta> = {},
): RangeSummary[] {
  const tree = buildGroupTree(summaries, groupMeta);
  const byId = new Map(summaries.map((s) => [s.id, s]));
  return flattenVisibleTree(tree, byId, groupMeta);
}

type ViewerRangeListProps = {
  summaries: RangeSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  emptyMessage?: string;
  className?: string;
  /**
   * Opt-in folder targeting (the Trainer): when `onSelectFolder` is given, each
   * folder row grows a "train this folder" button. The Viewer passes neither
   * prop and renders exactly as before.
   */
  selectedFolderPath?: string | null;
  onSelectFolder?: (path: string) => void;
  /**
   * How many ranges training that folder would actually draw from. Comes from
   * the store, NOT from the (searched/filtered) tree — the search box and the
   * situation filters narrow the list you browse, never the folder you train.
   */
  folderRangeCount?: (path: string) => number;
};

export function ViewerRangeList({
  summaries,
  selectedId,
  onSelect,
  emptyMessage = 'No ranges yet. Create one in the Editor.',
  className,
  selectedFolderPath = null,
  onSelectFolder,
  folderRangeCount,
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
          <TruncatedLabel text={s.name} className="font-medium" />
          <span className="text-[10px] uppercase tracking-wider text-content-muted">
            {s.position} · {SITUATION_LABELS[s.situation] ?? s.situation}
          </span>
        </button>
      </li>
    );
  };

  const renderFolder = (node: GroupTreeNode): React.ReactNode => {
    const meta = groupMeta[node.path];
    const isCollapsed = !isSearching && (meta?.collapsed ?? false);
    const trainCount = onSelectFolder
      ? (folderRangeCount?.(node.path) ?? collectRangeIds(node).length)
      : 0;
    const isFolderSelected = selectedFolderPath === node.path;

    return (
      <li key={node.path} className="flex flex-col">
        <div
          className={cn(
            'rounded-md',
            isFolderSelected && 'bg-accent/10 ring-1 ring-inset ring-accent/40',
          )}
        >
          <FolderRow
            node={node}
            meta={meta}
            forceExpand={isSearching}
            onToggleCollapse={() => toggleGroupCollapsed(node.path)}
            {...(onSelectFolder && trainCount > 0
              ? {
                  trailing: (
                    <button
                      type="button"
                      onClick={() => onSelectFolder(node.path)}
                      aria-pressed={isFolderSelected}
                      title={
                        isFolderSelected
                          ? 'Dejar de entrenar la carpeta'
                          : `Entrenar la carpeta (${trainCount} ${trainCount === 1 ? 'rango' : 'rangos'})`
                      }
                      className={cn(
                        'mr-0.5 shrink-0 rounded-md p-1 transition-colors',
                        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light',
                        isFolderSelected
                          ? 'text-accent-light'
                          : 'text-content-disabled hover:bg-surface-hover hover:text-content',
                      )}
                    >
                      <Dices className="h-3.5 w-3.5" strokeWidth={2.25} />
                      <span className="sr-only">
                        Entrenar la carpeta {node.label}
                      </span>
                    </button>
                  ),
                }
              : {})}
          />
        </div>
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
