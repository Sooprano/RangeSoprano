// Cash hands (D138): the rival type (Regular GTO; Fish later), the preflop
// line read from the hand, the other sizes of the same spot one click away
// (e.g. the 2bb and the 2.5bb open) and every cash GTO range in a list, for
// the spots without a range.

import { cn } from '@/lib/cn';
import { pickCashRange } from '../adapters/cashPick';
import type { CashInfo } from '../adapters/cashSpot';
import type { CashRange } from '../ranges/cashCatalog';

type Props = {
  info: CashInfo;
  catalog: readonly CashRange[] | null;
  /** The range in use (`CashRange.id`), if it is a cash GTO one. */
  currentId: string | undefined;
  onPick: (range: CashRange) => void;
};

const chip = (active: boolean) =>
  cn(
    'rounded-md border px-2 py-0.5 tabular-nums',
    active
      ? 'border-accent bg-accent/15 text-content'
      : 'border-border text-content-muted hover:bg-surface-hover hover:text-content',
  );

const sizeText = (s: CashRange['size']) => (s === null ? '—' : s === 'AI' ? 'All-in' : `${s}bb`);

export function CashBar({ info, catalog, currentId, onPick }: Props) {
  const current = catalog?.find((r) => r.id === currentId) ?? null;
  const pick = catalog && info.want ? pickCashRange(catalog, info.want) : null;
  const sizes = pick && pick.sameSpot.length > 1 ? pick.sameSpot : [];
  const groups = catalog ? [...new Set(catalog.map((r) => r.group))] : [];

  return (
    <div className="mt-2 flex flex-col gap-1.5 border-t border-border pt-2 text-xs">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-content-muted">Cash · rangos GTO (~100bb)</span>
        <span role="group" aria-label="Tipo de rival" className="ml-auto flex items-center gap-1">
          <span className="text-content-muted">Rival</span>
          <button type="button" aria-pressed className={chip(true)}>
            Regular
          </button>
          <button
            type="button"
            disabled
            title="Próximamente: rangos de cash para jugadores recreacionales"
            className="cursor-not-allowed rounded-md border border-dashed border-border px-2 py-0.5 text-content-disabled"
          >
            Fish · pronto
          </button>
        </span>
      </div>

      {sizes.length > 0 && (
        <div
          role="group"
          aria-label="Tamaño del rango"
          className="flex flex-wrap items-center gap-1"
        >
          <span className="mr-1 text-content-muted">Tamaño</span>
          {[...sizes]
            .sort(
              (a, b) =>
                (typeof a.size === 'number' ? a.size : 1e9) -
                (typeof b.size === 'number' ? b.size : 1e9),
            )
            .map((r) => (
              <button
                key={r.id}
                type="button"
                aria-pressed={r.id === currentId}
                title={r.name}
                onClick={() => onPick(r)}
                className={chip(r.id === currentId)}
              >
                {sizeText(r.size)}
              </button>
            ))}
        </div>
      )}

      {catalog && (
        <label className="flex flex-wrap items-center gap-1.5">
          <span className="text-content-muted">Rango de cash</span>
          <select
            value={current ? current.id : ''}
            onChange={(e) => {
              const r = catalog.find((x) => x.id === e.target.value);
              if (r) onPick(r);
            }}
            className="max-w-full rounded-md border border-border bg-bg px-2 py-1 text-xs"
          >
            {!current && <option value="">Elegir…</option>}
            {groups.map((g) => (
              <optgroup key={g} label={g}>
                {catalog
                  .filter((r) => r.group === g)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
