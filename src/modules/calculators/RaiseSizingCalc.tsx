import { useMemo, useState } from 'react';
import {
  potOddsVsRaise,
  raisePctOfPot,
  raiseSizeFromPct,
} from '@/utils/ev';
import {
  FormulaDetails,
  NumberField,
  ResultCard,
  formatPct,
  parseField,
} from './CalcShared';

function formatChips(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  const trimmed = rounded.toFixed(1).replace(/\.0$/, '');
  return `${trimmed} fichas`;
}

export function RaiseSizingCalc() {
  const [bote, setBote] = useState('10');
  const [bet, setBet] = useState('3');
  const [raiseSize, setRaiseSize] = useState('9');
  const [pctTarget, setPctTarget] = useState('47');

  const boteNum = parseField(bote, { min: 0 });
  const betNum = parseField(bet, { min: 0 });
  const raiseNum = parseField(raiseSize, { min: 0 });
  const pctNum = parseField(pctTarget, { min: 0, max: 100 });

  // % del pot que representa el raise (calc 1)
  const pctOfPot = useMemo(() => {
    if (boteNum === null || betNum === null || raiseNum === null) return null;
    return raisePctOfPot({ bote: boteNum, bet: betNum, raiseSize: raiseNum });
  }, [boteNum, betNum, raiseNum]);

  // Equity necesaria para pagar el raise (calc 3)
  const equityNeeded = useMemo(() => {
    if (boteNum === null || betNum === null || raiseNum === null) return null;
    return potOddsVsRaise({ bote: boteNum, bet: betNum, raiseSize: raiseNum });
  }, [boteNum, betNum, raiseNum]);

  // Fichas del raise dado un % objetivo (calc 2, inverso)
  const chipsFromPct = useMemo(() => {
    if (boteNum === null || betNum === null || pctNum === null) return null;
    return raiseSizeFromPct({ bote: boteNum, bet: betNum, pctOfPot: pctNum });
  }, [boteNum, betNum, pctNum]);

  const sharedValid =
    boteNum !== null && betNum !== null && raiseNum !== null;
  const inverseValid =
    boteNum !== null && betNum !== null && pctNum !== null;

  const pctDisplay = pctOfPot === null ? '—' : formatPct(pctOfPot);
  const equityDisplay = equityNeeded === null ? '—' : formatPct(equityNeeded);
  const chipsDisplay = chipsFromPct === null ? '—' : formatChips(chipsFromPct);

  const pctFormula = '% del pot = Raise ÷ (3·Bet + Bote)';
  const pctSubstituted = sharedValid
    ? `${raiseNum} ÷ (3·${betNum} + ${boteNum}) = ${raiseNum} ÷ ${3 * betNum + boteNum}`
    : '—';
  const pctResultStr = pctOfPot !== null ? formatPct(pctOfPot) : '—';

  const equityFormula = 'Equity = (Raise − Bet) ÷ (2·Raise + Bote)';
  const equitySubstituted = sharedValid
    ? `(${raiseNum} − ${betNum}) ÷ (2·${raiseNum} + ${boteNum}) = ${raiseNum - betNum} ÷ ${2 * raiseNum + boteNum}`
    : '—';
  const equityResultStr =
    equityNeeded !== null ? formatPct(equityNeeded) : '—';

  const chipsFormula = 'Raise = (3·Bet + Bote) · %objetivo';
  const chipsSubstituted = inverseValid
    ? `(3·${betNum} + ${boteNum}) · ${(pctNum / 100).toFixed(2)} = ${3 * betNum + boteNum} · ${(pctNum / 100).toFixed(2)}`
    : '—';
  const chipsResultStr =
    chipsFromPct !== null ? formatChips(chipsFromPct) : '—';

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-xl border border-border bg-surface/40 p-5">
        <h2 className="mb-1 text-base font-semibold text-content">
          Raise sizing &amp; pot odds (flop)
        </h2>
        <p className="mb-4 text-sm text-content-muted">
          Enfrentas un raise en el flop. Dimensioná el raise como porcentaje del
          pot, haz la conversión inversa (cuántas fichas es un raise de X%) y
          calcula la equity que necesitas para pagarlo. Todo a partir del bote, la
          apuesta y el tamaño del raise.
        </p>

        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField
            id="rs-bote"
            label="Bote"
            value={bote}
            onChange={setBote}
            min={0}
            step={1}
            invalid={bote.trim() !== '' && boteNum === null}
            hint="Lo que hay en el centro antes de la apuesta"
          />
          <NumberField
            id="rs-bet"
            label="Bet"
            value={bet}
            onChange={setBet}
            min={0}
            step={1}
            invalid={bet.trim() !== '' && betNum === null}
            hint="El tamaño de la apuesta"
          />
          <NumberField
            id="rs-raise"
            label="Raise size (fichas)"
            value={raiseSize}
            onChange={setRaiseSize}
            min={0}
            step={1}
            invalid={raiseSize.trim() !== '' && raiseNum === null}
            hint="El tamaño total del raise en fichas"
          />
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <ResultCard
          label="% del pot del raise ="
          display={pctDisplay}
          tone="neutral"
          caption="Relativo a un raise pot-completo (3·Bet + Bote). 100% = raise del tamaño del pot."
        />
        <ResultCard
          label="Equity para pagar vs raise ="
          display={equityDisplay}
          tone="neutral"
          caption="Pot odds: equity mínima para que pagar el raise sea rentable."
        />
      </div>

      <section className="rounded-xl border border-border bg-surface/40 p-5">
        <h3 className="mb-1 text-sm font-semibold text-content">
          Conversor inverso — ¿cuántas fichas para raisear X%?
        </h3>
        <p className="mb-4 text-sm text-content-muted">
          Usa el mismo bote y apuesta de arriba. Ingresa el % del pot al que quieres
          raisear y obtén el tamaño en fichas. El % es relativo a un raise
          pot-completo: 100% = un raise del tamaño del pot (3·Bet + Bote).
        </p>
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <NumberField
            id="rs-pct"
            label="% del pot objetivo"
            value={pctTarget}
            onChange={setPctTarget}
            suffix="%"
            min={0}
            max={100}
            step={1}
            invalid={pctTarget.trim() !== '' && pctNum === null}
            hint="% de un raise pot-completo (100% = raise del tamaño del pot)"
          />
          <ResultCard
            label="Raise ="
            display={chipsDisplay}
            tone="neutral"
          />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface/40 p-5">
        <h3 className="mb-3 text-sm font-semibold text-content">Fórmulas</h3>
        <div className="flex flex-col gap-3">
          <FormulaDetails
            formula={pctFormula}
            substituted={pctSubstituted}
            result={pctResultStr}
          />
          <FormulaDetails
            formula={equityFormula}
            substituted={equitySubstituted}
            result={equityResultStr}
          />
          <FormulaDetails
            formula={chipsFormula}
            substituted={chipsSubstituted}
            result={chipsResultStr}
          />
        </div>
      </section>
    </div>
  );
}
