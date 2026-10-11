import { Pencil, Plus } from 'lucide-react';
import { DEMO_RANGE_COUNT, useLoadDemoRanges } from '@/hooks/useLoadDemoRanges';

type EmptyEditorStateProps = {
  hasRanges: boolean;
  onCreate: () => void;
};

export function EmptyEditorState({ hasRanges, onCreate }: EmptyEditorStateProps) {
  const loadDemo = useLoadDemoRanges();

  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="flex max-w-md flex-col items-center rounded-2xl border border-border bg-surface/60 px-8 py-10 text-center shadow-[0_1px_0_rgb(255_255_255/0.03)]">
        <span
          aria-hidden
          className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-accent/15 text-accent-light"
        >
          <Pencil className="h-6 w-6" strokeWidth={2} />
        </span>
        <h2 className="text-lg font-semibold tracking-tight">
          {hasRanges ? 'Elige un rango para editar' : 'Todavía no hay rangos'}
        </h2>
        <p className="mt-2 text-sm text-content-muted">
          {hasRanges
            ? 'Selecciona uno de la lista de la izquierda, o crea uno nuevo para empezar a pintar.'
            : `Crea tu primer rango y asigna acciones a las manos, o carga el set de demo (${DEMO_RANGE_COUNT} rangos GTO en 1 carpeta + 4 subcarpetas) para tener una base que editar.`}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-accent-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
          >
            <Plus className="h-4 w-4" strokeWidth={2.25} />
            Nuevo rango
          </button>
          {!hasRanges && (
            <button
              type="button"
              onClick={loadDemo}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-content-muted transition-colors hover:bg-surface-hover hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
            >
              Cargar rangos de demo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
