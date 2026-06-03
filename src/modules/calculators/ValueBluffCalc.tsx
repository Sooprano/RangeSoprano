import { useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import { valueBluffCombos } from '@/utils/ev';
import {
  FormulaDetails,
  NumberField,
  ReadOnlyField,
  ResultCard,
  formatCurrency,
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
    if (
      result === null ||
      actualNum === null ||
      potNum === null ||
      betNum === null
    ) {
      return null;
    }
    const max = result.maxBluffCombos;
    const diff = actualNum - max;
    if (Math.abs(diff) < 0.5) {
      return {
        tone: 'positive' as const,
        text: `Estás balanceado: ${formatCombos(actualNum)} combos de farol es prácticamente el máximo óptimo (${formatCombos(max)}). El villano no te puede explotar ni foldeando ni pagando de más.`,
      };
    }
    if (diff > 0) {
      const overflowCost = diff * betNum;
      return {
        tone: 'negative' as const,
        text: `Te estás pasando de faroles: tienes ${formatCombos(actualNum)} pero el máximo balanceado es ${formatCombos(max)} (${formatCombos(diff)} de más). Si el villano paga seguido (lo correcto contra tu exceso de bluffs), cada farol de más se estrella perdiendo la apuesta: estás regalando hasta ${formatCurrency(overflowCost)} cuando te pagan. Saca ~${formatCombos(diff)} combos.`,
      };
    }
    const missing = -diff;
    const foldEquityLeft = missing * potNum;
    return {
      tone: 'neutral' as const,
      text: `Estás bluffeando de menos: tienes ${formatCombos(actualNum)} y puedes meter hasta ${formatCombos(max)} (${formatCombos(missing)} disponibles). Si el villano foldea sus bluff-catchers (lo correcto contra tu rango cargado de valor), cada farol que falta gana el bote: estás dejando hasta ${formatCurrency(foldEquityLeft)} de fold equity sobre la mesa. Agrega ~${formatCombos(missing)} faroles más.`,
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
          Cuántos combos de farol puedes tener respecto a tus combos de valor para
          que tu rango de apuesta quede balanceado — ni explotable por exceso de
          bluffs, ni dejando valor por bluffear de menos. A mayor tamaño de
          apuesta, más faroles puedes permitirte.
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
          ¿Cuántos faroles piensas meter? (opcional)
        </h3>
        <p className="mb-4 text-sm text-content-muted">
          Ingresa tus combos de farol actuales y te digo si te estás pasando o
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
            hint="Déjalo vacío si solo quieres ver el máximo"
          />
          <InsightCard insight={insight} />
        </div>
        <p className="mt-4 rounded-lg border border-border bg-surface/30 px-3 py-2.5 text-[12px] leading-relaxed text-content-muted">
          <span className="font-semibold text-content">Ojo con el matiz GTO:</span> en
          equilibrio un farol es break-even (0 EV). Cuando el villano paga a la
          frecuencia correcta (MDF), bluffear y rendirse rinden lo mismo. Balanceas para
          no darle una explotación, no por EV directo del farol. Si bluffeas{' '}
          <span className="font-semibold text-content">de menos</span>, el villano puede
          sobre-foldear sus bluff-catchers y tus apuestas de valor dejan de cobrar (pierdes
          fold equity). Si bluffeas{' '}
          <span className="font-semibold text-content">de más</span>, puede sobre-pagar y
          tus faroles de más se estrellan perdiendo la apuesta. Los costos de arriba se
          realizan solo cuando el villano se desvía para explotarte.
        </p>
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
        Ingresa tus faroles actuales para comparar.
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
