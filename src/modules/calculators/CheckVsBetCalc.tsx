import { useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import { betRiverEv, checkRiverEv } from '@/utils/ev';
import {
  FormulaDetails,
  NumberField,
  ReadOnlyField,
  ResultCard,
  formatCurrency,
  formatPct,
  parseField,
} from './CalcShared';

export function CheckVsBetCalc() {
  const [pot, setPot] = useState('100');
  const [checkWinPct, setCheckWinPct] = useState('25');
  const [bet, setBet] = useState('50');
  const [winWhenCalledPct, setWinWhenCalledPct] = useState('0');
  const [foldPct, setFoldPct] = useState('20');
  const [raisePct, setRaisePct] = useState('0');

  const potNum = parseField(pot, { min: 0 });
  const checkWinNum = parseField(checkWinPct, { min: 0, max: 100 });
  const betNum = parseField(bet, { min: 0 });
  const wcNum = parseField(winWhenCalledPct, { min: 0, max: 100 });
  const fNum = parseField(foldPct, { min: 0, max: 100 });
  const rNum = parseField(raisePct, { min: 0, max: 100 });

  const checkLoseDisplay = checkWinNum !== null ? (100 - checkWinNum).toFixed(1) : '—';
  const callPct = fNum !== null && rNum !== null ? 100 - fNum - rNum : null;
  const callDisplay = callPct !== null ? callPct.toFixed(1) : '—';
  const pmeBetDisplay =
    potNum !== null && betNum !== null && potNum + betNum > 0
      ? formatPct((betNum / (potNum + betNum)) * 100)
      : '—';

  const checkResult = useMemo(() => {
    if (potNum === null || checkWinNum === null) return null;
    return checkRiverEv({ pot: potNum, winPct: checkWinNum });
  }, [potNum, checkWinNum]);

  const betResult = useMemo(() => {
    if (
      potNum === null ||
      betNum === null ||
      wcNum === null ||
      fNum === null ||
      rNum === null
    ) {
      return null;
    }
    if (fNum + rNum > 100) return null; // fold + raise no pueden superar 100%
    return betRiverEv({
      pot: potNum,
      bet: betNum,
      winWhenCalledPct: wcNum,
      foldPct: fNum,
      raisePct: rNum,
    });
  }, [potNum, betNum, wcNum, fNum, rNum]);

  const checkAllValid = potNum !== null && checkWinNum !== null;
  const betAllValid =
    potNum !== null &&
    betNum !== null &&
    wcNum !== null &&
    fNum !== null &&
    rNum !== null;

  const checkTone =
    checkResult === null
      ? 'neutral'
      : checkResult > 0
        ? 'positive'
        : checkResult < 0
          ? 'negative'
          : 'neutral';
  const betTone =
    betResult === null
      ? 'neutral'
      : betResult > 0
        ? 'positive'
        : betResult < 0
          ? 'negative'
          : 'neutral';

  const checkDisplay = checkResult === null ? '—' : formatCurrency(checkResult);
  const betDisplay = betResult === null ? '—' : formatCurrency(betResult);

  const recommendation = (() => {
    if (checkResult === null || betResult === null) return null;
    const delta = Math.abs(checkResult - betResult);
    if (delta < 0.005) {
      return { action: 'tie' as const, delta: 0 };
    }
    return checkResult > betResult
      ? { action: 'check' as const, delta }
      : { action: 'bet' as const, delta };
  })();

  const checkFormula = 'EV check = Pot · Win%';
  const checkSubstituted = checkAllValid
    ? `${potNum} · ${(checkWinNum / 100).toFixed(2)}`
    : '—';
  const checkResultStr = checkResult !== null ? formatCurrency(checkResult) : '—';

  const betFormula =
    'EV bet = F·Pot + C·(W·(Pot+Bet) − (1−W)·Bet) − R·Bet   ·   C = 1−F−R';
  const betSubstituted = betAllValid
    ? `${(fNum / 100).toFixed(2)}·${potNum} + ${((100 - fNum - rNum) / 100).toFixed(2)}·(${(wcNum / 100).toFixed(2)}·(${potNum}+${betNum}) − ${((100 - wcNum) / 100).toFixed(2)}·${betNum}) − ${(rNum / 100).toFixed(2)}·${betNum}`
    : '—';
  const betResultStr = betResult !== null ? formatCurrency(betResult) : '—';

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-xl border border-border bg-surface/40 p-5">
        <h2 className="mb-1 text-base font-semibold text-content">Check vs Bet (ríver)</h2>
        <p className="mb-4 text-sm text-content-muted">
          Comparación de EV entre checkear (ir a showdown) y apostar. El villano
          puede tirarse (te llevás el pot), pagar (vas a showdown con tu equity) o
          subir (foldeás perdiendo tu apuesta). Útil en el ríver cuando dudás si
          apostar valor fino, blockear o controlar el bote checkeando.
        </p>

        <div className="mb-4 max-w-sm">
          <NumberField
            id="cvb-pot"
            label="Pot del ríver"
            value={pot}
            onChange={setPot}
            prefix="$"
            min={0}
            step={1}
            invalid={pot.trim() !== '' && potNum === null}
            hint="Compartido entre las dos opciones"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface/30 p-4">
            <h3 className="text-sm font-semibold text-content">Check behind</h3>
            <NumberField
              id="cvb-check-win"
              label="Win% al showdown"
              value={checkWinPct}
              onChange={setCheckWinPct}
              suffix="%"
              min={0}
              max={100}
              step={1}
              invalid={checkWinPct.trim() !== '' && checkWinNum === null}
              hint="Si vas a showdown sin apostar, qué tan seguido ganás"
            />
            <ReadOnlyField
              label="Lose%"
              display={checkLoseDisplay}
              suffix="%"
              hint="Complemento — calculado automáticamente"
            />
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface/30 p-4">
            <h3 className="text-sm font-semibold text-content">Apostar</h3>
            <NumberField
              id="cvb-bet"
              label="Tamaño de la apuesta"
              value={bet}
              onChange={setBet}
              prefix="$"
              min={0}
              step={1}
              invalid={bet.trim() !== '' && betNum === null}
            />
            <NumberField
              id="cvb-wc"
              label="Win% si te pagan"
              value={winWhenCalledPct}
              onChange={setWinWhenCalledPct}
              suffix="%"
              min={0}
              max={100}
              step={1}
              invalid={winWhenCalledPct.trim() !== '' && wcNum === null}
              hint="Equity vs el rango que te paga (0% si bluffeás sin outs)"
            />
            <NumberField
              id="cvb-fold"
              label="F% — Frecuencia de fold"
              value={foldPct}
              onChange={setFoldPct}
              suffix="%"
              min={0}
              max={100}
              step={1}
              invalid={foldPct.trim() !== '' && fNum === null}
              hint="Se tira y te llevás el pot"
            />
            <NumberField
              id="cvb-raise"
              label="R% — Frecuencia de raise"
              value={raisePct}
              onChange={setRaisePct}
              suffix="%"
              min={0}
              max={100}
              step={1}
              invalid={raisePct.trim() !== '' && rNum === null}
              hint="Te sube y foldeás perdiendo tu apuesta (0% si no te suben)"
            />
            <ReadOnlyField
              label="C% — Te paga (call)"
              display={callDisplay}
              suffix="%"
              hint={
                callPct !== null && callPct < 0
                  ? '⚠ Fold% + Raise% supera 100% — ajustá los valores'
                  : '100% − Fold% − Raise%'
              }
            />
            <ReadOnlyField
              label="PME — pot odds que ofrecés"
              display={pmeBetDisplay}
              hint="Bet/(Pot+Bet) · equity que el villano necesita para pagar"
            />
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <ResultCard label="EV Check =" display={checkDisplay} tone={checkTone} />
        <ResultCard label="EV Bet =" display={betDisplay} tone={betTone} />
      </div>

      <RecommendationCard rec={recommendation} />

      <section className="rounded-xl border border-border bg-surface/40 p-5">
        <h3 className="mb-3 text-sm font-semibold text-content">Fórmulas</h3>
        <div className="flex flex-col gap-3">
          <FormulaDetails
            formula={checkFormula}
            substituted={checkSubstituted}
            result={checkResultStr}
          />
          <FormulaDetails
            formula={betFormula}
            substituted={betSubstituted}
            result={betResultStr}
          />
        </div>
      </section>
    </div>
  );
}

function RecommendationCard({
  rec,
}: {
  rec: { action: 'check' | 'bet' | 'tie'; delta: number } | null;
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
        <span className="font-semibold text-content">Empate</span> — ambas opciones
        rinden lo mismo. Decisión libre por factores fuera del modelo (image,
        rango percibido, futuras manos).
      </div>
    );
  }

  const label = rec.action === 'check' ? 'Checkear' : 'Apostar';
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
        de EV frente a la otra opción.
      </span>
    </div>
  );
}
