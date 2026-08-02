import { cn } from '@/lib/cn';
import { withAlpha } from '@/utils/color';
import { useTableThemeStore } from '@/store/tableThemeStore';

/**
 * The trainer panel that holds the table, the action grid and the feedback row.
 *
 * The theme's `background` layer is painted HERE rather than inside PokerTable:
 * scoping it to the table alone left two nested rounded rectangles (a themed
 * one hugging the felt, sitting on the default surface), which read as an
 * accident. Owning the whole panel makes a custom background look deliberate.
 *
 * The bottom edge is the panel itself — the Auto-avance toggle lives outside it
 * and keeps the app's own chrome.
 *
 * With no background chosen (`null`, the default) this renders exactly the
 * classes the panel had before it was themable.
 */
export function TableSurface({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const background = useTableThemeStore((s) => s.background);
  const outerBorder = useTableThemeStore((s) => s.outerBorder);
  const themed = background !== null;

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-4 rounded-xl border p-4 shadow-surface sm:p-5',
        themed ? '' : 'border-border bg-surface/60',
        className,
      )}
      // Tie the panel edge to the table's own rim instead of the app border, so
      // the whole block reads as one object.
      style={
        themed
          ? {
              backgroundColor: background,
              borderColor: withAlpha(outerBorder, 0.4),
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}
