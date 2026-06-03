import { useMemo, useState } from 'react';
import { Calculator, Check, Coins, Pencil } from 'lucide-react';
import { cn } from '@/lib/cn';
import { CALC_META, type CalcMode } from '@/modules/calculators/calcMeta';
import type { Decision, ParsedHand, StreetData } from '@/utils/handHistory';
import { flopzillaInputsFor, suggestCalcForDecision } from '@/utils/spotCalc';
import { BoardCards } from './BoardCards';
import { InlineCalc } from './InlineCalc';

type Unit = 'chips' | 'bb';

const STREET_LABEL: Record<StreetData['street'], string> = {
  preflop: 'Preflop',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
};

const ACTION_LABEL: Record<Decision['type'], string> = {
  post: 'postea',
  check: 'pasa',
  call: 'paga',
  bet: 'apuesta',
  raise: 'sube a',
  fold: 'foldea',
  allin: 'va all-in',
};

/** Trims to 2 decimals without trailing zeros. */
function trimNum(n: number): string {
  const r = Math.round(n * 100) / 100;
  return String(r);
}

export function HandWorksheet({ hand }: { hand: ParsedHand }) {
  const [unit, setUnit] = useState<Unit>('chips');
  const [notes, setNotes] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [modeById, setModeById] = useState<Record<string, CalcMode>>({});

  const bb = hand.bigBlind;
  const canBb = unit === 'bb' && bb != null && bb > 0;

  // Formats a raw chip amount for display, applying the € / BB unit.
  const display = useMemo(() => {
    return (n: number | undefined): string => {
      if (n == null) return '—';
      if (canBb) return `${trimNum(n / bb!)} BB`;
      return `${hand.currency}${trimNum(n)}`;
    };
  }, [canBb, bb, hand.currency]);

  // Formats a seed for a calc input (no unit suffix; pure number string).
  const seedFmt = useMemo(() => {
    return (n: number | undefined): string | undefined => {
      if (n == null) return undefined;
      return canBb ? trimNum(n / bb!) : trimNum(n);
    };
  }, [canBb, bb]);

  return (
    <div className="flex flex-col gap-5">
      <HeaderCard hand={hand} unit={unit} onUnit={setUnit} display={display} />

      {hand.streets.map((sd) => (
        <StreetSection
          key={sd.street}
          sd={sd}
          hand={hand}
          display={display}
          seedFmt={seedFmt}
          openId={openId}
          setOpenId={setOpenId}
          modeById={modeById}
          setModeById={setModeById}
        />
      ))}

      {hand.shows.length > 0 && <ShowdownCard hand={hand} display={display} />}

      <section className="rounded-xl border border-border bg-surface/40 p-5">
        <h3 className="mb-2 text-sm font-semibold text-content">Tu conclusión</h3>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="¿Fue rentable la línea? ¿Qué fold equity / equity asumiste en Flopzilla? ¿Qué harías distinto?"
          className="w-full resize-y rounded-lg border border-border bg-surface/60 px-3 py-2 text-sm text-content placeholder:text-content-disabled focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
        />
      </section>
    </div>
  );
}

function HeaderCard({
  hand,
  unit,
  onUnit,
  display,
}: {
  hand: ParsedHand;
  unit: Unit;
  onUnit: (u: Unit) => void;
  display: (n: number | undefined) => string;
}) {
  const blinds =
    hand.smallBlind != null && hand.bigBlind != null
      ? `${hand.currency}${trimNum(hand.smallBlind)}/${hand.currency}${trimNum(hand.bigBlind)}`
      : '—';
  return (
    <section className="rounded-xl border border-border bg-surface/40 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-content-muted">
            <span>
              Ciegas <span className="font-mono text-content">{blinds}</span>
            </span>
            {hand.ante != null && (
              <span>
                Ante{' '}
                <span className="font-mono text-content">
                  {hand.currency}
                  {trimNum(hand.ante)}
                </span>
              </span>
            )}
            {hand.gameId && (
              <span className="text-content-disabled">#{hand.gameId}</span>
            )}
          </div>
          {hand.hero && (
            <div className="flex items-center gap-3">
              <div className="flex flex-col">
                <span className="text-[11px] uppercase tracking-[0.14em] text-content-muted">
                  Héroe
                </span>
                <span className="text-sm font-semibold text-content">
                  {hand.hero}
                </span>
              </div>
              <BoardCards cards={hand.heroCards} />
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-3">
          <UnitToggle unit={unit} onUnit={onUnit} disabled={hand.bigBlind == null} />
          <div className="flex flex-col items-end gap-0.5 text-xs text-content-muted">
            {hand.players.map((p) => (
              <span key={p.seat}>
                {p.name}
                {p.isDealer && <span className="text-content-disabled"> · BTN</span>}{' '}
                <span className="font-mono text-content">{display(p.stack)}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function UnitToggle({
  unit,
  onUnit,
  disabled,
}: {
  unit: Unit;
  onUnit: (u: Unit) => void;
  disabled: boolean;
}) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-surface/60 p-0.5 text-xs">
      {(['chips', 'bb'] as const).map((u) => (
        <button
          key={u}
          type="button"
          disabled={disabled && u === 'bb'}
          onClick={() => onUnit(u)}
          className={cn(
            'rounded-md px-2.5 py-1 font-medium transition-colors',
            unit === u
              ? 'bg-surface text-content shadow-sm'
              : 'text-content-muted hover:text-content',
            disabled && u === 'bb' && 'cursor-not-allowed opacity-40',
          )}
        >
          {u === 'chips' ? 'Fichas' : 'BB'}
        </button>
      ))}
    </div>
  );
}

function StreetSection({
  sd,
  hand,
  display,
  seedFmt,
  openId,
  setOpenId,
  modeById,
  setModeById,
}: {
  sd: StreetData;
  hand: ParsedHand;
  display: (n: number | undefined) => string;
  seedFmt: (n: number | undefined) => string | undefined;
  openId: string | null;
  setOpenId: (id: string | null) => void;
  modeById: Record<string, CalcMode>;
  setModeById: (next: Record<string, CalcMode>) => void;
}) {
  if (sd.decisions.length === 0) return null;
  return (
    <section className="rounded-xl border border-border bg-surface/40 p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-content">
            {STREET_LABEL[sd.street]}
          </h3>
          {sd.board.length > 0 && <BoardCards cards={sd.board} />}
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-subtle/80 px-3 py-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-content-muted">
            Pot
          </span>
          <span className="font-mono text-base font-bold tabular-nums text-amber-200">
            {display(sd.potStart)}
          </span>
        </div>
      </div>

      <ul className="flex flex-col gap-1.5">
        {sd.decisions.map((d) => (
          <DecisionRow
            key={d.id}
            decision={d}
            hand={hand}
            display={display}
            seedFmt={seedFmt}
            open={openId === d.id}
            onToggle={() => setOpenId(openId === d.id ? null : d.id)}
            mode={modeById[d.id]}
            onMode={(m) => setModeById({ ...modeById, [d.id]: m })}
          />
        ))}
      </ul>
    </section>
  );
}

function DecisionRow({
  decision,
  hand,
  display,
  seedFmt,
  open,
  onToggle,
  mode,
  onMode,
}: {
  decision: Decision;
  hand: ParsedHand;
  display: (n: number | undefined) => string;
  seedFmt: (n: number | undefined) => string | undefined;
  open: boolean;
  onToggle: () => void;
  mode: CalcMode | undefined;
  onMode: (m: CalcMode) => void;
}) {
  const suggestion = suggestCalcForDecision(decision, hand);
  // Skip the noisy preflop blind-completion call.
  const analyzable =
    suggestion != null &&
    !(decision.street === 'preflop' && decision.type === 'call');

  // Bet sizing as % of the pot it went into (ratio — unit-independent).
  const isAggro =
    decision.type === 'bet' || decision.type === 'raise' || decision.type === 'allin';
  const pctOfPot =
    isAggro && decision.potBefore > 0
      ? Math.round((decision.amount / decision.potBefore) * 100)
      : null;
  const activeMode: CalcMode | undefined =
    mode ?? suggestion?.primary ?? undefined;
  const calcOptions: CalcMode[] = suggestion
    ? [suggestion.primary, ...suggestion.alternatives]
    : [];

  return (
    <li>
      <div
        className={cn(
          'flex items-center justify-between gap-3 rounded-lg px-3 py-1.5 text-sm',
          decision.isHero ? 'bg-accent/5' : 'bg-transparent',
        )}
      >
        <span className={cn(decision.isHero ? 'text-content' : 'text-content-muted')}>
          <span className={cn('font-medium', decision.isHero && 'text-accent-light')}>
            {decision.actor}
          </span>{' '}
          {ACTION_LABEL[decision.type]}
          {decision.amount > 0 && (
            <span className="ml-1.5 inline-flex items-center rounded-md bg-bg-subtle px-1.5 py-0.5 font-mono text-[13px] font-semibold tabular-nums text-amber-200 ring-1 ring-inset ring-border/60">
              {display(decision.amount)}
            </span>
          )}
          {pctOfPot != null && (
            <span className="ml-1.5 inline-flex items-center rounded-md bg-surface px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-content-muted ring-1 ring-inset ring-border/50">
              {pctOfPot}% pot
            </span>
          )}
        </span>

        {analyzable && (
          <button
            type="button"
            onClick={onToggle}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors',
              open
                ? 'bg-accent text-white'
                : 'bg-surface text-content-muted ring-1 ring-inset ring-border hover:text-content',
            )}
          >
            <Calculator className="h-3.5 w-3.5" strokeWidth={2.25} />
            Analizar
          </button>
        )}
      </div>

      {open && analyzable && activeMode && (
        <div className="mt-2 rounded-lg border border-border bg-bg-subtle/60 p-4">
          {suggestion && (
            <p className="mb-3 flex items-start gap-2 text-xs text-content-muted">
              <Coins className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-light" strokeWidth={2.25} />
              <span>{suggestion.rationale}</span>
            </p>
          )}

          {calcOptions.length > 1 && (
            <div className="mb-4 flex flex-wrap gap-1.5">
              {calcOptions.map((m) => {
                const meta = CALC_META[m];
                const Icon = meta.Icon;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => onMode(m)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                      m === activeMode
                        ? 'bg-surface text-content shadow-[inset_0_0_0_1px_rgb(var(--color-accent)/0.6)]'
                        : 'bg-surface/40 text-content-muted ring-1 ring-inset ring-border/50 hover:text-content',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
                    {meta.label}
                  </button>
                );
              })}
            </div>
          )}

          <DataSourceLegend mode={activeMode} />

          {/* key remounts the calc so the seed re-applies when switching calc/decision. */}
          <InlineCalc
            key={`${decision.id}-${activeMode}`}
            mode={activeMode}
            seed={suggestion?.seed ?? {}}
            fmt={seedFmt}
          />
        </div>
      )}
    </li>
  );
}

function DataSourceLegend({ mode }: { mode: CalcMode }) {
  const flopzilla = flopzillaInputsFor(mode);
  return (
    <div className="mb-4 grid gap-2 sm:grid-cols-2">
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
          <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
          Cargado de la mano
        </p>
        <p className="mt-1 text-xs text-content-muted">
          Los montos (pot y apuesta) ya están puestos automáticamente desde el
          historial. No los toques salvo que quieras simular otro tamaño.
        </p>
      </div>
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
          <Pencil className="h-3.5 w-3.5" strokeWidth={2.5} />
          Ingresá de Flopzilla
        </p>
        {flopzilla.length > 0 ? (
          <ul className="mt-1 list-disc pl-4 text-xs text-content-muted">
            {flopzilla.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-content-muted">
            Completá las equities / frecuencias según tu lectura en Flopzilla.
          </p>
        )}
      </div>
    </div>
  );
}

function ShowdownCard({
  hand,
  display,
}: {
  hand: ParsedHand;
  display: (n: number | undefined) => string;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface/40 p-5">
      <h3 className="mb-3 text-sm font-semibold text-content">Showdown</h3>
      <ul className="flex flex-col gap-2">
        {hand.shows.map((s, i) => (
          <li key={`${s.name}-${i}`} className="flex flex-wrap items-center gap-3 text-sm">
            <span className="min-w-[90px] font-medium text-content">{s.name}</span>
            <BoardCards cards={s.cards} />
            {s.description && (
              <span className="text-content-muted">{s.description}</span>
            )}
          </li>
        ))}
      </ul>
      {hand.winners.length > 0 && (
        <p className="mt-3 text-sm text-content-muted">
          {hand.winners.map((w, i) => (
            <span key={`${w.name}-${i}`}>
              {i > 0 && ', '}
              <span className="font-medium text-content">{w.name}</span> gana{' '}
              <span className="font-mono text-emerald-300">{display(w.amount)}</span>
            </span>
          ))}
        </p>
      )}
    </section>
  );
}
