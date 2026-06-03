import { useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import { foldEquityRequired } from '@/utils/ev';
import {
  FormulaDetails,
  NumberField,
  ReadOnlyField,
  ResultCard,
  formatPct,
  parseField,
} from './CalcShared';

export function FoldEquityRequiredCalc() {
  const [pot, setPot] = useState('100');
  const [shove, setShove] = useState('50');
  const [equityPct, setEquityPct] = useState('35');

  const potNum = parseField(pot, { min: 0 });
  const shoveNum = parseField(shove, { min: 0 });
  const equityNum = parseField(equityPct, { min: 0, max: 100 });

  const result = useMemo(() => {
    if (potNum === null || shoveNum === null || equityNum === null) return null;
    return foldEquityRequired({
      pot: potNum,
      shove: shoveNum,
      equityPct: equityNum,
    });
  }, [potNum, shoveNum, equityNum]);

  const allValid =
    potNum !== null && shoveNum !== null && equityNum !== null;

  const shoveFractionDisplay =
    result === null ? '—' : formatPct(result.shoveFractionPct);
  const noEquityDisplay =
    result === null ? '—' : formatPct(result.breakevenFoldNoEquityPct);

  const mainDisplay = (() => {
    if (result === null) return '—';
    if (result.breakevenFoldPct === null) return '≤ 0%';
    return formatPct(result.breakevenFoldPct);
  })();

  const mainTone =
    result === null ? 'neutral' : result.alwaysProfitable ? 'positive' : 'neutral';

  const mainCaption = (() => {
    if (result === null) return undefined;
    if (result.alwaysProfitable) {
      return `Con ${equityPct}% de equity, el shove ya es +EV aunque el villano nunca foldee.`;
    }
    return `El villano tiene que foldear al menos ${mainDisplay} para que el shove sea rentable.`;
  })();

  const insight = (() => {
    if (result === null || equityNum === null) return null;
    const f0 = result.breakevenFoldNoEquityPct;
    if (result.breakevenFoldPct === null) {
      return {
        tone: 'positive' as const,
        text: `Sin equity necesitarías ${formatPct(f0)} de folds. Con tu ${equityPct}% de equity ya no necesitas ningún fold: el shove es +EV por tu sola equity. Eso es lo que pasa cuando vas all-in en el flop o el turn con outs — tu equity de respaldo te deja shovear más liviano.`,
      };
    }
    const f = result.breakevenFoldPct;
    const drop = f0 - f;
    return {
      tone: f <= 0 ? ('positive' as const) : ('neutral' as const),
      text: `Sin equity (puro bluff) necesitarías ${formatPct(f0)} de folds. Con tu ${equityPct}% de equity, el breakeven baja a ${formatPct(f)} — son ${formatPct(drop)} menos de fold equity requerida gracias a tus outs. A más equity al momento de shovear, menos falta que el villano se tire.`,
    };
  })();

  const formula =
    'F = [x − E·(1+2x)] ÷ [1 + x − E·(1+2x)]   ·   x = shove/pot, E = equity';
  const substituted = allValid
    ? (() => {
        const x = potNum > 0 ? shoveNum / potNum : 0;
        const e = equityNum / 100;
        const onePlus2x = 1 + 2 * x;
        const num = x - e * onePlus2x;
        const den = 1 + x - e * onePlus2x;
        return `x=${x.toFixed(2)}, E=${e.toFixed(2)} → [${x.toFixed(2)} − ${e.toFixed(2)}·${onePlus2x.toFixed(2)}] ÷ [1 + ${x.toFixed(2)} − ${e.toFixed(2)}·${onePlus2x.toFixed(2)}] = ${num.toFixed(2)} ÷ ${den.toFixed(2)}`;
      })()
    : '—';
  const resultStr = result === null ? '—' : mainDisplay;

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-xl border border-border bg-surface/40 p-5">
        <h2 className="mb-1 text-base font-semibold text-content">
          Fold equity requerida (con tu equity)
        </h2>
        <p className="mb-4 text-sm text-content-muted">
          Cuando vas all-in, ¿qué tan seguido necesitas que el villano foldee para
          que el shove sea +EV? La clave: si tienes equity cuando te pagan (un draw
          en el flop o turn, por ejemplo), el breakeven{' '}
          <span className="font-medium text-content">baja</span> — necesitas menos
          folds que con un bluff puro. Mostramos las dos cifras lado a lado para que
          veas cuánto te ayuda tu equity.
        </p>

        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField
            id="fer-pot"
            label="Bote"
            value={pot}
            onChange={setPot}
            prefix="$"
            min={0}
            step={1}
            invalid={pot.trim() !== '' && potNum === null}
            hint="Lo que hay antes de tu shove"
          />
          <NumberField
            id="fer-shove"
            label="Tu shove (bet del hero)"
            value={shove}
            onChange={setShove}
            prefix="$"
            min={0}
            step={1}
            invalid={shove.trim() !== '' && shoveNum === null}
            hint={`= ${shoveFractionDisplay} del pot`}
          />
          <NumberField
            id="fer-equity"
            label="Equity cuando te pagan"
            value={equityPct}
            onChange={setEquityPct}
            suffix="%"
            min={0}
            max={100}
            step={1}
            invalid={equityPct.trim() !== '' && equityNum === null}
            hint="Qué tan seguido ganas si el villano paga (0% = bluff puro)"
          />
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <ResultCard
          label="Break-even fold (con tu equity) ="
          display={mainDisplay}
          tone={mainTone}
          {...(mainCaption !== undefined ? { caption: mainCaption } : {})}
        />
        <ReadOnlyField
          label="Break-even fold sin equity (bluff puro)"
          display={noEquityDisplay}
          hint="Referencia con E=0 · x/(1+x) = bet/(pot+bet)"
        />
      </div>

      <InsightCard insight={insight} />

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
  insight: { tone: 'positive' | 'neutral'; text: string } | null;
}) {
  if (insight === null) {
    return (
      <div className="rounded-xl border border-border bg-surface/30 px-4 py-3 text-sm text-content-disabled">
        Completa los campos para ver cuánto baja el breakeven con tu equity.
      </div>
    );
  }
  return (
    <div
      className={cn(
        'rounded-xl border px-4 py-3 text-sm',
        insight.tone === 'positive'
          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'
          : 'border-amber-500/40 bg-amber-500/10 text-amber-100',
      )}
    >
      {insight.text}
    </div>
  );
}
