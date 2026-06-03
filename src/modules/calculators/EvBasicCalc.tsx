import { useMemo, useState } from 'react';
import { evBasic } from '@/utils/ev';
import {
  FormulaDetails,
  NumberField,
  ReadOnlyField,
  ResultCard,
  evInterpretation,
  formatCurrency,
  formatPct,
  parseField,
} from './CalcShared';

export function EvBasicCalc({
  initialWinAmount,
  initialWinPct,
  initialLoseAmount,
}: {
  initialWinAmount?: string | undefined;
  initialWinPct?: string | undefined;
  initialLoseAmount?: string | undefined;
} = {}) {
  const [winAmount, setWinAmount] = useState(initialWinAmount ?? '100');
  const [winPct, setWinPct] = useState(initialWinPct ?? '40');
  const [loseAmount, setLoseAmount] = useState(initialLoseAmount ?? '50');

  const wNum = parseField(winAmount, { min: 0 });
  const wpNum = parseField(winPct, { min: 0, max: 100 });
  const lNum = parseField(loseAmount, { min: 0 });

  const losePctDisplay = wpNum !== null ? (100 - wpNum).toFixed(1) : '—';

  const breakevenWDisplay =
    wNum !== null && lNum !== null && wNum + lNum > 0
      ? formatPct((lNum / (wNum + lNum)) * 100)
      : '—';

  const betPctDisplay =
    wNum !== null && lNum !== null && wNum > 0
      ? formatPct((lNum / wNum) * 100)
      : '—';

  const result = useMemo(() => {
    if (wNum === null || wpNum === null || lNum === null) return null;
    return evBasic({ winAmount: wNum, winPct: wpNum, loseAmount: lNum });
  }, [wNum, wpNum, lNum]);

  const tone =
    result === null ? 'neutral' : result > 0 ? 'positive' : result < 0 ? 'negative' : 'neutral';
  const display = result === null ? '—' : formatCurrency(result);

  const formula = 'EV = Pot · %ganar − Apuesta · %perder';
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
          EV de una jugada con dos finales: ganas y te llevas el pot, o pierdes tu
          apuesta. Ingresa el tamaño del pot en juego, cada cuánto esperas ganar y
          lo que arriesgas — sirve para ver si pagar o apostar es rentable a la
          larga.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField
            id="evb-win-amount"
            label="Pot — lo que te llevas si ganas"
            value={winAmount}
            onChange={setWinAmount}
            prefix="$"
            min={0}
            step={1}
            invalid={winAmount.trim() !== '' && wNum === null}
            hint="Lo que está en juego y ganas al sacar la mejor mano"
          />
          <NumberField
            id="evb-win-pct"
            label="% que esperas ganar"
            value={winPct}
            onChange={setWinPct}
            suffix="%"
            min={0}
            max={100}
            step={1}
            invalid={winPct.trim() !== '' && wpNum === null}
            hint="Cada cuánto crees que te llevas el pot"
          />
          <NumberField
            id="evb-lose-amount"
            label="Tu apuesta — lo que arriesgas si pierdes"
            value={loseAmount}
            onChange={setLoseAmount}
            prefix="$"
            min={0}
            step={1}
            invalid={loseAmount.trim() !== '' && lNum === null}
            hint="Tu call o tu bet — lo que pones en riesgo"
          />
          <ReadOnlyField
            label="% que esperas perder"
            display={losePctDisplay}
            suffix="%"
            hint="Se calcula como 100% − % que ganas"
          />
          <ReadOnlyField
            label="Breakeven — equity para EV 0"
            display={breakevenWDisplay}
            hint="Apuesta / (Pot + Apuesta) · necesitas ganar al menos esto para no perder"
          />
          <ReadOnlyField
            label="Tu apuesta como % del pot"
            display={betPctDisplay}
            hint="Apuesta / Pot · qué tan grande es lo que arriesgas vs el pot"
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
