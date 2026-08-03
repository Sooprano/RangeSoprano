import { useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Printer, Spade, X } from 'lucide-react';
import { RangeGrid } from '@/components/RangeGrid';
import { useRangeStore } from '@/store/rangeStore';
import { buildActionDefMap } from '@/utils/actionMeta';
import { computeRangeStats } from '@/utils/rangeStats';
import { deriveStack } from '@/utils/rangeStack';
import type { Range } from '@/types/poker';
import { SITUATION_LABELS } from '@/data/positions';

export type PrintPerPage = 2 | 4 | 6 | 9 | 12;
export type PrintFormatBadge = 'auto' | 'HU' | '3H' | '6max';

export type PrintState = {
  rangeIds: string[];
  title: string;
  subtitle: string;
  formatBadge: PrintFormatBadge;
  perPage: PrintPerPage;
  showLegend: boolean;
  showLabels: boolean;
};

const PER_PAGE_COLS: Record<PrintPerPage, number> = {
  2: 1,
  4: 2,
  6: 3,
  9: 3,
  12: 3,
};

function deriveFormatBadge(ranges: Range[], setting: PrintFormatBadge): string {
  if (setting !== 'auto') return setting;
  if (ranges.length === 0) return '';
  const first = ranges[0]!;
  if (first.tableFormat === 'HU') return 'HU';
  return '3H';
}

function chunkRanges(ranges: Range[], perPage: PrintPerPage): Range[][] {
  const pages: Range[][] = [];
  for (let i = 0; i < ranges.length; i += perPage) {
    pages.push(ranges.slice(i, i + perPage));
  }
  return pages;
}

export default function PrintPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const allRanges = useRangeStore((s) => s.ranges);
  const printedOnceRef = useRef(false);

  const state = location.state as PrintState | null;

  const ranges = useMemo<Range[]>(() => {
    if (!state) return [];
    const map = new Map(allRanges.map((r) => [r.id, r]));
    return state.rangeIds
      .map((id) => map.get(id))
      .filter((r): r is Range => !!r);
  }, [state, allRanges]);

  // Auto-trigger native print dialog once on mount.
  useEffect(() => {
    if (!state || ranges.length === 0) return;
    if (printedOnceRef.current) return;
    printedOnceRef.current = true;
    const t = window.setTimeout(() => window.print(), 350);
    return () => window.clearTimeout(t);
  }, [state, ranges.length]);

  // Override document.title so the optional browser-injected print header
  // shows "Range Soprano · {title}" instead of "localhost:5173/print".
  // (The browser URL/timestamp footer can only be removed by the user from
  // their print dialog: uncheck "Encabezados y pies de página".)
  useEffect(() => {
    const previous = document.title;
    document.title = state?.title
      ? `Range Soprano · ${state.title}`
      : 'Range Soprano';
    return () => {
      document.title = previous;
    };
  }, [state?.title]);

  useEffect(() => {
    const robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const previous = robots?.getAttribute('content') ?? 'index, follow';
    if (robots) robots.setAttribute('content', 'noindex, nofollow');
    return () => {
      if (robots) robots.setAttribute('content', previous);
    };
  }, []);

  if (!state) {
    return (
      <div
        data-theme="light"
        className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg p-6 text-center text-content"
      >
        <h1 className="text-xl font-semibold">No print configuration</h1>
        <p className="max-w-sm text-sm text-content-muted">
          Open the Viewer and click <strong>Print PDF</strong> to configure a
          printable layout.
        </p>
        <button
          type="button"
          onClick={() => navigate('/viewer')}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-deep"
        >
          Back to Viewer
        </button>
      </div>
    );
  }

  const pages = chunkRanges(ranges, state.perPage);
  const totalPages = pages.length;
  const cols = PER_PAGE_COLS[state.perPage];
  const formatBadge = deriveFormatBadge(ranges, state.formatBadge);

  return (
    <div
      data-theme="light"
      className="min-h-screen bg-bg text-content print:bg-white"
    >
      {/* Toolbar — only on screen, hidden in print */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface px-4 py-2 print:hidden">
        <div className="flex items-baseline gap-3">
          <span className="text-sm font-semibold">Print preview</span>
          <span className="text-xs text-content-muted">
            {ranges.length} range{ranges.length === 1 ? '' : 's'} ·{' '}
            {totalPages} page{totalPages === 1 ? '' : 's'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
          >
            <Printer className="h-3.5 w-3.5" strokeWidth={2.25} />
            Print / Save as PDF
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-content-muted hover:bg-surface-hover hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
            aria-label="Close print preview"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2.25} />
            Close
          </button>
        </div>
      </div>

      <div
        className="print-root mx-auto flex max-w-[210mm] flex-col gap-6 p-6 print:gap-0 print:p-0"
        data-per-page={state.perPage}
      >
        {pages.map((pageRanges, pageIdx) => (
          <PrintPageView
            key={pageIdx}
            ranges={pageRanges}
            cols={cols}
            title={state.title}
            subtitle={state.subtitle}
            formatBadge={formatBadge}
            pageNumber={pageIdx + 1}
            totalPages={totalPages}
            showLegend={state.showLegend}
            showLabels={state.showLabels}
          />
        ))}
      </div>
    </div>
  );
}

type PrintPageViewProps = {
  ranges: Range[];
  cols: number;
  title: string;
  subtitle: string;
  formatBadge: string;
  pageNumber: number;
  totalPages: number;
  showLegend: boolean;
  showLabels: boolean;
};

function PrintPageView({
  ranges,
  cols,
  title,
  subtitle,
  formatBadge,
  pageNumber,
  totalPages,
  showLegend,
  showLabels,
}: PrintPageViewProps) {
  // Aggregate present actions across the page from the first range that has any.
  const legendSource = ranges[0] ?? null;

  return (
    <section
      className="print-page flex min-h-[260mm] flex-col gap-3 rounded-md border border-border bg-surface p-6 shadow-surface print:min-h-0 print:border-none print:shadow-none print:rounded-none print:bg-transparent print:p-0"
      aria-label={`Print page ${pageNumber}`}
    >
      <div className="print-brand flex flex-col items-center gap-0.5 pb-1">
        <div className="flex items-center gap-1.5">
          <Spade
            className="h-3 w-3 text-accent"
            strokeWidth={2.5}
            aria-hidden
          />
          <span className="text-[11px] font-semibold tracking-tight text-content print:text-black">
            Range Soprano
          </span>
        </div>
        <span className="text-[8px] font-semibold uppercase tracking-[0.18em] text-content-muted print:text-black/60">
          Poker Ranges
        </span>
      </div>
      <header className="flex items-baseline justify-between gap-3 border-b border-border pb-2 print:border-b-2 print:border-black/30">
        <div className="flex min-w-0 flex-col">
          <h1 className="truncate text-base font-bold text-content print:text-black">
            {title || 'Range Soprano'}
          </h1>
          {subtitle && (
            <p className="truncate text-xs text-content-muted print:text-black/70">
              {subtitle}
            </p>
          )}
        </div>
        {formatBadge && (
          <span className="rounded-md border border-border bg-surface px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-content print:border-black/40 print:bg-transparent print:text-black">
            {formatBadge}
          </span>
        )}
      </header>

      <div
        className="grid flex-1 content-start gap-3 print:flex-none print:gap-1.5"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {ranges.map((r) => (
          <PrintRangeTile key={r.id} range={r} showLabels={showLabels} />
        ))}
      </div>

      <footer className="flex items-end justify-between gap-3 border-t border-border pt-2 text-[10px] text-content-muted print:border-t-2 print:border-black/30 print:text-black/70">
        {showLegend && legendSource ? (
          <PrintLegend range={legendSource} />
        ) : (
          <span />
        )}
        <span className="tabular-nums">
          {pageNumber} / {totalPages}
        </span>
      </footer>
    </section>
  );
}

function PrintRangeTile({
  range,
  showLabels,
}: {
  range: Range;
  showLabels: boolean;
}) {
  const actionsMap = useMemo(() => buildActionDefMap(range.actions), [range.actions]);
  const stack = deriveStack(range);
  const sizing1 = range.printLabels?.sizing1 ?? '';
  const sizing2 = range.printLabels?.sizing2 ?? '';

  const subtitle = `${range.position} · ${SITUATION_LABELS[range.situation] ?? range.situation}${
    range.villainPosition ? ` · vs ${range.villainPosition}` : ''
  }`;

  return (
    <div className="print-no-break flex flex-col gap-0.5">
      {showLabels && (stack || sizing1 || sizing2) && (
        <div className="flex items-baseline justify-between gap-2 text-[10px] font-semibold tabular-nums text-content print:text-black">
          <span className="min-w-0">{stack || ' '}</span>
          <span className="min-w-0 text-center">{sizing1 || ' '}</span>
          <span className="min-w-0 text-right">{sizing2 || ' '}</span>
        </div>
      )}
      <RangeGrid cells={range.cells} actionsMap={actionsMap} />
      <div className="flex flex-col text-[6.5px] leading-tight tracking-tight text-content-muted print:text-black/60">
        <span className="truncate font-medium">{range.name}</span>
        <span className="truncate">{subtitle}</span>
      </div>
    </div>
  );
}

function PrintLegend({ range }: { range: Range }) {
  const presentActions = useMemo(
    () => computeRangeStats(range.cells).presentActions,
    [range.cells],
  );
  const defs = range.actions
    .filter((a) => presentActions.includes(a.id))
    .sort((a, b) => a.order - b.order);
  if (defs.length === 0) return <span />;
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {defs.map((d) => (
        <li key={d.id} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: d.color }}
          />
          <span>{d.label}</span>
        </li>
      ))}
    </ul>
  );
}
