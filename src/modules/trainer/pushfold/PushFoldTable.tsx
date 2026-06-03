import { useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/cn';
import { ALL_HANDS, categoryOf, combosOf, TOTAL_COMBOS } from '@/utils/handUtils';
import type { HandNotation } from '@/types/poker';
import { NASH_HU, NASH_MAX_BB, NASH_MIN_BB } from '@/data/nashTable';
import type { PushFoldScope } from '@/utils/pushFold';

const PUSH_COLOR = '#22c55e';
const CALL_COLOR = '#3b82f6';

const SCOPE_META: Record<
  PushFoldScope,
  { label: string; verb: string; icon: typeof ArrowUpFromLine; color: string }
> = {
  push: {
    label: 'Push (BTN)',
    verb: 'pushear',
    icon: ArrowUpFromLine,
    color: PUSH_COLOR,
  },
  call: {
    label: 'Call (BB)',
    verb: 'pagar',
    icon: ArrowDownToLine,
    color: CALL_COLOR,
  },
};

export function PushFoldTable() {
  const [bb, setBb] = useState(10);
  const [scope, setScope] = useState<PushFoldScope>('push');
  const [showBB, setShowBB] = useState(true);

  const table = scope === 'push' ? NASH_HU.push : NASH_HU.call;
  const meta = SCOPE_META[scope];

  const stats = useMemo(() => {
    let activeHands = 0;
    let activeCombos = 0;
    for (const hand of ALL_HANDS) {
      const t = table[hand] ?? 0;
      if (t > 0 && bb <= t) {
        activeHands += 1;
        activeCombos += combosOf(hand);
      }
    }
    return {
      activeHands,
      activeCombos,
      pct: (activeCombos / TOTAL_COMBOS) * 100,
    };
  }, [table, bb]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label={`${meta.label} ≤ ${bb} BB`}
          value={`${stats.pct.toFixed(1)}%`}
          hint="del total de combos"
        />
        <Stat
          label="Manos en rango"
          value={`${stats.activeHands} / 169`}
          hint="celdas pintadas"
        />
        <Stat
          label="Combos"
          value={`${stats.activeCombos} / ${TOTAL_COMBOS}`}
          hint="combinaciones de cartas"
        />
      </div>

      <div className="flex flex-col items-stretch gap-4 rounded-xl border border-border bg-surface/60 p-4 shadow-surface sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ScopeToggle value={scope} onChange={setScope} />
          <ShowBBToggle value={showBB} onChange={setShowBB} />
        </div>

        <StackSlider value={bb} onChange={setBb} accentColor={meta.color} />

        <PushFoldGrid table={table} bb={bb} color={meta.color} showBB={showBB} />

        <p className="text-center text-xs text-content-muted">
          Mueves el slider y ves cómo cambia el rango. Las celdas pintadas son las
          manos donde es correcto {meta.verb} con stack ≤ <span className="font-medium text-content tabular-nums">{bb}</span> BB.
        </p>
      </div>
    </div>
  );
}

function StackSlider({
  value,
  onChange,
  accentColor,
}: {
  value: number;
  onChange: (next: number) => void;
  accentColor: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-content-muted">
        <span>Stack efectivo</span>
        <span className="font-mono text-base font-semibold text-content">
          {value} BB
        </span>
      </div>
      <input
        type="range"
        min={NASH_MIN_BB}
        max={NASH_MAX_BB}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Stack efectivo en BB"
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-surface accent-accent-light focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-light"
        style={{ accentColor }}
      />
      <div className="flex justify-between font-mono text-[10px] text-content-muted">
        <span>{NASH_MIN_BB}</span>
        <span>5</span>
        <span>10</span>
        <span>15</span>
        <span>{NASH_MAX_BB}</span>
      </div>
    </div>
  );
}

function ScopeToggle({
  value,
  onChange,
}: {
  value: PushFoldScope;
  onChange: (next: PushFoldScope) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Acción a estudiar"
      className="inline-flex items-center gap-1 rounded-xl border border-border bg-surface/60 p-1"
    >
      {(['push', 'call'] as const).map((k) => {
        const Icon = SCOPE_META[k].icon;
        const active = value === k;
        return (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(k)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium',
              'transition-colors duration-150 ease-out-soft',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light',
              active
                ? 'bg-surface text-content shadow-[inset_0_0_0_1px_rgb(var(--color-accent)/0.6)]'
                : 'text-content-muted hover:bg-surface-hover hover:text-content',
            )}
            style={active ? { color: SCOPE_META[k].color } : undefined}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
            {SCOPE_META[k].label}
          </button>
        );
      })}
    </div>
  );
}

function ShowBBToggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  const Icon = value ? Eye : EyeOff;
  return (
    <label
      className={cn(
        'inline-flex cursor-pointer items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium',
        'transition-colors duration-150 ease-out-soft',
        'focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent-light',
        value
          ? 'border-accent/60 bg-accent/10 text-content'
          : 'border-border bg-surface/40 text-content-muted hover:bg-surface-hover hover:text-content',
      )}
    >
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
      Mostrar BB
    </label>
  );
}

function PushFoldGrid({
  table,
  bb,
  color,
  showBB,
}: {
  table: Record<HandNotation, number>;
  bb: number;
  color: string;
  showBB: boolean;
}) {
  return (
    <div
      role="img"
      aria-label={`Tabla de Nash heads-up para stack de ${bb} BB`}
      className="relative mx-auto grid aspect-square w-full max-w-[min(640px,92vw)] grid-cols-[repeat(13,minmax(0,1fr))] gap-px overflow-hidden rounded-xl border border-border bg-border/60 shadow-surface"
    >
      {ALL_HANDS.map((hand) => {
        const t = table[hand] ?? 0;
        const active = t > 0 && bb <= t;
        const cat = categoryOf(hand);
        return (
          <div
            key={hand}
            data-hand={hand}
            data-active={active || undefined}
            className={cn(
              'flex flex-col items-center justify-center gap-px select-none px-0.5 py-1 text-[10px] leading-none tabular-nums',
              !active &&
                (cat === 'pair'
                  ? 'bg-cell-empty-pair text-content'
                  : cat === 'suited'
                    ? 'bg-cell-empty-suited text-content-muted'
                    : 'bg-cell-empty-offsuit text-content-muted'),
              active && 'text-white',
            )}
            style={active ? { backgroundColor: color } : undefined}
          >
            <span
              className={cn(
                'font-semibold',
                active && 'drop-shadow-[0_1px_1px_rgb(0_0_0/0.55)]',
              )}
            >
              {hand}
            </span>
            {showBB && active && t < 20 && (
              <span className="text-[9px] font-bold text-amber-200 drop-shadow-[0_1px_2px_rgb(0_0_0/0.75)]">
                {t}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface/40 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-content-muted">
        {label}
      </p>
      <p className="text-lg font-semibold tabular-nums text-content">{value}</p>
      {hint && (
        <p className="text-[10px] text-content-muted">{hint}</p>
      )}
    </div>
  );
}
