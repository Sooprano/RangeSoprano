import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Printer, X } from 'lucide-react';
import { useRangeStore } from '@/store/rangeStore';
import { SITUATION_LABELS } from '@/data/positions';
import type {
  PrintFormatBadge,
  PrintPerPage,
  PrintState,
} from './PrintPage';

type PrintConfigModalProps = {
  rangeIds: string[];
  onClose: () => void;
};

const PER_PAGE_OPTIONS: PrintPerPage[] = [2, 4, 6, 9, 12];
const FORMAT_OPTIONS: { value: PrintFormatBadge; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'HU', label: 'HU' },
  { value: '3H', label: '3H' },
  { value: '6max', label: '6max' },
];

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function suggestTitle(rangeNames: string[], firstGroup: string | undefined): string {
  if (firstGroup) {
    // Use last segment of group path.
    const segments = firstGroup.split('/');
    return segments[segments.length - 1] ?? firstGroup;
  }
  if (rangeNames.length === 1) return rangeNames[0] ?? 'Range Soprano';
  return 'Range Soprano';
}

export function PrintConfigModal({ rangeIds, onClose }: PrintConfigModalProps) {
  const navigate = useNavigate();
  const allRanges = useRangeStore((s) => s.ranges);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const titleId = useId();
  const subtitleId = useId();
  const perPageId = useId();
  const formatId = useId();

  const ranges = useMemo(() => {
    const map = new Map(allRanges.map((r) => [r.id, r]));
    return rangeIds.map((id) => map.get(id)).filter((r): r is NonNullable<typeof r> => !!r);
  }, [allRanges, rangeIds]);

  const defaultTitle = useMemo(
    () => suggestTitle(ranges.map((r) => r.name), ranges[0]?.group),
    [ranges],
  );
  const defaultSubtitle = useMemo(() => {
    const first = ranges[0];
    if (!first) return '';
    if (ranges.length === 1) {
      return `${first.position} · ${SITUATION_LABELS[first.situation] ?? first.situation}`;
    }
    return '';
  }, [ranges]);

  const [title, setTitle] = useState(defaultTitle);
  const [subtitle, setSubtitle] = useState(defaultSubtitle);
  const [perPage, setPerPage] = useState<PrintPerPage>(6);
  const [formatBadge, setFormatBadge] = useState<PrintFormatBadge>('auto');
  const [showLegend, setShowLegend] = useState(true);
  const [showLabels, setShowLabels] = useState(true);

  // Focus management.
  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    titleInputRef.current?.focus();
    titleInputRef.current?.select();
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

  const handleStartPrint = () => {
    const state: PrintState = {
      rangeIds,
      title: title.trim(),
      subtitle: subtitle.trim(),
      formatBadge,
      perPage,
      showLegend,
      showLabels,
    };
    navigate('/print', { state });
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
        aria-labelledby="print-title"
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-md flex-col gap-3 rounded-xl border border-border bg-surface p-5 shadow-surface"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 id="print-title" className="text-base font-semibold text-content">
              Print to PDF
            </h2>
            <p className="text-xs text-content-muted">
              {ranges.length} range{ranges.length === 1 ? '' : 's'} ready to print.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close print config"
            className="rounded-md p-1 text-content-muted hover:bg-surface-hover hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light"
          >
            <X className="h-4 w-4" strokeWidth={2.25} />
          </button>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={titleId} className="text-xs font-medium text-content-muted">
            Title (top-left)
          </label>
          <input
            ref={titleInputRef}
            id={titleId}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            className="rounded-md border border-border bg-bg px-3 py-1.5 text-sm text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={subtitleId} className="text-xs font-medium text-content-muted">
            Subtitle (optional)
          </label>
          <input
            id={subtitleId}
            type="text"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            maxLength={80}
            className="rounded-md border border-border bg-bg px-3 py-1.5 text-sm text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor={perPageId} className="text-xs font-medium text-content-muted">
              Charts per page
            </label>
            <select
              id={perPageId}
              value={perPage}
              onChange={(e) => setPerPage(Number(e.target.value) as PrintPerPage)}
              className="rounded-md border border-border bg-bg px-3 py-1.5 text-sm text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light"
            >
              {PER_PAGE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={formatId} className="text-xs font-medium text-content-muted">
              Format badge
            </label>
            <select
              id={formatId}
              value={formatBadge}
              onChange={(e) => setFormatBadge(e.target.value as PrintFormatBadge)}
              className="rounded-md border border-border bg-bg px-3 py-1.5 text-sm text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light"
            >
              {FORMAT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="inline-flex items-center gap-2 text-xs text-content-muted">
            <input
              type="checkbox"
              checked={showLegend}
              onChange={(e) => setShowLegend(e.target.checked)}
              className="accent-accent-light"
            />
            Show legend per page
          </label>
          <label className="inline-flex items-center gap-2 text-xs text-content-muted">
            <input
              type="checkbox"
              checked={showLabels}
              onChange={(e) => setShowLabels(e.target.checked)}
              className="accent-accent-light"
            />
            Show stack / sizing labels above each grid
          </label>
        </div>

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
            onClick={handleStartPrint}
            disabled={ranges.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Printer className="h-3.5 w-3.5" strokeWidth={2.25} />
            Open print preview
          </button>
        </div>
      </div>
    </div>
  );
}
