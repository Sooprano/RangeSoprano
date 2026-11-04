// "Editar cartas" (D102): change the board and / or Hero's cards of the hand
// that is open, keeping everything else (villain range, pots, positions,
// recorded action). Opened from the cards in the top bar or the board strip.

import { useState } from 'react';
import { X } from 'lucide-react';
import { formatCard, parseCards, type CardId } from '../engine/cards';
import { CardPicker } from './CardPicker';
import { SzDialog } from './SzDialog';

type Props = {
  hero: readonly CardId[];
  board: readonly CardId[];
  onApply: (hero: [CardId, CardId], board: CardId[]) => void;
  onClose: () => void;
};

const toText = (ids: readonly CardId[]) => ids.map(formatCard).join(' ');

export function EditCardsDialog({ hero, board, onApply, onClose }: Props) {
  const [cards, setCards] = useState({ hero: toText(hero), board: toText(board) });
  const heroIds = parseCards(cards.hero) ?? [];
  const boardIds = parseCards(cards.board) ?? [];
  const error =
    heroIds.length !== 2
      ? 'Elige tus 2 cartas.'
      : boardIds.length < 3
        ? 'El board necesita al menos el flop (3 cartas).'
        : null;

  return (
    <SzDialog label="Editar cartas" onClose={onClose} className="max-w-2xl">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Editar cartas</h2>
          <p className="text-xs text-content-muted">
            Toca la carta que quieres cambiar (arriba): sale y su hueco queda esperando. Después
            toca la carta nueva. El rango del villano, los botes y la acción de la mano no
            cambian; las filas vuelven a sus presets.
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
      <CardPicker hero={cards.hero} board={cards.board} onChange={setCards} />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={error !== null}
          onClick={() => onApply([heroIds[0]!, heroIds[1]!], boardIds)}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-40"
        >
          Aplicar
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-border px-3 py-1.5 text-sm text-content-muted hover:bg-surface-hover"
        >
          Cancelar
        </button>
        {error && <span className="text-xs text-amber-700 dark:text-amber-300">{error}</span>}
      </div>
    </SzDialog>
  );
}
