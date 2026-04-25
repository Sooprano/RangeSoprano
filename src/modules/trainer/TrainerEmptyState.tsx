import { Link } from 'react-router-dom';
import { Target, ArrowRight } from 'lucide-react';

export function TrainerEmptyState() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="flex max-w-md flex-col items-center rounded-2xl border border-border bg-surface/60 px-8 py-10 text-center shadow-[0_1px_0_rgb(255_255_255/0.03)]">
        <span
          aria-hidden
          className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-accent/15 text-accent-light"
        >
          <Target className="h-6 w-6" strokeWidth={2} />
        </span>
        <h2 className="text-lg font-semibold tracking-tight">
          No ranges to train against
        </h2>
        <p className="mt-2 text-sm text-content-muted">
          Build at least one range in the Editor before running a training
          session.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/editor"
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-accent-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
          >
            Open Editor
            <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </Link>
        </div>
      </div>
    </div>
  );
}
