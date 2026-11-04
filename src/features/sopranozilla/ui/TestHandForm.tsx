// "Mano de prueba" form: Hero cards, board, villain range text and pots,
// without going through /analisis (D3c).

import { useState } from 'react';
import { Library } from 'lucide-react';
import { CardPicker } from './CardPicker';
import { RangeLibraryDialog } from './RangeLibraryDialog';
import { buildTestHand, DEFAULT_TEST_HAND, type TestHandValues } from './testHand';
import type { AnalyzerHandInput } from '../engine/chain';
import type { ComboWeights } from '../engine/combos';

type Props = {
  /** Values to start from: the hand on screen (D102); the example otherwise. */
  initial?: TestHandValues;
  onLoad: (hand: AnalyzerHandInput, villain: ComboWeights, rangeText: string) => void;
  onClose: () => void;
};

const field =
  'w-full rounded-md border border-border bg-bg px-2 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light';

export function TestHandForm({ initial = DEFAULT_TEST_HAND, onLoad, onClose }: Props) {
  const [values, setValues] = useState<TestHandValues>(initial);
  const [messages, setMessages] = useState<{ errors: string[]; warnings: string[] }>({
    errors: [],
    warnings: [],
  });
  const [libraryOpen, setLibraryOpen] = useState(false);
  const set = (patch: Partial<TestHandValues>) => setValues((v) => ({ ...v, ...patch }));

  return (
    <form
      className="mb-4 rounded-xl border border-border bg-surface/40 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const built = buildTestHand(values);
        if (!built.ok) {
          setMessages({ errors: built.errors, warnings: [] });
          return;
        }
        setMessages({ errors: [], warnings: built.warnings });
        onLoad(built.hand, built.villain, values.range);
        if (built.warnings.length === 0) onClose();
      }}
    >
      <h2 className="mb-3 text-sm font-semibold">Mano de prueba</h2>
      <div className="mb-3">
        <CardPicker
          hero={values.hero}
          board={values.board}
          onChange={({ hero, board }) => set({ hero, board })}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs text-content-muted">
          Hero (cartas)
          <input
            className={field}
            value={values.hero}
            onChange={(e) => set({ hero: e.target.value })}
            placeholder="AsKs"
          />
        </label>
        <label className="text-xs text-content-muted">
          Board (3 a 5 cartas)
          <input
            className={field}
            value={values.board}
            onChange={(e) => set({ board: e.target.value })}
            placeholder="Kh 9h 4c 7s 2d"
          />
        </label>
        <label className="text-xs text-content-muted">
          Posición de Hero
          <input
            className={field}
            value={values.heroPosition}
            onChange={(e) => set({ heroPosition: e.target.value })}
          />
        </label>
        <label className="text-xs text-content-muted">
          Posición del villano
          <input
            className={field}
            value={values.villainPosition}
            onChange={(e) => set({ villainPosition: e.target.value })}
          />
        </label>
        {(['flop', 'turn', 'river'] as const).map((s) => (
          <label key={s} className="text-xs text-content-muted">
            Bote al {s === 'flop' ? 'flop' : s === 'turn' ? 'turn' : 'river'} (bb)
            <input
              className={field}
              inputMode="decimal"
              value={values.pots[s]}
              onChange={(e) => set({ pots: { ...values.pots, [s]: e.target.value } })}
            />
          </label>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-content-muted">Rango preflop del villano</span>
        <button
          type="button"
          onClick={() => setLibraryOpen(true)}
          className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-content-muted hover:bg-surface-hover hover:text-content"
        >
          <Library className="h-3.5 w-3.5" /> Cargar desde la biblioteca
        </button>
      </div>
      {libraryOpen && (
        <RangeLibraryDialog
          onClose={() => setLibraryOpen(false)}
          onUse={(text, range) => {
            set({ range: text, villainPosition: range.position });
            setLibraryOpen(false);
          }}
        />
      )}
      <label className="mt-1 block text-xs text-content-muted">
        En texto (ej.: <code>22-JJ, QQ:50, A2s-AJs, [50]KQo[/50]</code>)
        <textarea
          className={`${field} mt-1 font-mono text-xs`}
          rows={4}
          spellCheck={false}
          value={values.range}
          onChange={(e) => set({ range: e.target.value })}
        />
      </label>
      {messages.errors.length > 0 && (
        <ul role="alert" className="mt-2 list-disc pl-5 text-xs text-danger">
          {messages.errors.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}
      {messages.warnings.length > 0 && (
        <ul
          role="status"
          className="mt-2 list-disc pl-5 text-xs text-amber-700 dark:text-amber-300"
        >
          {messages.warnings.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="submit"
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-deep"
        >
          Cargar mano
        </button>
        <button
          type="button"
          onClick={() => {
            setValues(DEFAULT_TEST_HAND);
            setMessages({ errors: [], warnings: [] });
          }}
          className="rounded-md border border-border px-3 py-1.5 text-sm text-content-muted hover:bg-surface-hover"
        >
          Restaurar ejemplo
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-3 py-1.5 text-sm text-content-muted hover:bg-surface-hover"
        >
          Cerrar
        </button>
      </div>
    </form>
  );
}
