import { memo, useMemo } from 'react';
import { cn } from '@/lib/cn';
import { ALL_HANDS, categoryOf, handToGridCoords } from '@/utils/handUtils';
import type { WeightedHand } from '@/utils/handRangeParser';
import type { HandCategory } from '@/types/poker';

// Mini chart 13×13 presentacional (no interactivo) para previsualizar un rango
// de un vistazo. Colorea cada celda en rango según su categoría, para que la
// FORMA del rango (lineal / polarizado / etc.) se distinga sin leer notación.
// Reusa ALL_HANDS + handToGridCoords (orden/posición del grid) + categoryOf.
// Cero matemática: solo pinta las manos que recibe.

const CATEGORY_FILL: Record<HandCategory, string> = {
  pair: 'bg-amber-400',
  suited: 'bg-emerald-400',
  offsuit: 'bg-sky-400',
};

export const MiniRangeChart = memo(function MiniRangeChart({
  hands,
  className,
}: {
  hands: WeightedHand[];
  className?: string;
}) {
  const weightByHand = useMemo(
    () => new Map(hands.filter((h) => h.weight > 0).map((h) => [h.hand, h.weight])),
    [hands],
  );

  // Orden por coordenada (row-major) para que el grid CSS quede alineado.
  const ordered = useMemo(
    () =>
      [...ALL_HANDS].sort((a, b) => {
        const ca = handToGridCoords(a);
        const cb = handToGridCoords(b);
        return ca.row - cb.row || ca.col - cb.col;
      }),
    [],
  );

  return (
    <div
      aria-hidden
      className={cn(
        'grid aspect-square w-full grid-cols-[repeat(13,1fr)] gap-px overflow-hidden rounded',
        className,
      )}
    >
      {ordered.map((hand) => {
        const w = weightByHand.get(hand);
        if (w == null) return <div key={hand} className="h-full w-full bg-bg/70" />;
        // Peso → opacidad (piso 0.3 para que las frecuencias bajas se vean).
        return (
          <div
            key={hand}
            className={cn('h-full w-full', CATEGORY_FILL[categoryOf(hand)])}
            style={{ opacity: 0.3 + 0.7 * Math.min(1, w / 100) }}
          />
        );
      })}
    </div>
  );
});
