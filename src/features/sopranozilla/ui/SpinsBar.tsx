// Spins hands (D128): the rival type, the preflop line read from the hand and
// the Regular range in use — with the other stacks and sizes of the same spot
// one click away (the stack rounds to the closest; a tie takes the lower one,
// the other may be the right one) and every spins range in a list, for the
// spots without a folder.

import { cn } from '@/lib/cn';
import { pickSpinsRange } from '../adapters/spinsPick';
import type { SpinsInfo } from '../adapters/spinsSpot';
import type { SpinsRange } from '../ranges/spinsCatalog';

type Props = {
  info: SpinsInfo;
  catalog: readonly SpinsRange[] | null;
  /** The range in use (`SpinsRange.id`), if it is a spins one. */
  currentId: string | undefined;
  onPick: (range: SpinsRange) => void;
};

const chip = (active: boolean) =>
  cn(
    'rounded-md border px-2 py-0.5 tabular-nums',
    active
      ? 'border-accent bg-accent/15 text-content'
      : 'border-border text-content-muted hover:bg-surface-hover hover:text-content',
  );

const sizeText = (s: SpinsRange['size']) => (s === null ? '—' : s === 'AI' ? 'AI' : `${s}bb`);

export function SpinsBar({ info, catalog, currentId, onPick }: Props) {
  const current = catalog?.find((r) => r.id === currentId) ?? null;
  const pick =
    catalog && info.role && info.effectiveBb !== null && info.description !== null
      ? pickSpinsRange(
          catalog,
          {
            format: info.format,
            effectiveBb: info.effectiveBb,
            description: info.description,
            roles: [],
          },
          { name: '', ...info.role },
        )
      : null;
  // Stacks of the spot, and the sizes at the stack in use.
  const spot = pick?.sameSpot ?? [];
  const stackNow = current?.stackBb ?? pick?.range.stackBb ?? null;
  const stacks = [...new Set(spot.map((r) => r.stackBb))].sort((a, b) => a - b);
  const sizes = spot.filter((r) => r.stackBb === stackNow);
  const groups = catalog ? [...new Set(catalog.map((r) => r.group))] : [];

  /** Same spot, another stack: keep the size closest to the one in use. */
  const atStack = (stack: number) => {
    const ref = current?.size ?? pick?.range.size ?? null;
    const options = spot.filter((r) => r.stackBb === stack);
    const dist = (r: SpinsRange) =>
      typeof ref === 'number' && typeof r.size === 'number' ? Math.abs(r.size - ref) : 0;
    return [...options].sort((a, b) => dist(a) - dist(b))[0];
  };

  return (
    <div className="mt-2 flex flex-col gap-1.5 border-t border-border pt-2 text-xs">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-content-muted">
          Spins {info.format}
          {info.effectiveBb !== null && (
            <>
              {' '}
              · efectivo <span className="tabular-nums text-content">{info.effectiveBb}bb</span>
            </>
          )}
        </span>
        <span role="group" aria-label="Tipo de rival" className="ml-auto flex items-center gap-1">
          <span className="text-content-muted">Rival</span>
          <button type="button" aria-pressed className={chip(true)}>
            Regular
          </button>
          <button
            type="button"
            disabled
            title="Próximamente: rangos para jugadores recreacionales"
            className="cursor-not-allowed rounded-md border border-dashed border-border px-2 py-0.5 text-content-disabled"
          >
            Recreacional · pronto
          </button>
        </span>
      </div>

      {pick && stacks.length > 1 && (
        <div
          role="group"
          aria-label="Stack del rango"
          className="flex flex-wrap items-center gap-1"
        >
          <span className="mr-1 text-content-muted">Stack</span>
          {stacks.map((s) => {
            const target = atStack(s);
            return (
              <button
                key={s}
                type="button"
                aria-pressed={s === stackNow}
                disabled={!target}
                onClick={() => target && onPick(target)}
                className={chip(s === stackNow)}
              >
                {s}
              </button>
            );
          })}
        </div>
      )}
      {sizes.length > 1 && (
        <div
          role="group"
          aria-label="Tamaño del rango"
          className="flex flex-wrap items-center gap-1"
        >
          <span className="mr-1 text-content-muted">Tamaño</span>
          {sizes.map((r) => (
            <button
              key={r.id}
              type="button"
              aria-pressed={r.id === currentId}
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
          <span className="text-content-muted">Rango de spins</span>
          <select
            value={currentId ?? ''}
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
