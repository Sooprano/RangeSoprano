import { useMemo, useState } from 'react';
import { bluffEv } from '@/utils/ev';
import {
  FormulaDetails,
  NumberField,
  ReadOnlyField,
  ResultCard,
  formatCurrency,
  parseField,
} from './CalcShared';

export function BluffEvCalc({
  initialPot,
  initialBet,
  initialFoldPct,
}: {
  initialPot?: string | undefined;
  initialBet?: string | undefined;
  initialFoldPct?: string | undefined;
} = {}) {
  const [pot, setPot] = useState(initialPot ?? '100');
  const [bet, setBet] = useState(initialBet ?? '75');
  const [foldPct, setFoldPct] = useState(initialFoldPct ?? '45');

  const potNum = parseField(pot, { min: 0 });
  const betNum = parseField(bet, { min: 0 });
  const fNum = parseField(foldPct, { min: 0, max: 100 });

  const continuePctDisplay = fNum !== null ? `${(100 - fNum).toFixed(1)}` : '—';
  const betAsPctPotDisplay =
    potNum !== null && betNum !== null && potNum > 0
      ? `${((betNum / potNum) * 100).toFixed(1)}`
      : '—';

  const result = useMemo(() => {
    if (potNum === null || betNum === null || fNum === null) return null;
    return bluffEv({ pot: potNum, bet: betNum, foldPct: fNum });
  }, [potNum, betNum, fNum]);

  const allValid = potNum !== null && betNum !== null && fNum !== null;

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
      return 'Breakeven F% — sin solución finita (pot + bet = 0).';
    }
    return (
      <>
        <span className="font-mono tabular-nums text-content">
          Breakeven F% = {be.toFixed(1)}%
        </span>
        {' — '}
        necesitás que el villano se tire al menos ese porcentaje para que el
        bluff sea ≥ EV 0.
      </>
    );
  })();

  const formula = 'EV = F% · Pot − (1−F%) · Bet';
  const substituted = allValid
    ? `${(fNum / 100).toFixed(2)} · ${potNum} − ${((100 - fNum) / 100).toFixed(2)} · ${betNum}`
    : '—';
  const resultStr = result !== null ? formatCurrency(result.ev) : '—';

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-xl border border-border bg-surface/40 p-5">
        <h2 className="mb-1 text-base font-semibold text-content">EV de bluff</h2>
        <p className="mb-4 text-sm text-content-muted">
          EV de un bluff puro sin equity en showdown. Cuando el villano se tira
          te llevás el pot; cuando paga perdés tu apuesta completa. Útil para
          river bluffs o blocker bets donde ya no podés mejorar.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField
            id="bluff-pot"
            label="Pot antes del bluff"
            value={pot}
            onChange={setPot}
            prefix="$"
            min={0}
            step={1}
            invalid={pot.trim() !== '' && potNum === null}
            hint="Lo que ya hay en el centro antes de tu apuesta"
          />
          <NumberField
            id="bluff-bet"
            label="Tamaño del bluff"
            value={bet}
            onChange={setBet}
            prefix="$"
            min={0}
            step={1}
            invalid={bet.trim() !== '' && betNum === null}
            hint="Lo que estás arriesgando si te pagan"
          />
          <NumberField
            id="bluff-fold"
            label="F% — Con qué frecuencia se tira"
            value={foldPct}
            onChange={setFoldPct}
            suffix="%"
            min={0}
            max={100}
            step={1}
            invalid={foldPct.trim() !== '' && fNum === null}
            hint="Tu lectura de la fold equity del bluff"
          />
          <ReadOnlyField
            label="C% — Continúa pagando"
            display={continuePctDisplay}
            suffix="%"
            hint="Complemento de F% — calculado automáticamente"
          />
          <ReadOnlyField
            label="Bet como % del pot"
            display={betAsPctPotDisplay}
            suffix="%"
            hint="Tamaño del bluff relativo al pot"
          />
        </div>
      </section>

      <ResultCard
        label="EV ="
        display={display}
        tone={tone}
        caption={breakevenCaption}
      />

      <Breakdown result={result} pot={potNum} bet={betNum} foldPct={fNum} />

      <FormulaDetails
        formula={formula}
        substituted={substituted}
        result={resultStr}
      />
    </div>
  );
}

function Breakdown({
  result,
  pot,
  bet,
  foldPct,
}: {
  result: ReturnType<typeof bluffEv> | null;
  pot: number | null;
  bet: number | null;
  foldPct: number | null;
}) {
  if (result === null || pot === null || bet === null || foldPct === null) {
    return null;
  }
  const continuePct = 100 - foldPct;
  return (
    <section className="rounded-xl border border-border bg-surface/40 p-5">
      <h3 className="mb-3 text-sm font-semibold text-content">Desglose</h3>
      <div className="flex flex-col gap-2 text-sm">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-content-muted">
            <span className="font-mono tabular-nums text-content">
              {foldPct.toFixed(1)}%
            </span>{' '}
            del tiempo se tira → te llevás el pot de{' '}
            <span className="font-mono tabular-nums text-content">
              {formatCurrency(pot)}
            </span>
          </span>
          <span className="font-mono font-semibold tabular-nums text-emerald-300">
            {formatCurrency(result.pickupAmount)}
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-content-muted">
            <span className="font-mono tabular-nums text-content">
              {continuePct.toFixed(1)}%
            </span>{' '}
            del tiempo paga → perdés tu bet de{' '}
            <span className="font-mono tabular-nums text-content">
              {formatCurrency(bet)}
            </span>
          </span>
          <span className="font-mono font-semibold tabular-nums text-rose-300">
            −{formatCurrency(result.lossAmount)}
          </span>
        </div>
      </div>
    </section>
  );
}
