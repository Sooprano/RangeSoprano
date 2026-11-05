// EV calculator (§9), two modes:
// - "Hero decide": Check + bet sizes. Each bet has its own continuation range.
// - "Villano apuesta": Fold / Call / Raise N×. Call's range is the villain's
//   betting range; each raise's range ("goes on vs the raise") sits on top of
//   it, and inside each raise card "Si te re-sube all-in" (D133): of what goes
//   on, the hands that shove — like a solver's Fold / Call / All-in answer.
//   Facing the all-in Hero takes the better of calling and folding.
// Selecting a row makes the category table edit its range. Shows what
// continues, fold equity, Hero equity, EV in bb / % of the pot, the played row
// and the best EV, with the green / amber / rose rule of `tone.ts`.

import { useState } from 'react';
import { Flag, Plus, Star, X, Zap } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { ActionRow, AnalyzerMode } from '../engine/chain';
import type { EvRowResult } from '../engine/ev';
import { reraiseRowId } from '../store/analyzerStore';
import { combos as fmtCombos, pct } from './format';
import { evTone, TONE_BAR, TONE_TEXT, toneVs, type Tone } from './tone';

export type EvRowView = ActionRow & EvRowResult & { edited: boolean };

type Props = {
  mode: AnalyzerMode;
  onMode: (mode: AnalyzerMode) => void;
  rows: EvRowView[];
  bestId: string | null;
  selectedRow: string;
  playedRow: string;
  /** Pot of the street in bb (before the villain's bet), or undefined. */
  pot: number | undefined;
  /** "Villano apuesta": the villain's bet in % of the pot. */
  villainBetPct: number;
  onVillainBet: (pct: number) => void;
  /** "Villano apuesta": share of the starting range the villain bets with. */
  betShare: number;
  pending: boolean;
  onSelect: (id: string) => void;
  onMarkPlayed: (id: string) => void;
  onAddSize: (size: number) => void;
  onAddRaise: (multiple: number) => void;
  /** Effective stack behind on this street (bb): typed, or from the hand (D133). */
  effStack: number | null;
  /** The value the hand gives (null for a test hand). */
  stackFromHand: number | null;
  onEffStack: (bb: number | null) => void;
  /** Weighted combos marked as re-raising all-in over the raise of `multiple`. */
  reraiseCombos: (multiple: number) => number;
  /** D135: how the villain's betting range answers the raise of `multiple`. */
  raiseSplit: (multiple: number) => RaiseSplit | null;
  /** Removes a bet / raise size (not the played one). */
  onRemove: (id: string) => void;
};

/** Shares of the villain's betting range that fold / call / shove vs a raise. */
export type RaiseSplit = { fold: number; call: number; allin: number };

function signed(x: number, digits: number): string {
  if (!Number.isFinite(x)) return '—';
  const s = x.toFixed(digits);
  return x > 0 ? `+${s}` : s;
}

function Metric({
  label,
  value,
  tone = 'neutral',
  strong = false,
  title,
}: {
  label: string;
  value: string;
  tone?: Tone;
  strong?: boolean;
  title?: string;
}) {
  return (
    <div className="min-w-0" title={title}>
      <p className="text-[10px] uppercase tracking-wide text-content-muted">{label}</p>
      <p
        className={cn(
          // EV keeps "+4.57 bb" on one line; its column is sized to fit it.
          'whitespace-nowrap tabular-nums',
          strong ? 'text-base font-semibold' : 'text-sm',
          TONE_TEXT[tone],
        )}
      >
        {value}
      </p>
    </div>
  );
}

/** Fold equity bar with a tick at the auto-profit threshold. */
function FoldBar({ foldEq, threshold, tone }: { foldEq: number; threshold: number; tone: Tone }) {
  const w = Math.min(100, Math.max(0, foldEq * 100));
  const t = Math.min(100, Math.max(0, threshold * 100));
  return (
    <div
      className="relative mt-1.5 h-1.5 w-full rounded-full bg-border/60"
      role="img"
      aria-label={`Fold equity ${w.toFixed(0)}%, umbral ${t.toFixed(0)}%`}
    >
      <div className={cn('h-full rounded-full', TONE_BAR[tone])} style={{ width: `${w}%` }} />
      <div
        className="absolute -top-0.5 h-2.5 w-0.5 rounded bg-content"
        style={{ left: `calc(${t}% - 1px)` }}
      />
    </div>
  );
}

function SizeForm({
  id,
  placeholder,
  label,
  button,
  min,
  onAdd,
}: {
  id: string;
  placeholder: string;
  label: string;
  button: string;
  min: number;
  onAdd: (n: number) => void;
}) {
  const [value, setValue] = useState('');
  return (
    <form
      className="mt-3 flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const n = Number(value.replace(',', '.').replace(/x$/i, ''));
        if (Number.isFinite(n) && n > min) {
          onAdd(n);
          setValue('');
        }
      }}
    >
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        inputMode="decimal"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-24 rounded-md border border-border bg-bg px-2 py-1 text-sm"
      />
      <button
        type="submit"
        className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-content-muted hover:bg-surface-hover hover:text-content"
      >
        <Plus className="h-3.5 w-3.5" /> {button}
      </button>
    </form>
  );
}

const VILLAIN_BET_CHIPS = [33, 50, 75, 100] as const;

export function EvPanel(p: Props) {
  const villain = p.mode === 'villain';
  const bestEvPot = p.rows.find((x) => x.id === p.bestId)?.evPot ?? Number.NaN;
  const villainBetBb = p.pot !== undefined ? (p.pot * p.villainBetPct) / 100 : undefined;

  return (
    <div className="rounded-xl border border-border bg-surface/40 p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-light">
          Calculadora de EV
        </h2>
        <p className="text-xs text-content-muted">
          Bote{' '}
          <span className="tabular-nums text-content">
            {p.pot !== undefined ? `${p.pot.toFixed(1)} bb` : 'sin dato'}
          </span>
        </p>
      </div>

      <div role="tablist" aria-label="Modo de la calculadora" className="mb-2 flex gap-1">
        {(
          [
            ['hero', 'Hero decide'],
            ['villain', 'Villano apuesta'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={p.mode === id}
            onClick={() => p.onMode(id)}
            className={cn(
              'flex-1 rounded-full border px-2 py-1 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light',
              p.mode === id
                ? 'border-amber-500 bg-amber-500/15 text-content'
                : 'border-border text-content-muted hover:bg-surface-hover',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {villain && (
        <div className="mb-2 rounded-lg border border-border p-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="sz-vbet" className="text-content-muted">
              El villano apuesta
            </label>
            <input
              id="sz-vbet"
              inputMode="decimal"
              key={p.villainBetPct}
              defaultValue={p.villainBetPct}
              onBlur={(e) => p.onVillainBet(Number(e.target.value.replace(',', '.')))}
              onKeyDown={(e) => {
                if (e.key === 'Enter')
                  p.onVillainBet(Number(e.currentTarget.value.replace(',', '.')));
              }}
              className="w-14 rounded-md border border-border bg-bg px-1.5 py-0.5 text-right tabular-nums"
            />
            <span className="text-content-muted">
              % del bote
              {villainBetBb !== undefined && (
                <>
                  {' '}
                  = <span className="tabular-nums text-content">{villainBetBb.toFixed(1)} bb</span>
                </>
              )}
            </span>
          </div>
          <div className="mt-1.5 flex gap-1">
            {VILLAIN_BET_CHIPS.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={p.villainBetPct === c}
                onClick={() => p.onVillainBet(c)}
                className={cn(
                  'flex-1 rounded-md border px-1 py-0.5 tabular-nums',
                  p.villainBetPct === c
                    ? 'border-amber-500 bg-amber-500/15 text-content'
                    : 'border-border text-content-muted hover:bg-surface-hover',
                )}
              >
                {c}%
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-content-muted">
            Rango con el que apuesta: edítalo en la fila <b className="text-content">Call</b> ·{' '}
            <span className="tabular-nums text-content">{pct(p.betShare, 0)}</span> de su rango.
          </p>
        </div>
      )}

      <ul className="flex flex-col gap-1.5">
        {p.rows.map((r) => {
          const selected = r.id === p.selectedRow;
          const played = r.id === p.playedRow;
          const best = r.id === p.bestId;
          const hasRange = r.kind !== 'fold';
          const foldTone =
            r.bluffThreshold !== null ? toneVs(r.foldEq, r.bluffThreshold) : 'neutral';
          const eqTarget = r.calledBreakEven ?? 0.5;
          const eqTone: Tone = p.pending ? 'neutral' : toneVs(r.heroEq, eqTarget);
          const evToneValue: Tone = p.pending ? 'neutral' : evTone(r.evPot, bestEvPot, best);
          const evText =
            p.pending && r.kind !== 'fold'
              ? '…'
              : !Number.isFinite(r.ev)
                ? '—'
                : p.pot !== undefined
                  ? `${signed(r.ev, 2)} bb`
                  : `${signed(r.evPot * 100, 1)}%`;
          return (
            <li
              key={r.id}
              className={cn(
                'rounded-lg border p-2',
                selected ? 'border-accent/60 bg-accent/10' : 'border-border',
                // The line with the highest EV of the street (D136): it moves
                // by itself as the ranges change.
                best && !p.pending && 'ring-2 ring-emerald-500/70',
              )}
            >
              <div className="flex flex-wrap items-center gap-1.5">
                {hasRange ? (
                  <span className="mr-auto flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => p.onSelect(r.id)}
                      className="text-left text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light"
                    >
                      {r.label}
                      {r.bet !== null && p.pot !== undefined && (
                        <span className="ml-1 text-xs font-normal text-content-muted">
                          ({r.kind === 'raise' ? 'a ' : ''}
                          {r.bet.toFixed(1)} bb)
                        </span>
                      )}
                    </button>
                    {(r.kind === 'bet' || r.kind === 'raise') && !played && (
                      <button
                        type="button"
                        onClick={() => p.onRemove(r.id)}
                        aria-label={`Quitar ${r.label}`}
                        title={`Quitar ${r.label} (Ctrl+Z lo devuelve)`}
                        className="rounded p-0.5 text-content-disabled hover:bg-surface-hover hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </span>
                ) : (
                  <span className="mr-auto text-sm font-semibold">{r.label}</span>
                )}
                {r.edited && (
                  <span className="rounded bg-amber-500/20 px-1 py-px text-[10px] font-medium text-amber-700 dark:text-amber-300">
                    editado
                  </span>
                )}
                {best && !p.pending && (
                  <span className="flex items-center gap-0.5 rounded bg-emerald-600/20 px-1 py-px text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                    <Star className="h-3 w-3 fill-current" /> Mejor línea
                  </span>
                )}
                {played ? (
                  <span className="flex items-center gap-0.5 rounded bg-sky-600/20 px-1 py-px text-[10px] font-medium text-sky-700 dark:text-sky-300">
                    <Flag className="h-3 w-3" /> Jugada
                  </span>
                ) : (
                  hasRange && (
                    <button
                      type="button"
                      onClick={() => p.onMarkPlayed(r.id)}
                      className="rounded border border-border px-1.5 py-px text-[10px] text-content-muted hover:bg-surface-hover hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light"
                    >
                      Marcar como jugada
                    </button>
                  )
                )}
              </div>

              {r.kind === 'fold' ? (
                <div className="mt-1.5 grid grid-cols-[repeat(3,minmax(0,1fr))_auto] gap-2">
                  <p className="col-span-3 self-end text-[11px] text-content-muted">
                    Dejas el bote; lo ya invertido no cuenta.
                  </p>
                  <Metric label="EV" value={evText} tone={evToneValue} strong />
                </div>
              ) : r.kind === 'call' ? (
                <div className="mt-1.5 grid grid-cols-[repeat(3,minmax(0,1fr))_auto] gap-2">
                  <Metric label="Apuesta" value={pct(p.betShare, 0)} />
                  <Metric
                    label="Pot odds"
                    value={r.calledBreakEven !== null ? pct(r.calledBreakEven, 0) : '—'}
                    title="Equity mínima para pagar: V / (P + 2V)"
                  />
                  <Metric
                    label="Tu eq."
                    value={p.pending ? '…' : pct(r.heroEq)}
                    tone={eqTone}
                    title="Contra el rango con el que apuesta el villano"
                  />
                  <Metric label="EV" value={evText} tone={evToneValue} strong />
                </div>
              ) : (
                <div className="mt-1.5 grid grid-cols-[repeat(3,minmax(0,1fr))_auto] gap-2">
                  <Metric
                    label="Sigue"
                    value={pct(r.follows, 0)}
                    {...(r.kind === 'raise' && { title: 'Del rango con el que apuesta' })}
                  />
                  <Metric
                    label="Fold eq."
                    value={r.kind === 'check' ? '—' : pct(r.foldEq, 0)}
                    tone={foldTone}
                    {...(r.bluffThreshold !== null && {
                      title: `Autoprofit con este tamaño: ${pct(r.bluffThreshold, 0)} de fold`,
                    })}
                  />
                  <Metric
                    label="Tu eq."
                    value={p.pending ? '…' : pct(r.heroEq)}
                    tone={eqTone}
                    title={
                      r.calledBreakEven !== null
                        ? `Si te pagan necesitas ${pct(r.calledBreakEven, 0)} de equity`
                        : 'Comparada con 50%'
                    }
                  />
                  <Metric label="EV" value={evText} tone={evToneValue} strong />
                </div>
              )}

              {r.kind === 'raise' && r.size !== undefined && (
                <AnswerBar
                  split={p.raiseSplit(r.size)}
                  onFoldCall={() => p.onSelect(r.id)}
                  onAllIn={() => p.onSelect(reraiseRowId(r.size!))}
                  selectedRaise={selected}
                  selectedAllIn={p.selectedRow === reraiseRowId(r.size)}
                />
              )}

              {r.kind === 'raise' && r.size !== undefined && (
                <ReraiseBlock
                  multiple={r.size}
                  raiseTo={r.bet}
                  result={r.reraise ?? null}
                  marked={p.reraiseCombos(r.size)}
                  selected={p.selectedRow === reraiseRowId(r.size)}
                  onSelect={() => p.onSelect(reraiseRowId(r.size!))}
                  potKnown={p.pot !== undefined}
                  pending={p.pending}
                  effStack={p.effStack}
                  stackFromHand={p.stackFromHand}
                  onEffStack={p.onEffStack}
                />
              )}

              {r.bluffThreshold !== null && Number.isFinite(r.bluffThreshold) && (
                <>
                  <FoldBar foldEq={r.foldEq} threshold={r.bluffThreshold} tone={foldTone} />
                  <p className="mt-1 text-[11px] text-content-muted">
                    Autoprofit: necesita{' '}
                    <span className="tabular-nums text-content">{pct(r.bluffThreshold, 0)}</span> de
                    fold ·{' '}
                    <span className={TONE_TEXT[foldTone]}>
                      {foldTone === 'good'
                        ? 'lo supera'
                        : foldTone === 'close'
                          ? 'está justo'
                          : 'no llega'}
                    </span>
                    {r.calledBreakEven !== null && (
                      <>
                        {' '}
                        · si pagan necesitas{' '}
                        <span className="tabular-nums text-content">
                          {pct(r.calledBreakEven, 0)}
                        </span>{' '}
                        de eq.
                      </>
                    )}
                    {p.pot !== undefined && Number.isFinite(r.evPot) && (
                      <> · EV {signed(r.evPot * 100, 0)}% del bote</>
                    )}
                  </p>
                </>
              )}
              {r.kind === 'call' && r.calledBreakEven !== null && !p.pending && (
                <p className="mt-1 text-[11px] text-content-muted">
                  Pagar necesita{' '}
                  <span className="tabular-nums text-content">{pct(r.calledBreakEven, 0)}</span> de
                  equity ·{' '}
                  <span className={TONE_TEXT[eqTone]}>
                    {eqTone === 'good'
                      ? 'te sobra'
                      : eqTone === 'close'
                        ? 'está justo'
                        : 'no llega'}
                  </span>
                </p>
              )}
            </li>
          );
        })}
      </ul>

      {villain ? (
        <SizeForm
          id="sz-raise"
          placeholder="3x"
          label="Nuevo raise, en veces la apuesta del villano"
          button="Raise"
          min={1}
          onAdd={p.onAddRaise}
        />
      ) : (
        <SizeForm
          id="sz-size"
          placeholder="% del bote"
          label="Nuevo tamaño en % del bote"
          button="Tamaño"
          min={0}
          onAdd={p.onAddSize}
        />
      )}

      <p className="mt-3 text-[11px] text-content-muted">
        <span className="text-emerald-600 dark:text-emerald-400">Verde</span>: supera el objetivo
        por 5 puntos o más · <span className="text-amber-600 dark:text-amber-300">Ámbar</span>: a ±5
        puntos · <span className="text-rose-600 dark:text-rose-400">Rosa</span>: por debajo. Fold
        eq. contra el autoprofit del tamaño; tu eq. contra la que necesitas si te pagan (o por pot
        odds al pagar); EV contra el mejor de la calle.
      </p>
      <p className="mt-2 border-t border-border pt-2 text-[11px] text-content-muted">
        Supuesto: equity hasta el river sin apuestas posteriores; no modela la realización de
        equity.{' '}
        {villain
          ? 'P = bote antes de la apuesta, V = apuesta del villano, R = tu raise (total), A = su all-in (total). Call: EV = eq × (P + 2V) − V. Raise: EV = fold eq. × (P + V) + paga × (eq × (P + 2R) − R) + re-sube × máx(eq × (P + 2A) − A ; −R).'
          : 'Check: EV = tu equity × bote. Apuesta B: EV = fold eq. × bote + (1 − fold eq.) × (tu eq. × (bote + 2B) − B).'}
      </p>
    </div>
  );
}

/**
 * Inside a raise card (D133): what happens if the villain re-raises all-in.
 * "Elegir manos" selects the re-raise row, so the table and the grid mark,
 * of what goes on vs the raise, the hands that shove.
 */
function ReraiseBlock(p: {
  multiple: number;
  raiseTo: number | null;
  result: EvRowResult['reraise'] | null;
  marked: number;
  selected: boolean;
  onSelect: () => void;
  potKnown: boolean;
  pending: boolean;
  effStack: number | null;
  stackFromHand: number | null;
  onEffStack: (bb: number | null) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const alreadyAllIn = p.effStack !== null && p.raiseTo !== null && p.raiseTo >= p.effStack;
  const res = p.result;
  return (
    <div
      className={cn(
        'mt-2 rounded-md border border-dashed p-2 text-[11px]',
        p.selected ? 'border-rose-400 bg-rose-500/10' : 'border-border',
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Zap className="h-3.5 w-3.5 text-rose-500" />
        <span className="mr-auto font-semibold text-content">Si te re-sube all-in</span>
        {!alreadyAllIn && (
          <button
            type="button"
            aria-pressed={p.selected}
            onClick={p.onSelect}
            title="Marca en la tabla o en el grid qué manos van all-in, de las que siguen contra tu raise"
            className={cn(
              'rounded border px-1.5 py-px font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light',
              p.selected
                ? 'border-rose-500 bg-rose-500 text-white'
                : 'border-border text-content-muted hover:bg-surface-hover hover:text-content',
            )}
          >
            {p.selected ? 'Marcando manos…' : 'Elegir manos'}
          </button>
        )}
      </div>

      {alreadyAllIn ? (
        <p className="mt-1 text-content-muted">Tu raise ya es all-in: no queda re-subida.</p>
      ) : !p.potKnown ? (
        <p className="mt-1 text-content-muted">Hace falta el bote en bb para calcularlo.</p>
      ) : p.marked <= 0 ? (
        <p className="mt-1 text-content-muted">
          {p.selected
            ? 'Marca en la tabla (✓ y peso) o pinta en el grid las manos que van all-in. Solo cuentan las que siguen contra tu raise.'
            : 'Nadie re-sube todavía: el EV supone que todo lo que sigue solo paga. Toca «Elegir manos» para marcar las que van all-in.'}
        </p>
      ) : p.effStack === null ? (
        <p className="mt-1 text-amber-700 dark:text-amber-300">
          Escribe el stack efectivo de esta calle para calcular el all-in.
        </p>
      ) : res ? (
        <p className="mt-1 text-content-muted">
          Re-sube <span className="tabular-nums text-content">{pct(res.share, 0)}</span> de lo que
          sigue ({fmtCombos(p.marked)} combos) a{' '}
          <span className="tabular-nums text-content">{res.allInTo.toFixed(1)} bb</span> · tu eq.{' '}
          <span className="tabular-nums text-content">{p.pending ? '…' : pct(res.eq)}</span> ·
          necesitas <span className="tabular-nums text-content">{pct(res.need, 0)}</span> para pagar
          →{' '}
          {p.pending ? (
            '…'
          ) : res.call ? (
            <b className="text-emerald-700 dark:text-emerald-300">
              <Star className="mr-0.5 inline h-3 w-3 fill-current align-[-2px]" />
              Pagar ({signed(res.callEv, 2)} bb, mejor que foldear {res.foldEv.toFixed(2)} bb)
            </b>
          ) : (
            <b className="text-rose-700 dark:text-rose-300">
              <Star className="mr-0.5 inline h-3 w-3 fill-current align-[-2px]" />
              Foldear ({res.foldEv.toFixed(2)} bb; pagar daría {signed(res.callEv, 2)} bb)
            </b>
          )}
          . Ya está dentro del EV del raise (no es otra línea: no lo sumes aparte).
        </p>
      ) : null}

      {!alreadyAllIn && (
        <label className="mt-1.5 flex flex-wrap items-center gap-1.5 text-content-muted">
          Stack efectivo en esta calle
          <input
            type="number"
            min={0}
            step={0.5}
            inputMode="decimal"
            value={draft ?? p.effStack ?? ''}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              if (draft === null) return;
              const n = Number(draft.replace(',', '.'));
              p.onEffStack(draft.trim() === '' || !(n > 0) ? null : n);
              setDraft(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            className="w-16 rounded border border-border bg-bg px-1 py-px text-right tabular-nums text-content"
            aria-label="Stack efectivo en esta calle, en bb"
          />
          bb
          {p.stackFromHand !== null && p.effStack === p.stackFromHand && (
            <span className="text-content-disabled">(de la mano)</span>
          )}
        </label>
      )}
    </div>
  );
}

/**
 * D135: how the villain's betting range answers the raise, like a solver's
 * action bar — Foldea (gray) · Paga (amber) · All-in (rose), the same colors
 * as the grid. Fold and call are set in the raise row (✗ = folds), the
 * all-in in «Si te re-sube all-in»: each label selects the row that sets it.
 */
function AnswerBar(p: {
  split: RaiseSplit | null;
  onFoldCall: () => void;
  onAllIn: () => void;
  selectedRaise: boolean;
  selectedAllIn: boolean;
}) {
  const s = p.split;
  if (!s) return null;
  const w = (x: number) => `${Math.max(0, Math.min(1, x)) * 100}%`;
  const item =
    'rounded px-1 py-px hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light';
  return (
    <div className="mt-2">
      <p className="mb-1 text-[11px] text-content-muted">Ante tu raise, de lo que te apuesta:</p>
      <div
        className="flex h-2.5 overflow-hidden rounded-full bg-surface-hover"
        role="img"
        aria-label={`Foldea ${pct(s.fold, 0)}, paga ${pct(s.call, 0)}, all-in ${pct(s.allin, 0)}`}
      >
        <span className="h-full bg-slate-400/60" style={{ width: w(s.fold) }} />
        <span className="h-full bg-amber-500" style={{ width: w(s.call) }} />
        <span className="h-full bg-rose-500" style={{ width: w(s.allin) }} />
      </div>
      <div className="mt-1 flex flex-wrap gap-x-2 text-[11px] tabular-nums">
        <button
          type="button"
          onClick={p.onFoldCall}
          title="Se define en esta fila: lo que marques con ✗ foldea"
          className={cn(item, p.selectedRaise && 'bg-accent/15')}
        >
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-slate-400/60" />
          Foldea <b className="text-content">{pct(s.fold, 0)}</b>
        </button>
        <button
          type="button"
          onClick={p.onFoldCall}
          title="Se define en esta fila: lo que dejes en ✓ sigue (y paga si no va all-in)"
          className={cn(item, p.selectedRaise && 'bg-accent/15')}
        >
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-500" />
          Paga <b className="text-content">{pct(s.call, 0)}</b>
        </button>
        <button
          type="button"
          onClick={p.onAllIn}
          title="Se define en «Si te re-sube all-in»"
          className={cn(item, p.selectedAllIn && 'bg-rose-500/15')}
        >
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-rose-500" />
          All-in <b className="text-content">{pct(s.allin, 0)}</b>
        </button>
      </div>
    </div>
  );
}
