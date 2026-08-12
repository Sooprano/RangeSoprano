import { useMemo, useState } from 'react';
import { checkCompoundEv } from '@/utils/ev';
import {
  FormulaDetails,
  NumberField,
  ResultCard,
  evInterpretation,
  useMoney,
  parseField,
} from './CalcShared';

export function CheckCompoundEvCalc({
  initialPot,
}: {
  initialPot?: string | undefined;
} = {}) {
  const money = useMoney();
  const [pot, setPot] = useState(initialPot ?? '100');
  const [villainBetsPct, setVillainBetsPct] = useState('50');
  const [villainBet, setVillainBet] = useState('60');
  const [callEquityPct, setCallEquityPct] = useState('45');
  const [xxEquityPct, setXxEquityPct] = useState('55');

  const potNum = parseField(pot, { min: 0 });
  const betsNum = parseField(villainBetsPct, { min: 0, max: 100 });
  const vbetNum = parseField(villainBet, { min: 0 });
  const callEqNum = parseField(callEquityPct, { min: 0, max: 100 });
  const xxEqNum = parseField(xxEquityPct, { min: 0, max: 100 });

  const checksBackDisplay =
    betsNum !== null ? (100 - betsNum).toFixed(1) : '—';

  const result = useMemo(() => {
    if (
      potNum === null ||
      betsNum === null ||
      vbetNum === null ||
      callEqNum === null ||
      xxEqNum === null
    ) {
      return null;
    }
    return checkCompoundEv({
      pot: potNum,
      villainBetsPct: betsNum,
      villainBet: vbetNum,
      callEquityPct: callEqNum,
      checkCheckEquityPct: xxEqNum,
    });
  }, [potNum, betsNum, vbetNum, callEqNum, xxEqNum]);

  const allValid =
    potNum !== null &&
    betsNum !== null &&
    vbetNum !== null &&
    callEqNum !== null &&
    xxEqNum !== null;

  const toneOf = (n: number | undefined) =>
    n === undefined ? 'neutral' : n > 0 ? 'positive' : n < 0 ? 'negative' : 'neutral';

  const totalDisplay = result === null ? '—' : money(result.evTotal);
  const callDisplay = result === null ? '—' : money(result.evCheckCall);
  const xxDisplay = result === null ? '—' : money(result.evCheckCheck);

  const formula =
    'EV check = P(apuesta)·EV(check-call) + P(checkea)·EV(check-check)';
  const substituted = allValid
    ? `${(betsNum / 100).toFixed(2)}·[${(callEqNum / 100).toFixed(2)}·(${potNum}+${vbetNum}) − ${((100 - callEqNum) / 100).toFixed(2)}·${vbetNum}] + ${((100 - betsNum) / 100).toFixed(2)}·[${(xxEqNum / 100).toFixed(2)}·${potNum}]`
    : '—';
  const resultStr = result === null ? '—' : money(result.evTotal);

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-xl border border-border bg-surface/40 p-5">
        <h2 className="mb-1 text-base font-semibold text-content">
          EV de checkear (compuesto)
        </h2>
        <p className="mb-4 text-sm text-content-muted">
          Cuánto rinde checkear en total, juntando las dos cosas que pueden pasar:
          a veces el villano apuesta y tú pagas (check-call), a veces hace check
          behind y van a showdown gratis (check-check). Compara este número con el
          EV de apostar para decidir.
        </p>

        <div className="mb-4 grid gap-4 sm:grid-cols-2">
          <NumberField
            id="cc-pot"
            label="Pot"
            value={pot}
            onChange={setPot}
            prefix="$"
            min={0}
            step={1}
            invalid={pot.trim() !== '' && potNum === null}
            hint="Lo que hay en el centro cuando checkeas"
          />
          <NumberField
            id="cc-bets"
            label="% que el villano apuesta"
            value={villainBetsPct}
            onChange={setVillainBetsPct}
            suffix="%"
            min={0}
            max={100}
            step={1}
            invalid={villainBetsPct.trim() !== '' && betsNum === null}
            hint={`Hace check behind el ${checksBackDisplay}% restante`}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface/30 p-4">
            <h3 className="text-sm font-semibold text-content">
              Si el villano apuesta → check-call
            </h3>
            <NumberField
              id="cc-vbet"
              label="Apuesta del villano"
              value={villainBet}
              onChange={setVillainBet}
              prefix="$"
              min={0}
              step={1}
              invalid={villainBet.trim() !== '' && vbetNum === null}
              hint="Cuánto apuesta (y tú pagas)"
            />
            <NumberField
              id="cc-call-eq"
              label="Equity al pagar"
              value={callEquityPct}
              onChange={setCallEquityPct}
              suffix="%"
              min={0}
              max={100}
              step={1}
              invalid={callEquityPct.trim() !== '' && callEqNum === null}
              hint="Tu equity vs su rango de apuesta (suele ser más baja)"
            />
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface/30 p-4">
            <h3 className="text-sm font-semibold text-content">
              Si hace check behind → check-check
            </h3>
            <NumberField
              id="cc-xx-eq"
              label="Equity en check-check"
              value={xxEquityPct}
              onChange={setXxEquityPct}
              suffix="%"
              min={0}
              max={100}
              step={1}
              invalid={xxEquityPct.trim() !== '' && xxEqNum === null}
              hint="Tu equity a showdown vs su rango de check behind (suele ser más alta)"
            />
          </div>
        </div>
      </section>

      <ResultCard
        label="EV total de checkear ="
        display={totalDisplay}
        tone={toneOf(result?.evTotal)}
        {...(result !== null ? { caption: evInterpretation(result.evTotal, money) } : {})}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <ResultCard
          label="EV check-call ="
          display={callDisplay}
          tone={toneOf(result?.evCheckCall)}
          caption="Cuando apuesta y pagas."
        />
        <ResultCard
          label="EV check-check ="
          display={xxDisplay}
          tone={toneOf(result?.evCheckCheck)}
          caption="Cuando hace check behind y vas a showdown gratis."
        />
      </div>

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
