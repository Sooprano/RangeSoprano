import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { parseHandRange, type WeightedHand } from '@/utils/handRangeParser';
import { ACTION_META } from '@/utils/actionMeta';
import type { Action } from '@/types/poker';

type ImportModalProps = {
  action: Action;
  onImport: (hands: WeightedHand[], replace: boolean) => void;
  onClose: () => void;
};

const MAX_ERROR_LIST = 8;

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function ImportModal({ action, onImport, onClose }: ImportModalProps) {
  const [text, setText] = useState('');
  const [replace, setReplace] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    textareaRef.current?.focus();
    return () => {
      previouslyFocused.current?.focus?.();
    };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const root = dialogRef.current;
      if (!root) return;
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => !el.hasAttribute('aria-hidden') && el.offsetParent !== null);
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || !root.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !root.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const result = useMemo(() => parseHandRange(text), [text]);
  const meta = ACTION_META[action];

  const handleImportClick = () => {
    if (result.hands.length === 0) return;
    onImport(result.hands, replace);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
        aria-describedby="import-desc"
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-xl flex-col gap-3 rounded-xl border border-border bg-surface p-5 shadow-surface"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 id="import-title" className="text-base font-semibold text-content">
              Import range
            </h2>
            <p id="import-desc" className="text-xs text-content-muted">
              Parsed hands will be painted as{' '}
              <span className="inline-flex items-center gap-1 font-medium text-content">
                <span
                  aria-hidden
                  className={cn('h-2.5 w-2.5 rounded-sm', meta.swatchClass)}
                />
                {meta.label}
              </span>{' '}
              using each token's weight (defaults to 100%).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close import"
            className="rounded-md p-1 text-content-muted hover:bg-surface-hover hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light"
          >
            <X className="h-4 w-4" strokeWidth={2.25} />
          </button>
        </div>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          spellCheck={false}
          aria-label="Hand range tokens"
          aria-describedby="import-result"
          placeholder="AA,AKs,KK,[98%]AQs[/98%],[45%]A7s[/45%],88+,T9s-65s"
          className="w-full resize-y rounded-md border border-border bg-bg px-3 py-2 font-mono text-xs text-content placeholder:text-content-disabled focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light"
        />

        <div
          id="import-result"
          className="flex flex-col gap-2 rounded-md border border-border bg-bg/40 px-3 py-2 text-xs"
        >
          <div className="flex items-center gap-3">
            <span className="text-content">
              <span className="font-semibold">{result.hands.length}</span> hand
              {result.hands.length === 1 ? '' : 's'} detected
            </span>
            {result.errors.length > 0 && (
              <span className="text-danger">
                {result.errors.length} unrecognized
              </span>
            )}
          </div>
          {result.errors.length > 0 && (
            <ul className="flex flex-col gap-0.5 text-[11px] text-content-muted">
              {result.errors.slice(0, MAX_ERROR_LIST).map((err, i) => (
                <li key={i}>
                  <span className="font-mono text-danger">{err.token}</span>
                  {' · '}
                  {err.reason}
                </li>
              ))}
              {result.errors.length > MAX_ERROR_LIST && (
                <li>+{result.errors.length - MAX_ERROR_LIST} more…</li>
              )}
            </ul>
          )}
        </div>

        <label className="inline-flex items-center gap-2 text-xs text-content-muted">
          <input
            type="checkbox"
            checked={replace}
            onChange={(e) => setReplace(e.target.checked)}
            className="accent-accent-light"
          />
          Replace current range (clears existing cells first)
        </label>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-content-muted hover:bg-surface-hover hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImportClick}
            disabled={result.hands.length === 0}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light',
              result.hands.length === 0
                ? 'cursor-not-allowed bg-surface-hover text-content-disabled'
                : 'bg-accent text-white hover:bg-accent-deep',
            )}
          >
            Import {result.hands.length > 0 && `(${result.hands.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}
