import { Pencil, Plus } from 'lucide-react';

type EmptyEditorStateProps = {
  hasRanges: boolean;
  onCreate: () => void;
};

export function EmptyEditorState({ hasRanges, onCreate }: EmptyEditorStateProps) {
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
          {hasRanges ? 'Pick a range to edit' : 'No ranges yet'}
        </h2>
        <p className="mt-2 text-sm text-content-muted">
          {hasRanges
            ? 'Select one from the list on the left, or create a new one to start painting.'
            : 'Create your first range and start assigning actions to hands.'}
        </p>
        <button
          type="button"
          onClick={onCreate}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-accent-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
        >
          <Plus className="h-4 w-4" strokeWidth={2.25} />
          New range
        </button>
      </div>
    </div>
  );
}
