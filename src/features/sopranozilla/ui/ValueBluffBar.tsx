// «Valor / Farol» summary above the grid (D140): how the villain's range
// splits against Hero's hand, in % and combos, and — when the villain bets on
// the river — how many bluff combos the range needs for a call to break even,
// so the user sees at a glance whether the line can even have them (a range
// filtered hard on earlier streets is often all value; other spots have
// bluffs to spare).

import { cn } from '@/lib/cn';
import type { Street } from '../engine/equity';
import { bluffsNeeded, VB_AHEAD, VB_BEHIND, VB_COLORS, type VbSummary } from './valueBluff';

type Props = {
  street: Street;
  summary: VbSummary;
  /** What the numbers are about («Su rango de apuesta», «Lo que sigue en «Check»»). */
  title: string;
  /** Villain bets: the equity the call needs (pot odds) and the bet, in bb. */
  call: { need: number; bet: number } | null;
};

const pct = (x: number) => `${Math.round(x * 100)}%`;
const n = (x: number) =>
  x >= 10 ? Math.round(x).toString() : (Math.round(x * 10) / 10).toString();

export function ValueBluffBar({ street, summary: s, title, call }: Props) {
  const total = s.value + s.tie + s.bluff;
  const river = street === 'river';
  const label = river
    ? { value: 'Valor', tie: 'Empate', bluff: 'Farol' }
    : { value: 'Te va ganando', tie: 'Disputada', bluff: 'Vas ganando' };
  const need = call && river ? bluffsNeeded(s, call.need) : Number.NaN;
  const diff = s.bluff - need;

  if (total <= 0) {
    return (
      <div className="mb-2 rounded-xl border border-border bg-surface/40 px-2.5 py-2 text-xs text-content-muted">
        {s.pending > 0 ? 'Calculando valor y farol…' : `${title}: sin combos.`}
      </div>
    );
  }

  const part = (key: 'value' | 'tie' | 'bluff', x: number) => (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      <span
        aria-hidden
        className="inline-block h-2.5 w-2.5 rounded-sm"
        style={{ backgroundColor: VB_COLORS[key] }}
      />
      <span className="text-content-muted">{label[key]}</span>
      <b className="tabular-nums text-content">{pct(x / total)}</b>
      <span className="tabular-nums text-content-muted">
        ({n(x)}
        {key === 'value' ? ' combos' : ''})
      </span>
    </span>
  );

  return (
    <div
      className="mb-2 rounded-xl border border-border bg-surface/40 px-2.5 py-2 text-xs"
      aria-live="polite"
    >
      <p className="mb-1 text-[11px] text-content-muted">
        {title}
        {!river && ` · por tu equity contra cada combo (< ${pct(VB_BEHIND)} · > ${pct(VB_AHEAD)})`}
        {s.pending > 0 && ' · calculando…'}
      </p>
      <div
        className="flex h-2 overflow-hidden rounded-full bg-surface-hover"
        role="img"
        aria-label={`${label.value} ${pct(s.value / total)}, ${label.tie} ${pct(s.tie / total)}, ${label.bluff} ${pct(s.bluff / total)}`}
      >
        <span style={{ width: pct(s.value / total), backgroundColor: VB_COLORS.value }} />
        <span style={{ width: pct(s.tie / total), backgroundColor: VB_COLORS.tie }} />
        <span style={{ width: pct(s.bluff / total), backgroundColor: VB_COLORS.bluff }} />
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
        {part('value', s.value)}
        {part('bluff', s.bluff)}
        {s.tie > 0.05 && part('tie', s.tie)}
      </div>
      {Number.isFinite(need) && call && (
        <p className="mt-1.5 border-t border-border pt-1.5 leading-snug text-content-muted">
          Su apuesta de <b className="tabular-nums text-content">{call.bet.toFixed(1)} bb</b> te
          pide <b className="tabular-nums text-content">{pct(call.need)}</b> de equity: para que
          pagar sea rentable necesita{' '}
          <b className="tabular-nums text-content">{n(need)} combos de farol</b> y tiene{' '}
          <b className="tabular-nums text-content">{n(s.bluff)}</b>
          {' · '}
          <span
            className={cn(
              'font-semibold',
              diff >= 0
                ? 'text-emerald-700 dark:text-emerald-300'
                : 'text-rose-700 dark:text-rose-300',
            )}
          >
            {diff >= 0
              ? `le sobran ${n(diff)}: pagar gana`
              : `le faltan ${n(-diff)}: hay sobre-valor, pagar pierde`}
          </span>
        </p>
      )}
    </div>
  );
}
