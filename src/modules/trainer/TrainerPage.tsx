import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Brush, Dices, Expand, Focus, Minimize2, Palette, Shrink, Zap } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { PageHeader } from '@/components/ui/PageHeader';
import { useRangeStore } from '@/store/rangeStore';
import { useUiStore } from '@/store/uiStore';
import { useRangeSummaries, useRangesInGroup, useTrainerRange } from '@/store/selectors';
import { isInGroup } from '@/utils/groupUtils';
import type { TrainerSource } from '@/utils/trainerSource';
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
  const trainerFolderPath = useUiStore((s) => s.trainerFolderPath);
  const setTrainerFolderPath = useUiStore((s) => s.setTrainerFolderPath);
  const range = useTrainerRange();
  const folderRanges = useRangesInGroup(trainerFolderPath);

  const [mode, setMode] = useState<TrainerMode>('classic');
  const [filters, setFilters] = useState<ViewerFilters>(EMPTY_FILTERS);
  const [themeOpen, setThemeOpen] = useState(false);
  // Focus mode (phase 55): only the trainer, no sidebars or headers. Page
  // state on purpose: entering it is a choice per session, not a setting.
  const [focus, setFocus] = useState(false);
  const fullscreen = useFullscreen();
  const exitFocus = useCallback(() => {
    setFocus(false);
    fullscreen.exit();
  }, [fullscreen]);

  // Esc leaves Focus. The hotkey capture (right click on an action) eats its
  // own Esc in the capture phase, and an open dialog keeps it.
  useEffect(() => {
    if (!focus) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (document.querySelector('[role="dialog"]')) return;
      exitFocus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focus, exitFocus]);

  const filteredSummaries = useMemo(
    () => (hasAnyFilter(filters) ? summaries.filter((s) => matchesFilters(s, filters)) : summaries),
    [summaries, filters],
  );

  const folderMode = trainerFolderPath !== null && folderRanges.length > 0;

  const source: TrainerSource | null = folderMode
    ? {
        kind: 'folder',
        path: trainerFolderPath!,
        label: folderLabel(trainerFolderPath!),
        ranges: folderRanges,
      }
    : range
      ? { kind: 'range', range }
      : null;

  // Drop a stale folder selection (folder renamed, moved or emptied).
  useEffect(() => {
    if (trainerFolderPath !== null && folderRanges.length === 0) {
      setTrainerFolderPath(null);
    }
  }, [trainerFolderPath, folderRanges, setTrainerFolderPath]);

  // Drawing paints one grid, so it trains one range. Derived, not synced with
  // an effect: the mode you had comes back when you leave the folder.
  const effectiveMode: TrainerMode = folderMode && mode === 'drawing' ? 'classic' : mode;

  // In Focus the trainer grows to the screen (big monitors, fullscreen).
  const fitRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  useFocusFit(focus, fitRef, contentRef, effectiveMode);

  const folderRangeCount = useCallback(
    (path: string) => ranges.filter((r) => isInGroup(r.group, path)).length,
    [ranges],
  );

  const selectRange = useCallback(
    (id: string) => {
      setTrainerRangeId(id);
      setTrainerFolderPath(null);
    },
    [setTrainerRangeId, setTrainerFolderPath],
  );

  const selectFolder = useCallback(
    (path: string) => {
      setTrainerFolderPath(trainerFolderPath === path ? null : path);
    },
    [trainerFolderPath, setTrainerFolderPath],
  );

  useEffect(() => {
    if (ranges.length === 0) {
      if (trainerRangeId !== null) setTrainerRangeId(null);
      return;
    }
    const stillValid = trainerRangeId ? ranges.some((r) => r.id === trainerRangeId) : false;
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
          <ModeToggle value={mode} onChange={setMode} folderMode={false} />
        </div>
        <TrainerEmptyState />
      </>
    );
  }

  return (
    <>
      {!focus && (
        <PageHeader
          eyebrow={
            source?.kind === 'folder'
              ? `Carpeta · ${source.ranges.length} rangos`
              : range
                ? `${range.position} · ${SITUATION_LABELS[range.situation] ?? range.situation}`
                : 'Module'
          }
          title={source?.kind === 'folder' ? source.label : range ? range.name : 'Entrenador'}
          description={
            source?.kind === 'folder'
              ? 'Entrenás toda la carpeta mezclada: cada mano sortea uno de sus rangos y el stack del paño te dice cuál.'
              : 'Practicá decisiones contra tus rangos guardados. Modos clásico, dibujo y velocidad.'
          }
        />
      )}

      <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
        {!focus && (
          <ViewerRangeList
            summaries={filteredSummaries}
            selectedId={folderMode ? null : trainerRangeId}
            onSelect={selectRange}
            selectedFolderPath={trainerFolderPath}
            onSelectFolder={selectFolder}
            folderRangeCount={folderRangeCount}
            emptyMessage={
              hasAnyFilter(filters)
                ? 'Ningún rango coincide con los filtros actuales.'
                : 'Sin rangos todavía. Crea uno en el Editor.'
            }
          />
        )}

        <div
          className={cn(
            'flex min-w-0 flex-col gap-4',
            // Covers the whole window (sidebar included); the trainer stays
            // mounted, only its frame changes.
            focus && 'fixed inset-0 z-40 overflow-y-auto bg-bg px-4 pb-8 pt-3 sm:px-6',
          )}
        >
          {focus ? (
            <FocusBar
              fullscreen={fullscreen.active}
              canFullscreen={fullscreen.supported}
              onFullscreen={fullscreen.toggle}
              onExit={exitFocus}
            />
          ) : (
            <div className="flex flex-wrap items-start justify-between gap-3">
              <SituationSelector filters={filters} onChange={setFilters} />
              <div className="flex items-center gap-2">
                {source && (
                  <button
                    type="button"
                    onClick={() => setFocus(true)}
                    title="Modo Focus: solo la mesa, sin nada a los lados (Esc para salir)"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface/60 px-3 py-2 text-sm font-medium text-content-muted transition-colors hover:bg-surface-hover hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
                  >
                    <Focus className="h-3.5 w-3.5" strokeWidth={2.25} />
                    <span className="hidden sm:inline">Focus</span>
                  </button>
                )}
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
                <ModeToggle value={effectiveMode} onChange={setMode} folderMode={folderMode} />
              </div>
            </div>
          )}
          <div ref={fitRef}>
            <div
              ref={contentRef}
              className={cn('flex min-w-0 flex-col gap-4', focus && 'mx-auto w-full max-w-5xl')}
            >
              {source ? (
                effectiveMode === 'classic' ? (
                  <ClassicTrainer source={source} />
                ) : effectiveMode === 'drawing' && source.kind === 'range' ? (
                  <DrawingTrainer range={source.range} />
                ) : (
                  <SpeedTrainer source={source} />
                )
              ) : (
                <div className="flex min-h-[40vh] items-center justify-center rounded-xl border border-dashed border-border p-6 text-center text-sm text-content-muted">
                  Elige un rango o una carpeta de la lista para empezar.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {themeOpen && <TableThemeModal onClose={() => setThemeOpen(false)} />}
    </>
  );
}

/** Biggest zoom in Focus: past this the table feels on top of you. */
const FOCUS_MAX_SCALE = 1.6;
/** Share of the free height the trainer may take (some air around it). */
const FOCUS_FILL = 0.94;

/**
 * Focus mode: scales the trainer (tiles, table, actions, pills) to fill the
 * screen, keeping its proportions — before, it kept its page size and on a big
 * or fullscreen monitor it was a small island in the middle. `transform` (not
 * `zoom`) because offsetWidth / offsetHeight ignore it, so the natural size can
 * be measured at any time; the outer box gets the scaled height so the page
 * still scrolls right. Measured on entering, on a window resize (fullscreen
 * included) and on a mode change — NOT on content changes: opening the session
 * errors list must not shrink the table under your cursor. Written to the DOM
 * directly (no state): it is pure presentation.
 */
function useFocusFit(
  focus: boolean,
  fitRef: React.RefObject<HTMLDivElement | null>,
  contentRef: React.RefObject<HTMLDivElement | null>,
  mode: string,
) {
  useLayoutEffect(() => {
    const box = fitRef.current;
    const el = contentRef.current;
    if (!box || !el) return;
    const clear = () => {
      el.style.transform = '';
      el.style.transformOrigin = '';
      box.style.height = '';
    };
    if (!focus) {
      clear();
      return;
    }
    const fit = () => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (w === 0 || h === 0) return;
      // Room left under the Focus bar (the box's top) and inside the side padding.
      const top = box.getBoundingClientRect().top + (box.parentElement?.scrollTop ?? 0);
      const freeH = (window.innerHeight - top - 16) * FOCUS_FILL;
      const freeW = window.innerWidth - 48;
      const scale = Math.max(1, Math.min(FOCUS_MAX_SCALE, freeH / h, freeW / w));
      if (scale <= 1.01) {
        clear();
        return;
      }
      el.style.transformOrigin = 'top center';
      el.style.transform = `scale(${scale.toFixed(3)})`;
      box.style.height = `${Math.ceil(h * scale)}px`;
    };
    fit();
    window.addEventListener('resize', fit);
    return () => {
      window.removeEventListener('resize', fit);
      clear();
    };
  }, [focus, fitRef, contentRef, mode]);
}

/** Browser fullscreen, opt-in inside Focus (the window size may be on purpose). */
function useFullscreen() {
  const supported = typeof document !== 'undefined' && document.fullscreenEnabled === true;
  const [active, setActive] = useState(
    () => typeof document !== 'undefined' && document.fullscreenElement !== null,
  );
  useEffect(() => {
    const onChange = () => setActive(document.fullscreenElement !== null);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  const toggle = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void document.documentElement.requestFullscreen().catch(() => {});
  }, []);
  const exit = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  }, []);
  return useMemo(() => ({ supported, active, toggle, exit }), [supported, active, toggle, exit]);
}

const FOCUS_BUTTON =
  'inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface/60 px-2.5 py-1.5 text-xs font-medium text-content-muted transition-colors hover:bg-surface-hover hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light';

function FocusBar({
  fullscreen,
  canFullscreen,
  onFullscreen,
  onExit,
}: {
  fullscreen: boolean;
  canFullscreen: boolean;
  onFullscreen: () => void;
  onExit: () => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-5xl justify-end gap-2">
      {canFullscreen && (
        <button
          type="button"
          onClick={onFullscreen}
          aria-pressed={fullscreen}
          title={
            fullscreen
              ? 'Volver a la ventana del navegador'
              : 'Pantalla completa: oculta las pestañas y la barra del navegador'
          }
          className={FOCUS_BUTTON}
        >
          {fullscreen ? (
            <Shrink className="h-3.5 w-3.5" strokeWidth={2.25} />
          ) : (
            <Expand className="h-3.5 w-3.5" strokeWidth={2.25} />
          )}
          {fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
        </button>
      )}
      <button type="button" onClick={onExit} title="Salir de Focus (Esc)" className={FOCUS_BUTTON}>
        <Minimize2 className="h-3.5 w-3.5" strokeWidth={2.25} />
        Salir de Focus
        <kbd className="rounded border border-border px-1 font-sans text-[10px]">Esc</kbd>
      </button>
    </div>
  );
}

/** Last segment of a group path: "SPIN/BBvsBU OR" → "BBvsBU OR". */
function folderLabel(path: string): string {
  const segments = path.split('/');
  return segments[segments.length - 1] ?? path;
}

type ModeToggleProps = {
  value: TrainerMode;
  onChange: (mode: TrainerMode) => void;
  folderMode: boolean;
};

function ModeToggle({ value, onChange, folderMode }: ModeToggleProps) {
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
        disabled={folderMode}
        title={folderMode ? 'El modo Dibujo entrena un rango a la vez' : undefined}
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
  disabled = false,
  title,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  title?: string | undefined;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium',
        'transition-colors duration-150 ease-out-soft',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light',
        disabled
          ? 'cursor-not-allowed text-content-disabled'
          : active
            ? 'bg-surface text-content shadow-[inset_0_0_0_1px_rgb(var(--color-accent)/0.6)]'
            : 'text-content-muted hover:bg-surface-hover hover:text-content',
      )}
    >
      {icon}
      {label}
    </button>
  );
}
