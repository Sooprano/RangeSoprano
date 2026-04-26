import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { StickyNote } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useRangeStore } from '@/store/rangeStore';
import { MAX_NOTES_LEN } from '@/store/schemas';
import type { Range } from '@/types/poker';

type NotesButtonProps = {
  range: Range;
  className?: string;
};

const DEBOUNCE_MS = 400;

export function NotesButton({ range, className }: NotesButtonProps) {
  const updateRange = useRangeStore((s) => s.updateRange);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(range.notes ?? '');
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const headingId = useId();

  // Sync local draft when switching to a different range.
  useEffect(() => {
    setDraft(range.notes ?? '');
  }, [range.id, range.notes]);

  // Debounced save.
  useEffect(() => {
    const current = range.notes ?? '';
    if (draft === current) return;
    const t = window.setTimeout(() => {
      const trimmed = draft.length > MAX_NOTES_LEN ? draft.slice(0, MAX_NOTES_LEN) : draft;
      updateRange(range.id, trimmed === '' ? { notes: '' } : { notes: trimmed });
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [draft, range.id, range.notes, updateRange]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popoverRef.current?.contains(t)) return;
      if (triggerRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) textareaRef.current?.focus();
  }, [open]);

  const toggle = useCallback(() => setOpen((v) => !v), []);

  const hasNotes = (range.notes ?? '').trim().length > 0;

  return (
    <div className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-label={hasNotes ? 'Edit range notes' : 'Add range notes'}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Notes"
        className={cn(
          'relative inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium',
          'transition-colors duration-150 ease-out-soft',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light',
          open
            ? 'bg-surface-hover text-content'
            : 'text-content-muted hover:bg-surface-hover hover:text-content',
        )}
      >
        <StickyNote className="h-3.5 w-3.5" strokeWidth={2.25} />
        Notes
        {hasNotes && (
          <span
            aria-hidden
            className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-accent"
          />
        )}
      </button>

      {open && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-labelledby={headingId}
          className={cn(
            'absolute right-0 top-full z-30 mt-2 w-[min(360px,80vw)]',
            'rounded-xl border border-border bg-surface p-3 shadow-surface',
          )}
        >
          <div className="mb-2 flex items-baseline justify-between">
            <h3 id={headingId} className="text-sm font-semibold text-content">
              Notes
            </h3>
            <span className="text-[10px] tabular-nums text-content-muted">
              {draft.length}/{MAX_NOTES_LEN}
            </span>
          </div>
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX_NOTES_LEN))}
            placeholder="Notes about this range…"
            rows={8}
            className={cn(
              'w-full resize-y rounded-lg border border-border bg-bg px-2.5 py-2',
              'text-sm text-content placeholder:text-content-muted',
              'focus:outline focus:outline-2 focus:outline-offset-0 focus:outline-accent-light',
            )}
          />
          <p className="mt-1.5 text-[11px] text-content-muted">
            Auto-saved while you type.
          </p>
        </div>
      )}
    </div>
  );
}
