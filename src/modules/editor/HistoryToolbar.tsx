import { Undo2, Redo2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useRangeStore } from '@/store/rangeStore';
import { useCanRedo, useCanUndo } from '@/store/selectors';

type HistoryToolbarProps = {
  className?: string;
};

export function HistoryToolbar({ className }: HistoryToolbarProps) {
  const canUndo = useCanUndo();
  const canRedo = useCanRedo();
  const undo = useRangeStore((s) => s.undo);
  const redo = useRangeStore((s) => s.redo);

  return (
    <div
      role="toolbar"
      aria-label="Undo and redo"
      className={cn('flex items-center gap-1', className)}
    >
      <button
        type="button"
        onClick={undo}
        disabled={!canUndo}
        aria-label="Undo"
        title="Undo (Ctrl+Z)"
        className={cn(
          'inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium',
          'transition-colors duration-150 ease-out-soft',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light',
          canUndo
            ? 'text-content-muted hover:bg-surface-hover hover:text-content'
            : 'cursor-not-allowed opacity-40',
        )}
      >
        <Undo2 className="h-4 w-4" strokeWidth={2} />
      </button>
      <button
        type="button"
        onClick={redo}
        disabled={!canRedo}
        aria-label="Redo"
        title="Redo (Ctrl+Shift+Z)"
        className={cn(
          'inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium',
          'transition-colors duration-150 ease-out-soft',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light',
          canRedo
            ? 'text-content-muted hover:bg-surface-hover hover:text-content'
            : 'cursor-not-allowed opacity-40',
        )}
      >
        <Redo2 className="h-4 w-4" strokeWidth={2} />
      </button>
    </div>
  );
}
