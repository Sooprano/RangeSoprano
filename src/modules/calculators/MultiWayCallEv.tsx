import { useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import { multiWayCallEv } from '@/utils/ev';
import {
  FormulaDetails,
  NumberField,
  ResultCard,
  formatCurrency,
  parseField,
} from './CalcShared';

type ScenarioId = 'hu' | 'actual' | 'mw';

type Scenario = {
  id: ScenarioId;
  label: string;
  hint: string;
  othersCallOverride: number | null; // null = usar el valor real del input
};

const SCENARIOS: readonly Scenario[] = [
  { id: 'hu', label: 'HU only', hint: 'Si nadie más paga (OC = 0%)', othersCallOverride: 0 },
  { id: 'actual', label: 'Actual', hint: 'Con tu estimación de OC', othersCallOverride: null },
  { id: 'mw', label: 'MW only', hint: 'Si siempre va MW (OC = 100%)', othersCallOverride: 100 },
];

export function MultiWayCallEv() {
  const [pot, setPot] = useState('100');
  const [call, setCall] = useState('40');
  const [huEquityPct, setHuEquityPct] = useState('35');
  const [othersCallPct, setOthersCallPct] = useState('40');
  const [mwPot, setMwPot] = useState('180');
  const [mwEquityPct, setMwEquityPct] = useState('30');

  const potNum = parseField(pot, { min: 0 });
  const callNum = parseField(call, { min: 0 });
  const huEqNum = parseField(huEquityPct, { min: 0, max: 100 });
  const ocNum = parseField(othersCallPct, { min: 0, max: 100 });
  const mwPotNum = parseField(mwPot, { min: 0 });
  const mwEqNum = parseField(mwEquityPct, { min: 0, max: 100 });

  const result = useMemo(() => {
    if (
      potNum === null ||
      callNum === null ||
      huEqNum === null ||
      ocNum === null ||
      mwPotNum === null ||
      mwEqNum === null
    ) {
      return null;
    }
    return multiWayCallEv({
      pot: potNum,
      call: callNum,
      huEquityPct: huEqNum,
      othersCallPct: ocNum,
      mwPot: mwPotNum,
      mwEquityPct: mwEqNum,
    });
  }, [potNum, callNum, huEqNum, ocNum, mwPotNum, mwEqNum]);

  const allValid =
    potNum !== null &&
    callNum !== null &&
    huEqNum !== null &&
    ocNum !== null &&
    mwPotNum !== null &&
    mwEqNum !== null;

  const tone =
    result === null
      ? 'neutral'
      : result > 0
        ? 'positive'
        : result < 0
          ? 'negative'
          : 'neutral';
  const display = result === null ? '—' : formatCurrency(result);

  const mwPotHint =
    potNum !== null && callNum !== null && mwPotNum !== null && mwPotNum < potNum + callNum
      ? `Cuando va MW el pot efectivo es al menos $${(potNum + callNum).toFixed(0)} (lo que hay + tu call). Verifica el valor.`
      : 'Pot final si todos los relevantes pagan (incluye tu call)';

  const formula =
    'EV = pot · huEq · (1−OC) − call · (1−huEq) · (1−OC) + (mwPot − call) · mwEq · OC − call · (1−mwEq) · OC';
  const substituted = allValid
    ? `${potNum} · ${(huEqNum / 100).toFixed(2)} · ${((100 - ocNum) / 100).toFixed(2)} − ${callNum} · ${((100 - huEqNum) / 100).toFixed(2)} · ${((100 - ocNum) / 100).toFixed(2)} + (${mwPotNum} − ${callNum}) · ${(mwEqNum / 100).toFixed(2)} · ${(ocNum / 100).toFixed(2)} − ${callNum} · ${((100 - mwEqNum) / 100).toFixed(2)} · ${(ocNum / 100).toFixed(2)}`
    : '—';
  const resultStr = result !== null ? formatCurrency(result) : '—';

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-xl border border-border bg-surface/40 p-5">
        <h2 className="mb-1 text-base font-semibold text-content">Call multi-way</h2>
        <p className="mb-4 text-sm text-content-muted">
          EV de pagar un shove preflop cuando hay jugadores por hablar que
          pueden coldcallar. Ramifica el resultado en dos escenarios: HU vs el
          shover (prob = 1 − OC%) o multi-way si otros pagan (prob = OC%), cada
          uno con su propia equity.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField
            id="mwc-pot"
            label="Pot antes de tu call"
            value={pot}
            onChange={setPot}
            prefix="$"
            min={0}
            step={1}
            invalid={pot.trim() !== '' && potNum === null}
            hint="Lo que ya hay en el centro antes de que pagues"
          />
          <NumberField
            id="mwc-call"
            label="Cuánto pagar"
            value={call}
            onChange={setCall}
            prefix="$"
            min={0}
            step={1}
            invalid={call.trim() !== '' && callNum === null}
            hint="Lo que tienes que pagar para seguir en la mano"
          />
          <NumberField
            id="mwc-hueq"
            label="HU eq% — Tu equity vs el shover"
            value={huEquityPct}
            onChange={setHuEquityPct}
            suffix="%"
            min={0}
            max={100}
            step={1}
            invalid={huEquityPct.trim() !== '' && huEqNum === null}
            hint="Si el pot queda HU, qué tan seguido ganas"
          />
          <NumberField
            id="mwc-oc"
            label="OC% — Frecuencia con que otros pagan"
            value={othersCallPct}
            onChange={setOthersCallPct}
            suffix="%"
            min={0}
            max={100}
            step={1}
            invalid={othersCallPct.trim() !== '' && ocNum === null}
            hint="Probabilidad de que al menos un overcaller te lleve a MW"
          />
          <NumberField
            id="mwc-mwpot"
            label="Pot efectivo si va MW"
            value={mwPot}
            onChange={setMwPot}
            prefix="$"
            min={0}
            step={1}
            invalid={mwPot.trim() !== '' && mwPotNum === null}
            hint={mwPotHint}
          />
          <NumberField
            id="mwc-mweq"
            label="MW eq% — Tu equity en el pot MW"
            value={mwEquityPct}
            onChange={setMwEquityPct}
            suffix="%"
            min={0}
            max={100}
            step={1}
            invalid={mwEquityPct.trim() !== '' && mwEqNum === null}
            hint="Si el pot se va MW, qué tan seguido ganas contra todos"
          />
        </div>
      </section>

      <ResultCard label="EV =" display={display} tone={tone} />

      <ScenarioCards
        pot={potNum}
        call={callNum}
        huEquityPct={huEqNum}
        othersCallPct={ocNum}
        mwPot={mwPotNum}
        mwEquityPct={mwEqNum}
      />

      <FormulaDetails
        formula={formula}
        substituted={substituted}
        result={resultStr}
      />
    </div>
  );
}

function ScenarioCards({
  pot,
  call,
  huEquityPct,
  othersCallPct,
  mwPot,
  mwEquityPct,
}: {
  pot: number | null;
  call: number | null;
  huEquityPct: number | null;
  othersCallPct: number | null;
  mwPot: number | null;
  mwEquityPct: number | null;
}) {
  const cells = useMemo(() => {
    if (
      pot === null ||
      call === null ||
      huEquityPct === null ||
      othersCallPct === null ||
      mwPot === null ||
      mwEquityPct === null
    ) {
      return null;
    }
    return SCENARIOS.map((s) => {
      const oc = s.othersCallOverride ?? othersCallPct;
      const ev = multiWayCallEv({
        pot,
        call,
        huEquityPct,
        othersCallPct: oc,
        mwPot,
        mwEquityPct,
      });
      return { ...s, ev };
    });
  }, [pot, call, huEquityPct, othersCallPct, mwPot, mwEquityPct]);

  return (
    <section className="rounded-xl border border-border bg-surface/40 p-5">
      <h3 className="mb-1 text-sm font-semibold text-content">Escenarios</h3>
      <p className="mb-3 text-xs text-content-muted">
        Cómo cambia el EV según la frecuencia con que otros pagan. Tus equities
        HU y MW se mantienen iguales — sólo se mueve <span className="font-mono">OC%</span>.
      </p>

      {cells === null ? (
        <p className="text-xs text-content-disabled">
          Completa los seis campos para ver los escenarios.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          {cells.map((c) => (
            <div
              key={c.id}
              className={cn(
                'flex flex-col gap-1 rounded-lg border bg-surface/30 px-3 py-2.5',
                c.id === 'actual'
                  ? 'border-accent/40 ring-1 ring-accent/40'
                  : 'border-border',
              )}
            >
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-content-muted">
                {c.label}
              </span>
              <span
                className={cn(
                  'font-mono text-xl font-bold tabular-nums',
                  c.ev > 0.005
                    ? 'text-emerald-300'
                    : c.ev < -0.005
                      ? 'text-rose-300'
                      : 'text-content-muted',
                )}
              >
                {formatCurrency(c.ev)}
              </span>
              <span className="text-[11px] text-content-disabled">{c.hint}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
