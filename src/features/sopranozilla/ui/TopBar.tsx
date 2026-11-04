// Top bar (§10.1): Hero / villain cards with equity at the start of the
// street, the street tabs (each says which played row feeds it, D37), the
// board with the new card highlighted, and the pot.

import type { ReactNode } from 'react';
import { Pencil } from 'lucide-react';
import { CardFace } from '@/modules/trainer/HandCards';
import { cn } from '@/lib/cn';
import { fromCardId, type CardId } from '../engine/cards';
import { STREETS, type ActionRow } from '../engine/chain';
import type { Street } from '../engine/equity';
import { bb, combos, pct } from './format';
import { StreetEquityTable, type StreetEquityRow } from './StreetEquityTable';

const STREET_LABEL: Record<Street, string> = { flop: 'Flop', turn: 'Turn', river: 'River' };

export type StreetTab = {
  street: Street;
  available: boolean;
  /** The previous street's played row that feeds this one (null on the flop). */
  fedBy: ActionRow | null;
};

type Props = {
  hero: readonly CardId[];
  heroPosition: string | undefined;
  villainPosition: string | undefined;
  board: readonly CardId[];
  street: Street;
  tabs: StreetTab[];
  onStreet: (street: Street) => void;
  pot: number | undefined;
  rangeCombos: number;
  heroEq: number;
  progress: { done: number; total: number } | null;
  streetEquity: StreetEquityRow[];
  /** Opens «Editar cartas» (D102). */
  onEditCards?: () => void;
};

/** Cards that open «Editar cartas» on click. */
function EditableCards({
  onEdit,
  label,
  children,
}: {
  onEdit: (() => void) | undefined;
  label: string;
  children: ReactNode;
}) {
  if (!onEdit) return <>{children}</>;
  return (
    <button
      type="button"
      onClick={onEdit}
      title={`${label}: clic para cambiar las cartas`}
      aria-label={`${label}: editar cartas`}
      className="group/edit relative rounded-lg p-0.5 transition-colors hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light"
    >
      {children}
      <span className="pointer-events-none absolute -right-1 -top-1 hidden rounded-full border border-border bg-surface p-0.5 text-content-muted group-hover/edit:block">
        <Pencil className="h-3 w-3" />
      </span>
    </button>
  );
}

function Cards({
  cards,
  highlightLast = false,
}: {
  cards: readonly CardId[];
  highlightLast?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {cards.map((id, i) => {
        const c = fromCardId(id);
        const isNew = highlightLast && i === cards.length - 1 && cards.length > 3;
        return (
          <div
            key={id}
            className={cn(
              'rounded-lg',
              isNew && 'ring-2 ring-amber-400 ring-offset-2 ring-offset-bg',
            )}
          >
            <CardFace rank={c.rank} suit={c.suit} />
          </div>
        );
      })}
    </div>
  );
}

export function TopBar(p: Props) {
  return (
    <section className="mb-3 flex flex-wrap items-stretch gap-3 rounded-xl border border-border bg-surface/40 p-3">
      <div className="flex items-center gap-3">
        <EditableCards onEdit={p.onEditCards} label="Tus cartas">
          <Cards cards={p.hero} />
        </EditableCards>
        <div className="text-sm">
          <p className="font-semibold">Hero{p.heroPosition ? ` · ${p.heroPosition}` : ''}</p>
          <p className="text-content-muted">
            Equity: <span className="tabular-nums text-content">{pct(p.heroEq)}</span>
          </p>
          <p className="text-content-muted">
            vs Villano{p.villainPosition ? ` (${p.villainPosition})` : ''}:{' '}
            <span className="tabular-nums text-content">{combos(p.rangeCombos)}</span> combos
          </p>
        </div>
      </div>

      {/* min-w (not basis 0) so the equity table wraps below instead of overlapping. */}
      <div className="flex min-w-[18rem] flex-1 flex-col gap-2">
        <div role="tablist" aria-label="Calles" className="flex flex-wrap gap-1.5">
          {p.tabs.map((t) => (
            <button
              key={t.street}
              type="button"
              role="tab"
              aria-selected={t.street === p.street}
              disabled={!t.available}
              onClick={() => p.onStreet(t.street)}
              className={cn(
                'flex flex-col items-start rounded-lg border px-3 py-1.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light disabled:opacity-40',
                t.street === p.street
                  ? 'border-accent bg-accent/15'
                  : 'border-border hover:bg-surface-hover',
              )}
            >
              <span className="text-sm font-semibold">{STREET_LABEL[t.street]}</span>
              <span className="text-[11px] text-content-muted">
                {t.fedBy
                  ? `${STREET_LABEL[t.street]} ← ${STREET_LABEL[STREETS[STREETS.indexOf(t.street) - 1]!]}: ${t.fedBy.label}`
                  : 'Rango preflop'}
              </span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <EditableCards onEdit={p.onEditCards} label="Board">
            <Cards cards={p.board} highlightLast />
          </EditableCards>
          <p className="text-sm text-content-muted">
            Bote: <span className="tabular-nums text-content">{bb(p.pot)}</span>
          </p>
          {p.progress && (
            <p role="status" className="text-xs text-content-muted">
              Calculando equity… {p.progress.done}/{p.progress.total}
            </p>
          )}
        </div>
      </div>

      <div className="shrink-0 overflow-x-auto border-border xl:border-l xl:pl-3">
        <StreetEquityTable rows={p.streetEquity} />
      </div>
    </section>
  );
}
