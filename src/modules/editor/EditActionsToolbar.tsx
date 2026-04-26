import { Eraser, RotateCcw, Save } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useRangeStore } from '@/store/rangeStore';
import { useHasUnsavedChanges } from '@/store/selectors';
import { pushToast } from '@/store/toastStore';
import type { Range } from '@/types/poker';

type EditActionsToolbarProps = {
  range: Range;
  className?: string;
};

export function EditActionsToolbar({ range, className }: EditActionsToolbarProps) {
  const snapshotRange = useRangeStore((s) => s.snapshotRange);
  const revertRange = useRangeStore((s) => s.revertRange);
  const clearAllCells = useRangeStore((s) => s.clearAllCells);
  const pushHistory = useRangeStore((s) => s.pushHistory);
  const isDirty = useHasUnsavedChanges(range.id);

  const handleSave = () => {
    snapshotRange(range.id);
    pushToast({ kind: 'success', message: 'Range saved.' });
  };

  const handleDiscard = () => {
    if (!isDirty) return;
    if (
      !window.confirm(
        'Discard all changes since the last save? This cannot be undone.',
      )
    )
      return;
    pushHistory();
    revertRange(range.id);
    pushToast({ kind: 'info', message: 'Changes discarded.' });
  };

  const handleClear = () => {
    if (Object.keys(range.cells).length === 0) return;
    if (!window.confirm('Clear all cells in this range?')) return;
    pushHistory();
    clearAllCells(range.id);
    pushToast({ kind: 'info', message: 'Grid cleared.' });
  };

  const baseBtn =
    'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors duration-150 ease-out-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light';

  return (
    <div
      role="toolbar"
      aria-label="Range actions"
      className={cn('flex items-center gap-1', className)}
    >
      <button
        type="button"
        onClick={handleSave}
        title="Save (snapshot)"
        aria-label={isDirty ? 'Save range (unsaved changes)' : 'Save range'}
        className={cn(
          baseBtn,
          isDirty
            ? 'text-accent hover:bg-surface-hover'
            : 'text-content-muted hover:bg-surface-hover hover:text-content',
        )}
      >
        <Save className="h-3.5 w-3.5" strokeWidth={2.25} />
        <span>Save</span>
        {isDirty && (
          <span aria-hidden className="ml-0.5 h-1.5 w-1.5 rounded-full bg-accent" />
        )}
      </button>
      <button
        type="button"
        onClick={handleDiscard}
        disabled={!isDirty}
        title="Discard unsaved changes"
        className={cn(
          baseBtn,
          isDirty
            ? 'text-content-muted hover:bg-surface-hover hover:text-content'
            : 'cursor-not-allowed opacity-40',
        )}
      >
        <RotateCcw className="h-3.5 w-3.5" strokeWidth={2.25} />
        <span>Discard</span>
      </button>
      <button
        type="button"
        onClick={handleClear}
        title="Clear all cells in this range"
        className={cn(
          baseBtn,
          'text-content-muted hover:bg-surface-hover hover:text-content',
        )}
      >
        <Eraser className="h-3.5 w-3.5" strokeWidth={2.25} />
        <span>Clear</span>
      </button>
    </div>
  );
}
