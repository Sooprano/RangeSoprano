import { useMemo, useState } from 'react';
import { evBasic } from '@/utils/ev';
import {
  FormulaDetails,
  NumberField,
  ReadOnlyField,
  ResultCard,
  formatCurrency,
  parseField,
} from './CalcShared';

export function EvBasicCalc() {
  const [winAmount, setWinAmount] = useState('800');
  const [winPct, setWinPct] = useState('67');
  const [loseAmount, setLoseAmount] = useState('475');

  const wNum = parseField(winAmount, { min: 0 });
  const wpNum = parseField(winPct, { min: 0, max: 100 });
  const lNum = parseField(loseAmount, { min: 0 });

  const losePctDisplay = wpNum !== null ? (100 - wpNum).toFixed(1) : '—';

  const result = useMemo(() => {
    if (wNum === null || wpNum === null || lNum === null) return null;
    return evBasic({ winAmount: wNum, winPct: wpNum, loseAmount: lNum });
  }, [wNum, wpNum, lNum]);

  const tone =
    result === null ? 'neutral' : result > 0 ? 'positive' : result < 0 ? 'negative' : 'neutral';
  const display = result === null ? '—' : formatCurrency(result);

  const formula = 'EV = $W · W% − $L · L%';
  const substituted =
    wNum !== null && wpNum !== null && lNum !== null
      ? `${wNum} · ${(wpNum / 100).toFixed(2)} − ${lNum} · ${((100 - wpNum) / 100).toFixed(2)}`
      : '—';
  const resultStr = result !== null ? formatCurrency(result) : '—';

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-xl border border-border bg-surface/40 p-5">
        <h2 className="mb-1 text-base font-semibold text-content">EV básico</h2>
        <p className="mb-4 text-sm text-content-muted">
          Cuánto ganás en promedio en una decisión binaria: cuando ganás
          embolsás $W con probabilidad W%; cuando perdés tirás $L con
          probabilidad L% (= 100% − W%).
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField
            id="evb-win-amount"
            label="$W — Cuando ganás, ¿cuánto ganás?"
            value={winAmount}
            onChange={setWinAmount}
            prefix="$"
            min={0}
            step={1}
            invalid={winAmount.trim() !== '' && wNum === null}
          />
          <NumberField
            id="evb-win-pct"
            label="W% — ¿Con qué frecuencia ganás?"
            value={winPct}
            onChange={setWinPct}
            suffix="%"
            min={0}
            max={100}
            step={1}
            invalid={winPct.trim() !== '' && wpNum === null}
          />
          <NumberField
            id="evb-lose-amount"
            label="$L — Cuando perdés, ¿cuánto perdés?"
            value={loseAmount}
            onChange={setLoseAmount}
            prefix="$"
            min={0}
            step={1}
            invalid={loseAmount.trim() !== '' && lNum === null}
          />
          <ReadOnlyField
            label="L% — Frecuencia de pérdida"
            display={losePctDisplay}
            suffix="%"
            hint="Se calcula como 100% − W%"
          />
        </div>
      </section>

      <ResultCard label="EV =" display={display} tone={tone} />

      <FormulaDetails
        formula={formula}
        substituted={substituted}
        result={resultStr}
      />
    </div>
  );
}
