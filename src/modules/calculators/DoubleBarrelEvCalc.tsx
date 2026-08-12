import { useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import { doubleBarrelEv } from '@/utils/ev';
import {
  FormulaDetails,
  NumberField,
  ReadOnlyField,
  ResultCard,
  useMoney,
  formatPct,
  parseField,
} from './CalcShared';

export function DoubleBarrelEvCalc({
  initialPotTurn,
  initialBetTurn,
  initialBetRiver,
}: {
  initialPotTurn?: string | undefined;
  initialBetTurn?: string | undefined;
  initialBetRiver?: string | undefined;
} = {}) {
  const money = useMoney();
  const [potTurn, setPotTurn] = useState(initialPotTurn ?? '100');
  const [betTurn, setBetTurn] = useState(initialBetTurn ?? '50');
  const [foldTurn, setFoldTurn] = useState('25');
  const [betRiver, setBetRiver] = useState(initialBetRiver ?? '150');
  const [foldRiver, setFoldRiver] = useState('50');

  const potTurnNum = parseField(potTurn, { min: 0 });
  const betTurnNum = parseField(betTurn, { min: 0 });
  const foldTurnNum = parseField(foldTurn, { min: 0, max: 100 });
  const betRiverNum = parseField(betRiver, { min: 0 });
  const foldRiverNum = parseField(foldRiver, { min: 0, max: 100 });

  const result = useMemo(() => {
    if (
      potTurnNum === null ||
      betTurnNum === null ||
      foldTurnNum === null ||
      betRiverNum === null ||
      foldRiverNum === null
    ) {
      return null;
    }
    return doubleBarrelEv({
      potTurn: potTurnNum,
      betTurn: betTurnNum,
      foldTurnPct: foldTurnNum,
      betRiver: betRiverNum,
      foldRiverPct: foldRiverNum,
    });
  }, [potTurnNum, betTurnNum, foldTurnNum, betRiverNum, foldRiverNum]);

  const allValid =
    potTurnNum !== null &&
    betTurnNum !== null &&
    foldTurnNum !== null &&
    betRiverNum !== null &&
    foldRiverNum !== null;

  const turnContinueDisplay =
    foldTurnNum !== null ? (100 - foldTurnNum).toFixed(1) : '—';
  const riverContinueDisplay =
    foldRiverNum !== null ? (100 - foldRiverNum).toFixed(1) : '—';

  const riverPotDisplay = result === null ? '—' : `$${result.riverPot}`;
  const pmeTurnDisplay = result === null ? '—' : formatPct(result.pmeTurnPct);
  const pmeRiverDisplay = result === null ? '—' : formatPct(result.pmeRiverPct);

  const turnTone =
    result === null
      ? 'neutral'
      : result.evTurnOnly > 0
        ? 'positive'
        : result.evTurnOnly < 0
          ? 'negative'
          : 'neutral';
  const combinedTone =
    result === null
      ? 'neutral'
      : result.evCombined > 0
        ? 'positive'
        : result.evCombined < 0
          ? 'negative'
          : 'neutral';

  const turnDisplay = result === null ? '—' : money(result.evTurnOnly);
  const combinedDisplay =
    result === null ? '—' : money(result.evCombined);

  const insight = (() => {
    if (result === null) return null;
    const { evTurnOnly, evCombined } = result;
    if (evCombined > 0 && evTurnOnly < 0) {
      return {
        tone: 'positive' as const,
        text: `El barrel del river rescata la jugada: el bet del turn solo pierde ${money(evTurnOnly)}, pero la línea completa gana ${money(evCombined)}. Tener un plan de seguir en el river hace +EV una apuesta que sola sería −EV.`,
      };
    }
    if (evCombined > 0 && evTurnOnly >= 0) {
      return {
        tone: 'positive' as const,
        text: `Ambas son +EV: el bet del turn ya gana ${money(evTurnOnly)} y la línea completa ${money(evCombined)}. Apuesta con confianza.`,
      };
    }
    if (evCombined <= 0 && evTurnOnly < 0) {
      return {
        tone: 'negative' as const,
        text: `La línea completa sigue siendo −EV (${money(evCombined)}). Ni con el barrel del river se rescata: necesitas más fold equity (en el turn o el river) o mejor equity de respaldo.`,
      };
    }
    return {
      tone: 'negative' as const,
      text: `El bet del turn gana solo (${money(evTurnOnly)}) pero seguir con el barrel baja el EV a ${money(evCombined)}. Considerá apostar el turn y checkear el river.`,
    };
  })();

  const turnFormula = 'EV turn solo = Fold_t · Pot_t − (1−Fold_t) · Bet_t';
  const turnSubstituted = allValid
    ? `${(foldTurnNum / 100).toFixed(2)} · ${potTurnNum} − ${((100 - foldTurnNum) / 100).toFixed(2)} · ${betTurnNum}`
    : '—';
  const turnResultStr =
    result !== null ? money(result.evTurnOnly) : '—';

  const combinedFormula =
    'EV combinado = Fold_t · Pot_t + (1−Fold_t) · Fold_r · (Pot_t + Bet_t) − (1−Fold_t) · (1−Fold_r) · (Bet_t + Bet_r)';
  const combinedSubstituted = allValid
    ? `${(foldTurnNum / 100).toFixed(2)} · ${potTurnNum} + ${((100 - foldTurnNum) / 100).toFixed(2)} · ${(foldRiverNum / 100).toFixed(2)} · (${potTurnNum} + ${betTurnNum}) − ${((100 - foldTurnNum) / 100).toFixed(2)} · ${((100 - foldRiverNum) / 100).toFixed(2)} · (${betTurnNum} + ${betRiverNum})`
    : '—';
  const combinedResultStr =
    result !== null ? money(result.evCombined) : '—';

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-xl border border-border bg-surface/40 p-5">
        <h2 className="mb-1 text-base font-semibold text-content">
          Doble barrel (turn + river)
        </h2>
        <p className="mb-4 text-sm text-content-muted">
          Miras si la jugada completa de apostar el turn y volver a barrelear el
          river como bluff es +EV en conjunto, aunque el bet del turn por sí solo
          sea −EV. La fold equity acumulada de las dos calles suele rescatar la
          línea. Asume 0 equity en showdown (bluff puro).
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface/30 p-4">
            <h3 className="text-sm font-semibold text-content">Turn</h3>
            <NumberField
              id="db-pot-turn"
              label="Pot del turn"
              value={potTurn}
              onChange={setPotTurn}
              prefix="$"
              min={0}
              step={1}
              invalid={potTurn.trim() !== '' && potTurnNum === null}
              hint="Lo que hay antes de tu apuesta en el turn"
            />
            <NumberField
              id="db-bet-turn"
              label="Bet del hero (turn)"
              value={betTurn}
              onChange={setBetTurn}
              prefix="$"
              min={0}
              step={1}
              invalid={betTurn.trim() !== '' && betTurnNum === null}
            />
            <NumberField
              id="db-fold-turn"
              label="Fold del villano (turn)"
              value={foldTurn}
              onChange={setFoldTurn}
              suffix="%"
              min={0}
              max={100}
              step={1}
              invalid={foldTurn.trim() !== '' && foldTurnNum === null}
              hint={`Paga el ${turnContinueDisplay}% y vas al river`}
            />
            <ReadOnlyField
              label="PME turn (fold breakeven)"
              display={pmeTurnDisplay}
              hint="Fold mínimo para que el bet del turn (como bluff) sea 0 EV"
            />
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface/30 p-4">
            <h3 className="text-sm font-semibold text-content">River (barrel)</h3>
            <ReadOnlyField
              label="Pot del river"
              display={riverPotDisplay}
              hint="Calculado: Pot del turn + 2 × bet del turn"
            />
            <NumberField
              id="db-bet-river"
              label="Bet del hero (river)"
              value={betRiver}
              onChange={setBetRiver}
              prefix="$"
              min={0}
              step={1}
              invalid={betRiver.trim() !== '' && betRiverNum === null}
            />
            <NumberField
              id="db-fold-river"
              label="Fold del villano (river)"
              value={foldRiver}
              onChange={setFoldRiver}
              suffix="%"
              min={0}
              max={100}
              step={1}
              invalid={foldRiver.trim() !== '' && foldRiverNum === null}
              hint={`Condicional a que pagó el turn · paga el ${riverContinueDisplay}%`}
            />
            <ReadOnlyField
              label="PME river (fold breakeven)"
              display={pmeRiverDisplay}
              hint="Fold mínimo para que el barrel del river (como bluff) sea 0 EV"
            />
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <ResultCard
          label="EV bet turn (solo) ="
          display={turnDisplay}
          tone={turnTone}
          caption="Si apuestas el turn y te rindes en el river."
        />
        <ResultCard
          label="EV combinado (turn + barrel) ="
          display={combinedDisplay}
          tone={combinedTone}
          caption="La línea completa: apostar el turn y barrelear el river."
        />
      </div>

      <InsightCard insight={insight} />

      <section className="rounded-xl border border-border bg-surface/40 p-5">
        <h3 className="mb-3 text-sm font-semibold text-content">Fórmulas</h3>
        <div className="flex flex-col gap-3">
          <FormulaDetails
            formula={turnFormula}
            substituted={turnSubstituted}
            result={turnResultStr}
          />
          <FormulaDetails
            formula={combinedFormula}
            substituted={combinedSubstituted}
            result={combinedResultStr}
          />
        </div>
      </section>
    </div>
  );
}

function InsightCard({
  insight,
}: {
  insight: { tone: 'positive' | 'negative'; text: string } | null;
}) {
  if (insight === null) {
    return (
      <div className="rounded-xl border border-border bg-surface/30 px-4 py-3 text-sm text-content-disabled">
        Completa los campos para ver el análisis de la línea.
      </div>
    );
  }
  return (
    <div
      className={cn(
        'rounded-xl border px-4 py-3 text-sm',
        insight.tone === 'positive'
          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'
          : 'border-rose-500/40 bg-rose-500/10 text-rose-100',
      )}
    >
      {insight.text}
    </div>
  );
}
