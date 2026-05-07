import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, PictureInPicture2, Spade } from 'lucide-react';
import { ChronometerCard } from '../Chronometer/ChronometerCard';
import { RandomizerPanel } from '../Randomizer/RandomizerPanel';
import {
  isPipSupported,
  openFloatingWindow,
} from '@/utils/floatingWindow';

const FLOATING_WIDTH = 460;
const FLOATING_HEIGHT = 340;
const FLOATING_TITLE = 'Range Soprano · Tools';

export function FloatingTools() {
  const [pipWin, setPipWin] = useState<Window | null>(null);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const pipRef = useRef<Window | null>(null);

  // Keep ref in sync for cleanup access
  useEffect(() => {
    pipRef.current = pipWin;
  }, [pipWin]);

  // On unmount (e.g. user leaves overview mode), close any open PiP.
  useEffect(() => {
    return () => {
      pipRef.current?.close();
    };
  }, []);

  const handlePopOut = async () => {
    if (pipWin) return;
    const win = await openFloatingWindow({
      width: FLOATING_WIDTH,
      height: FLOATING_HEIGHT,
      title: FLOATING_TITLE,
    });
    if (!win) return;

    const div = win.document.createElement('div');
    win.document.body.appendChild(div);

    const onPageHide = () => {
      setPipWin(null);
      setContainer(null);
    };
    win.addEventListener('pagehide', onPageHide);

    setContainer(div);
    setPipWin(win);
  };

  const handleReturn = () => {
    pipWin?.close();
  };

  if (pipWin && container) {
    return (
      <>
        <FloatingPlaceholder onReturn={handleReturn} />
        {createPortal(
          <FloatingContent onClose={handleReturn} />,
          container,
        )}
      </>
    );
  }

  return (
    <div className="relative flex items-start gap-2">
      <ChronometerCard />
      <RandomizerPanel />
      <PopOutButton onClick={handlePopOut} />
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

interface PopOutButtonProps {
  onClick: () => void;
}

function PopOutButton({ onClick }: PopOutButtonProps) {
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

interface FloatingPlaceholderProps {
  onReturn: () => void;
}

function FloatingPlaceholder({ onReturn }: FloatingPlaceholderProps) {
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

interface FloatingContentProps {
  onClose: () => void;
}

function FloatingContent({ onClose }: FloatingContentProps) {
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
