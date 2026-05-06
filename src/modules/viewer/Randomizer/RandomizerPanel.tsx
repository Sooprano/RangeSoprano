import { useCallback, useEffect, useRef, useState } from 'react';
import { Dices, Eye, EyeOff, Pause, Play, RotateCcw, Settings } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useRandomizerStore } from '@/store/randomizerStore';
import { rollOnce } from '@/utils/randomizer';
import {
  RANDOMIZER_FREQUENCIES,
  RANDOMIZER_SETS_COUNT,
  type RandomizerFrequency,
  type RandomizerPreset,
} from '@/store/schemas';

export function RandomizerPanel() {
  const sets = useRandomizerStore((s) => s.sets);
  const activeSet = useRandomizerStore((s) => s.activeSet);
  const setActiveSet = useRandomizerStore((s) => s.setActiveSet);
  const updatePreset = useRandomizerStore((s) => s.updatePreset);
  const updateSetLabel = useRandomizerStore((s) => s.updateSetLabel);
  const resetActiveSet = useRandomizerStore((s) => s.resetActiveSetToDefaults);
  const frequency = useRandomizerStore((s) => s.frequency);
  const setFrequency = useRandomizerStore((s) => s.setFrequency);
  const autoEnabled = useRandomizerStore((s) => s.autoEnabled);
  const toggleAutoEnabled = useRandomizerStore((s) => s.toggleAutoEnabled);
  const highlightEnabled = useRandomizerStore((s) => s.highlightEnabled);
  const toggleHighlightEnabled = useRandomizerStore(
    (s) => s.toggleHighlightEnabled,
  );
  const lastValues = useRandomizerStore((s) => s.lastValues);
  const pushRoll = useRandomizerStore((s) => s.pushRoll);

  const activeSetData = sets[activeSet] ?? sets[0]!;

  const [configOpen, setConfigOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const handleRoll = useCallback(() => {
    pushRoll([rollOnce()]);
  }, [pushRoll]);

  const rollRef = useRef(handleRoll);
  useEffect(() => {
    rollRef.current = handleRoll;
  }, [handleRoll]);

  // Auto loop
  useEffect(() => {
    if (!autoEnabled) return;
    const id = window.setInterval(() => rollRef.current(), frequency);
    return () => window.clearInterval(id);
  }, [autoEnabled, frequency]);

  // Keyboard shortcuts: Espacio = tirar, A = toggle auto. Always-on while
  // mounted (panel is permanent). Ignored while focusing inputs/grids.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Escape' && configOpen) {
        setConfigOpen(false);
        return;
      }
      const target = e.target as HTMLElement | null;
      if (
        target?.closest(
          'input, textarea, select, [contenteditable="true"], [role="grid"]',
        )
      ) {
        return;
      }
      if (e.key === ' ') {
        e.preventDefault();
        rollRef.current();
        return;
      }
      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        toggleAutoEnabled();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleAutoEnabled, configOpen]);

  // Click outside the config popover closes it (the main card stays visible).
  useEffect(() => {
    if (!configOpen) return;
    const handler = (e: MouseEvent) => {
      const wrap = wrapperRef.current;
      if (!wrap) return;
      if (e.target instanceof Node && wrap.contains(e.target)) return;
      setConfigOpen(false);
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [configOpen]);

  const lastValue = lastValues[0] ?? null;
  const summaryText = lastValue === null ? '—' : String(lastValue);

  return (
    <div ref={wrapperRef} className="relative w-[420px] max-w-full">
      <section
        aria-label="Randomizador"
        className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-2.5 shadow-surface"
      >
        {/* Row 1 — presets pill row, mirrors the legacy GTO Randomizer button strip */}
        <div className="flex items-center gap-1">
          {activeSetData.presets.map((p) => (
            <PresetChip
              key={p.id}
              preset={p}
              matched={
                highlightEnabled &&
                lastValue !== null &&
                lastValue <= p.value
              }
            />
          ))}
        </div>

        {/* Row 2 — Tirar · valor · Auto */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRoll}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
            title="Tirar (Espacio)"
          >
            <Dices className="h-4 w-4" strokeWidth={2.25} />
            Tirar
          </button>

          <div className="flex min-w-0 flex-1 items-center justify-center rounded-lg border border-border bg-bg/60 px-2 py-1">
            <span
              className={cn(
                'font-mono text-3xl font-bold leading-none tabular-nums',
                lastValue === null ? 'text-content-disabled' : 'text-amber-200',
              )}
            >
              {summaryText}
            </span>
          </div>

          <button
            type="button"
            onClick={toggleAutoEnabled}
            aria-pressed={autoEnabled}
            title={autoEnabled ? 'Detener auto (A)' : 'Iniciar auto (A)'}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-sm font-medium transition-colors',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light',
              autoEnabled
                ? 'border-amber-500/60 bg-amber-500/15 text-amber-200'
                : 'border-border bg-surface/40 text-content-muted hover:bg-surface-hover hover:text-content',
            )}
          >
            {autoEnabled ? (
              <Pause className="h-4 w-4" strokeWidth={2.25} />
            ) : (
              <Play className="h-4 w-4" strokeWidth={2.25} />
            )}
          </button>
        </div>

        {/* Row 3 — Set tabs · gear */}
        <div className="flex items-center justify-between gap-2">
          <SetTabs
            activeSet={activeSet}
            sets={sets}
            onSelect={setActiveSet}
          />
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleHighlightEnabled}
              aria-pressed={highlightEnabled}
              title={
                highlightEnabled
                  ? 'Ocultar resaltado de presets'
                  : 'Mostrar resaltado de presets'
              }
              className={cn(
                'inline-flex items-center gap-1 rounded-md border px-1.5 py-1 text-[11px] font-medium transition-colors',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light',
                highlightEnabled
                  ? 'border-success/50 bg-success/10 text-success'
                  : 'border-border bg-surface/40 text-content-muted hover:bg-surface-hover hover:text-content',
              )}
            >
              {highlightEnabled ? (
                <Eye className="h-3.5 w-3.5" strokeWidth={2.25} />
              ) : (
                <EyeOff className="h-3.5 w-3.5" strokeWidth={2.25} />
              )}
            </button>
            <button
              type="button"
              onClick={() => setConfigOpen((v) => !v)}
              aria-pressed={configOpen}
              aria-expanded={configOpen}
              title="Configuración"
              className={cn(
                'inline-flex items-center gap-1 rounded-md border px-1.5 py-1 text-[11px] font-medium transition-colors',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light',
                configOpen
                  ? 'border-accent/60 bg-accent/10 text-content'
                  : 'border-border bg-surface/40 text-content-muted hover:bg-surface-hover hover:text-content',
              )}
            >
              <Settings className="h-3.5 w-3.5" strokeWidth={2.25} />
            </button>
          </div>
        </div>
      </section>

      {configOpen && (
        <div
          role="dialog"
          aria-label="Configuración del randomizador"
          className="absolute right-0 top-full z-30 mt-2 flex w-[380px] max-w-[calc(100vw-2rem)] flex-col gap-3 rounded-xl border border-border bg-surface p-3 shadow-[0_8px_32px_rgb(0_0_0/0.4)]"
        >
          <ConfigSection title="Frecuencia">
            <SelectLabel label="Frecuencia auto">
              <select
                value={frequency}
                onChange={(e) =>
                  setFrequency(Number(e.target.value) as RandomizerFrequency)
                }
                className="rounded-md border border-border bg-bg px-1.5 py-0.5 text-xs text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
              >
                {RANDOMIZER_FREQUENCIES.map((f) => (
                  <option key={f} value={f}>
                    {formatFrequency(f)}
                  </option>
                ))}
              </select>
            </SelectLabel>
          </ConfigSection>

          <ConfigSection
            title={`Editar ${activeSetData.label || `Set ${activeSet + 1}`}`}
            action={
              <button
                type="button"
                onClick={resetActiveSet}
                title="Restaurar valores por defecto del set activo"
                className="inline-flex items-center gap-1 rounded-md border border-border bg-surface/40 px-1.5 py-0.5 text-[10px] font-medium text-content-muted transition-colors hover:bg-surface-hover hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
              >
                <RotateCcw className="h-3 w-3" strokeWidth={2.25} />
                Restaurar
              </button>
            }
          >
            <label className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-wider text-content-muted">
              Nombre del set
              <input
                type="text"
                value={activeSetData.label}
                maxLength={24}
                onChange={(e) => updateSetLabel(activeSet, e.target.value)}
                className="flex-1 rounded-md border border-border bg-bg px-2 py-1 text-xs normal-case tracking-normal text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              {activeSetData.presets.map((p, i) => (
                <PresetEditor
                  key={p.id}
                  preset={p}
                  onChange={(patch) => updatePreset(activeSet, i, patch)}
                />
              ))}
            </div>
          </ConfigSection>

          <p className="text-[10px] text-content-muted">
            <kbd className="rounded bg-bg px-1">Espacio</kbd> tirar ·{' '}
            <kbd className="rounded bg-bg px-1">A</kbd> auto ·{' '}
            <kbd className="rounded bg-bg px-1">Esc</kbd> cerrar
          </p>
        </div>
      )}
    </div>
  );
}

function PresetChip({
  preset,
  matched,
}: {
  preset: RandomizerPreset;
  matched: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-1 items-center justify-center rounded-md border px-1 py-1 text-xs font-semibold transition-colors',
        matched
          ? 'border-success/60 bg-success/15 text-content'
          : 'border-border bg-surface/40 text-content-muted',
      )}
      title={`≤ ${preset.value}`}
    >
      <span className="truncate">{preset.label}</span>
    </div>
  );
}

function SetTabs({
  activeSet,
  sets,
  onSelect,
}: {
  activeSet: number;
  sets: { label: string }[];
  onSelect: (idx: number) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Conjunto de presets"
      className="inline-flex items-center gap-1 rounded-md border border-border bg-bg/40 p-0.5"
    >
      {Array.from({ length: RANDOMIZER_SETS_COUNT }).map((_, i) => {
        const active = i === activeSet;
        const label = sets[i]?.label || `Set ${i + 1}`;
        return (
          <button
            key={i}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onSelect(i)}
            className={cn(
              'inline-flex min-w-[40px] items-center justify-center rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light',
              active
                ? 'bg-surface text-content shadow-[inset_0_0_0_1px_rgb(var(--color-accent)/0.6)]'
                : 'text-content-muted hover:bg-surface-hover hover:text-content',
            )}
          >
            {label.length > 8 ? label.slice(0, 8) + '…' : label}
          </button>
        );
      })}
    </div>
  );
}

function ConfigSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-1.5">
      <header className="flex items-center justify-between gap-2">
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-content-muted">
          {title}
        </h4>
        {action}
      </header>
      <div>{children}</div>
    </section>
  );
}

function PresetEditor({
  preset,
  onChange,
}: {
  preset: RandomizerPreset;
  onChange: (patch: Partial<Pick<RandomizerPreset, 'label' | 'value'>>) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-accent/40 bg-accent/5 p-2">
      <label className="flex flex-col gap-0.5">
        <span className="text-[9px] uppercase tracking-wider text-content-muted">
          Etiqueta
        </span>
        <input
          type="text"
          value={preset.label}
          maxLength={24}
          onChange={(e) => onChange({ label: e.target.value })}
          className="rounded-md border border-border bg-bg px-1.5 py-0.5 text-xs text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
        />
      </label>
      <label className="flex items-center gap-1.5">
        <span className="text-[9px] uppercase tracking-wider text-content-muted">
          Valor
        </span>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={100}
          value={preset.value}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v)) onChange({ value: v });
          }}
          className="w-14 rounded-md border border-border bg-bg px-1.5 py-0.5 text-right font-mono text-xs tabular-nums text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
        />
        <span className="text-[10px] text-content-muted">/ 100</span>
      </label>
    </div>
  );
}

function SelectLabel({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-content-muted">
      {label}
      {children}
    </label>
  );
}

function formatFrequency(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${ms / 1000} s`;
}
