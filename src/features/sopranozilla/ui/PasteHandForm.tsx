// "Pegar mano": a hand history (.txt) straight into Sopranozilla, the same
// path as "Abrir en Sopranozilla" in /analisis but without leaving the page.

import { useRef, useState } from 'react';
import { Eraser, FileSearch } from 'lucide-react';
import { SAMPLE_RANGES } from '@/data/sampleRanges';
import { useRangeStore } from '@/store/rangeStore';
import { parseHandHistory } from '@/utils/handHistory';
import { savedHandFromParsed } from '../adapters/openHand';
import type { RangeSource } from '../adapters/villainRange';
import type { SavedHand } from '../store/lastHand';

type Props = {
  prefer: RangeSource;
  onLoad: (saved: SavedHand) => void;
  onClose: () => void;
};

export function PasteHandForm({ prefer, onLoad, onClose }: Props) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const analyze = () => {
    const { hand, errors } = parseHandHistory(text);
    if (!hand) {
      setError(errors[0]?.reason ?? 'No reconocí ninguna mano en el texto pegado.');
      return;
    }
    const result = savedHandFromParsed(hand, useRangeStore.getState().ranges, SAMPLE_RANGES, {
      prefer,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    onLoad(result.saved);
  };

  return (
    <form
      className="mb-4 rounded-xl border border-border bg-surface/40 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        analyze();
      }}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <label htmlFor="sz-paste" className="text-sm font-semibold">
          Pegar mano (.txt)
        </label>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-content-muted hover:text-content"
        >
          Cerrar
        </button>
      </div>
      <textarea
        id="sz-paste"
        ref={inputRef}
        autoFocus
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setError(null);
        }}
        rows={8}
        spellCheck={false}
        placeholder="Pega aquí el historial de la mano, igual que en Análisis de manos…"
        className="w-full resize-y rounded-lg border border-border bg-bg px-3 py-2 font-mono text-xs placeholder:text-content-disabled focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light"
      />
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
      <div className="mt-3 flex items-center gap-2">
        <button
          type="submit"
          disabled={text.trim() === ''}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-40"
        >
          <FileSearch className="h-4 w-4" /> Analizar mano
        </button>
        {text !== '' && (
          <button
            type="button"
            onClick={() => {
              setText('');
              setError(null);
              inputRef.current?.focus();
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-content-muted hover:bg-surface-hover hover:text-content"
          >
            <Eraser className="h-4 w-4" /> Limpiar
          </button>
        )}
        <span className="ml-auto text-xs text-content-muted">
          El rango del villano se busca primero en{' '}
          <b className="text-content">{prefer === 'gto' ? 'Rangos GTO' : 'Mis rangos'}</b>.
        </span>
      </div>
    </form>
  );
}
