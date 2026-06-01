import { useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import { valueBluffCombos } from '@/utils/ev';
import {
  FormulaDetails,
  NumberField,
  ReadOnlyField,
  ResultCard,
  formatPct,
  parseField,
} from './CalcShared';

function formatCombos(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return rounded.toFixed(2).replace(/\.?0+$/, '') || '0';
}

export function ValueBluffCalc() {
  const [pot, setPot] = useState('100');
  const [bet, setBet] = useState('64');
  const [valueCombos, setValueCombos] = useState('40');
  const [actualBluffs, setActualBluffs] = useState('');

  const potNum = parseField(pot, { min: 0 });
  const betNum = parseField(bet, { min: 0 });
  const valueNum = parseField(valueCombos, { min: 0 });
  const actualNum = parseField(actualBluffs, { min: 0 });

  const result = useMemo(() => {
    if (potNum === null || betNum === null || valueNum === null) return null;
    return valueBluffCombos({
      pot: potNum,
      bet: betNum,
      valueCombos: valueNum,
    });
  }, [potNum, betNum, valueNum]);

  const allValid = potNum !== null && betNum !== null && valueNum !== null;

  const maxBluffDisplay =
    result === null ? '—' : `${formatCombos(result.maxBluffCombos)} combos`;
  const bluffFreqDisplay =
    result === null ? '—' : formatPct(result.bluffFreqPct);
  const callFreqDisplay = result === null ? '—' : formatPct(result.callFreqPct);
  const oddsDisplay =
    result === null ? '—' : `${result.oddsRatio.toFixed(2)} : 1`;

  const insight = (() => {
    if (result === null || actualNum === null) return null;
    const max = result.maxBluffCombos;
    const diff = actualNum - max;
    if (Math.abs(diff) < 0.5) {
      return {
        tone: 'positive' as const,
        text: `Estás balanceado: ${formatCombos(actualNum)} combos de farol es prácticamente el máximo óptimo (${formatCombos(max)}). El villano no te puede explotar ni foldeando ni pagando de más.`,
      };
    }
    if (diff > 0) {
      return {
        tone: 'negative' as const,
        text: `Te estás pasando de faroles: tenés ${formatCombos(actualNum)} pero el máximo balanceado es ${formatCombos(max)} (${formatCombos(diff)} de más). Con tantos bluffs, un villano que paga seguido te explota — sacá ~${formatCombos(diff)} combos.`,
      };
    }
    return {
      tone: 'neutral' as const,
      text: `Estás bluffeando de menos: tenés ${formatCombos(actualNum)} y podés meter hasta ${formatCombos(max)} (${formatCombos(-diff)} disponibles). Estás dejando valor sobre la mesa: podés agregar ~${formatCombos(-diff)} faroles más sin desbalancearte.`,
    };
  })();

  const formula = 'Bluff combos = Value combos · Bet ÷ (Pot + Bet)';
  const substituted = allValid
    ? `${valueNum} · ${betNum} ÷ (${potNum} + ${betNum}) = ${valueNum} · ${betNum} ÷ ${potNum + betNum}`
    : '—';
  const resultStr =
    result !== null ? `${formatCombos(result.maxBluffCombos)} combos` : '—';

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-xl border border-border bg-surface/40 p-5">
        <h2 className="mb-1 text-base font-semibold text-content">
          Combos de farol máx (Value / Bluff)
        </h2>
        <p className="mb-4 text-sm text-content-muted">
          Cuántos combos de farol podés tener respecto a tus combos de valor para
          que tu rango de apuesta quede balanceado — ni explotable por exceso de
          bluffs, ni dejando valor por bluffear de menos. A mayor tamaño de
          apuesta, más faroles podés permitirte.
        </p>

        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField
            id="vb-pot"
            label="Bote"
            value={pot}
            onChange={setPot}
            prefix="$"
            min={0}
            step={1}
            invalid={pot.trim() !== '' && potNum === null}
            hint="Lo que hay antes de tu apuesta"
          />
          <NumberField
            id="vb-bet"
            label="Bet del hero"
            value={bet}
            onChange={setBet}
            prefix="$"
            min={0}
            step={1}
            invalid={bet.trim() !== '' && betNum === null}
          />
          <NumberField
            id="vb-value"
            label="Value combos"
            value={valueCombos}
            onChange={setValueCombos}
            min={0}
            step={1}
            invalid={valueCombos.trim() !== '' && valueNum === null}
            hint="Combos de valor en tu rango de apuesta"
          />
        </div>
      </section>

      <ResultCard
        label="Bluff combos (máx) ="
        display={maxBluffDisplay}
        tone="neutral"
        caption="Máximo de combos de farol para mantener el rango balanceado (no explotable)."
      />

      <section className="rounded-xl border border-border bg-surface/40 p-5">
        <h3 className="mb-1 text-sm font-semibold text-content">
          ¿Cuántos faroles pensás meter? (opcional)
        </h3>
        <p className="mb-4 text-sm text-content-muted">
          Ingresá tus combos de farol actuales y te digo si te estás pasando o
          quedando corto respecto al máximo óptimo.
        </p>
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <NumberField
            id="vb-actual"
            label="Bluff combos actuales"
            value={actualBluffs}
            onChange={setActualBluffs}
            min={0}
            step={1}
            invalid={actualBluffs.trim() !== '' && actualNum === null}
            hint="Dejalo vacío si solo querés ver el máximo"
          />
          <InsightCard insight={insight} />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface/40 p-5">
        <h3 className="mb-3 text-sm font-semibold text-content">
          Frecuencias óptimas
        </h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <ReadOnlyField
            label="Frecuencia bluff"
            display={bluffFreqDisplay}
            hint="% del rango de apuesta que deberían ser faroles · bet/(pot+2·bet)"
          />
          <ReadOnlyField
            label="Frecuencia call (MDF)"
            display={callFreqDisplay}
            hint="Cuánto debe pagar el villano para no ser explotado · pot/(pot+bet)"
          />
          <ReadOnlyField
            label="Odds (precio del call)"
            display={oddsDisplay}
            hint="Precio que recibe el villano para pagar · (pot+bet):bet"
          />
        </div>
      </section>

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

function InsightCard({
  insight,
}: {
  insight: { tone: 'positive' | 'negative' | 'neutral'; text: string } | null;
}) {
  if (insight === null) {
    return (
      <div className="flex items-center rounded-xl border border-border bg-surface/30 px-4 py-3 text-sm text-content-disabled">
        Ingresá tus faroles actuales para comparar.
      </div>
    );
  }
  const toneClasses =
    insight.tone === 'positive'
      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'
      : insight.tone === 'negative'
        ? 'border-rose-500/40 bg-rose-500/10 text-rose-100'
        : 'border-amber-500/40 bg-amber-500/10 text-amber-100';
  return (
    <div className={cn('rounded-xl border px-4 py-3 text-sm', toneClasses)}>
      {insight.text}
    </div>
  );
}
