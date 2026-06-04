import { useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import { foldPctFromCombos, raiseBluffEv } from '@/utils/ev';
import {
  FormulaDetails,
  NumberField,
  ReadOnlyField,
  ResultCard,
  formatCurrency,
  formatPct,
  parseField,
} from './CalcShared';

export function RaiseBluffEvCalc({
  initialPot,
  initialVillainBet,
  initialRaiseCost,
  initialFoldPct,
}: {
  initialPot?: string | undefined;
  initialVillainBet?: string | undefined;
  initialRaiseCost?: string | undefined;
  initialFoldPct?: string | undefined;
} = {}) {
  const [pot, setPot] = useState(initialPot ?? '100');
  const [villainBet, setVillainBet] = useState(initialVillainBet ?? '50');
  const [raiseCost, setRaiseCost] = useState(initialRaiseCost ?? '150');
  const [foldPct, setFoldPct] = useState(initialFoldPct ?? '55');
  const [useCombos, setUseCombos] = useState(false);
  const [combosBet, setCombosBet] = useState('10');
  const [combosCall, setCombosCall] = useState('5.8');

  const potNum = parseField(pot, { min: 0 });
  const vbetNum = parseField(villainBet, { min: 0 });
  const costNum = parseField(raiseCost, { min: 0 });
  const foldDirectNum = parseField(foldPct, { min: 0, max: 100 });
  const combosBetNum = parseField(combosBet, { min: 0 });
  const combosCallNum = parseField(combosCall, { min: 0 });

  // Fold% efectivo: directo o derivado de combos.
  const foldNum = useCombos
    ? combosBetNum !== null && combosCallNum !== null && combosBetNum > 0
      ? foldPctFromCombos(combosBetNum, combosCallNum)
      : null
    : foldDirectNum;

  const foldFromCombosDisplay =
    useCombos && foldNum !== null ? formatPct(foldNum) : '—';

  const result = useMemo(() => {
    if (potNum === null || vbetNum === null || costNum === null || foldNum === null) {
      return null;
    }
    return raiseBluffEv({
      pot: potNum,
      villainBet: vbetNum,
      raiseCost: costNum,
      foldPct: foldNum,
    });
  }, [potNum, vbetNum, costNum, foldNum]);

  const allValid =
    potNum !== null && vbetNum !== null && costNum !== null && foldNum !== null;

  const tone =
    result === null ? 'neutral' : result.ev > 0 ? 'positive' : result.ev < 0 ? 'negative' : 'neutral';
  const display = result === null ? '—' : formatCurrency(result.ev);
  const breakevenDisplay =
    result === null ? '—' : formatPct(result.breakevenFoldPct);

  const breakevenCaption = (() => {
    if (result === null || foldNum === null) return undefined;
    const be = result.breakevenFoldPct;
    return foldNum >= be
      ? `El villano se tira el ${formatPct(foldNum)}, por encima del breakeven (${formatPct(be)}) → el raise es +EV.`
      : `El villano se tira el ${formatPct(foldNum)}, por debajo del breakeven (${formatPct(be)}) → el raise es −EV.`;
  })();

  const formula = 'EV = F·(Pot+Apuesta) − (1−F)·Coste del raise';
  const substituted = allValid
    ? `${(foldNum / 100).toFixed(2)}·(${potNum}+${vbetNum}) − ${((100 - foldNum) / 100).toFixed(2)}·${costNum}`
    : '—';
  const resultStr = result === null ? '—' : formatCurrency(result.ev);

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-xl border border-border bg-surface/40 p-5">
        <h2 className="mb-1 text-base font-semibold text-content">
          EV del raise (bluff)
        </h2>
        <p className="mb-4 text-sm text-content-muted">
          Subes como bluff sobre la apuesta del villano. Si se tira, te llevas el
          pot más su apuesta; si paga, pierdes el coste de tu raise (asume 0 equity
          si te paga). Puedes poner el fold% a mano o derivarlo de los combos que el
          villano apuesta y los que te pagan.
        </p>

        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField
            id="rb-pot"
            label="Bote"
            value={pot}
            onChange={setPot}
            prefix="$"
            min={0}
            step={1}
            invalid={pot.trim() !== '' && potNum === null}
            hint="Lo que hay antes de la apuesta del villano"
          />
          <NumberField
            id="rb-vbet"
            label="Apuesta del villano"
            value={villainBet}
            onChange={setVillainBet}
            prefix="$"
            min={0}
            step={1}
            invalid={villainBet.trim() !== '' && vbetNum === null}
            hint="Lo que apostó y vas a subir"
          />
          <NumberField
            id="rb-cost"
            label="Coste del raise"
            value={raiseCost}
            onChange={setRaiseCost}
            prefix="$"
            min={0}
            step={1}
            invalid={raiseCost.trim() !== '' && costNum === null}
            hint="Lo que pones de tu stack al subir"
          />
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            role="switch"
            aria-checked={useCombos}
            onClick={() => setUseCombos((v) => !v)}
            className={cn(
              'relative h-5 w-9 shrink-0 rounded-full transition-colors',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light',
              useCombos ? 'bg-accent' : 'bg-surface-hover',
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform',
                useCombos ? 'translate-x-[18px]' : 'translate-x-0.5',
              )}
            />
          </button>
          <span className="text-sm text-content-muted">
            Derivar fold% de combos
          </span>
        </div>

        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          {useCombos ? (
            <>
              <NumberField
                id="rb-combos-bet"
                label="Combos que apuestan"
                value={combosBet}
                onChange={setCombosBet}
                min={0}
                step={1}
                invalid={combosBet.trim() !== '' && combosBetNum === null}
                hint="Total de combos con los que el villano apuesta"
              />
              <NumberField
                id="rb-combos-call"
                label="Combos que pagan"
                value={combosCall}
                onChange={setCombosCall}
                min={0}
                step={1}
                invalid={combosCall.trim() !== '' && combosCallNum === null}
                hint="De esos, cuántos pagan tu raise"
              />
              <ReadOnlyField
                label="Fold% (derivado)"
                display={foldFromCombosDisplay}
                hint="1 − combos que pagan / combos que apuestan"
              />
            </>
          ) : (
            <NumberField
              id="rb-fold"
              label="Fold% del villano"
              value={foldPct}
              onChange={setFoldPct}
              suffix="%"
              min={0}
              max={100}
              step={1}
              invalid={foldPct.trim() !== '' && foldDirectNum === null}
              hint="Con qué frecuencia se tira a tu raise"
            />
          )}
        </div>
      </section>

      <ResultCard
        label="EV del raise ="
        display={display}
        tone={tone}
        {...(breakevenCaption !== undefined ? { caption: breakevenCaption } : {})}
      />

      <ReadOnlyField
        label="PME — breakeven fold%"
        display={breakevenDisplay}
        hint="Coste / (Coste + Pot + Apuesta) · fold mínimo del villano para que el raise sea EV 0"
      />

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
