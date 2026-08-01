import { Spade } from 'lucide-react';
import { ChronometerCard } from '../Chronometer/ChronometerCard';
import { RandomizerPanel } from '../Randomizer/RandomizerPanel';

/** The content rendered inside the floating window (portaled by FloatingToolsHost). */
export function FloatingContent({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex min-h-screen flex-col gap-2 bg-bg p-3">
      <header className="flex items-center justify-between border-b border-border pb-2">
        <div className="flex items-center gap-1.5">
          <Spade className="h-4 w-4 text-accent" strokeWidth={2.25} />
          <span className="text-sm font-semibold text-content">
            Range Soprano
          </span>
          <span className="text-xs text-content-disabled">· Tools</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-2 py-1 text-xs text-content-muted transition-colors hover:bg-surface-hover hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
        >
          Volver a la página
        </button>
      </header>

      <div className="flex flex-col items-stretch gap-2">
        <ChronometerCard />
        <RandomizerPanel />
      </div>
    </div>
  );
}
