import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
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
  /** When the parent triggers this with a value, the inline form is forced open. */
  openFormSignal?: number;
};

export function RangeManager({ className, openFormSignal }: RangeManagerProps) {
  const summaries = useRangeSummaries();
  const activeRangeId = useRangeStore((s) => s.activeRangeId);
  const createRange = useRangeStore((s) => s.createRange);
  const setActiveRange = useRangeStore((s) => s.setActiveRange);
  const deleteRange = useRangeStore((s) => s.deleteRange);

  const [isFormOpen, setIsFormOpen] = useState(false);

  useEffect(() => {
    // Monotonic counter from the parent: any non-zero value means the parent
    // explicitly asked to open the form (e.g. clicking "New range" from the
    // empty state). The initial 0 on mount is ignored.
    if (openFormSignal !== undefined && openFormSignal > 0) {
      setIsFormOpen(true);
    }
  }, [openFormSignal]);

  const handleCreate = (payload: NewRangePayload) => {
    const id = createRange(payload);
    setActiveRange(id);
    setIsFormOpen(false);
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Delete range "${name}"? This can't be undone.`)) {
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
          onClick={() => setIsFormOpen((v) => !v)}
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
          onCancel={() => setIsFormOpen(false)}
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
                  <button
                    type="button"
                    aria-label={`Delete ${s.name}`}
                    onClick={() => handleDelete(s.id, s.name)}
                    className="mr-1 hidden rounded-md p-1 text-content-muted hover:bg-surface hover:text-content group-hover:inline-flex focus-visible:inline-flex focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={2.25} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
