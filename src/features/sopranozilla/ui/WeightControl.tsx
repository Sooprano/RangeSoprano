// The whole selected table row («Top pair») at once: its weight and its suits.
// It edits WHAT THE GRID SHOWS (D124): with «Lo que sigue en «Bet 33%»» the %
// of the category that continues; with «Rango preflop» / «al empezar» the
// weight of its combos in the range (100 = as it was). Before it always edited
// the continuation, so with the grid on the preflop range nothing changed.
// The brush (`GridEditBar`) is only for painting cells.

import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

const CHIPS = [0, 25, 50, 75, 100] as const;

type Props = {
  /** The selected table row ("Top pair"), or null when none is selected. */
  targetLabel: string | null;
  /** What the value means, e.g. "qué % sigue en «Bet 33%»". */
  meaning: ReactNode;
  value: number;
  onChange: (value: number) => void;
  /** Extra controls for the selected row (suit filter). */
  children?: ReactNode;
};

export function WeightControl({ targetLabel, meaning, value, onChange, children }: Props) {
  const disabled = targetLabel === null;
  return (
    <div
      className={cn(
        'mt-3 rounded-xl border bg-surface/40 p-3',
        disabled ? 'border-border' : 'border-violet-400/60',
      )}
    >
      <p className="mb-2 text-xs text-content-muted">
        {targetLabel ? (
          <>
            Toda la categoría <span className="font-medium text-content">«{targetLabel}»</span>:{' '}
            {meaning}
          </>
        ) : (
          <>
            Toca una fila de la tabla (ej. Top pair) para cambiar toda la categoría de una vez: su
            peso y sus palos.
          </>
        )}
      </p>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={`Peso de ${targetLabel ?? 'la categoría'}`}
          className="w-full accent-violet-500 disabled:opacity-40"
        />
        <span className="w-9 text-right text-sm tabular-nums">{disabled ? '—' : value}</span>
      </div>
      <div className="mt-2 flex gap-1.5">
        {CHIPS.map((c) => (
          <button
            key={c}
            type="button"
            disabled={disabled}
            aria-pressed={!disabled && value === c}
            onClick={() => onChange(c)}
            className={cn(
              'flex-1 rounded-md border px-1 py-1 text-xs tabular-nums focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light disabled:opacity-40',
              !disabled && value === c
                ? 'border-violet-500 bg-violet-500/15 text-content'
                : 'border-border text-content-muted hover:bg-surface-hover',
            )}
          >
            {c}
          </button>
        ))}
      </div>
      {!disabled && children}
    </div>
  );
}
