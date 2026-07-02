// Shared presentational pieces for the /ejercicios drills. Each drill keeps its
// own question/answer logic and FeedbackPanel (they differ), but the score bar
// and auto-advance toggle are identical across drills. Score model + timing
// constants live in `drillScore.ts` (no JSX) so this file only exports
// components.

import { Calculator, ChevronDown, Trophy } from 'lucide-react';
import { cn } from '@/lib/cn';
import { AUTO_ADVANCE_MS, STREAK_BONUS_THRESHOLD, type Score } from './drillScore';

export function ScoreBar({ score, accuracy }: { score: Score; accuracy: number }) {
  const streakHot = score.streak >= STREAK_BONUS_THRESHOLD;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat label="Precisión" value={`${accuracy.toFixed(0)}%`} />
      <Stat label="Correctas" value={`${score.correct} / ${score.total}`} />
      <Stat
        label="Racha"
        value={String(score.streak)}
        accent={streakHot}
        {...(streakHot && {
          icon: <Trophy className="h-4 w-4" strokeWidth={2.5} />,
        })}
      />
      <Stat label="Mejor racha" value={String(score.bestStreak)} />
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: string;
  accent?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border px-3 py-2 transition-colors',
        accent ? 'border-amber-500/60 bg-amber-500/10' : 'border-border bg-surface/40',
      )}
    >
      <p
        className={cn(
          'text-[10px] uppercase tracking-wider',
          accent ? 'text-amber-300' : 'text-content-muted',
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          'flex items-center gap-1.5 text-lg font-semibold tabular-nums',
          accent ? 'text-amber-200' : 'text-content',
        )}
      >
        {icon && <span aria-hidden>{icon}</span>}
        <span>{value}</span>
      </p>
    </div>
  );
}

/**
 * Collapsible "see the math" panel shared by the drills: a toggle button plus
 * the seeded calculator (passed as children, only mounted when open so the seed
 * re-applies each time). Drills render this AFTER answering so it doesn't spoil
 * the answer, and pause auto-advance while it's open.
 */
export function CalcReveal({
  open,
  onToggle,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={cn(
          'inline-flex items-center justify-center gap-1.5 self-center rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light',
          open
            ? 'border-accent/60 bg-accent/10 text-content'
            : 'border-border bg-surface/40 text-content-muted hover:bg-surface-hover hover:text-content',
        )}
      >
        <Calculator className="h-3.5 w-3.5" strokeWidth={2.25} />
        {open ? 'Ocultar calculadora' : 'Ver el cálculo en la calculadora'}
        <ChevronDown
          className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')}
          strokeWidth={2.25}
        />
      </button>
      {open && (
        <div className="rounded-lg border border-border bg-bg-subtle/60 p-4">
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Fila de chips para filtrar qué tipos de rango entran al drill (multi-select).
 * Minimalista, mismo lenguaje visual que AutoAdvanceToggle. Siempre queda ≥1
 * activo: al intentar apagar el último, se ignora (no hay estado vacío).
 */
export function ChipFilter<T extends string>({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  selected: ReadonlySet<T>;
  onToggle: (value: T) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-content-muted">
        {label}
      </span>
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {options.map(({ value, label: optLabel }) => {
          const on = selected.has(value);
          const isLast = on && selected.size === 1;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={on}
              disabled={isLast}
              onClick={() => onToggle(value)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium',
                'transition-colors duration-150 ease-out-soft',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light',
                isLast && 'cursor-not-allowed',
                on
                  ? 'border-accent/60 bg-accent/10 text-content'
                  : 'border-border bg-surface/40 text-content-muted hover:bg-surface-hover hover:text-content',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'inline-block h-3 w-3 rounded-sm border',
                  on ? 'border-accent bg-accent' : 'border-border bg-surface',
                )}
              />
              {optLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function AutoAdvanceToggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label
      className={cn(
        'inline-flex cursor-pointer items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium',
        'transition-colors duration-150 ease-out-soft',
        'focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent-light',
        value
          ? 'border-accent/60 bg-accent/10 text-content'
          : 'border-border bg-surface/40 text-content-muted hover:bg-surface-hover hover:text-content',
      )}
    >
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span
        aria-hidden
        className={cn(
          'inline-block h-3 w-3 rounded-sm border',
          value ? 'border-accent bg-accent' : 'border-border bg-surface',
        )}
      />
      Auto-avance ({(AUTO_ADVANCE_MS / 1000).toFixed(1)}s)
    </label>
  );
}
