import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { Download } from 'lucide-react';
import { cn } from '@/lib/cn';
import { pushToast } from '@/store/toastStore';
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

export function ExportMenu({ activeRange, allRanges, gridRef }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

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

  const canCopy = !!activeRange;
  const canDownloadOne = !!activeRange;
  const canDownloadAll = allRanges.length > 0;
  const canExportPng = !!activeRange;

  const handleCopy = useCallback(async () => {
    if (!activeRange) return;
    setOpen(false);
    const text = rangeToNotation(activeRange);
    const ok = await copyToClipboard(text);
    if (ok) pushToast({ kind: 'success', message: 'Notation copied to clipboard' });
    else pushToast({ kind: 'error', message: 'Could not copy notation' });
  }, [activeRange]);

  const handleDownloadOne = useCallback(() => {
    if (!activeRange) return;
    setOpen(false);
    downloadBlob(
      rangeToJson(activeRange),
      `${slugify(activeRange.name)}.json`,
      'application/json',
    );
    pushToast({ kind: 'success', message: `Downloaded "${activeRange.name}.json"` });
  }, [activeRange]);

  const handleDownloadAll = useCallback(() => {
    if (allRanges.length === 0) return;
    setOpen(false);
    downloadBlob(
      allRangesToJson(allRanges),
      `range-soprano-${todayIsoDate()}.json`,
      'application/json',
    );
    pushToast({
      kind: 'success',
      message: `Downloaded ${allRanges.length} range${allRanges.length === 1 ? '' : 's'} as JSON`,
    });
  }, [allRanges]);

  const handleExportPng = useCallback(async () => {
    const node = gridRef.current;
    if (!activeRange || !node) return;
    setOpen(false);
    try {
      await exportNodeToPng(node, `${slugify(activeRange.name)}.png`);
      pushToast({ kind: 'success', message: 'PNG saved' });
    } catch {
      pushToast({ kind: 'error', message: 'Could not export PNG' });
    }
  }, [activeRange, gridRef]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-content-muted hover:bg-surface-hover hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
      >
        <Download className="h-3.5 w-3.5" strokeWidth={2.25} />
        Export
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
