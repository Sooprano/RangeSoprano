// Header line of a real hand: format, blinds, effective stack and every
// player dealt in (position + starting stack). Hero and the villain stand out;
// players who folded preflop are dimmed. This is what picks the villain range.
// In a multiway pot the other opponents who saw the flop are buttons: a click
// analyzes the hand against them (D96).

import { cn } from '@/lib/cn';
import type { TableInfo, TableSeat } from '../adapters/tableInfo';

function stackText(s: { stack: number; stackBb: number | null }, currency: string): string {
  return s.stackBb !== null ? `${s.stackBb} bb` : `${currency}${s.stack}`;
}

function Seat({
  seat,
  currency,
  onPick,
}: {
  seat: TableSeat;
  currency: string;
  /** Set when this opponent can become the villain. */
  onPick?: (() => void) | undefined;
}) {
  const body = (
    <>
      <span className="font-semibold">{seat.position ?? '?'}</span>
      <span className="max-w-[9rem] truncate text-content-muted">
        {seat.role === 'hero' ? 'Hero' : seat.role === 'villain' ? `Villano · ${seat.name}` : seat.name}
      </span>
      <span className="tabular-nums font-medium">{stackText(seat, currency)}</span>
    </>
  );
  if (onPick) {
    return (
      <li>
        <button
          type="button"
          onClick={onPick}
          title={`Analizar contra ${seat.name}`}
          className="flex items-baseline gap-1.5 rounded-md border border-dashed border-rose-500/50 px-2 py-0.5 text-xs hover:bg-rose-500/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light"
        >
          {body}
        </button>
      </li>
    );
  }
  return (
    <li
      title={`${seat.name}${seat.inFlop ? '' : ' · foldeó preflop'}`}
      className={cn(
        'flex items-baseline gap-1.5 rounded-md border px-2 py-0.5 text-xs',
        seat.role === 'hero'
          ? 'border-accent bg-accent/15'
          : seat.role === 'villain'
            ? 'border-rose-500/60 bg-rose-500/10'
            : 'border-border',
        !seat.inFlop && 'opacity-50',
      )}
    >
      {body}
    </li>
  );
}

export function TableSeats({
  table,
  pickable = [],
  onPickVillain,
}: {
  table: TableInfo;
  /** Opponents who saw the flop and can become the villain (multiway only). */
  pickable?: readonly string[];
  onPickVillain?: (name: string) => void;
}) {
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <p className="text-xs text-content-muted">
        Mesa <span className="font-medium text-content">{table.format}</span>
        {table.blinds && (
          <>
            {' · '}ciegas <span className="tabular-nums text-content">{table.blinds}</span>
          </>
        )}
        {table.effective !== null && (
          <>
            {' · '}stack efectivo{' '}
            <span className="tabular-nums font-medium text-content">
              {stackText(
                { stack: table.effective, stackBb: table.effectiveBb },
                table.currency,
              )}
            </span>
          </>
        )}
      </p>
      <ul aria-label="Jugadores y stacks iniciales" className="flex flex-wrap gap-1.5">
        {table.seats.map((s) => (
          <Seat
            key={s.name}
            seat={s}
            currency={table.currency}
            onPick={
              onPickVillain && s.role === null && pickable.includes(s.name)
                ? () => onPickVillain(s.name)
                : undefined
            }
          />
        ))}
      </ul>
    </div>
  );
}
