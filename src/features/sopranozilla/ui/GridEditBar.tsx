// Above the grid: WHAT the grid edits (the continuation of the edited EV row,
// or the range the street starts with), the brush weight, import / export and
// the mouse legend. The grid always paints — there is no brush mode to turn
// on or off. With a table row selected («Top pair») the brush only touches
// that row's combos; the whole row at once is the violet control under the
// grid (one job per control: the double click on these weights was dropped).

import { ArrowLeftRight, Download, Paintbrush, Undo2, Upload } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { Street } from '../engine/equity';
import type { GridTarget } from '../store/analyzerStore';

const CHIPS = [0, 25, 50, 75, 100] as const;
const STREET_LABEL: Record<Street, string> = { flop: 'flop', turn: 'turn', river: 'river' };

type Props = {
  street: Street;
  target: GridTarget;
  onTarget: (t: GridTarget) => void;
  /** The EV row being edited ("Bet 33%"). */
  rowLabel: string;
  brush: number;
  onBrush: (w: number) => void;
  /** Turn / river start range fixed by hand (no longer follows the previous street). */
  startFixed: boolean;
  onUnfix: () => void;
  onImport: () => void;
  onExport: () => void;
  /** The selected table row ("Top pair"): the brush is limited to it. */
  targetLabel: string | null;
  canUndo: boolean;
  onUndo: () => void;
  /** «Inv» (D132): the grid shows what does NOT pass the row. */
  inverted: boolean;
  onToggleInverse: () => void;
  /** Weighted combos of the inverse, and whether it chains (the row is the played one). */
  inverseCombos: number;
  rowIsPlayed: boolean;
  /** "turn" / "river"; null on the river (nothing comes after). */
  nextStreet: string | null;
  /** D135: what the colors mean when the row filters another row's range. */
  baseHint: string | null;
};

export function GridEditBar(p: Props) {
  const startLabel =
    p.street === 'flop' ? 'Rango preflop' : `Rango al empezar el ${STREET_LABEL[p.street]}`;
  const options: { value: GridTarget; label: string; title: string }[] = [
    {
      value: 'row',
      label: `Lo que sigue en «${p.rowLabel}»`,
      title: 'Filtra qué parte del rango sigue después de esta acción. No agrega manos.',
    },
    {
      value: 'start',
      label: startLabel,
      title:
        p.street === 'flop'
          ? 'Agrega o quita manos del rango con el que el villano llega al flop.'
          : `Agrega o quita manos del rango con el que el villano llega al ${STREET_LABEL[p.street]}.`,
    },
  ];

  return (
    <div className="mb-2 rounded-xl border border-border bg-surface/40 p-2.5 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-content-muted">El grid edita</span>
        <div role="radiogroup" aria-label="Qué edita el grid" className="flex flex-wrap gap-1">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={p.target === o.value}
              title={o.title}
              onClick={() => p.onTarget(o.value)}
              className={cn(
                'rounded-md border px-2 py-1 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light',
                p.target === o.value
                  ? 'border-sky-500 bg-sky-500/15 text-content'
                  : 'border-border text-content-muted hover:bg-surface-hover hover:text-content',
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
        {p.target === 'row' && (
          <button
            type="button"
            aria-pressed={p.inverted}
            onClick={p.onToggleInverse}
            title={`Inverso (como «Inv» en Flopzilla): muestra lo que NO sigue en «${p.rowLabel}». Si es la fila jugada, eso es lo que pasa a la siguiente calle (ej. el rango con el que el villano checkea).`}
            className={cn(
              'flex items-center gap-1 rounded-md border px-2 py-1 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light',
              p.inverted
                ? 'border-rose-500 bg-rose-500 text-white'
                : 'border-border text-content-muted hover:bg-surface-hover hover:text-content',
            )}
          >
            <ArrowLeftRight className="h-3.5 w-3.5" /> Inv
          </button>
        )}
        <span className="ml-auto flex gap-1">
          <button
            type="button"
            onClick={p.onUndo}
            disabled={!p.canUndo}
            title="Deshacer la última edición (Ctrl+Z)"
            className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-content-muted hover:bg-surface-hover hover:text-content disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <Undo2 className="h-3.5 w-3.5" /> Deshacer
          </button>
          <button
            type="button"
            onClick={p.onImport}
            title={`Pegar un rango para el ${STREET_LABEL[p.street]}`}
            className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-content-muted hover:bg-surface-hover hover:text-content"
          >
            <Upload className="h-3.5 w-3.5" /> Importar
          </button>
          <button
            type="button"
            onClick={p.onExport}
            title={`Exportar el rango del ${STREET_LABEL[p.street]}`}
            className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-content-muted hover:bg-surface-hover hover:text-content"
          >
            <Download className="h-3.5 w-3.5" /> Exportar
          </button>
        </span>
      </div>

      {p.target === 'row' && p.inverted && (
        <p
          role="note"
          className="mt-2 rounded-md bg-rose-500/10 px-2 py-1 text-rose-700 dark:text-rose-300"
        >
          <b>Inverso:</b> el grid muestra lo que <b>no</b> sigue en «{p.rowLabel}» (
          <span className="tabular-nums">{p.inverseCombos.toFixed(2)}</span> combos).{' '}
          {p.nextStreet === null
            ? null
            : p.rowIsPlayed
              ? `Esto es lo que pasa al ${p.nextStreet}.`
              : `Para que pase al ${p.nextStreet}, marca «${p.rowLabel}» como jugada.`}{' '}
          Lo que pintas es lo que ves; la tabla sigue marcando lo que sí sigue.
        </p>
      )}
      {p.target === 'start' && p.startFixed && (
        <p role="note" className="mt-2 text-sky-700 dark:text-sky-300">
          El rango del {STREET_LABEL[p.street]} está fijado a mano: ya no sigue lo que filtres en la
          calle anterior.{' '}
          <button type="button" onClick={p.onUnfix} className="underline hover:no-underline">
            Volver al encadenado
          </button>
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1 text-content-muted">
          <Paintbrush className="h-3.5 w-3.5 text-sky-500" />
          {p.target === 'row' ? 'Pincel (qué % de la mano sigue)' : 'Pincel (peso de la mano)'}
        </span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={p.brush}
          onChange={(e) => p.onBrush(Number(e.target.value))}
          aria-label="Peso del pincel"
          className="min-w-[6rem] flex-1 accent-sky-500"
        />
        <span className="w-8 text-right tabular-nums text-content">{p.brush}%</span>
        <div className="flex gap-1">
          {CHIPS.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={p.brush === c}
              onClick={() => p.onBrush(c)}
              className={cn(
                'rounded-md border px-1.5 py-0.5 tabular-nums',
                p.brush === c
                  ? 'border-sky-500 bg-sky-500/15 text-content'
                  : 'border-border text-content-muted hover:bg-surface-hover',
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-1.5 text-[11px] text-content-muted">
        Clic o arrastre: pintar · Clic derecho: quitar
        {p.target === 'row' && ' · Alt+clic: restaurar'} · Shift+clic: ver palos
      </p>
      {p.target === 'row' && p.baseHint && (
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-content-muted">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm bg-slate-400/60" /> gris
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm bg-amber-500" /> ámbar
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm bg-rose-500" /> rojo
          </span>
          <span className="basis-full">{p.baseHint}</span>
        </p>
      )}
      {p.targetLabel && (
        <p className="mt-1 text-[11px] text-violet-700 dark:text-violet-300">
          Con «{p.targetLabel}» elegida, el pincel solo pinta sus combos, mano por mano. Para
          cambiar toda «{p.targetLabel}» de una vez, usa el control violeta debajo del grid.
        </p>
      )}
    </div>
  );
}
