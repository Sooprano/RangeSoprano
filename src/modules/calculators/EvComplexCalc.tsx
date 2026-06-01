import { useMemo, useState } from 'react';
import { evComplex } from '@/utils/ev';
import {
  FormulaDetails,
  NumberField,
  ReadOnlyField,
  ResultCard,
  evInterpretation,
  formatCurrency,
  parseField,
} from './CalcShared';

export function EvComplexCalc() {
  const [foldPct, setFoldPct] = useState('60');
  const [currentPot, setCurrentPot] = useState('100');
  const [winAmount, setWinAmount] = useState('150');
  const [winPct, setWinPct] = useState('40');
  const [loseAmount, setLoseAmount] = useState('100');

  const fNum = parseField(foldPct, { min: 0, max: 100 });
  const potNum = parseField(currentPot, { min: 0 });
  const wNum = parseField(winAmount, { min: 0 });
  const wpNum = parseField(winPct, { min: 0, max: 100 });
  const lNum = parseField(loseAmount, { min: 0 });

  const callPctDisplay = fNum !== null ? (100 - fNum).toFixed(1) : '—';
  const losePctDisplay = wpNum !== null ? (100 - wpNum).toFixed(1) : '—';

  const result = useMemo(() => {
    if (
      fNum === null ||
      potNum === null ||
      wNum === null ||
      wpNum === null ||
      lNum === null
    ) {
      return null;
    }
    return evComplex({
      foldPct: fNum,
      currentPot: potNum,
      winAmount: wNum,
      winPct: wpNum,
      loseAmount: lNum,
    });
  }, [fNum, potNum, wNum, wpNum, lNum]);

  const tone =
    result === null ? 'neutral' : result > 0 ? 'positive' : result < 0 ? 'negative' : 'neutral';
  const display = result === null ? '—' : formatCurrency(result);

  const formula = 'EV = F% · Pot + C% · ($W · W% − $L · L%)';
  const substituted =
    fNum !== null && potNum !== null && wNum !== null && wpNum !== null && lNum !== null
      ? `${(fNum / 100).toFixed(2)} · ${potNum} + ${((100 - fNum) / 100).toFixed(2)} · (${wNum} · ${(wpNum / 100).toFixed(2)} − ${lNum} · ${((100 - wpNum) / 100).toFixed(2)})`
      : '—';
  const resultStr = result !== null ? formatCurrency(result) : '—';

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-xl border border-border bg-surface/40 p-5">
        <h2 className="mb-1 text-base font-semibold text-content">
          EV con fold equity
        </h2>
        <p className="mb-4 text-sm text-content-muted">
          EV de una apuesta o all-in que combina fold equity (F% — frecuencia
          con que el villano se tira y te llevás el pot muerto) con showdown
          equity cuando te paga (W% / L%). Útil para semi-bluffs y shoves.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField
            id="evc-fold-pct"
            label="F% — Frecuencia con que el villano se tira"
            value={foldPct}
            onChange={setFoldPct}
            suffix="%"
            min={0}
            max={100}
            step={1}
            invalid={foldPct.trim() !== '' && fNum === null}
          />
          <ReadOnlyField
            label="C% — Frecuencia con que te paga"
            display={callPctDisplay}
            suffix="%"
            hint="Se calcula como 100% − F%"
          />
          <NumberField
            id="evc-pot"
            label="Pot actual — antes de tu apuesta"
            value={currentPot}
            onChange={setCurrentPot}
            prefix="$"
            min={0}
            step={1}
            invalid={currentPot.trim() !== '' && potNum === null}
            hint="Lo que ya hay en el bote sin contar tu apuesta de ahora"
          />
          <div />
          <NumberField
            id="evc-win-amount"
            label="$W — Cuando te pagan y ganás"
            value={winAmount}
            onChange={setWinAmount}
            prefix="$"
            min={0}
            step={1}
            invalid={winAmount.trim() !== '' && wNum === null}
            hint="Pot + call del villano (no contás tu propia apuesta)"
          />
          <NumberField
            id="evc-win-pct"
            label="W% — Equity cuando te pagan"
            value={winPct}
            onChange={setWinPct}
            suffix="%"
            min={0}
            max={100}
            step={1}
            invalid={winPct.trim() !== '' && wpNum === null}
          />
          <NumberField
            id="evc-lose-amount"
            label="$L — Cuando te pagan y perdés"
            value={loseAmount}
            onChange={setLoseAmount}
            prefix="$"
            min={0}
            step={1}
            invalid={loseAmount.trim() !== '' && lNum === null}
            hint="Tu apuesta perdida"
          />
          <ReadOnlyField
            label="L% — Frecuencia de pérdida"
            display={losePctDisplay}
            suffix="%"
            hint="Se calcula como 100% − W%"
          />
        </div>
      </section>

      <ResultCard
        label="EV ="
        display={display}
        tone={tone}
        {...(result !== null ? { caption: evInterpretation(result) } : {})}
      />

      <FormulaDetails
        formula={formula}
        substituted={substituted}
        result={resultStr}
      />
    </div>
  );
}
