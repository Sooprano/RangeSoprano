import { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { impliedOdds } from '@/utils/ev';
import {
  FormulaDetails,
  NumberField,
  ResultCard,
  formatCurrency,
  formatPct,
  parseField,
} from './CalcShared';

export function ImpliedOddsCalc() {
  const [callAmount, setCallAmount] = useState('50');
  const [currentPot, setCurrentPot] = useState('100');
  const [equityPct, setEquityPct] = useState('20');
  const [remainingStack, setRemainingStack] = useState('200');

  const callNum = parseField(callAmount, { min: 0 });
  const potNum = parseField(currentPot, { min: 0 });
  const eqNum = parseField(equityPct, { min: 0, max: 100 });
  const stackNum = parseField(remainingStack, { min: 0 });

  const result = useMemo(() => {
    if (callNum === null || potNum === null || eqNum === null) return null;
    return impliedOdds({
      callAmount: callNum,
      currentPot: potNum,
      equityPct: eqNum,
    });
  }, [callNum, potNum, eqNum]);

  let tone: 'positive' | 'negative' | 'neutral' = 'neutral';
  let display = '—';
  let caption: string | null = null;

  if (result !== null) {
    if (result.isAlreadyProfitable) {
      tone = 'positive';
      display = 'Ya es +EV';
      caption = `Tu equity (${formatPct(eqNum ?? 0)}) supera las pot odds requeridas (${formatPct(result.potOddsNeededPct)}). No necesitás ganancias futuras.`;
    } else {
      const exceedsStack =
        stackNum !== null && result.impliedNeeded > stackNum;
      tone = exceedsStack ? 'negative' : 'neutral';
      display = formatCurrency(result.impliedNeeded);
      caption = exceedsStack
        ? `Imposible: el villano sólo tiene ${formatCurrency(stackNum ?? 0)} de stack restante. Tirar.`
        : `Pot odds requeridas: ${formatPct(result.potOddsNeededPct)}. Tu equity (${formatPct(eqNum ?? 0)}) no alcanza directo — necesitás sacarle al menos esta cantidad más en futuras calles cuando pegues.`;
    }
  }

  const formula = 'Future ≥ call / equity − call − pot';
  const substituted =
    callNum !== null && potNum !== null && eqNum !== null && eqNum > 0
      ? `${callNum} / ${(eqNum / 100).toFixed(2)} − ${callNum} − ${potNum}`
      : '—';
  const resultStr = result !== null ? formatCurrency(result.impliedNeeded) : '—';

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-xl border border-border bg-surface/40 p-5">
        <h2 className="mb-1 text-base font-semibold text-content">
          Implied Odds
        </h2>
        <p className="mb-4 text-sm text-content-muted">
          Tenés un draw, el villano apuesta, y tu equity directa no alcanza las
          pot odds. ¿Cuánto más necesitás ganar en promedio en futuras calles
          cuando pegues para que el call sea +EV?
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField
            id="io-call-amount"
            label="Call — ¿Cuánto te toca pagar?"
            value={callAmount}
            onChange={setCallAmount}
            prefix="$"
            min={0}
            step={1}
            invalid={callAmount.trim() !== '' && callNum === null}
          />
          <NumberField
            id="io-pot"
            label="Pot actual (antes de tu call)"
            value={currentPot}
            onChange={setCurrentPot}
            prefix="$"
            min={0}
            step={1}
            invalid={currentPot.trim() !== '' && potNum === null}
            hint="Lo que hay en el bote incluyendo la apuesta del villano"
          />
          <NumberField
            id="io-equity"
            label="Equity — ¿Con qué frecuencia pegás el draw?"
            value={equityPct}
            onChange={setEquityPct}
            suffix="%"
            min={0}
            max={100}
            step={1}
            invalid={equityPct.trim() !== '' && eqNum === null}
            hint="Aprox: 4·outs en turn, 2·outs en river"
          />
          <NumberField
            id="io-stack"
            label="Stack restante del villano (opcional)"
            value={remainingStack}
            onChange={setRemainingStack}
            prefix="$"
            min={0}
            step={1}
            invalid={remainingStack.trim() !== '' && stackNum === null}
            hint="Para chequear si lo que necesitás ganar es posible"
          />
        </div>
      </section>

      <ResultCard
        label="Necesitás ganar"
        display={display}
        tone={tone}
        caption={
          caption && (
            <span className="flex items-start gap-1.5">
              {tone === 'negative' && (
                <AlertTriangle
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400"
                  strokeWidth={2.25}
                />
              )}
              <span>{caption}</span>
            </span>
          )
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
