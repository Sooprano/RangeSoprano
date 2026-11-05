// Category table (§10.4): one row per category with its bar, combos, share of
// the range, Hero's equity against it, weight and ✓ / ✗ of the edited EV row.

import { useRef, type ReactNode } from 'react';
import { Check, Copy, Download, Pencil, Plus, Trash2, Upload, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { CATEGORY_INFO } from '../engine/categories';
import { describeExpr, type CustomFilter } from '../engine/filterExpr';
import type { RowTarget } from '../store/analyzerStore';
import { combos, pct } from './format';
import { Tip } from './Tip';
import type { TableModel, TableRow } from './viewModel';

/** Actions on saved custom filters (§6.2). */
export type FilterActions = {
  onNew: () => void;
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onExport: () => void;
  onImport: (file: File) => void;
};

type Props = {
  model: TableModel;
  filters: readonly CustomFilter[];
  selected: RowTarget | null;
  /** Row under the pointer / keyboard focus: previews its hands in the grid. */
  hovered: RowTarget | null;
  onHover: (target: RowTarget | null) => void;
  onSelect: (target: RowTarget) => void;
  onToggle: (target: RowTarget, mark: 'follow' | 'exclude') => void;
  equityPending: boolean;
  filterActions: FilterActions;
  /** Narrow column: no share bar (the % column already says it). */
  compact?: boolean;
};

function sameTarget(a: RowTarget | null, b: RowTarget): boolean {
  return a !== null && a.kind === b.kind && a.id === b.id;
}

function labelOf(
  target: RowTarget,
  filters: readonly CustomFilter[],
): { label: string; definition: string } {
  if (target.kind === 'cat') return CATEGORY_INFO[target.id];
  const f = filters.find((x) => x.id === target.id);
  return {
    label: f?.name ?? 'Filtro',
    definition: f
      ? `Filtro personalizado: ${describeExpr(f.expr, filters)}.`
      : 'Filtro personalizado.',
  };
}

function Row({
  row,
  filters,
  selected,
  hovered,
  onHover,
  onSelect,
  onToggle,
  equityPending,
  filterActions,
  compact = false,
}: { row: TableRow } & Omit<Props, 'model'>) {
  const { label, definition } = labelOf(row.target, filters);
  const isSel = sameTarget(selected, row.target);
  const isHover = !isSel && sameTarget(hovered, row.target);
  const s = row.state?.s ?? null;
  const empty = row.combos <= 0;
  return (
    <tr
      className={cn(
        'border-t border-border/60',
        isSel ? 'bg-accent/10' : isHover && 'bg-violet-500/10',
      )}
      onMouseEnter={() => onHover(row.target)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(row.target)}
      onBlur={() => onHover(null)}
    >
      <td className="py-1 pr-2">
        <div className="flex items-center gap-0.5">
          <Tip text={definition} className="min-w-0 flex-1">
            {(describedBy) => (
              <button
                type="button"
                data-row={`${row.target.kind}:${row.target.id}`}
                onClick={() => onSelect(row.target)}
                aria-describedby={describedBy}
                aria-pressed={isSel}
                className={cn(
                  'w-full rounded px-1.5 py-0.5 text-left text-[13px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light',
                  isSel
                    ? 'font-semibold text-content'
                    : empty
                      ? 'text-content-disabled'
                      : 'text-content',
                  'hover:bg-surface-hover',
                )}
              >
                {label}
              </button>
            )}
          </Tip>
          {row.target.kind === 'custom' && (
            <>
              <IconButton
                label={`Editar ${label}`}
                onClick={() => filterActions.onEdit(row.target.id)}
              >
                <Pencil className="h-3 w-3" />
              </IconButton>
              <IconButton
                label={`Duplicar ${label}`}
                onClick={() => filterActions.onDuplicate(row.target.id)}
              >
                <Copy className="h-3 w-3" />
              </IconButton>
              <IconButton
                label={`Borrar ${label}`}
                onClick={() => filterActions.onDelete(row.target.id)}
              >
                <Trash2 className="h-3 w-3" />
              </IconButton>
            </>
          )}
        </div>
      </td>
      {!compact && (
        <td className="w-20 py-1 pr-2" aria-hidden>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/50">
            <div
              className="h-full rounded-full bg-amber-500"
              style={{ width: `${Math.min(100, row.share * 100)}%` }}
            />
          </div>
        </td>
      )}
      <td className="py-1 pr-2 text-right tabular-nums">{combos(row.combos)}</td>
      <td className="py-1 pr-2 text-right tabular-nums text-content-muted">{pct(row.share)}</td>
      <td className="py-1 pr-2 text-right tabular-nums">
        {empty ? '—' : equityPending && Number.isNaN(row.heroEq) ? '…' : pct(row.heroEq)}
      </td>
      <td
        className={cn(
          'py-1 pr-2 text-right tabular-nums',
          s !== 'follow' && 'text-content-disabled',
        )}
      >
        {s === 'follow' ? row.state?.w : s === 'exclude' ? 0 : '—'}
      </td>
      <td className="py-1">
        <div className="flex gap-1">
          <button
            type="button"
            aria-pressed={s === 'follow'}
            aria-label={`${label}: sigue`}
            onClick={() => onToggle(row.target, 'follow')}
            className={cn(
              'rounded p-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light',
              s === 'follow'
                ? 'bg-emerald-600 text-white'
                : 'text-content-muted hover:bg-surface-hover',
            )}
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-pressed={s === 'exclude'}
            aria-label={`${label}: no sigue`}
            onClick={() => onToggle(row.target, 'exclude')}
            className={cn(
              'rounded p-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light',
              s === 'exclude'
                ? 'bg-rose-600 text-white'
                : 'text-content-muted hover:bg-surface-hover',
            )}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="rounded p-1 text-content-muted hover:bg-surface-hover hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light"
    >
      {children}
    </button>
  );
}

export function CategoryTable(props: Props) {
  const { model, filterActions } = props;
  const fileRef = useRef<HTMLInputElement>(null);
  const toolBtn =
    'flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[11px] font-normal normal-case tracking-normal text-content-muted hover:bg-surface-hover hover:text-content';
  return (
    <div className="rounded-xl border border-border bg-surface/40 p-3">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-[11px] uppercase tracking-wide text-content-muted">
            <th className="pb-1 text-left font-medium">Categoría</th>
            {!props.compact && <th className="pb-1" />}
            <th className="pb-1 pr-2 text-right font-medium">Combos</th>
            <th className="pb-1 pr-2 text-right font-medium">% rango</th>
            <th className="pb-1 pr-2 text-right font-medium">Tu eq.</th>
            <th className="pb-1 pr-2 text-right font-medium">Peso</th>
            <th className="pb-1 text-left font-medium">✓ ✗</th>
          </tr>
        </thead>
        {model.groups
          .filter((g) => g.rows.length > 0 || g.id === 'custom')
          .map((g) => (
            <tbody key={g.id}>
              <tr>
                <th
                  colSpan={props.compact ? 6 : 7}
                  scope="colgroup"
                  className="pt-3 pb-1 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-light"
                >
                  {g.id === 'custom' ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="mr-auto">{g.label}</span>
                      <button type="button" className={toolBtn} onClick={filterActions.onNew}>
                        <Plus className="h-3 w-3" /> Filtro personalizado
                      </button>
                      <button
                        type="button"
                        className={toolBtn}
                        onClick={filterActions.onExport}
                        disabled={g.rows.length === 0}
                      >
                        <Download className="h-3 w-3" /> Exportar
                      </button>
                      <button
                        type="button"
                        className={toolBtn}
                        onClick={() => fileRef.current?.click()}
                      >
                        <Upload className="h-3 w-3" /> Importar
                      </button>
                      <input
                        ref={fileRef}
                        type="file"
                        accept="application/json,.json"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) filterActions.onImport(file);
                          e.target.value = '';
                        }}
                      />
                    </div>
                  ) : (
                    g.label
                  )}
                </th>
              </tr>
              {g.id === 'custom' && g.rows.length === 0 && (
                <tr>
                  <td colSpan={props.compact ? 6 : 7} className="pb-1 text-xs text-content-muted">
                    Combina categorías con Y / O / NO / PALOS y modificadores (ej.: «Top 3 BDFD»).
                  </td>
                </tr>
              )}
              {g.rows.map((row) => (
                <Row key={`${row.target.kind}:${row.target.id}`} row={row} {...props} />
              ))}
            </tbody>
          ))}
      </table>
      <p className="mt-3 border-t border-border pt-2 text-xs text-content-muted">
        Rango: <span className="tabular-nums text-content">{combos(model.total)}</span> combos (
        {pct(model.liveCombos > 0 ? model.total / model.liveCombos : 0)} de manos vivas) · Siguen:{' '}
        <span className="tabular-nums text-content">{combos(model.follows)}</span> (
        {pct(model.total > 0 ? model.follows / model.total : 0)})
      </p>
      <details className="mt-2 text-xs text-content-muted">
        <summary className="cursor-pointer select-none hover:text-content">
          ¿Cómo se calcula el peso de cada combo?
        </summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Si lo marcaste a mano con el selector de palos, manda ese peso.</li>
          <li>Si pintaste su celda en el grid, manda el peso del pincel (clic derecho = 0).</li>
          <li>
            Filtros personalizados que lo incluyen: el mayor peso entre los ✓; si solo hay ✗, 0.
          </li>
          <li>Combo draws que lo incluyen: igual que los filtros personalizados.</li>
          <li>
            Su mano hecha y sus proyectos: el mayor peso entre las filas ✓. Un ✗ no anula un ✓ (ej.:
            “Nada ✗” + “BDFD ✓ 40” = 40). Si ninguna fila ✓ lo incluye, 0.
          </li>
        </ol>
        <p className="mt-2">
          Peso efectivo = peso preflop × peso de la fila jugada en cada calle anterior × peso de
          esta calle.
        </p>
      </details>
      <details className="mt-1 text-xs text-content-muted">
        <summary className="cursor-pointer select-none hover:text-content">
          Atajos de teclado
        </summary>
        <ul className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
          {[
            ['↑ / ↓', 'Moverse entre filas de la tabla'],
            ['1 – 9, 0', 'Peso 10 – 90 y 100 de la fila seleccionada (sin fila: el del pincel)'],
            ['F', '✓ en la fila seleccionada'],
            ['X', '✗ en la fila seleccionada'],
            [
              'Clic / arrastre',
              'Pintar con el peso del pincel (con una fila elegida, solo sus combos)',
            ],
            ['Clic derecho', 'Quitar la mano (peso 0)'],
            ['Alt + clic', 'Restaurar la mano (vuelve a lo que digan las filas)'],
            ['Shift + clic', 'Ver y editar los palos de la mano'],
            ['Control violeta', 'Con una fila elegida: toda la fila a la vez (peso y palos)'],
            ['Ctrl + Z', 'Deshacer la última edición'],
            [
              'Inv',
              'Ver lo que NO sigue en la fila; si es la jugada, eso pasa a la siguiente calle',
            ],
            ['[ / ]', 'Calle anterior / siguiente'],
          ].map(([k, v]) => (
            <li key={k} className="contents">
              <kbd className="rounded border border-border px-1 font-mono text-[10px] text-content">
                {k}
              </kbd>
              <span>{v}</span>
            </li>
          ))}
        </ul>
        <p className="mt-1">
          No funcionan mientras escribes en un campo ni con el constructor de filtros abierto.
        </p>
      </details>
    </div>
  );
}
