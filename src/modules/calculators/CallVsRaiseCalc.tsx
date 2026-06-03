import { useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import { allInEv, callRiverBetEv } from '@/utils/ev';
import {
  FormulaDetails,
  NumberField,
  ReadOnlyField,
  ResultCard,
  formatCurrency,
  formatPct,
  parseField,
} from './CalcShared';

export function CallVsRaiseCalc({
  initialPot,
  initialCall,
  initialShove,
}: {
  initialPot?: string | undefined;
  initialCall?: string | undefined;
  initialShove?: string | undefined;
} = {}) {
  const [pot, setPot] = useState(initialPot ?? '150');
  const [call, setCall] = useState(initialCall ?? '50');
  const [callEquityPct, setCallEquityPct] = useState('25');
  const [shove, setShove] = useState(initialShove ?? '200');
  const [winWhenCalledPct, setWinWhenCalledPct] = useState('25');
  const [foldPct, setFoldPct] = useState('50');

  const potNum = parseField(pot, { min: 0 });
  const callNum = parseField(call, { min: 0 });
  const callEqNum = parseField(callEquityPct, { min: 0, max: 100 });
  const shoveNum = parseField(shove, { min: 0 });
  const wcNum = parseField(winWhenCalledPct, { min: 0, max: 100 });
  const fNum = parseField(foldPct, { min: 0, max: 100 });

  const callLoseDisplay = callEqNum !== null ? (100 - callEqNum).toFixed(1) : '—';
  const pmeCallDisplay =
    potNum !== null && callNum !== null && potNum + callNum > 0
      ? formatPct((callNum / (potNum + callNum)) * 100)
      : '—';
  const continueDisplay = fNum !== null ? (100 - fNum).toFixed(1) : '—';

  const callResult = useMemo(() => {
    if (potNum === null || callNum === null || callEqNum === null) return null;
    return callRiverBetEv({ pot: potNum, call: callNum, equityPct: callEqNum });
  }, [potNum, callNum, callEqNum]);

  const raiseResult = useMemo(() => {
    if (
      potNum === null ||
      callNum === null ||
      shoveNum === null ||
      wcNum === null ||
      fNum === null
    ) {
      return null;
    }
    return allInEv({
      pot: potNum,
      call: callNum,
      shove: shoveNum,
      equityPct: wcNum,
      foldPct: fNum,
    });
  }, [potNum, callNum, shoveNum, wcNum, fNum]);

  const callAllValid =
    potNum !== null && callNum !== null && callEqNum !== null;
  const raiseAllValid =
    potNum !== null &&
    callNum !== null &&
    shoveNum !== null &&
    wcNum !== null &&
    fNum !== null;

  const callTone =
    callResult === null
      ? 'neutral'
      : callResult > 0
        ? 'positive'
        : callResult < 0
          ? 'negative'
          : 'neutral';
  const raiseTone =
    raiseResult === null
      ? 'neutral'
      : raiseResult.ev > 0
        ? 'positive'
        : raiseResult.ev < 0
          ? 'negative'
          : 'neutral';

  const callDisplay = callResult === null ? '—' : formatCurrency(callResult);
  const raiseDisplay =
    raiseResult === null ? '—' : formatCurrency(raiseResult.ev);

  const raiseBreakeven = (() => {
    if (raiseResult === null) return null;
    const be = raiseResult.breakevenFoldPct;
    if (be === null) return 'Breakeven F% — sin solución finita.';
    if (be < 0) return '+EV en cualquier fold equity.';
    if (be > 100) return 'Breakeven F% > 100% — imposible con este showdown.';
    return `Breakeven F% = ${be.toFixed(1)}% para Raise ≥ Fold.`;
  })();

  // Mejor de {Call, Raise, Fold=0}. Fold siempre disponible con EV 0.
  const recommendation = (() => {
    if (callResult === null || raiseResult === null) return null;
    const options = [
      { action: 'call' as const, ev: callResult },
      { action: 'raise' as const, ev: raiseResult.ev },
      { action: 'fold' as const, ev: 0 },
    ].sort((a, b) => b.ev - a.ev);
    const [best, second] = options;
    if (best === undefined || second === undefined) return null;
    const delta = best.ev - second.ev;
    if (delta < 0.005) return { action: 'tie' as const, delta: 0 };
    return { action: best.action, delta };
  })();

  const callFormula = 'EV Call = Pot · eq − Call · (1−eq)';
  const callSubstituted = callAllValid
    ? `${potNum} · ${(callEqNum / 100).toFixed(2)} − ${callNum} · ${((100 - callEqNum) / 100).toFixed(2)}`
    : '—';
  const callResultStr = callResult !== null ? formatCurrency(callResult) : '—';

  const raiseFormula =
    'EV Raise = F% · Pot + (1−F%) · W% · (Pot+Shove−Call) − (1−F%) · (1−W%) · Shove';
  const raiseSubstituted = raiseAllValid
    ? `${(fNum / 100).toFixed(2)} · ${potNum} + ${((100 - fNum) / 100).toFixed(2)} · ${(wcNum / 100).toFixed(2)} · (${potNum} + ${shoveNum} − ${callNum}) − ${((100 - fNum) / 100).toFixed(2)} · ${((100 - wcNum) / 100).toFixed(2)} · ${shoveNum}`
    : '—';
  const raiseResultStr =
    raiseResult !== null ? formatCurrency(raiseResult.ev) : '—';

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-xl border border-border bg-surface/40 p-5">
        <h2 className="mb-1 text-base font-semibold text-content">
          Call vs Raise (ríver)
        </h2>
        <p className="mb-4 text-sm text-content-muted">
          Enfrentás una apuesta en el ríver: ¿pagás o raiseas all-in? Compara
          el EV de pagar (vas a showdown con tu equity) contra el de restarse All-in
          o raisear (fold equity + showdown si te pagan). Si ambas opciones son
          negativas, lo mejor es Foldear.
        </p>

        <div className="mb-4 grid gap-4 sm:grid-cols-2">
          <NumberField
            id="cvr-pot"
            label="Pot del ríver"
            value={pot}
            onChange={setPot}
            prefix="$"
            min={0}
            step={1}
            invalid={pot.trim() !== '' && potNum === null}
            hint="Incluye la apuesta del villano + Pot."
          />
          <NumberField
            id="cvr-call"
            label="Monto a pagar"
            value={call}
            onChange={setCall}
            prefix="$"
            min={0}
            step={1}
            invalid={call.trim() !== '' && callNum === null}
            hint="La apuesta que estás enfrentando."
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface/30 p-4">
            <h3 className="text-sm font-semibold text-content">Call (pagar)</h3>
            <NumberField
              id="cvr-call-eq"
              label="Equity al pagar"
              value={callEquityPct}
              onChange={setCallEquityPct}
              suffix="%"
              min={0}
              max={100}
              step={1}
              invalid={callEquityPct.trim() !== '' && callEqNum === null}
              hint="Si pagás y vas a showdown, qué tan seguido ganás el pot"
            />
            <ReadOnlyField
              label="Lose%"
              display={callLoseDisplay}
              suffix="%"
              hint="Complemento — calculado automáticamente"
            />
            <ReadOnlyField
              label="PME — equity para pagar"
              display={pmeCallDisplay}
              hint="Call/(Pot+Call) · si tu equity supera esto, pagar es +EV"
            />
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface/30 p-4">
            <h3 className="text-sm font-semibold text-content">Raise (restarse all-in)</h3>
            <NumberField
              id="cvr-shove"
              label="Tu all-in (total)"
              value={shove}
              onChange={setShove}
              prefix="$"
              min={0}
              step={1}
              invalid={shove.trim() !== '' && shoveNum === null}
              hint="El total con lo que te restas (no adicional al call)"
            />
            <NumberField
              id="cvr-wc"
              label="Win% si te pagan"
              value={winWhenCalledPct}
              onChange={setWinWhenCalledPct}
              suffix="%"
              min={0}
              max={100}
              step={1}
              invalid={winWhenCalledPct.trim() !== '' && wcNum === null}
              hint="Equity vs el rango que te paga el all-in"
            />
            <NumberField
              id="cvr-fold"
              label="F% — Frecuencia de fold"
              value={foldPct}
              onChange={setFoldPct}
              suffix="%"
              min={0}
              max={100}
              step={1}
              invalid={foldPct.trim() !== '' && fNum === null}
              hint={`Te paga el ${continueDisplay}% restante`}
            />
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <ResultCard label="EV Call =" display={callDisplay} tone={callTone} />
        <ResultCard
          label="EV Raise ="
          display={raiseDisplay}
          tone={raiseTone}
          {...(raiseBreakeven !== null ? { caption: raiseBreakeven } : {})}
        />
      </div>

      <RecommendationCard rec={recommendation} />

      <section className="rounded-xl border border-border bg-surface/40 p-5">
        <h3 className="mb-3 text-sm font-semibold text-content">Fórmulas</h3>
        <div className="flex flex-col gap-3">
          <FormulaDetails
            formula={callFormula}
            substituted={callSubstituted}
            result={callResultStr}
          />
          <FormulaDetails
            formula={raiseFormula}
            substituted={raiseSubstituted}
            result={raiseResultStr}
          />
        </div>
      </section>
    </div>
  );
}

function RecommendationCard({
  rec,
}: {
  rec: { action: 'call' | 'raise' | 'fold' | 'tie'; delta: number } | null;
}) {
  if (rec === null) {
    return (
      <div className="rounded-xl border border-border bg-surface/30 px-4 py-3 text-sm text-content-disabled">
        Completá los campos para ver la recomendación.
      </div>
    );
  }

  if (rec.action === 'tie') {
    return (
      <div className="rounded-xl border border-border bg-surface/40 px-4 py-3 text-sm text-content-muted">
        <span className="font-semibold text-content">Empate</span> — las mejores
        opciones rinden lo mismo. Decisión libre por factores fuera del modelo
        (image, rango percibido, ICM).
      </div>
    );
  }

  const label =
    rec.action === 'call' ? 'Call' : rec.action === 'raise' ? 'Raise' : 'Fold';
  return (
    <div
      className={cn(
        'flex flex-wrap items-baseline gap-3 rounded-xl border px-4 py-3',
        'border-accent/40 bg-accent/10',
      )}
    >
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-content-muted">
        Recomendación
      </span>
      <span className="text-base font-bold text-content">{label}</span>
      <span className="text-sm text-content-muted">
        gana por{' '}
        <span className="font-mono font-semibold tabular-nums text-emerald-300">
          {formatCurrency(rec.delta)}
        </span>{' '}
        de EV frente a la siguiente mejor opción.
      </span>
    </div>
  );
}
