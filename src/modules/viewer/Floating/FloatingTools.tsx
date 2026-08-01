import { ExternalLink, PictureInPicture2 } from 'lucide-react';
import { ChronometerCard } from '../Chronometer/ChronometerCard';
import { RandomizerPanel } from '../Randomizer/RandomizerPanel';
import { isPipSupported } from '@/utils/floatingWindow';
import { useFloatingToolsStore } from '@/store/floatingToolsStore';

/**
 * Viewer "Resumen" tools strip. When the floating window is open (from here or
 * the sidebar) it shows a "Volver" placeholder; otherwise the inline tools + a
 * pop-out button. The window itself is owned app-wide by `floatingToolsStore` /
 * `FloatingToolsHost`, so it survives leaving this page.
 */
export function FloatingTools() {
  const isOpen = useFloatingToolsStore((s) => s.pipWin !== null);
  const open = useFloatingToolsStore((s) => s.open);
  const close = useFloatingToolsStore((s) => s.close);

  if (isOpen) {
    return <FloatingPlaceholder onReturn={close} />;
  }

  return (
    <div className="relative flex items-start gap-2">
      <ChronometerCard />
      <RandomizerPanel />
      <PopOutButton onClick={() => void open()} />
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function PopOutButton({ onClick }: { onClick: () => void }) {
  const supported = isPipSupported();
  const title = supported
    ? 'Abrir en ventana flotante'
    : 'Abrir en ventana flotante (no siempre encima en este navegador)';

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className="absolute -top-2 -right-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-surface text-content-muted shadow-surface transition-colors hover:border-accent-light/60 hover:text-accent-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
    >
      <PictureInPicture2 className="h-3.5 w-3.5" strokeWidth={2} />
    </button>
  );
}

function FloatingPlaceholder({ onReturn }: { onReturn: () => void }) {
  return (
    <button
      type="button"
      onClick={onReturn}
      className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-content-muted shadow-surface transition-colors hover:border-accent-light/50 hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
    >
      <ExternalLink className="h-4 w-4 text-accent-light" strokeWidth={2} />
      <span>En ventana flotante</span>
      <span className="text-content-disabled">·</span>
      <span className="font-medium text-accent-light">Volver</span>
    </button>
  );
}
