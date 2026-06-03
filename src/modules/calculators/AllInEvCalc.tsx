import { useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import { allInEv } from '@/utils/ev';
import {
  FormulaDetails,
  NumberField,
  ResultCard,
  formatCurrency,
  parseField,
} from './CalcShared';

type Scenario = {
  id: string;
  label: string;
  deltaE: number;
  deltaF: number;
};

const SCENARIOS: readonly Scenario[] = [
  { id: '-10B', label: '−10B', deltaE: -10, deltaF: -10 },
  { id: '-10F', label: '−10F', deltaE: 0, deltaF: -10 },
  { id: '-10E', label: '−10E', deltaE: -10, deltaF: 0 },
  { id: '-5B', label: '−5B', deltaE: -5, deltaF: -5 },
  { id: '-5F', label: '−5F', deltaE: 0, deltaF: -5 },
  { id: '-5E', label: '−5E', deltaE: -5, deltaF: 0 },
  { id: 'actual', label: 'Actual', deltaE: 0, deltaF: 0 },
  { id: '+5E', label: '+5E', deltaE: 5, deltaF: 0 },
  { id: '+5F', label: '+5F', deltaE: 0, deltaF: 5 },
  { id: '+5B', label: '+5B', deltaE: 5, deltaF: 5 },
  { id: '+10E', label: '+10E', deltaE: 10, deltaF: 0 },
  { id: '+10F', label: '+10F', deltaE: 0, deltaF: 10 },
  { id: '+10B', label: '+10B', deltaE: 10, deltaF: 10 },
];

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function AllInEvCalc({
  initialPot,
  initialCall,
  initialShove,
  initialEquityPct,
  initialFoldPct,
}: {
  initialPot?: string | undefined;
  initialCall?: string | undefined;
  initialShove?: string | undefined;
  initialEquityPct?: string | undefined;
  initialFoldPct?: string | undefined;
} = {}) {
  const [pot, setPot] = useState(initialPot ?? '100');
  const [call, setCall] = useState(initialCall ?? '75');
  const [shove, setShove] = useState(initialShove ?? '400');
  const [equityPct, setEquityPct] = useState(initialEquityPct ?? '33');
  const [foldPct, setFoldPct] = useState(initialFoldPct ?? '66');

  const potNum = parseField(pot, { min: 0 });
  const callNum = parseField(call, { min: 0 });
  const shoveNum = parseField(shove, { min: 0 });
  const eqNum = parseField(equityPct, { min: 0, max: 100 });
  const fNum = parseField(foldPct, { min: 0, max: 100 });

  const result = useMemo(() => {
    if (
      potNum === null ||
      callNum === null ||
      shoveNum === null ||
      eqNum === null ||
      fNum === null
    ) {
      return null;
    }
    return allInEv({
      pot: potNum,
      call: callNum,
      shove: shoveNum,
      equityPct: eqNum,
      foldPct: fNum,
    });
  }, [potNum, callNum, shoveNum, eqNum, fNum]);

  const allValid =
    potNum !== null &&
    callNum !== null &&
    shoveNum !== null &&
    eqNum !== null &&
    fNum !== null;

  const tone =
    result === null
      ? 'neutral'
      : result.ev > 0
        ? 'positive'
        : result.ev < 0
          ? 'negative'
          : 'neutral';
  const display = result === null ? '—' : formatCurrency(result.ev);

  const breakevenCaption = (() => {
    if (result === null) return null;
    const be = result.breakevenFoldPct;
    if (be === null) {
      return 'Breakeven F% — sin solución finita (Pot ≈ EV mostdown).';
    }
    if (be < 0) {
      return 'Breakeven F% < 0 — el shove es +EV en cualquier fold equity (incluso si nunca se tira).';
    }
    if (be > 100) {
      return `Breakeven F% = ${be.toFixed(1)}% — imposible: incluso con 100% de fold, el showdown negativo no se cubre.`;
    }
    return (
      <>
        <span className="font-mono tabular-nums text-content">
          Breakeven F% = {be.toFixed(1)}%
        </span>
        {' — '}
        necesitas que el villano se tire al menos ese porcentaje para shove ≥ fold.
      </>
    );
  })();

  const formula =
    'EV = F% · Pot + (1−F%) · Eq · (Pot + Shove − Call) − (1−F%) · (1−Eq) · Shove';
  const substituted = allValid
    ? `${(fNum / 100).toFixed(2)} · ${potNum} + ${((100 - fNum) / 100).toFixed(2)} · ${(eqNum / 100).toFixed(2)} · (${potNum} + ${shoveNum} − ${callNum}) − ${((100 - fNum) / 100).toFixed(2)} · ${((100 - eqNum) / 100).toFixed(2)} · ${shoveNum}`
    : '—';
  const resultStr = result !== null ? formatCurrency(result.ev) : '—';

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-xl border border-border bg-surface/40 p-5">
        <h2 className="mb-1 text-base font-semibold text-content">All-in EV</h2>
        <p className="mb-4 text-sm text-content-muted">
          EV de un shove preflop por encima de la apuesta del villano. Combina
          fold equity (te llevas el pot muerto) con showdown equity cuando te
          paga (ganas pot + lo que el villano agrega · pierdes tu shove
          completo).
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField
            id="aiev-pot"
            label="Pot antes del shove"
            value={pot}
            onChange={setPot}
            prefix="$"
            min={0}
            step={1}
            invalid={pot.trim() !== '' && potNum === null}
            hint="Tamaño del bote antes de que tú restees"
          />
          <NumberField
            id="aiev-call"
            label="Cuánto sería pagar"
            value={call}
            onChange={setCall}
            prefix="$"
            min={0}
            step={1}
            invalid={call.trim() !== '' && callNum === null}
            hint="Lo que arriesgas si pagas en vez de shovear"
          />
          <NumberField
            id="aiev-shove"
            label="Cuánto shoveas"
            value={shove}
            onChange={setShove}
            prefix="$"
            min={0}
            step={1}
            invalid={shove.trim() !== '' && shoveNum === null}
            hint="Tu shove total (incluye el call)"
          />
          <div />
          <NumberField
            id="aiev-eq"
            label="Eq% — Tu equity cuando te paga"
            value={equityPct}
            onChange={setEquityPct}
            suffix="%"
            min={0}
            max={100}
            step={1}
            invalid={equityPct.trim() !== '' && eqNum === null}
            hint="Qué tan seguido ganas al showdown si te paga"
          />
          <NumberField
            id="aiev-fold"
            label="F% — Con qué frecuencia se tira"
            value={foldPct}
            onChange={setFoldPct}
            suffix="%"
            min={0}
            max={100}
            step={1}
            invalid={foldPct.trim() !== '' && fNum === null}
            hint="Estimá la fold equity del shove"
          />
        </div>
      </section>

      <ResultCard
        label="EV ="
        display={display}
        tone={tone}
        caption={breakevenCaption}
      />

      <SensitivityTable
        pot={potNum}
        call={callNum}
        shove={shoveNum}
        equityPct={eqNum}
        foldPct={fNum}
      />

      <FormulaDetails
        formula={formula}
        substituted={substituted}
        result={resultStr}
      />
    </div>
  );
}

function SensitivityTable({
  pot,
  call,
  shove,
  equityPct,
  foldPct,
}: {
  pot: number | null;
  call: number | null;
  shove: number | null;
  equityPct: number | null;
  foldPct: number | null;
}) {
  const cells = useMemo(() => {
    if (
      pot === null ||
      call === null ||
      shove === null ||
      equityPct === null ||
      foldPct === null
    ) {
      return null;
    }
    return SCENARIOS.map((s) => {
      const eq = clamp(equityPct + s.deltaE, 0, 100);
      const f = clamp(foldPct + s.deltaF, 0, 100);
      const { ev } = allInEv({ pot, call, shove, equityPct: eq, foldPct: f });
      return { ...s, ev };
    });
  }, [pot, call, shove, equityPct, foldPct]);

  return (
    <section className="rounded-xl border border-border bg-surface/40 p-5">
      <h3 className="mb-1 text-sm font-semibold text-content">
        Sensibilidad ±5 / ±10%
      </h3>
      <p className="mb-3 text-xs text-content-muted">
        Cómo cambia el EV si tu lectura está corrida.{' '}
        <span className="font-mono">E</span> = equity,{' '}
        <span className="font-mono">F</span> = fold equity,{' '}
        <span className="font-mono">B</span> = ambos.
      </p>

      {cells === null ? (
        <p className="text-xs text-content-disabled">
          Completa los cinco campos para ver la sensibilidad.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 text-xs">
            <thead>
              <tr>
                {cells.map((c) => (
                  <th
                    key={c.id}
                    className={cn(
                      'border-b border-border px-2 py-1.5 text-center font-medium text-content-muted',
                      c.id === 'actual' && 'text-content',
                    )}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {cells.map((c) => (
                  <td
                    key={c.id}
                    className={cn(
                      'px-2 py-2 text-center font-mono tabular-nums',
                      c.ev > 0.005
                        ? 'text-emerald-300'
                        : c.ev < -0.005
                          ? 'text-rose-300'
                          : 'text-content-muted',
                      c.id === 'actual' &&
                        'rounded-md bg-accent/10 ring-1 ring-accent/40',
                    )}
                  >
                    {formatCurrency(c.ev)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
