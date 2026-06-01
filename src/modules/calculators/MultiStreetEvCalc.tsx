import { useMemo, useState } from 'react';
import { multiStreetEv } from '@/utils/ev';
import {
  FormulaDetails,
  NumberField,
  ReadOnlyField,
  ResultCard,
  evInterpretation,
  formatCurrency,
  parseField,
} from './CalcShared';

export function MultiStreetEvCalc() {
  const [evTurn, setEvTurn] = useState('5.18');
  const [seeRiverPct, setSeeRiverPct] = useState('60');
  const [evRiver, setEvRiver] = useState('-81.4');

  const turnNum = parseField(evTurn); // permite negativos
  const seeNum = parseField(seeRiverPct, { min: 0, max: 100 });
  const riverNum = parseField(evRiver); // permite negativos

  const result = useMemo(() => {
    if (turnNum === null || seeNum === null || riverNum === null) return null;
    return multiStreetEv({
      evTurn: turnNum,
      seeRiverPct: seeNum,
      evRiver: riverNum,
    });
  }, [turnNum, seeNum, riverNum]);

  const allValid = turnNum !== null && seeNum !== null && riverNum !== null;

  const tone =
    result === null ? 'neutral' : result > 0 ? 'positive' : result < 0 ? 'negative' : 'neutral';
  const display = result === null ? '—' : formatCurrency(result);

  const riverContribDisplay =
    seeNum !== null && riverNum !== null
      ? formatCurrency((seeNum / 100) * riverNum)
      : '—';

  const formula = 'EV total = EV turn + P(ver river) · EV river';
  const substituted = allValid
    ? `${turnNum} + ${(seeNum / 100).toFixed(2)} · ${riverNum}`
    : '—';
  const resultStr = result === null ? '—' : formatCurrency(result);

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-xl border border-border bg-surface/40 p-5">
        <h2 className="mb-1 text-base font-semibold text-content">
          EV conjunto multi-calle
        </h2>
        <p className="mb-4 text-sm text-content-muted">
          Encadena el EV de dos calles para ver si la línea completa es rentable.
          Una apuesta en el turn puede ser −EV por sí sola, pero si solo a veces se
          ve el river, la jugada conjunta puede cambiar. Calculá el EV de cada
          calle en las otras herramientas y traélo acá.
        </p>

        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField
            id="ms-turn"
            label="EV del turn"
            value={evTurn}
            onChange={setEvTurn}
            prefix="$"
            step={1}
            invalid={evTurn.trim() !== '' && turnNum === null}
            hint="EV de tu acción en el turn (puede ser negativo)"
          />
          <NumberField
            id="ms-see"
            label="% que se ve el river"
            value={seeRiverPct}
            onChange={setSeeRiverPct}
            suffix="%"
            min={0}
            max={100}
            step={1}
            invalid={seeRiverPct.trim() !== '' && seeNum === null}
            hint="Cada cuánto la mano llega al river"
          />
          <NumberField
            id="ms-river"
            label="EV del river"
            value={evRiver}
            onChange={setEvRiver}
            prefix="$"
            step={1}
            invalid={evRiver.trim() !== '' && riverNum === null}
            hint="EV de tu acción en el river (condicional a llegar)"
          />
        </div>

        <div className="mt-4 max-w-xs">
          <ReadOnlyField
            label="Aporte del river"
            display={riverContribDisplay}
            hint="P(ver river) · EV river — lo que el river suma o resta al total"
          />
        </div>
      </section>

      <ResultCard
        label="EV total ="
        display={display}
        tone={tone}
        {...(result !== null ? { caption: evInterpretation(result) } : {})}
      />

      <section className="rounded-xl border border-border bg-surface/40 p-5">
        <h3 className="mb-3 text-sm font-semibold text-content">Fórmula</h3>
        <FormulaDetails
          formula={formula}
          substituted={substituted}
          result={resultStr}
        />
      </section>
    </div>
  );
}
