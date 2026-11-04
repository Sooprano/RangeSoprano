// Compact board above the grid. It lives in the sticky column, so the board
// stays in view while scrolling the category table (the top bar does not).

import { SUIT_BG } from '@/data/suitColors';
import { Pencil } from 'lucide-react';
import { cn } from '@/lib/cn';
import { fromCardId, type CardId } from '../engine/cards';
import type { Street } from '../engine/equity';
import { bb } from './format';

const STREET_LABEL: Record<Street, string> = { flop: 'Flop', turn: 'Turn', river: 'River' };

function MiniCard({ id, isNew = false }: { id: CardId; isNew?: boolean }) {
  const c = fromCardId(id);
  return (
    <span
      className={cn(
        'flex h-7 w-5 flex-col items-center justify-center rounded text-white shadow-sm select-none',
        isNew && 'ring-2 ring-amber-400 ring-offset-1 ring-offset-bg',
      )}
      style={{ backgroundColor: SUIT_BG[c.suit] }}
    >
      <span className="text-xs font-bold leading-none">{c.rank}</span>
      <span className="text-[8px] leading-none text-white/60">{c.suit}</span>
    </span>
  );
}

type Props = {
  street: Street;
  board: readonly CardId[];
  hero: readonly CardId[];
  pot: number | undefined;
  /** Opens «Editar cartas» (D102). */
  onEdit?: (() => void) | undefined;
};

export function BoardStrip({ street, board, hero, pot, onEdit }: Props) {
  const label = board.map((id) => fromCardId(id)).map((c) => `${c.rank}${c.suit}`).join(' ');
  return (
    <div
      aria-label={`${STREET_LABEL[street]}: ${label}`}
      className="mb-1.5 flex items-center gap-2 rounded-lg border border-border bg-surface/80 px-2 py-1 text-xs backdrop-blur"
    >
      <span className="font-semibold">{STREET_LABEL[street]}</span>
      <span className="flex gap-1">
        {board.map((id, i) => (
          <MiniCard key={id} id={id} isNew={i === board.length - 1 && board.length > 3} />
        ))}
      </span>
      <span className="ml-auto flex items-center gap-1 text-content-muted">
        Hero
        {hero.map((id) => (
          <MiniCard key={id} id={id} />
        ))}
      </span>
      <span className="tabular-nums text-content-muted">· {bb(pot)}</span>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          title="Cambiar el board o tus cartas"
          aria-label="Editar cartas"
          className="rounded p-1 text-content-muted hover:bg-surface-hover hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
