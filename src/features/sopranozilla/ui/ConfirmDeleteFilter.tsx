// "Borrar filtro" (D103): the app's own dialog instead of window.confirm.
// Shows what the filter does and, when another filter uses it, says which
// one and does not offer to delete (the store would refuse anyway).

import { Trash2, X } from 'lucide-react';
import { describeExpr, referencedFilters, type CustomFilter } from '../engine/filterExpr';
import { SzDialog } from './SzDialog';

type Props = {
  filter: CustomFilter;
  filters: readonly CustomFilter[];
  onConfirm: () => void;
  onClose: () => void;
};

export function ConfirmDeleteFilter({ filter, filters, onConfirm, onClose }: Props) {
  const usedBy = filters.filter(
    (f) => f.id !== filter.id && referencedFilters(f.expr).includes(filter.id),
  );
  return (
    <SzDialog label={`Borrar el filtro ${filter.name}`} onClose={onClose} className="max-w-md">
      <div className="flex items-start gap-3">
        <span className="rounded-full bg-rose-500/15 p-2 text-rose-600 dark:text-rose-300">
          <Trash2 className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">Borrar «{filter.name}»</h2>
          <p className="mt-1 rounded-md bg-bg px-2 py-1.5 text-xs text-content-muted">
            {describeExpr(filter.expr, filters)}
          </p>
          {usedBy.length > 0 ? (
            <p role="alert" className="mt-2 text-sm text-amber-700 dark:text-amber-300">
              No se puede borrar: lo usa {usedBy.map((f) => `«${f.name}»`).join(', ')}. Quítalo
              de ese filtro primero.
            </p>
          ) : (
            <p className="mt-2 text-sm text-content-muted">
              Se quita de la tabla y de todas las filas de EV. No se puede deshacer.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="rounded-md p-1 text-content-muted hover:bg-surface-hover hover:text-content"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-border px-3 py-1.5 text-sm text-content-muted hover:bg-surface-hover hover:text-content"
        >
          {usedBy.length > 0 ? 'Entendido' : 'Cancelar'}
        </button>
        {usedBy.length === 0 && (
          <button
            type="button"
            onClick={onConfirm}
            className="flex items-center gap-1.5 rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700"
          >
            <Trash2 className="h-4 w-4" /> Borrar
          </button>
        )}
      </div>
    </SzDialog>
  );
}
