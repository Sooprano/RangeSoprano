import { Link } from 'react-router-dom';
import { Sparkles, ArrowRight } from 'lucide-react';
import { useRangeStore } from '@/store/rangeStore';
import { SAMPLE_BTN_RFI } from '@/data/sampleRanges';

export function EmptyState() {
  const createRange = useRangeStore((s) => s.createRange);
  const setActiveRange = useRangeStore((s) => s.setActiveRange);

  const loadDemo = () => {
    const id = createRange({
      name: SAMPLE_BTN_RFI.name,
      position: SAMPLE_BTN_RFI.position,
      situation: SAMPLE_BTN_RFI.situation,
      cells: SAMPLE_BTN_RFI.cells,
      ...(SAMPLE_BTN_RFI.villainPosition !== undefined && {
        villainPosition: SAMPLE_BTN_RFI.villainPosition,
      }),
      ...(SAMPLE_BTN_RFI.group !== undefined && { group: SAMPLE_BTN_RFI.group }),
    });
    setActiveRange(id);
  };

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="flex max-w-md flex-col items-center rounded-2xl border border-border bg-surface/60 px-8 py-10 text-center shadow-[0_1px_0_rgb(255_255_255/0.03)]">
        <span
          aria-hidden
          className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-accent/15 text-accent-light"
        >
          <Sparkles className="h-6 w-6" strokeWidth={2} />
        </span>
        <h2 className="text-lg font-semibold tracking-tight">No active range yet</h2>
        <p className="mt-2 text-sm text-content-muted">
          Load the demo BTN RFI range to see the grid in action, or build your own
          in the Editor.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={loadDemo}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-accent-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
          >
            Load demo range
          </button>
          <Link
            to="/editor"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-content-muted transition-colors hover:text-content"
          >
            Open Editor
            <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </Link>
        </div>
      </div>
    </div>
  );
}
