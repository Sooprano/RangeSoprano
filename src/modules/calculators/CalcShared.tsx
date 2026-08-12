import { createContext, useCallback, useContext, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type FieldState = {
  value: string;
  num: number | null;
};

/**
 * Unit every monetary amount of a calc is rendered in. One of the two sides is
 * empty: a currency goes before the number ('$120', '€120') and a stack unit
 * goes after it ('6 BB').
 *
 * The default is the plain '$' of /calculadoras, so a calc rendered outside a
 * provider looks exactly as it always did. The /analisis worksheet wraps the
 * inline calc in a provider to show the hand's real currency — or BB, when the
 * user flips the Fichas/BB toggle (the seeded amounts are divided by the big
 * blind there, so only the label has to follow).
 */
export type MoneyUnit = { prefix: string; suffix: string };

const DEFAULT_MONEY_UNIT: MoneyUnit = { prefix: '$', suffix: '' };

const MoneyUnitContext = createContext<MoneyUnit>(DEFAULT_MONEY_UNIT);

export function MoneyUnitProvider({
  unit,
  children,
}: {
  unit: MoneyUnit;
  children: ReactNode;
}) {
  return (
    <MoneyUnitContext.Provider value={unit}>{children}</MoneyUnitContext.Provider>
  );
}

function formatAmount(n: number, unit: MoneyUnit): string {
  const rounded = Math.round(n * 100) / 100;
  const abs = Math.abs(rounded).toFixed(2);
  const trimmed = abs.replace(/\.?0+$/, '') || '0';
  const sign = rounded < 0 ? '−' : '';
  return unit.suffix
    ? `${sign}${unit.prefix}${trimmed} ${unit.suffix}`
    : `${sign}${unit.prefix}${trimmed}`;
}

/**
 * Formats an amount in the ambient unit. Use this inside a calc instead of
 * `formatCurrency` so the number carries the right symbol when the calc is
 * embedded in the análisis worksheet.
 */
export function useMoney(): (n: number) => string {
  const unit = useContext(MoneyUnitContext);
  return useCallback((n: number) => formatAmount(n, unit), [unit]);
}

export function parseField(
  value: string,
  opts?: { min?: number; max?: number },
): number | null {
  if (value.trim() === '') return null;
  const n = parseFloat(value);
  if (!Number.isFinite(n)) return null;
  if (opts?.min !== undefined && n < opts.min) return null;
  if (opts?.max !== undefined && n > opts.max) return null;
  return n;
}

/** Amount in the default '$' unit. For calc internals prefer `useMoney()`. */
export function formatCurrency(n: number): string {
  return formatAmount(n, DEFAULT_MONEY_UNIT);
}

export function formatPct(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return `${rounded}%`;
}

// Línea de interpretación de un EV en dinero, para que se lea cómo afecta a largo plazo.
// `format` permite pasar el `useMoney()` de la calc (€ o BB en /analisis).
export function evInterpretation(
  ev: number,
  format: (n: number) => string = formatCurrency,
): string {
  if (Math.abs(ev) < 0.005) {
    return 'Es break-even: en promedio ni ganas ni pierdes con esta jugada.';
  }
  const abs = format(Math.abs(ev));
  return ev > 0
    ? `A largo plazo ganas ${abs} en promedio cada vez que tomas esta decisión (+EV).`
    : `A largo plazo pierdes ${abs} en promedio cada vez que tomas esta decisión (−EV).`;
}

export function NumberField({
  id,
  label,
  hint,
  value,
  onChange,
  prefix,
  suffix,
  min,
  max,
  step,
  invalid,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (next: string) => void;
  prefix?: string;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
  invalid?: boolean;
}) {
  // `prefix="$"` marks the field as monetary: the symbol actually shown comes
  // from the ambient MoneyUnit ('$' by default, '€' o 'BB' en /analisis). No
  // money field carries a suffix of its own, so BB can borrow that slot.
  const unit = useContext(MoneyUnitContext);
  const isMoney = prefix === '$';
  const shownPrefix = isMoney ? unit.prefix : prefix;
  const shownSuffix = isMoney && unit.suffix ? unit.suffix : suffix;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-content-muted">
        {label}
      </label>
      <div
        className={cn(
          'flex items-center gap-1.5 rounded-lg border bg-surface/60 px-2.5 py-1.5',
          'focus-within:border-accent/60 focus-within:ring-1 focus-within:ring-accent/40',
          invalid ? 'border-rose-500/50' : 'border-border',
        )}
      >
        {shownPrefix && (
          <span className="text-sm text-content-muted">{shownPrefix}</span>
        )}
        <input
          id={id}
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          min={min}
          max={max}
          step={step}
          className="w-full bg-transparent text-sm tabular-nums text-content outline-none placeholder:text-content-disabled"
        />
        {shownSuffix && (
          <span className="text-sm text-content-muted">{shownSuffix}</span>
        )}
      </div>
      {hint && <p className="text-[11px] text-content-disabled">{hint}</p>}
    </div>
  );
}

export function ReadOnlyField({
  label,
  display,
  hint,
  suffix,
}: {
  label: string;
  display: string;
  hint?: string;
  suffix?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-content-muted">{label}</span>
      <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface/30 px-2.5 py-1.5">
        <span className="w-full text-sm tabular-nums text-content-muted">
          {display}
        </span>
        {suffix && (
          <span className="text-sm text-content-disabled">{suffix}</span>
        )}
      </div>
      {hint && <p className="text-[11px] text-content-disabled">{hint}</p>}
    </div>
  );
}

export function ResultCard({
  label,
  display,
  tone,
  caption,
}: {
  label: string;
  display: string;
  tone: 'positive' | 'negative' | 'neutral';
  caption?: ReactNode;
}) {
  const toneClasses =
    tone === 'positive'
      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
      : tone === 'negative'
        ? 'border-rose-500/40 bg-rose-500/10 text-rose-200'
        : 'border-border bg-surface/40 text-content-muted';
  return (
    <div
      className={cn(
        'flex flex-col gap-1 rounded-xl border px-4 py-3',
        toneClasses,
      )}
    >
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-content-muted">
          {label}
        </span>
        <span className="font-mono text-2xl font-bold tabular-nums">
          {display}
        </span>
      </div>
      {caption && (
        <div className="text-xs text-content-muted">{caption}</div>
      )}
    </div>
  );
}

export function FormulaDetails({
  formula,
  substituted,
  result,
}: {
  formula: string;
  substituted: string;
  result: string;
}) {
  return (
    <details className="group rounded-lg border border-border bg-surface/30 px-3 py-2 text-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-medium text-content">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
        Cómo se calcula
      </summary>
      <div className="mt-2 flex flex-col gap-1 font-mono text-xs text-content-muted">
        <div>
          <span className="text-content-disabled">Fórmula · </span>
          {formula}
        </div>
        <div>
          <span className="text-content-disabled">Valores · </span>
          {substituted}
        </div>
        <div>
          <span className="text-content-disabled">Resultado · </span>
          <span className="font-semibold text-content">{result}</span>
        </div>
      </div>
    </details>
  );
}
