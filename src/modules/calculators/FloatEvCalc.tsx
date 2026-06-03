import { useMemo, useState } from 'react';
import { floatEv } from '@/utils/ev';
import {
  FormulaDetails,
  NumberField,
  ReadOnlyField,
  ResultCard,
  evInterpretation,
  formatCurrency,
  parseField,
} from './CalcShared';

export function FloatEvCalc({
  initialPot,
  initialCall,
  initialBarrelPct,
  initialXfPct,
  initialTurnBet,
}: {
  initialPot?: string | undefined;
  initialCall?: string | undefined;
  initialBarrelPct?: string | undefined;
  initialXfPct?: string | undefined;
  initialTurnBet?: string | undefined;
} = {}) {
  const [potOnFlop, setPotOnFlop] = useState(initialPot ?? '100');
  const [callOnFlop, setCallOnFlop] = useState(initialCall ?? '25');
  const [barrelPct, setBarrelPct] = useState(initialBarrelPct ?? '55');
  const [xfPct, setXfPct] = useState(initialXfPct ?? '50');
  const [turnBet, setTurnBet] = useState(initialTurnBet ?? '75');

  const potNum = parseField(potOnFlop, { min: 0 });
  const callNum = parseField(callOnFlop, { min: 0 });
  const barrelNum = parseField(barrelPct, { min: 0, max: 100 });
  const xfNum = parseField(xfPct, { min: 0, max: 100 });
  const turnBetNum = parseField(turnBet, { min: 0 });

  const potAfterCallDisplay =
    potNum !== null && callNum !== null
      ? `$${(potNum + callNum).toFixed(0)}`
      : '—';

  const restPctDisplay =
    barrelNum !== null && xfNum !== null
      ? (100 - barrelNum - xfNum).toFixed(1)
      : '—';

  const result = useMemo(() => {
    if (
      potNum === null ||
      callNum === null ||
      barrelNum === null ||
      xfNum === null ||
      turnBetNum === null
    ) {
      return null;
    }
    return floatEv({
      potOnFlop: potNum,
      callOnFlop: callNum,
      barrelPct: barrelNum,
      xfPct: xfNum,
      turnBet: turnBetNum,
    });
  }, [potNum, callNum, barrelNum, xfNum, turnBetNum]);

  const tone =
    result === null ? 'neutral' : result > 0 ? 'positive' : result < 0 ? 'negative' : 'neutral';
  const display = result === null ? '—' : formatCurrency(result);

  const formula =
    'EV = Barrel% · (−Call) + X/F% · Pot − Resto% · (Turn bet + Call)';
  const substituted =
    potNum !== null &&
    callNum !== null &&
    barrelNum !== null &&
    xfNum !== null &&
    turnBetNum !== null
      ? `${(barrelNum / 100).toFixed(2)} · (−${callNum}) + ${(xfNum / 100).toFixed(2)} · ${potNum} − ${((100 - barrelNum - xfNum) / 100).toFixed(2)} · (${turnBetNum} + ${callNum})`
      : '—';
  const resultStr = result !== null ? formatCurrency(result) : '—';

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-xl border border-border bg-surface/40 p-5">
        <h2 className="mb-1 text-base font-semibold text-content">
          EV de flotar
        </h2>
        <p className="mb-4 text-sm text-content-muted">
          El villano apuesta el flop y estás pensando en flotar (pagar sin nada
          hecho) para robarle el turn cuando checkee. ¿Es +EV dadas sus
          frecuencias de barrel y check-fold?
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField
            id="float-pot"
            label="Pot en el flop (antes de tu call)"
            value={potOnFlop}
            onChange={setPotOnFlop}
            prefix="$"
            min={0}
            step={1}
            invalid={potOnFlop.trim() !== '' && potNum === null}
            hint="Lo que hay en el bote incluyendo la apuesta del villano"
          />
          <NumberField
            id="float-call"
            label="Tu call en el flop"
            value={callOnFlop}
            onChange={setCallOnFlop}
            prefix="$"
            min={0}
            step={1}
            invalid={callOnFlop.trim() !== '' && callNum === null}
          />
          <NumberField
            id="float-barrel"
            label="Barrel% — Frecuencia con que el villano dispara el turn"
            value={barrelPct}
            onChange={setBarrelPct}
            suffix="%"
            min={0}
            max={100}
            step={1}
            invalid={barrelPct.trim() !== '' && barrelNum === null}
            hint="Cuando barrelea, tiras tu mano y pierdes el call"
          />
          <NumberField
            id="float-xf"
            label="X/F% — Frecuencia con que checkea y se tira a tu turn bet"
            value={xfPct}
            onChange={setXfPct}
            suffix="%"
            min={0}
            max={100}
            step={1}
            invalid={xfPct.trim() !== '' && xfNum === null}
            hint="Cuando checkea y se tira, te llevas el pot del flop"
          />
          <NumberField
            id="float-turn-bet"
            label="Tu turn bet (cuando checkea)"
            value={turnBet}
            onChange={setTurnBet}
            prefix="$"
            min={0}
            step={1}
            invalid={turnBet.trim() !== '' && turnBetNum === null}
            hint={`Disparas dentro de ${potAfterCallDisplay} (pot tras tu call)`}
          />
          <ReadOnlyField
            label="Resto% — Checkea y te paga el turn"
            display={restPctDisplay}
            suffix="%"
            hint="100% − Barrel% − X/F%. Vas a showdown perdiendo call + turn bet"
          />
        </div>
      </section>

      <ResultCard
        label="EV ="
        display={display}
        tone={tone}
        {...(result !== null ? { caption: evInterpretation(result) } : {})}
      />

      <FormulaDetails
        formula={formula}
        substituted={substituted}
        result={resultStr}
      />
    </div>
  );
}
