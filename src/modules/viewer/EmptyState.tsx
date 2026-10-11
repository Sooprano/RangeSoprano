import { Link } from 'react-router-dom';
import { Sparkles, ArrowRight } from 'lucide-react';
import { DEMO_RANGE_COUNT, useLoadDemoRanges } from '@/hooks/useLoadDemoRanges';

export function EmptyState() {
  const loadDemo = useLoadDemoRanges();

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="flex max-w-md flex-col items-center rounded-2xl border border-border bg-surface/60 px-8 py-10 text-center shadow-[0_1px_0_rgb(255_255_255/0.03)]">
        <span
          aria-hidden
          className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-accent/15 text-accent-light"
        >
          <Sparkles className="h-6 w-6" strokeWidth={2} />
        </span>
        <h2 className="text-lg font-semibold tracking-tight">Sin rango activo</h2>
        <p className="mt-2 text-sm text-content-muted">
          Carga el set de demo ({DEMO_RANGE_COUNT} rangos GTO en 1 carpeta + 4 subcarpetas) para
          explorar Individual, Comparar, Resumen e Imprimir PDF, o crea el tuyo en el Editor.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={loadDemo}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-accent-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
          >
            Cargar rangos de demo
          </button>
          <Link
            to="/editor"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-content-muted transition-colors hover:text-content"
          >
            Abrir Editor
            <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </Link>
        </div>
      </div>
    </div>
  );
}
