// Import / export the villain's range of ONE street (the one on screen). The
// turn export is the turn range already filtered by the flop, and so on.
// Import reads every format the app knows (no format to pick).

import { useMemo, useState } from 'react';
import { Copy, Download, Upload, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { pushToast } from '@/store/toastStore';
import { copyToClipboard, downloadBlob } from '@/utils/exportRange';
import type { ComboWeights } from '../engine/combos';
import type { Street } from '../engine/equity';
import { exportRange, type RangeExportFormat } from '../engine/rangeExport';
import { parseRangeText } from '../engine/rangeText';
import { combos as fmtCombos } from './format';
import { SzDialog } from './SzDialog';

const STREET_LABEL: Record<Street, string> = { flop: 'flop', turn: 'turn', river: 'river' };

const FORMATS: { value: RangeExportFormat; label: string; hint: string }[] = [
  { value: 'flopzilla', label: 'Formato Flopzilla', hint: 'Pesos [NN]…[/NN]' },
  { value: 'gtowizard', label: 'Formato GTO Wizard', hint: 'Combo por combo, AhKd: 0.5' },
  {
    value: 'notation',
    label: 'Formato estándar',
    hint: 'Notación con pesos [NN%]…[/NN%] (22+, AKs, [50%]QJo[/50%]): la del Editor de Range Soprano',
  },
];

function sumLive(w: ComboWeights, live: Uint8Array): number {
  let s = 0;
  for (let i = 0; i < w.length; i++) if (live[i] === 1) s += w[i] ?? 0;
  return s;
}

type ExportProps = {
  street: Street;
  rowLabel: string;
  start: ComboWeights;
  row: ComboWeights;
  live: Uint8Array;
  onClose: () => void;
};

export function ExportRangeDialog({ street, rowLabel, start, row, live, onClose }: ExportProps) {
  const [which, setWhich] = useState<'start' | 'row'>('start');
  const [format, setFormat] = useState<RangeExportFormat>('flopzilla');
  const weights = which === 'start' ? start : row;
  const text = useMemo(() => exportRange(weights, format, live), [weights, format, live]);
  const s = STREET_LABEL[street];
  const choices = [
    { value: 'start' as const, label: `Rango al empezar el ${s}`, w: start },
    { value: 'row' as const, label: `Lo que sigue en «${rowLabel}» (${s})`, w: row },
  ];

  const copy = async () => {
    const ok = await copyToClipboard(text);
    pushToast(
      ok
        ? { kind: 'success', message: 'Rango copiado al portapapeles.' }
        : { kind: 'error', message: 'No se pudo copiar: selecciona el texto y cópialo a mano.' },
    );
  };

  return (
    <SzDialog label={`Exportar rango del ${s}`} onClose={onClose} className="max-w-2xl">
      <DialogHead title={`Exportar rango del ${s}`} onClose={onClose} />
      <fieldset className="mb-3">
        <legend className="mb-1 text-xs text-content-muted">Qué rango</legend>
        <div className="flex flex-wrap gap-1.5">
          {choices.map((c) => (
            <Choice key={c.value} active={which === c.value} onClick={() => setWhich(c.value)}>
              {c.label}{' '}
              <span className="tabular-nums text-content-muted">
                · {fmtCombos(sumLive(c.w, live))} combos
              </span>
            </Choice>
          ))}
        </div>
      </fieldset>
      <fieldset className="mb-3">
        <legend className="mb-1 text-xs text-content-muted">Formato</legend>
        <div className="flex flex-wrap gap-1.5">
          {FORMATS.map((f) => (
            <Choice
              key={f.value}
              active={format === f.value}
              onClick={() => setFormat(f.value)}
              title={f.hint}
            >
              Exportar {f.label.charAt(0).toLowerCase() + f.label.slice(1)}
            </Choice>
          ))}
        </div>
      </fieldset>
      <textarea
        readOnly
        value={text}
        rows={6}
        aria-label="Rango exportado"
        className="w-full resize-y rounded-md border border-border bg-bg px-2 py-1.5 font-mono text-xs"
        onFocus={(e) => e.currentTarget.select()}
      />
      <p className="mt-1 text-[11px] text-content-muted">
        Las manos con palos de distinto peso salen combo por combo. Las cartas bloqueadas por tu
        mano y el board no se exportan.
      </p>
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          disabled={!text}
          onClick={() => downloadBlob(text, `rango-${s}.txt`, 'text/plain')}
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface-hover disabled:opacity-40"
        >
          <Download className="h-4 w-4" /> Descargar .txt
        </button>
        <button
          type="button"
          disabled={!text}
          onClick={() => void copy()}
          className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-deep disabled:opacity-40"
        >
          <Copy className="h-4 w-4" /> Copiar
        </button>
      </div>
    </SzDialog>
  );
}

type ImportProps = {
  street: Street;
  live: Uint8Array;
  onImport: (weights: ComboWeights) => void;
  onClose: () => void;
};

export function ImportRangeDialog({ street, live, onImport, onClose }: ImportProps) {
  const [text, setText] = useState('');
  const parsed = useMemo(() => (text.trim() ? parseRangeText(text) : null), [text]);
  const total = parsed ? sumLive(parsed.weights, live) : 0;
  const s = STREET_LABEL[street];

  const loadFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 1_000_000) {
      pushToast({ kind: 'error', message: 'El archivo es demasiado grande (máx. 1 MB).' });
      return;
    }
    setText(await file.text());
  };

  return (
    <SzDialog label={`Importar rango del ${s}`} onClose={onClose} className="max-w-2xl">
      <DialogHead title={`Importar rango del ${s}`} onClose={onClose} />
      <p className="mb-2 text-xs text-content-muted">
        Pega un rango en cualquier formato: Flopzilla <code>[50]AKs[/50]</code>, GTO Wizard{' '}
        <code>AhKd: 0.5</code>, notación <code>22+, A2s+, QQ:50</code> o combos sueltos{' '}
        <code>AhKh</code>.{' '}
        {street === 'flop'
          ? 'Reemplaza el rango preflop del villano.'
          : `Fija el rango con el que el villano llega al ${s} (deja de seguir lo filtrado en la calle anterior).`}{' '}
        Lo que ya filtraste en las acciones se mantiene.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        aria-label="Rango a importar"
        placeholder="22+, A2s+, KTs+, [50]QJo[/50]"
        className="w-full resize-y rounded-md border border-border bg-bg px-2 py-1.5 font-mono text-xs"
      />
      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
        <label className="flex cursor-pointer items-center gap-1 rounded-md border border-border px-2 py-1 text-content-muted hover:bg-surface-hover hover:text-content">
          <Upload className="h-3.5 w-3.5" /> Cargar .txt
          <input
            type="file"
            accept=".txt,text/plain"
            className="sr-only"
            onChange={(e) => void loadFile(e.target.files?.[0])}
          />
        </label>
        {parsed && (
          <span className="text-content-muted">
            <span className="tabular-nums text-content">{fmtCombos(total)}</span> combos vivos en
            el {s}
            {parsed.errors.length > 0 && (
              <span className="text-amber-700 dark:text-amber-300">
                {' '}
                · no se entendió: {parsed.errors.slice(0, 4).map((e) => e.token).join(', ')}
                {parsed.errors.length > 4 && '…'}
              </span>
            )}
          </span>
        )}
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-surface-hover"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={!parsed || total <= 0}
          onClick={() => parsed && onImport(parsed.weights)}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-deep disabled:opacity-40"
        >
          Usar este rango en el {s}
        </button>
      </div>
    </SzDialog>
  );
}

function DialogHead({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-sm font-semibold">{title}</h2>
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        className="rounded p-1 text-content-muted hover:bg-surface-hover hover:text-content"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function Choice({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      title={title}
      onClick={onClick}
      className={cn(
        'rounded-md border px-2 py-1 text-xs',
        active
          ? 'border-accent bg-accent/15 text-content'
          : 'border-border text-content-muted hover:bg-surface-hover hover:text-content',
      )}
    >
      {children}
    </button>
  );
}
