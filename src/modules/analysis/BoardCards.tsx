import { CardFace } from '@/modules/trainer/HandCards';
import type { Card } from '@/utils/handHistory';

/** Renders a row of real cards (board or hole cards) reusing the trainer CardFace. */
export function BoardCards({ cards }: { cards: Card[] }) {
  if (cards.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5">
      {cards.map((c, i) => (
        <CardFace key={`${c.rank}${c.suit}-${i}`} rank={c.rank} suit={c.suit} />
      ))}
    </div>
  );
}
