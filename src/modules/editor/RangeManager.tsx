import { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, FolderInput, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useRangeStore } from '@/store/rangeStore';
import { useUiStore } from '@/store/uiStore';
import { pushToast } from '@/store/toastStore';
import { useRangeSummaries, type RangeSummary } from '@/store/selectors';
import { MAX_GROUP_LEN, MAX_NAME_LEN, sanitizeText } from '@/store/schemas';
import type { Range } from '@/types/poker';
import { buildGroupTree, type GroupTreeNode } from '@/utils/groupUtils';
import { FolderRow } from '@/components/FolderRow';
import { NewRangeForm, type NewRangePayload } from './NewRangeForm';

const SITUATION_LABEL: Record<string, string> = {
  RFI: 'RFI',
  vs_RFI: 'vs RFI',
  vs_3BET: 'vs 3-Bet',
  vs_4BET: 'vs 4-Bet',
  SQUEEZE: 'Squeeze',
  DEFEND_BB: 'Defend BB',
};

const GROUP_SUGGESTIONS_ID = 'range-group-suggestions';

type RangeManagerProps = {
  className?: string;
  isFormOpen: boolean;
  onFormOpenChange: (open: boolean) => void;
};

export function RangeManager({
  className,
  isFormOpen,
  onFormOpenChange,
}: RangeManagerProps) {
  const summaries = useRangeSummaries();
  const activeRangeId = useRangeStore((s) => s.activeRangeId);
  const createRange = useRangeStore((s) => s.createRange);
  const setActiveRange = useRangeStore((s) => s.setActiveRange);
  const deleteRange = useRangeStore((s) => s.deleteRange);
  const duplicateRange = useRangeStore((s) => s.duplicateRange);
  const updateRange = useRangeStore((s) => s.updateRange);
  const pushHistory = useRangeStore((s) => s.pushHistory);

  const groupMeta = useUiStore((s) => s.groupMeta);
  const toggleGroupCollapsed = useUiStore((s) => s.toggleGroupCollapsed);
  const setGroupColor = useUiStore((s) => s.setGroupColor);

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [groupingId, setGroupingId] = useState<string | null>(null);
  const [groupDraft, setGroupDraft] = useState('');
  const [colorPickerPath, setColorPickerPath] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const groupInputRef = useRef<HTMLInputElement | null>(null);
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const menuPanelRef = useRef<HTMLDivElement | null>(null);

  const closeMenuAndRestoreFocus = (restore = true) => {
    setOpenMenuId(null);
    if (restore) menuTriggerRef.current?.focus();
  };

  const tree = useMemo(() => buildGroupTree(summaries), [summaries]);
  const summaryById = useMemo(
    () => new Map(summaries.map((s) => [s.id, s])),
    [summaries],
  );

  const groupSuggestions = useMemo(() => {
    const paths = new Set<string>();
    const collect = (nodes: GroupTreeNode[]) => {
      for (const n of nodes) {
        paths.add(n.path);
        collect(n.children);
      }
    };
    collect(tree.roots);
    return Array.from(paths).sort();
  }, [tree]);

  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  useEffect(() => {
    if (groupingId && groupInputRef.current) {
      groupInputRef.current.focus();
      groupInputRef.current.select();
    }
  }, [groupingId]);

  useEffect(() => {
    if (!openMenuId) return;
    const handleDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest(`[data-menu-scope="${openMenuId}"]`)) {
        setOpenMenuId(null);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeMenuAndRestoreFocus();
      }
    };
    window.addEventListener('mousedown', handleDown);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handleDown);
      window.removeEventListener('keydown', handleKey);
    };
  }, [openMenuId]);

  useEffect(() => {
    if (!openMenuId) return;
    const items = menuPanelRef.current?.querySelectorAll<HTMLButtonElement>(
      'button[role="menuitem"]',
    );
    items?.[0]?.focus();
  }, [openMenuId]);

  const onMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      menuPanelRef.current?.querySelectorAll<HTMLButtonElement>(
        'button[role="menuitem"]',
      ) ?? [],
    );
    if (items.length === 0) return;
    const active = document.activeElement as HTMLElement | null;
    const idx = items.findIndex((el) => el === active);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(idx + 1 + items.length) % items.length]!.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(idx - 1 + items.length) % items.length]!.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0]!.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1]!.focus();
    } else if (e.key === 'Tab') {
      setOpenMenuId(null);
    }
  };

  const handleCreate = (payload: NewRangePayload) => {
    pushHistory();
    const id = createRange(payload);
    setActiveRange(id);
    onFormOpenChange(false);
  };

  const handleDuplicate = (id: string) => {
    pushHistory();
    const newId = duplicateRange(id);
    if (newId) setActiveRange(newId);
    setOpenMenuId(null);
  };

  const handleDelete = (id: string, name: string) => {
    setOpenMenuId(null);
    if (window.confirm(`Delete range "${name}"? You can undo with Ctrl+Z.`)) {
      pushHistory();
      deleteRange(id);
      pushToast({ kind: 'info', message: `Deleted "${name}" — Ctrl+Z to undo` });
    }
  };

  const startRename = (id: string, currentName: string) => {
    setRenamingId(id);
    setRenameDraft(currentName);
    setGroupingId(null);
    setOpenMenuId(null);
  };

  const commitRename = (id: string, currentName: string) => {
    const next = sanitizeText(renameDraft).slice(0, MAX_NAME_LEN);
    if (next.length > 0 && next !== currentName) {
      pushHistory();
      updateRange(id, { name: next });
    }
    setRenamingId(null);
    setRenameDraft('');
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameDraft('');
  };

  const startGroupEdit = (id: string, currentGroup: string | undefined) => {
    setGroupingId(id);
    setGroupDraft(currentGroup ?? '');
    setRenamingId(null);
    setOpenMenuId(null);
  };

  const commitGroup = (id: string, currentGroup: string | undefined) => {
    const next = sanitizeText(groupDraft).slice(0, MAX_GROUP_LEN);
    const nextValue = next.length === 0 ? undefined : next;
    if (nextValue !== currentGroup) {
      pushHistory();
      updateRange(id, { group: nextValue } as Partial<Range>);
    }
    setGroupingId(null);
    setGroupDraft('');
  };

  const cancelGroup = () => {
    setGroupingId(null);
    setGroupDraft('');
  };

  const renderRangeRow = (s: RangeSummary) => {
    const isActive = s.id === activeRangeId;
    const isMenuOpen = openMenuId === s.id;
    const isRenaming = renamingId === s.id;
    const isGrouping = groupingId === s.id;
    return (
      <li key={s.id}>
        <div
          className={cn(
            'group flex items-center gap-1 rounded-lg border border-transparent text-sm transition-colors',
            isActive
              ? 'border-accent/40 bg-accent/10 text-content'
              : 'text-content-muted hover:bg-surface-hover hover:text-content',
          )}
        >
          {isRenaming ? (
            <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5 px-2.5 py-2">
              <input
                ref={renameInputRef}
                type="text"
                value={renameDraft}
                maxLength={MAX_NAME_LEN}
                onChange={(e) => setRenameDraft(e.target.value)}
                onBlur={() => commitRename(s.id, s.name)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitRename(s.id, s.name);
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    cancelRename();
                  }
                }}
                aria-label={`Rename ${s.name}`}
                className="w-full rounded-md border border-accent/50 bg-bg px-1.5 py-0.5 text-sm text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light"
              />
              <span className="text-[10px] uppercase tracking-wider text-content-muted">
                {s.position} · {SITUATION_LABEL[s.situation] ?? s.situation}
              </span>
            </div>
          ) : isGrouping ? (
            <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5 px-2.5 py-2">
              <span className="w-full truncate text-sm font-medium text-content">
                {s.name}
              </span>
              <input
                ref={groupInputRef}
                type="text"
                list={GROUP_SUGGESTIONS_ID}
                value={groupDraft}
                maxLength={MAX_GROUP_LEN}
                placeholder="Group (empty = ungroup)"
                onChange={(e) => setGroupDraft(e.target.value)}
                onBlur={() => commitGroup(s.id, s.group)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitGroup(s.id, s.group);
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    cancelGroup();
                  }
                }}
                aria-label={`Group for ${s.name}`}
                className="w-full rounded-md border border-accent/50 bg-bg px-1.5 py-0.5 text-xs text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setActiveRange(s.id)}
              onDoubleClick={() => startRename(s.id, s.name)}
              aria-current={isActive || undefined}
              className="flex min-w-0 flex-1 flex-col items-start gap-0.5 px-2.5 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light"
            >
              <span className="w-full truncate text-sm font-medium">
                {s.name}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-content-muted">
                {s.position} · {SITUATION_LABEL[s.situation] ?? s.situation}
              </span>
            </button>
          )}
          {!isRenaming && !isGrouping && (
            <div data-menu-scope={s.id} className="relative mr-1">
              <button
                type="button"
                aria-label={`Actions for ${s.name}`}
                aria-haspopup="menu"
                aria-expanded={isMenuOpen}
                onClick={(e) => {
                  if (isMenuOpen) {
                    closeMenuAndRestoreFocus(false);
                  } else {
                    menuTriggerRef.current = e.currentTarget;
                    setOpenMenuId(s.id);
                  }
                }}
                className={cn(
                  'rounded-md p-1 text-content-muted hover:bg-surface hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light',
                  isMenuOpen
                    ? 'inline-flex bg-surface text-content'
                    : 'hidden group-hover:inline-flex focus-visible:inline-flex',
                )}
              >
                <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={2.25} />
              </button>
              {isMenuOpen && (
                <div
                  ref={menuPanelRef}
                  role="menu"
                  aria-label={`Actions for ${s.name}`}
                  onKeyDown={onMenuKeyDown}
                  className="absolute right-0 top-full z-20 mt-1 flex min-w-[160px] flex-col rounded-lg border border-border bg-surface p-1 shadow-surface"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => startRename(s.id, s.name)}
                    className="inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs text-content hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none"
                  >
                    <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                    Rename
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => startGroupEdit(s.id, s.group)}
                    className="inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs text-content hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none"
                  >
                    <FolderInput className="h-3.5 w-3.5" strokeWidth={2} />
                    Move to group…
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleDuplicate(s.id)}
                    className="inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs text-content hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none"
                  >
                    <Copy className="h-3.5 w-3.5" strokeWidth={2} />
                    Duplicate
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleDelete(s.id, s.name)}
                    className="inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs text-red-400 hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                    Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </li>
    );
  };

  const renderFolder = (node: GroupTreeNode): React.ReactNode => {
    const meta = groupMeta[node.path];
    const isCollapsed = meta?.collapsed ?? false;

    return (
      <li key={node.path} className="flex flex-col">
        <FolderRow
          node={node}
          meta={meta}
          onToggleCollapse={() => toggleGroupCollapsed(node.path)}
          onColorDotClick={() =>
            setColorPickerPath((prev) => (prev === node.path ? null : node.path))
          }
          colorPickerOpen={colorPickerPath === node.path}
          onColorChange={(color) => setGroupColor(node.path, color)}
          onColorPickerClose={() => setColorPickerPath(null)}
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
      aria-label="Saved ranges"
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-border bg-surface/40 p-3',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-content-muted">
          Ranges
        </h2>
        <button
          type="button"
          onClick={() => onFormOpenChange(!isFormOpen)}
          aria-expanded={isFormOpen}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-accent-light hover:bg-surface-hover"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
          {isFormOpen ? 'Close' : 'New'}
        </button>
      </div>

      {isFormOpen && (
        <NewRangeForm
          onCreate={handleCreate}
          onCancel={() => onFormOpenChange(false)}
        />
      )}

      {summaries.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-content-muted">
          No ranges yet. Create one to start painting.
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

      {groupSuggestions.length > 0 && (
        <datalist id={GROUP_SUGGESTIONS_ID}>
          {groupSuggestions.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
      )}
    </aside>
  );
}
