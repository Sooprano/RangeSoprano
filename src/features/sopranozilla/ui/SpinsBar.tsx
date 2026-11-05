// Spins hands (D128, D137): the rival type (Regular GTO or Fish), the preflop
// line read from the hand and the range in use — with the other stacks and
// sizes of the same spot one click away (Regular: the stack rounds to the
// closest, a tie takes the lower one; Fish: the band that holds the stack)
// and every spins range in a list, for the spots without a folder.

import { cn } from '@/lib/cn';
import { pickSpinsRange, spinsSpotRanges } from '../adapters/spinsPick';
import type { SpinsInfo } from '../adapters/spinsSpot';
import { spinsLineOf } from '../adapters/openHand';
import { bandText, RIVAL_LABEL, type SpinsRange, type SpinsRival } from '../ranges/spinsCatalog';

type Props = {
  info: SpinsInfo;
  catalog: readonly SpinsRange[] | null;
  /** The range in use (`SpinsRange.id`), if it is a spins one. */
  currentId: string | undefined;
  rival: SpinsRival;
  onPick: (range: SpinsRange) => void;
  /** Picks the range again for the other kind of rival. */
  onRival: (rival: SpinsRival) => void;
};

const chip = (active: boolean) =>
  cn(
    'rounded-md border px-2 py-0.5 tabular-nums',
    active
      ? 'border-accent bg-accent/15 text-content'
      : 'border-border text-content-muted hover:bg-surface-hover hover:text-content',
  );

const sizeText = (s: SpinsRange['size']) => (s === null ? '—' : s === 'AI' ? 'AI' : `${s}bb`);

const RIVAL_TITLE: Record<SpinsRival, string> = {
  regular: 'Rangos GTO para un regular',
  fish: 'Rangos para un jugador recreacional (fish)',
};

export function SpinsBar({ info, catalog, currentId, rival, onPick, onRival }: Props) {
  const current = catalog?.find((r) => r.id === currentId) ?? null;
  const lr = spinsLineOf(info);
  const pick = catalog && lr ? pickSpinsRange(catalog, lr.line, lr.role, rival) : null;
  // The spot's ranges, even when no Fish band holds the effective stack.
  const spot =
    pick?.sameSpot ??
    (catalog && lr ? spinsSpotRanges(catalog, lr.line, lr.role, rival) : null)?.sameSpot ??
    [];
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
  const stackLabel = (stack: number) => {
    const band = spot.find((r) => r.stackBb === stack)?.band;
    return band ? bandText(band) : String(stack);
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
          {(['regular', 'fish'] as const).map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={rival === r}
              title={RIVAL_TITLE[r]}
              onClick={() => rival !== r && onRival(r)}
              className={chip(rival === r)}
            >
              {RIVAL_LABEL[r]}
            </button>
          ))}
        </span>
      </div>

      {catalog && !pick && !current && rival === 'fish' && (
        <p className="flex flex-wrap items-center gap-2 text-content-muted">
          Sin rango Fish para este spot.
          <button
            type="button"
            onClick={() => onRival('regular')}
            className="rounded-md border border-border px-2 py-0.5 text-content hover:bg-surface-hover"
          >
            Usar el de Regular
          </button>
        </p>
      )}

      {spot.length > 0 && stacks.length > 1 && (
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
                {stackLabel(s)}
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
