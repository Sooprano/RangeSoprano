import { useMemo, useState } from 'react';
import { combinedFoldEquity } from '@/utils/ev';
import {
  FormulaDetails,
  NumberField,
  ResultCard,
  formatPct,
  parseField,
} from './CalcShared';

export function CombinedFoldEquityCalc() {
  const [folds, setFolds] = useState<string[]>(['72', '53', '', '', '', '']);

  const parsed = folds.map((v) => parseField(v, { min: 0, max: 100 }));
  const activeCount = parsed.filter((p) => p !== null).length;

  const result = useMemo(() => combinedFoldEquity(parsed), [folds]); // eslint-disable-line react-hooks/exhaustive-deps

  const display = result === null ? '—' : formatPct(result);
  const tone: 'positive' | 'negative' | 'neutral' = 'neutral';

  const setPlayer = (idx: number, next: string) => {
    setFolds((prev) => prev.map((v, i) => (i === idx ? next : v)));
  };

  const formula = 'Combined fold% = ∏ fold_i (sólo jugadores con dato)';
  const substituted =
    activeCount === 0
      ? '—'
      : parsed
          .filter((p): p is number => p !== null)
          .map((p) => `${(p / 100).toFixed(2)}`)
          .join(' · ');
  const resultStr = result === null ? '—' : formatPct(result);

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-xl border border-border bg-surface/40 p-5">
        <h2 className="mb-1 text-base font-semibold text-content">
          Fold equity combinada (multi-way)
        </h2>
        <p className="mb-4 text-sm text-content-muted">
          Probabilidad de que <span className="font-medium text-content">todos</span> los
          villanos se tiren. Útil para evaluar si un bluff o shove pasa cuando hay
          varios jugadores por hablar. Ingresá el fold% de cada uno — los que dejes
          vacíos se ignoran.
        </p>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {folds.map((value, idx) => (
            <NumberField
              key={idx}
              id={`cfe-player-${idx + 1}`}
              label={`Jugador ${idx + 1} — fold%`}
              value={value}
              onChange={(next) => setPlayer(idx, next)}
              suffix="%"
              min={0}
              max={100}
              step={1}
              invalid={value.trim() !== '' && parsed[idx] === null}
            />
          ))}
        </div>

        <p className="mt-3 text-[11px] text-content-disabled">
          {activeCount === 0
            ? 'Cargá al menos un jugador para ver el resultado.'
            : `${activeCount} jugador${activeCount === 1 ? '' : 'es'} con dato — el resto se ignora.`}
        </p>
      </section>

      <ResultCard
        label="Todos foldean"
        display={display}
        tone={tone}
        caption={
          result !== null && activeCount >= 2 ? (
            <span>
              Probabilidad de que los {activeCount} villanos cuyo fold% ingresaste
              se tiren todos al mismo tiempo.
            </span>
          ) : null
        }
      />

      <FormulaDetails
        formula={formula}
        substituted={substituted}
        result={resultStr}
      />
    </div>
  );
}
