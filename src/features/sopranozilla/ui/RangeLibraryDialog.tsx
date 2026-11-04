// "Cargar rango del villano": pick a range from the site's GTO ranges or from
// "Mis rangos", choose which actions (colors) count, preview it and use it.
// The result goes into the test hand's range text, so it can still be edited.

import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { RangeGrid } from '@/components/RangeGrid';
import { SAMPLE_RANGES } from '@/data/sampleRanges';
import { cn } from '@/lib/cn';
import { useRangeStore } from '@/store/rangeStore';
import type { ActionId, Range } from '@/types/poker';
import { buildActionDefMap } from '@/utils/actionMeta';
import { actionShares, defaultActionIds, previewCells, rangeToText } from './rangeLibrary';

type Source = 'gto' | 'mine';

type Props = {
  onUse: (text: string, range: Range) => void;
  onClose: () => void;
};

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function groupLabel(group: string | undefined): string {
  return group ? group.split('/').join(' › ') : 'Sin carpeta';
}

export function RangeLibraryDialog({ onUse, onClose }: Props) {
  const mine = useRangeStore((s) => s.ranges);
  const [source, setSource] = useState<Source>('gto');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionIds, setActionIds] = useState<ActionId[]>([]);
  const dialogRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Focus the search on open, trap Tab and close on Escape (same pattern as
  // the app's other modals).
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    searchRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const els = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null,
      );
      const first = els[0];
      const last = els[els.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      previous?.focus?.();
    };
  }, [onClose]);

  const ranges = source === 'gto' ? SAMPLE_RANGES : mine;
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const byGroup = new Map<string, Range[]>();
    for (const r of ranges) {
      const label = groupLabel(r.group);
      if (q && !`${r.name} ${label}`.toLowerCase().includes(q)) continue;
      const list = byGroup.get(label) ?? [];
      list.push(r);
      byGroup.set(label, list);
    }
    return [...byGroup.entries()];
  }, [ranges, query]);

  const selected = ranges.find((r) => r.id === selectedId) ?? null;
  const shares = useMemo(() => (selected ? actionShares(selected) : []), [selected]);
  const actionsMap = useMemo(
    () => (selected ? buildActionDefMap(selected.actions) : undefined),
    [selected],
  );
  const cells = useMemo(
    () => (selected ? previewCells(selected, actionIds) : {}),
    [selected, actionIds],
  );
  const total = shares
    .filter((s) => actionIds.includes(s.def.id))
    .reduce((sum, s) => sum + s.share, 0);

  const choose = (r: Range) => {
    setSelectedId(r.id);
    setActionIds(defaultActionIds(r));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sz-range-title"
        onClick={(e) => e.stopPropagation()}
        className="my-auto flex w-full max-w-4xl flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-surface"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="sz-range-title" className="text-base font-semibold">
              Rango del villano
            </h2>
            <p className="text-xs text-content-muted">
              Elige un rango y las acciones (colores) que cuentan. Reemplaza el rango actual.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-md p-1 text-content-muted hover:bg-surface-hover hover:text-content"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-[16rem_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-2">
            <div role="tablist" aria-label="Origen" className="flex gap-1">
              {(
                [
                  ['gto', 'Rangos GTO'],
                  ['mine', 'Mis rangos'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={source === id}
                  onClick={() => {
                    setSource(id);
                    setSelectedId(null);
                  }}
                  className={cn(
                    'flex-1 rounded-full border px-2 py-1 text-xs font-medium',
                    source === id
                      ? 'border-amber-500 bg-amber-500/15 text-content'
                      : 'border-border text-content-muted hover:bg-surface-hover',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar (ej.: BB vs BTN)"
              aria-label="Buscar rango"
              className="rounded-md border border-border bg-bg px-2 py-1.5 text-sm"
            />
            <div className="max-h-[22rem] overflow-y-auto pr-1">
              {groups.length === 0 && (
                <p className="py-4 text-center text-xs text-content-muted">
                  {source === 'mine' && mine.length === 0
                    ? 'Todavía no tienes rangos propios. Créalos en el Editor.'
                    : 'Ningún rango coincide.'}
                </p>
              )}
              {groups.map(([label, list]) => (
                <div key={label} className="mb-2">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-content-muted">
                    {label}
                  </p>
                  {list.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      aria-pressed={r.id === selectedId}
                      onClick={() => choose(r)}
                      className={cn(
                        'block w-full truncate rounded px-2 py-1 text-left text-sm',
                        r.id === selectedId
                          ? 'bg-accent/15 text-content'
                          : 'hover:bg-surface-hover',
                      )}
                    >
                      {r.name}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="min-w-0">
            {selected ? (
              <div className="flex flex-col gap-3 lg:flex-row">
                <div className="min-w-0 flex-1">
                  <RangeGrid cells={cells} {...(actionsMap && { actionsMap })} />
                </div>
                <div className="flex w-full flex-col gap-2 lg:w-52">
                  <p className="text-xs font-semibold uppercase tracking-wide text-content-muted">
                    Acciones que cuentan
                  </p>
                  {shares.map(({ def, share }) => {
                    const on = actionIds.includes(def.id);
                    return (
                      <label
                        key={def.id}
                        className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-2 py-1 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() =>
                            setActionIds((ids) =>
                              on ? ids.filter((x) => x !== def.id) : [...ids, def.id],
                            )
                          }
                        />
                        <span
                          aria-hidden
                          className="h-3 w-3 shrink-0 rounded-sm"
                          style={{ backgroundColor: def.color }}
                        />
                        <span className="min-w-0 flex-1 truncate">{def.label}</span>
                        <span className="tabular-nums text-xs text-content-muted">
                          {(share * 100).toFixed(1)}%
                        </span>
                      </label>
                    );
                  })}
                  <p className="text-xs text-content-muted">
                    {(total * 100).toFixed(1)}% de las manos
                  </p>
                  <button
                    type="button"
                    disabled={actionIds.length === 0}
                    onClick={() => onUse(rangeToText(selected, actionIds), selected)}
                    className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-deep disabled:opacity-40"
                  >
                    Usar este rango
                  </button>
                </div>
              </div>
            ) : (
              <p className="py-10 text-center text-sm text-content-muted">
                Elige un rango de la lista.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
