import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { Download, Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { Range } from '@/types/poker';
import {
  allRangesToJson,
  copyToClipboard,
  downloadBlob,
  exportNodeToPng,
  rangeToJson,
  rangeToNotation,
  slugify,
  todayIsoDate,
} from '@/utils/exportRange';

type ExportMenuProps = {
  activeRange: Range | null;
  allRanges: Range[];
  gridRef: RefObject<HTMLDivElement | null>;
};

type Feedback = { key: string; label: string };

export function ExportMenu({ activeRange, allRanges, gridRef }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const feedbackTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onDocClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDocClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(
    () => () => {
      if (feedbackTimer.current !== null) {
        window.clearTimeout(feedbackTimer.current);
      }
    },
    [],
  );

  const flash = useCallback((key: string, label: string) => {
    setFeedback({ key, label });
    if (feedbackTimer.current !== null) {
      window.clearTimeout(feedbackTimer.current);
    }
    feedbackTimer.current = window.setTimeout(() => {
      setFeedback(null);
      feedbackTimer.current = null;
    }, 1500);
  }, []);

  const canCopy = !!activeRange;
  const canDownloadOne = !!activeRange;
  const canDownloadAll = allRanges.length > 0;
  const canExportPng = !!activeRange;

  const handleCopy = useCallback(async () => {
    if (!activeRange) return;
    const text = rangeToNotation(activeRange);
    const ok = await copyToClipboard(text);
    flash('copy', ok ? 'Copied' : 'Copy failed');
    setOpen(false);
  }, [activeRange, flash]);

  const handleDownloadOne = useCallback(() => {
    if (!activeRange) return;
    downloadBlob(
      rangeToJson(activeRange),
      `${slugify(activeRange.name)}.json`,
      'application/json',
    );
    setOpen(false);
  }, [activeRange]);

  const handleDownloadAll = useCallback(() => {
    if (allRanges.length === 0) return;
    downloadBlob(
      allRangesToJson(allRanges),
      `range-soprano-${todayIsoDate()}.json`,
      'application/json',
    );
    setOpen(false);
  }, [allRanges]);

  const handleExportPng = useCallback(async () => {
    const node = gridRef.current;
    if (!activeRange || !node) return;
    setOpen(false);
    try {
      await exportNodeToPng(node, `${slugify(activeRange.name)}.png`);
      flash('png', 'Saved PNG');
    } catch {
      flash('png', 'PNG failed');
    }
  }, [activeRange, gridRef, flash]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-content-muted hover:bg-surface-hover hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
      >
        {feedback ? (
          <Check className="h-3.5 w-3.5" strokeWidth={2.25} />
        ) : (
          <Download className="h-3.5 w-3.5" strokeWidth={2.25} />
        )}
        {feedback ? feedback.label : 'Export'}
      </button>
      {open && (
        <ul
          role="menu"
          className="absolute right-0 z-30 mt-1 flex w-60 flex-col rounded-lg border border-border bg-surface p-1 text-sm shadow-surface"
        >
          <MenuItem
            label="Copy notation"
            disabled={!canCopy}
            onClick={handleCopy}
          />
          <MenuItem
            label="Download JSON"
            disabled={!canDownloadOne}
            onClick={handleDownloadOne}
          />
          <MenuItem
            label="Download all ranges JSON"
            disabled={!canDownloadAll}
            onClick={handleDownloadAll}
          />
          <MenuItem
            label="Export PNG"
            disabled={!canExportPng}
            onClick={handleExportPng}
          />
        </ul>
      )}
    </div>
  );
}

type MenuItemProps = {
  label: string;
  disabled?: boolean;
  onClick: () => void;
};

function MenuItem({ label, disabled = false, onClick }: MenuItemProps) {
  return (
    <li role="none">
      <button
        type="button"
        role="menuitem"
        disabled={disabled}
        onClick={onClick}
        className={cn(
          'w-full rounded-md px-2.5 py-1.5 text-left text-sm',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light',
          disabled
            ? 'cursor-not-allowed text-content-disabled'
            : 'text-content-muted hover:bg-surface-hover hover:text-content',
        )}
      >
        {label}
      </button>
    </li>
  );
}
