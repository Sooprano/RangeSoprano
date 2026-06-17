import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Eye, GitCompare, LayoutGrid, Printer, Spade } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { PageHeader } from '@/components/ui/PageHeader';
import { RangeGrid } from '@/components/RangeGrid';
import { RangeStats } from '@/components/RangeStats';
import { ActionLegend } from '@/components/ActionLegend';
import { CopyRangeMenu } from '@/components/CopyRangeMenu/CopyRangeMenu';
import { computeRangeStats } from '@/utils/rangeStats';
import { buildActionDefMap } from '@/utils/actionMeta';
import { useRangeStore } from '@/store/rangeStore';
import { pushToast } from '@/store/toastStore';
import { useUiStore } from '@/store/uiStore';
import { useRangeSummaries, useViewerRange } from '@/store/selectors';
import { SITUATION_LABELS } from '@/data/positions';
import { exportNodeToPng, slugify } from '@/utils/exportRange';
import { EmptyState } from './EmptyState';
import { ViewerRangeList, displayOrderFor } from './ViewerRangeList';
import {
  EMPTY_FILTERS,
  SituationSelector,
  hasAnyFilter,
  matchesFilters,
  type ViewerFilters,
} from './SituationSelector';
import { CompareToolbar } from './CompareToolbar';
import { RangePanel } from './RangePanel';
import { OverviewPanel } from './OverviewPanel';
import { PrintConfigModal } from './PrintConfigModal';
import { FloatingTools } from './Floating/FloatingTools';

type ViewMode = 'single' | 'compare' | 'overview';

export default function ViewerPage() {
  useDocumentTitle('Visualizador de rangos · Range Soprano', {
    description:
      'Visualiza rangos preflop con filtros por posición, situación y villano. Compara dos rangos, exporta PNG o imprime PDF.',
    canonical: 'https://rangesoprano.com/viewer/',
  });
  const ranges = useRangeStore((s) => s.ranges);
  const summaries = useRangeSummaries();
  const viewerRangeId = useUiStore((s) => s.viewerRangeId);
  const setViewerRangeId = useUiStore((s) => s.setViewerRangeId);
  const overviewSelectedGroups = useUiStore((s) => s.overviewSelectedGroups);
  const range = useViewerRange();

  const [viewMode, setViewMode] = useState<ViewMode>('single');
  const [filters, setFilters] = useState<ViewerFilters>(EMPTY_FILTERS);
  const [compareRangeId, setCompareRangeId] = useState<string | null>(null);
  const [isPrintConfigOpen, setIsPrintConfigOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const captureRef = useRef<HTMLDivElement | null>(null);

  const compareEnabled = viewMode === 'compare';

  const filteredSummaries = useMemo(
    () =>
      hasAnyFilter(filters)
        ? summaries.filter((s) => matchesFilters(s, filters))
        : summaries,
    [summaries, filters],
  );

  useEffect(() => {
    if (ranges.length === 0) {
      if (viewerRangeId !== null) setViewerRangeId(null);
      return;
    }
    const stillValid = viewerRangeId
      ? ranges.some((r) => r.id === viewerRangeId)
      : false;
    if (!stillValid) {
      setViewerRangeId(ranges[0]!.id);
    }
  }, [ranges, viewerRangeId, setViewerRangeId]);

  useEffect(() => {
    if (compareRangeId && !ranges.some((r) => r.id === compareRangeId)) {
      setCompareRangeId(null);
    }
  }, [ranges, compareRangeId]);

  const compareRange = useMemo(
    () => ranges.find((r) => r.id === compareRangeId) ?? null,
    [ranges, compareRangeId],
  );

  const handleSetViewMode = useCallback(
    (next: ViewMode) => {
      setViewMode(next);
      if (next === 'compare' && !compareRangeId) {
        const candidate = ranges.find((r) => r.id !== viewerRangeId);
        if (candidate) setCompareRangeId(candidate.id);
      }
    },
    [compareRangeId, ranges, viewerRangeId],
  );

  const handleOverviewTileClick = useCallback(
    (id: string) => {
      setViewerRangeId(id);
      setViewMode('single');
    },
    [setViewerRangeId],
  );

  const handleExportPng = useCallback(async () => {
    const node = captureRef.current;
    if (!node || !range) return;
    const baseName = compareEnabled && compareRange
      ? `${slugify(range.name)}-vs-${slugify(compareRange.name)}`
      : slugify(range.name);
    setIsExporting(true);
    try {
      // Two RAFs to ensure the export-only header has been painted.
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      await exportNodeToPng(node, `${baseName}.png`);
      pushToast({ kind: 'success', message: 'PNG guardado' });
    } catch {
      pushToast({ kind: 'error', message: 'No se pudo exportar el PNG' });
    } finally {
      setIsExporting(false);
    }
  }, [range, compareRange, compareEnabled]);

  const groupMeta = useUiStore((s) => s.groupMeta);
  const orderedForNav = useMemo(
    () => displayOrderFor(filteredSummaries, groupMeta),
    [filteredSummaries, groupMeta],
  );

  useEffect(() => {
    if (viewMode !== 'single') return;
    if (orderedForNav.length < 2) return;
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const target = e.target as HTMLElement | null;
      if (
        target?.closest(
          'input, textarea, select, [contenteditable="true"], [role="grid"]',
        )
      ) {
        return;
      }
      e.preventDefault();
      const idx = orderedForNav.findIndex((s) => s.id === viewerRangeId);
      const dir = e.key === 'ArrowRight' ? 1 : -1;
      const len = orderedForNav.length;
      const nextIdx = idx < 0 ? 0 : (idx + dir + len) % len;
      const next = orderedForNav[nextIdx];
      if (next) setViewerRangeId(next.id);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [viewMode, orderedForNav, viewerRangeId, setViewerRangeId]);

  const actionsMap = useMemo(
    () => (range ? buildActionDefMap(range.actions) : new Map()),
    [range],
  );
  const presentActions = useMemo(
    () => (range ? computeRangeStats(range.cells).presentActions : []),
    [range],
  );

  if (ranges.length === 0) {
    return (
      <>
        <PageHeader
          title="Visualizador"
          description="Explorá rangos preflop por formato, posición y situación."
        />
        <EmptyState />
      </>
    );
  }

  const selectionInFilter = range !== null && matchesFilters(range, filters);
  const canExport =
    !!range && (!compareEnabled || compareRange !== null);

  // Decide which range IDs feed the print modal.
  const printRangeIds: string[] =
    viewMode === 'overview'
      ? ranges
          .filter((r) => overviewSelectedGroups.includes(r.group ?? ''))
          .map((r) => r.id)
      : range
        ? [range.id]
        : [];
  const canPrint = printRangeIds.length > 0;

  return (
    <>
      <PageHeader
        eyebrow={
          range && viewMode !== 'overview'
            ? `${range.position} · ${SITUATION_LABELS[range.situation] ?? range.situation}`
            : 'Module'
        }
        title={
          viewMode === 'overview'
            ? 'Resumen'
            : range
              ? range.name
              : 'Visualizador'
        }
        description="Explorá rangos preflop por formato, posición y situación."
        {...(viewMode === 'overview' && { actions: <FloatingTools /> })}
      />

      <div
        className={cn(
          'grid gap-6',
          viewMode === 'overview'
            ? ''
            : compareEnabled
              ? 'md:grid-cols-[220px_minmax(0,1fr)]'
              : 'md:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_280px]',
        )}
      >
        {viewMode !== 'overview' && (
          <ViewerRangeList
            summaries={filteredSummaries}
            selectedId={viewerRangeId}
            onSelect={setViewerRangeId}
            emptyMessage={
              hasAnyFilter(filters)
                ? 'Ningún rango coincide con los filtros actuales.'
                : 'Sin rangos todavía. Crea uno en el Editor.'
            }
          />
        )}

        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            {viewMode !== 'overview' && (
              <SituationSelector filters={filters} onChange={setFilters} />
            )}
            {viewMode === 'overview' && <span />}
            <div className="flex flex-wrap items-center gap-2">
              <ViewModeToggle value={viewMode} onChange={handleSetViewMode} />
              {viewMode === 'compare' && (
                <CompareToolbar
                  enabled
                  onToggle={(next) => {
                    if (!next) setViewMode('single');
                  }}
                  summaries={summaries}
                  compareId={compareRangeId}
                  onChangeCompareId={setCompareRangeId}
                />
              )}
              {viewMode !== 'overview' && range && (
                <CopyRangeMenu range={range} />
              )}
              {viewMode !== 'overview' && (
                <button
                  type="button"
                  onClick={handleExportPng}
                  disabled={!canExport}
                  title="Exportar PNG"
                  className={
                    'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light ' +
                    (canExport
                      ? 'text-content-muted hover:bg-surface-hover hover:text-content'
                      : 'cursor-not-allowed text-content-disabled')
                  }
                >
                  <Download className="h-3.5 w-3.5" strokeWidth={2.25} />
                  Exportar PNG
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsPrintConfigOpen(true)}
                disabled={!canPrint}
                title="Imprimir PDF"
                className={
                  'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light ' +
                  (canPrint
                    ? 'text-content-muted hover:bg-surface-hover hover:text-content'
                    : 'cursor-not-allowed text-content-disabled')
                }
              >
                <Printer className="h-3.5 w-3.5" strokeWidth={2.25} />
                Imprimir PDF
              </button>
            </div>
          </div>

          {viewMode === 'overview' ? (
            <OverviewPanel onTileClick={handleOverviewTileClick} />
          ) : compareEnabled ? (
            <div ref={captureRef} className="rounded-xl bg-bg p-2">
              {isExporting && (range || compareRange) && (
                <ExportHeader
                  title={
                    range && compareRange
                      ? `${range.name} vs ${compareRange.name}`
                      : range?.name ?? compareRange?.name ?? 'Range Soprano'
                  }
                />
              )}
              <div className="grid gap-6 xl:grid-cols-2">
                {range ? (
                  <RangePanel range={range} badge="A" />
                ) : (
                  <CompareSlot label="Elige un rango de la lista" />
                )}
                {compareRange ? (
                  <RangePanel range={compareRange} badge="B" />
                ) : (
                  <CompareSlot label="Elige un rango para comparar" />
                )}
              </div>
            </div>
          ) : range ? (
            <>
              {!selectionInFilter && hasAnyFilter(filters) && (
                <p className="rounded-md border border-dashed border-border px-3 py-2 text-center text-xs text-content-muted">
                  El rango seleccionado no coincide con los filtros actuales.
                </p>
              )}
              <div ref={captureRef} className="rounded-xl bg-bg p-2">
                {isExporting && (
                  <ExportHeader
                    title={range.name}
                    subtitle={`${range.position} · ${SITUATION_LABELS[range.situation] ?? range.situation}${range.villainPosition ? ` · vs ${range.villainPosition}` : ''}`}
                    {...(range.tableFormat === 'HU' && { badge: 'HU' })}
                  />
                )}
                <RangeGrid cells={range.cells} actionsMap={actionsMap} />
              </div>
              {filteredSummaries.length > 1 && (
                <p className="text-xs text-content-muted">
                  Usa ← / → para navegar por la lista filtrada.
                </p>
              )}
            </>
          ) : (
            <CompareSlot label="Selecciona un rango de la lista para verlo." />
          )}
        </div>

        {viewMode === 'single' && range && (
          <aside className="flex flex-col gap-4 md:col-span-2 md:grid md:grid-cols-2 md:gap-4 xl:col-span-1 xl:flex xl:flex-col">
            <RangeStats cells={range.cells} actionDefs={range.actions} />
            <ActionLegend actionDefs={range.actions} presentActions={presentActions} />
          </aside>
        )}
      </div>

      {isPrintConfigOpen && canPrint && (
        <PrintConfigModal
          rangeIds={printRangeIds}
          onClose={() => setIsPrintConfigOpen(false)}
        />
      )}
    </>
  );
}

type ViewModeToggleProps = {
  value: ViewMode;
  onChange: (m: ViewMode) => void;
};

function ViewModeToggle({ value, onChange }: ViewModeToggleProps) {
  return (
    <div
      role="tablist"
      aria-label="View mode"
      className="inline-flex items-center gap-1 rounded-xl border border-border bg-surface/60 p-1"
    >
      <ModeButton
        active={value === 'single'}
        onClick={() => onChange('single')}
        icon={<Eye className="h-3.5 w-3.5" strokeWidth={2.25} />}
        label="Individual"
      />
      <ModeButton
        active={value === 'compare'}
        onClick={() => onChange('compare')}
        icon={<GitCompare className="h-3.5 w-3.5" strokeWidth={2.25} />}
        label="Comparar"
      />
      <ModeButton
        active={value === 'overview'}
        onClick={() => onChange('overview')}
        icon={<LayoutGrid className="h-3.5 w-3.5" strokeWidth={2.25} />}
        label="Resumen"
      />
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium',
        'transition-colors duration-150 ease-out-soft',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light',
        active
          ? 'bg-surface text-content shadow-[inset_0_0_0_1px_rgb(var(--color-accent)/0.6)]'
          : 'text-content-muted hover:bg-surface-hover hover:text-content',
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function CompareSlot({ label }: { label: string }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center rounded-xl border border-dashed border-border p-6 text-center text-sm text-content-muted">
      {label}
    </div>
  );
}

function ExportHeader({
  title,
  subtitle,
  badge,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
}) {
  return (
    <div
      aria-hidden
      className="mb-2 flex flex-col gap-2 border-b border-border/60 px-3 pb-3 pt-2"
    >
      <div className="flex flex-col items-center gap-0.5">
        <div className="flex items-center gap-1.5">
          <Spade className="h-3.5 w-3.5 text-accent" strokeWidth={2.5} aria-hidden />
          <span className="text-sm font-semibold tracking-tight text-content">
            Range Soprano
          </span>
        </div>
        <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-content-muted">
          Poker Ranges
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <h2 className="truncate text-base font-bold text-content">{title}</h2>
          {subtitle && (
            <p className="truncate text-xs text-content-muted">{subtitle}</p>
          )}
        </div>
        {badge && (
          <span className="rounded-md border border-border bg-surface px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-content">
            {badge}
          </span>
        )}
      </div>
    </div>
  );
}
