import { useEffect, useMemo, useState } from 'react';
import { Brush, Dices, Palette, Zap } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { PageHeader } from '@/components/ui/PageHeader';
import { useRangeStore } from '@/store/rangeStore';
import { useUiStore } from '@/store/uiStore';
import { useRangeSummaries, useTrainerRange } from '@/store/selectors';
import { ViewerRangeList } from '@/modules/viewer/ViewerRangeList';
import {
  EMPTY_FILTERS,
  SituationSelector,
  hasAnyFilter,
  matchesFilters,
  type ViewerFilters,
} from '@/modules/viewer/SituationSelector';
import { TrainerEmptyState } from './TrainerEmptyState';
import { ClassicTrainer } from './ClassicTrainer';
import { DrawingTrainer } from './DrawingTrainer';
import { SpeedTrainer } from './SpeedTrainer';
import { TableThemeModal } from './TableThemeModal';
import { SITUATION_LABELS } from '@/data/positions';

type TrainerMode = 'classic' | 'drawing' | 'speed';

export default function TrainerPage() {
  useDocumentTitle('Entrenador de rangos · Range Soprano', {
    description:
      'Entrena manos preflop en mesa 6-max o HU. Modo Clásico, Speed contrarreloj o Drawing.',
    canonical: 'https://rangesoprano.com/trainer/',
  });
  const ranges = useRangeStore((s) => s.ranges);
  const summaries = useRangeSummaries();
  const trainerRangeId = useUiStore((s) => s.trainerRangeId);
  const setTrainerRangeId = useUiStore((s) => s.setTrainerRangeId);
  const range = useTrainerRange();

  const [mode, setMode] = useState<TrainerMode>('classic');
  const [filters, setFilters] = useState<ViewerFilters>(EMPTY_FILTERS);
  const [themeOpen, setThemeOpen] = useState(false);

  const filteredSummaries = useMemo(
    () =>
      hasAnyFilter(filters)
        ? summaries.filter((s) => matchesFilters(s, filters))
        : summaries,
    [summaries, filters],
  );

  useEffect(() => {
    if (ranges.length === 0) {
      if (trainerRangeId !== null) setTrainerRangeId(null);
      return;
    }
    const stillValid = trainerRangeId
      ? ranges.some((r) => r.id === trainerRangeId)
      : false;
    if (!stillValid) {
      setTrainerRangeId(ranges[0]!.id);
    }
  }, [ranges, trainerRangeId, setTrainerRangeId]);

  if (ranges.length === 0) {
    return (
      <>
        <PageHeader
          title="Entrenador"
          description="Practicá decisiones contra tus rangos guardados. Modos clásico, dibujo y velocidad."
        />
        <div className="flex flex-wrap items-start justify-end gap-3 pb-4">
          <ModeToggle value={mode} onChange={setMode} />
        </div>
        <TrainerEmptyState />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow={
          range
            ? `${range.position} · ${SITUATION_LABELS[range.situation] ?? range.situation}`
            : 'Module'
        }
        title={range ? range.name : 'Entrenador'}
        description="Practicá decisiones contra tus rangos guardados. Modos clásico, dibujo y velocidad."
      />

      <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
        <ViewerRangeList
          summaries={filteredSummaries}
          selectedId={trainerRangeId}
          onSelect={setTrainerRangeId}
          emptyMessage={
            hasAnyFilter(filters)
              ? 'Ningún rango coincide con los filtros actuales.'
              : 'Sin rangos todavía. Crea uno en el Editor.'
          }
        />

        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <SituationSelector filters={filters} onChange={setFilters} />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setThemeOpen(true)}
                title="Apariencia de la mesa"
                aria-label="Apariencia de la mesa"
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface/60 px-3 py-2 text-sm font-medium text-content-muted transition-colors hover:bg-surface-hover hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
              >
                <Palette className="h-3.5 w-3.5" strokeWidth={2.25} />
                <span className="hidden sm:inline">Mesa</span>
              </button>
              <ModeToggle value={mode} onChange={setMode} />
            </div>
          </div>
          {range ? (
            mode === 'classic' ? (
              <ClassicTrainer range={range} />
            ) : mode === 'drawing' ? (
              <DrawingTrainer range={range} />
            ) : (
              <SpeedTrainer range={range} />
            )
          ) : (
            <div className="flex min-h-[40vh] items-center justify-center rounded-xl border border-dashed border-border p-6 text-center text-sm text-content-muted">
              Elige un rango de la lista para empezar.
            </div>
          )}
        </div>
      </div>

      {themeOpen && <TableThemeModal onClose={() => setThemeOpen(false)} />}
    </>
  );
}

type ModeToggleProps = {
  value: TrainerMode;
  onChange: (mode: TrainerMode) => void;
};

function ModeToggle({ value, onChange }: ModeToggleProps) {
  return (
    <div
      role="tablist"
      aria-label="Modo"
      className="inline-flex w-fit items-center gap-1 rounded-xl border border-border bg-surface/60 p-1"
    >
      <ModeButton
        active={value === 'classic'}
        onClick={() => onChange('classic')}
        icon={<Dices className="h-3.5 w-3.5" strokeWidth={2.25} />}
        label="Clásico"
      />
      <ModeButton
        active={value === 'drawing'}
        onClick={() => onChange('drawing')}
        icon={<Brush className="h-3.5 w-3.5" strokeWidth={2.25} />}
        label="Dibujo"
      />
      <ModeButton
        active={value === 'speed'}
        onClick={() => onChange('speed')}
        icon={<Zap className="h-3.5 w-3.5" strokeWidth={2.25} />}
        label="Velocidad"
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

