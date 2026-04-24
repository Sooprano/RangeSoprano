import { useEffect, useState } from 'react';
import { Copy, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useRangeStore } from '@/store/rangeStore';
import { useRangeSummaries } from '@/store/selectors';
import { NewRangeForm, type NewRangePayload } from './NewRangeForm';

const SITUATION_LABEL: Record<string, string> = {
  RFI: 'RFI',
  vs_RFI: 'vs RFI',
  vs_3BET: 'vs 3-Bet',
  vs_4BET: 'vs 4-Bet',
  SQUEEZE: 'Squeeze',
  DEFEND_BB: 'Defend BB',
};

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
  const pushHistory = useRangeStore((s) => s.pushHistory);

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    if (!openMenuId) return;
    const handleDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest(`[data-menu-scope="${openMenuId}"]`)) {
        setOpenMenuId(null);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenuId(null);
    };
    window.addEventListener('mousedown', handleDown);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handleDown);
      window.removeEventListener('keydown', handleKey);
    };
  }, [openMenuId]);

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
    }
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
        <ul className="flex flex-col gap-1">
          {summaries.map((s) => {
            const isActive = s.id === activeRangeId;
            const isMenuOpen = openMenuId === s.id;
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
                  <button
                    type="button"
                    onClick={() => setActiveRange(s.id)}
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
                  <div
                    data-menu-scope={s.id}
                    className="relative mr-1"
                  >
                    <button
                      type="button"
                      aria-label={`Actions for ${s.name}`}
                      aria-haspopup="menu"
                      aria-expanded={isMenuOpen}
                      onClick={() =>
                        setOpenMenuId(isMenuOpen ? null : s.id)
                      }
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
                        role="menu"
                        className="absolute right-0 top-full z-20 mt-1 flex min-w-[140px] flex-col rounded-lg border border-border bg-surface p-1 shadow-surface"
                      >
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
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
