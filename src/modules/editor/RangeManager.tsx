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
import { TruncatedLabel } from '@/components/TruncatedLabel';
import { FolderRow } from '@/components/FolderRow';
import { SortableItem, SortableList } from '@/components/dnd/SortableList';
import { NewRangeForm, type NewRangePayload } from './NewRangeForm';
import { SITUATION_LABELS } from '@/data/positions';

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
  const reorderRanges = useRangeStore((s) => s.reorderRanges);

  const renameGroup = useRangeStore((s) => s.renameGroup);

  const groupMeta = useUiStore((s) => s.groupMeta);
  const toggleGroupCollapsed = useUiStore((s) => s.toggleGroupCollapsed);
  const setGroupColor = useUiStore((s) => s.setGroupColor);
  const reorderFolders = useUiStore((s) => s.reorderFolders);
  const renameGroupMeta = useUiStore((s) => s.renameGroupMeta);

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [groupingId, setGroupingId] = useState<string | null>(null);
  const [groupDraft, setGroupDraft] = useState('');
  const [colorPickerPath, setColorPickerPath] = useState<string | null>(null);
  const [renamingFolderPath, setRenamingFolderPath] = useState<string | null>(null);
  const [folderRenameParent, setFolderRenameParent] = useState<string>('');
  const [folderRenameName, setFolderRenameName] = useState<string>('');
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const groupInputRef = useRef<HTMLInputElement | null>(null);
  const folderRenameInputRef = useRef<HTMLInputElement | null>(null);
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const menuPanelRef = useRef<HTMLDivElement | null>(null);

  const closeMenuAndRestoreFocus = (restore = true) => {
    setOpenMenuId(null);
    if (restore) menuTriggerRef.current?.focus();
  };

  const tree = useMemo(() => buildGroupTree(summaries, groupMeta), [summaries, groupMeta]);
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
    if (renamingFolderPath && folderRenameInputRef.current) {
      folderRenameInputRef.current.focus();
      folderRenameInputRef.current.select();
    }
  }, [renamingFolderPath]);

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
    if (window.confirm(`¿Eliminar el rango "${name}"? Puedes deshacer con Ctrl+Z.`)) {
      pushHistory();
      deleteRange(id);
      pushToast({ kind: 'info', message: `Se eliminó "${name}" — Ctrl+Z para deshacer` });
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

  const startFolderRename = (path: string) => {
    const lastSlash = path.lastIndexOf('/');
    setFolderRenameParent(lastSlash >= 0 ? path.slice(0, lastSlash) : '');
    setFolderRenameName(lastSlash >= 0 ? path.slice(lastSlash + 1) : path);
    setRenamingFolderPath(path);
    setOpenMenuId(null);
  };

  const commitFolderRename = (oldPath: string) => {
    const cleanName = sanitizeText(folderRenameName).trim();
    const cleanParent = sanitizeText(folderRenameParent).trim();
    if (cleanName.length === 0) {
      setRenamingFolderPath(null);
      setFolderRenameParent('');
      setFolderRenameName('');
      return;
    }
    const nextPath = (cleanParent ? `${cleanParent}/${cleanName}` : cleanName).slice(0, MAX_GROUP_LEN);
    if (nextPath === oldPath) {
      setRenamingFolderPath(null);
      setFolderRenameParent('');
      setFolderRenameName('');
      return;
    }
    if (cleanParent === oldPath || cleanParent.startsWith(oldPath + '/')) {
      pushToast({ kind: 'error', message: 'No se puede mover una carpeta dentro de sí misma' });
      return;
    }
    pushHistory();
    renameGroup(oldPath, nextPath);
    renameGroupMeta(oldPath, nextPath);
    const oldDepth = oldPath.split('/').length;
    const newDepth = nextPath.split('/').length;
    const message =
      newDepth > oldDepth
        ? `Carpeta "${cleanName}" movida dentro de "${cleanParent}"`
        : newDepth < oldDepth
          ? `Carpeta "${cleanName}" movida al nivel raíz`
          : `Carpeta renombrada a "${cleanName}"`;
    pushToast({ kind: 'success', message });
    setRenamingFolderPath(null);
    setFolderRenameParent('');
    setFolderRenameName('');
  };

  const cancelFolderRename = () => {
    setRenamingFolderPath(null);
    setFolderRenameParent('');
    setFolderRenameName('');
  };

  const renderRangeRow = (s: RangeSummary, indentLevel = 0) => {
    const isActive = s.id === activeRangeId;
    const isMenuOpen = openMenuId === s.id;
    const isRenaming = renamingId === s.id;
    const isGrouping = groupingId === s.id;
    const isHU = s.tableFormat === 'HU';
    const subtitle = [
      s.position,
      SITUATION_LABELS[s.situation] ?? s.situation,
      !isHU && s.villainPosition ? `vs ${s.villainPosition}` : null,
      isHU ? 'HU' : null,
    ]
      .filter(Boolean)
      .join(' · ');
    const indentStyle = indentLevel > 0 ? { paddingLeft: indentLevel * 12 } : undefined;
    return (
      <li
        key={s.id}
        className="group"
        {...(indentStyle ? { style: indentStyle } : {})}
      >
        <SortableItem id={s.id} ariaLabel={`Drag ${s.name}`}>
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
                aria-label={`Renombrar ${s.name}`}
                className="w-full rounded-md border border-accent/50 bg-bg px-1.5 py-0.5 text-sm text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light"
              />
              <span className="text-[10px] uppercase tracking-wider text-content-muted">
                {subtitle}
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
                placeholder="Grupo (vacío = sin grupo)"
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
                aria-label={`Grupo para ${s.name}`}
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
              <TruncatedLabel text={s.name} className="text-sm font-medium" />
              <span className="text-[10px] uppercase tracking-wider text-content-muted">
                {subtitle}
              </span>
            </button>
          )}
          {!isRenaming && !isGrouping && (
            <div data-menu-scope={s.id} className="relative mr-1">
              <button
                type="button"
                aria-label={`Acciones para ${s.name}`}
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
                  aria-label={`Acciones para ${s.name}`}
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
                    Renombrar
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => startGroupEdit(s.id, s.group)}
                    className="inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs text-content hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none"
                  >
                    <FolderInput className="h-3.5 w-3.5" strokeWidth={2} />
                    Mover a grupo…
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleDuplicate(s.id)}
                    className="inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs text-content hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none"
                  >
                    <Copy className="h-3.5 w-3.5" strokeWidth={2} />
                    Duplicar
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleDelete(s.id, s.name)}
                    className="inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs text-red-400 hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                    Eliminar
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        </SortableItem>
      </li>
    );
  };

  const renderFolder = (node: GroupTreeNode): React.ReactNode => {
    const meta = groupMeta[node.path];
    const isCollapsed = meta?.collapsed ?? false;
    const childFolderIds = node.children.map((c) => c.path);
    const isRenamingFolder = renamingFolderPath === node.path;
    const parentOptions = isRenamingFolder
      ? groupSuggestions.filter((p) => p !== node.path && !p.startsWith(node.path + '/'))
      : [];

    return (
      <li key={node.path} className="group flex flex-col">
        <SortableItem id={node.path} ariaLabel={`Arrastrar carpeta ${node.label}`}>
        {isRenamingFolder ? (
          <div
            className="flex flex-col gap-1.5 rounded-md border border-accent/40 bg-surface/60 p-2"
            style={{ marginLeft: node.depth * 16 + 4 }}
          >
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-wider text-content-muted">
                Carpeta padre
              </span>
              <select
                value={folderRenameParent}
                onChange={(e) => setFolderRenameParent(e.target.value)}
                aria-label={`Carpeta padre de ${node.label}`}
                className="rounded-md border border-border bg-bg px-1.5 py-0.5 text-xs text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light"
              >
                <option value="">— Sin padre (raíz) —</option>
                {parentOptions.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-wider text-content-muted">
                Nombre
              </span>
              <input
                ref={folderRenameInputRef}
                type="text"
                value={folderRenameName}
                maxLength={MAX_GROUP_LEN}
                onChange={(e) => setFolderRenameName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); commitFolderRename(node.path); }
                  if (e.key === 'Escape') { e.preventDefault(); cancelFolderRename(); }
                }}
                aria-label={`Nombre de carpeta ${node.label}`}
                className="rounded-md border border-accent/50 bg-bg px-1.5 py-0.5 text-xs text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light"
              />
            </label>
            <p className="text-[10px] text-content-muted">
              Resultado:{' '}
              <span className="font-mono text-content">
                {folderRenameParent ? `${folderRenameParent}/` : ''}
                {folderRenameName || '…'}
              </span>
            </p>
            <div className="flex justify-end gap-1">
              <button
                type="button"
                onClick={cancelFolderRename}
                className="rounded-md px-2 py-0.5 text-[11px] text-content-muted hover:bg-surface-hover hover:text-content"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => commitFolderRename(node.path)}
                className="rounded-md bg-accent/20 px-2 py-0.5 text-[11px] font-medium text-accent-light hover:bg-accent/30"
              >
                Guardar
              </button>
            </div>
          </div>
        ) : (
        <FolderRow
          node={node}
          meta={meta}
          onToggleCollapse={() => toggleGroupCollapsed(node.path)}
          onStartRename={() => startFolderRename(node.path)}
          onColorDotClick={() =>
            setColorPickerPath((prev) => (prev === node.path ? null : node.path))
          }
          colorPickerOpen={colorPickerPath === node.path}
          onColorChange={(color) => setGroupColor(node.path, color)}
          onColorPickerClose={() => setColorPickerPath(null)}
        />
        )}
        </SortableItem>
        {!isCollapsed && (
          <div className="relative flex flex-col gap-0.5">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-0 bottom-1 w-px bg-border/50"
              style={{ left: node.depth * 12 + 32 }}
            />
            {node.rangeIds.length > 0 && (
              <SortableList
                ids={node.rangeIds}
                onReorder={(orderedIds) => reorderRanges(node.path, orderedIds)}
              >
                <ul className="flex flex-col gap-0.5">
                  {node.rangeIds.map((id) => {
                    const s = summaryById.get(id);
                    return s ? renderRangeRow(s, node.depth + 1) : null;
                  })}
                </ul>
              </SortableList>
            )}
            {node.children.length > 0 && (
              <SortableList
                ids={childFolderIds}
                onReorder={(orderedPaths) => reorderFolders(node.path, orderedPaths)}
              >
                <ul className="flex flex-col gap-0.5">
                  {node.children.map(renderFolder)}
                </ul>
              </SortableList>
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
            <SortableList
              ids={tree.ungrouped.map((s) => s.id)}
              onReorder={(orderedIds) => reorderRanges(null, orderedIds)}
            >
              <ul className="flex flex-col gap-1">
                {tree.ungrouped.map(renderRangeRow)}
              </ul>
            </SortableList>
          )}
          {tree.roots.length > 0 && (
            <SortableList
              ids={tree.roots.map((n) => n.path)}
              onReorder={(orderedPaths) => reorderFolders(null, orderedPaths)}
            >
              <ul className="flex flex-col gap-1">
                {tree.roots.map(renderFolder)}
              </ul>
            </SortableList>
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
