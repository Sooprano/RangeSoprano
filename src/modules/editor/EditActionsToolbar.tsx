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
    pushToast({ kind: 'success', message: 'Rango guardado.' });
  };

  const handleDiscard = () => {
    if (!isDirty) return;
    if (
      !window.confirm(
        '¿Descartar todos los cambios desde el último guardado? Esta acción no se puede deshacer.',
      )
    )
      return;
    pushHistory();
    revertRange(range.id);
    pushToast({ kind: 'info', message: 'Cambios descartados.' });
  };

  const handleClear = () => {
    if (Object.keys(range.cells).length === 0) return;
    if (!window.confirm('¿Limpiar todas las celdas de este rango?')) return;
    pushHistory();
    clearAllCells(range.id);
    pushToast({ kind: 'info', message: 'Grilla limpiada.' });
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
        title="Guardar (snapshot)"
        aria-label={isDirty ? 'Guardar rango (cambios sin guardar)' : 'Guardar rango'}
        className={cn(
          baseBtn,
          isDirty
            ? 'text-accent hover:bg-surface-hover'
            : 'text-content-muted hover:bg-surface-hover hover:text-content',
        )}
      >
        <Save className="h-3.5 w-3.5" strokeWidth={2.25} />
        <span>Guardar</span>
        {isDirty && (
          <span aria-hidden className="ml-0.5 h-1.5 w-1.5 rounded-full bg-accent" />
        )}
      </button>
      <button
        type="button"
        onClick={handleDiscard}
        disabled={!isDirty}
        title="Descartar cambios sin guardar"
        className={cn(
          baseBtn,
          isDirty
            ? 'text-content-muted hover:bg-surface-hover hover:text-content'
            : 'cursor-not-allowed opacity-40',
        )}
      >
        <RotateCcw className="h-3.5 w-3.5" strokeWidth={2.25} />
        <span>Descartar</span>
      </button>
      <button
        type="button"
        onClick={handleClear}
        title="Limpiar todas las celdas de este rango"
        className={cn(
          baseBtn,
          'text-content-muted hover:bg-surface-hover hover:text-content',
        )}
      >
        <Eraser className="h-3.5 w-3.5" strokeWidth={2.25} />
        <span>Limpiar</span>
      </button>
    </div>
  );
}
