import { cn } from '@/lib/cn';

export type ChipTone = 'muted' | 'accent' | 'rose' | 'amber';

const CHIP_TONE: Record<
  ChipTone,
  { bar: string; ring: string; label: string; value: string }
> = {
  muted: {
    bar: 'bg-content/30',
    ring: 'ring-white/10',
    label: 'text-content-muted',
    value: 'text-content',
  },
  accent: {
    bar: 'bg-accent',
    ring: 'ring-accent-light/40',
    label: 'text-accent-light',
    value: 'text-accent-light',
  },
  rose: {
    bar: 'bg-rose-400',
    ring: 'ring-rose-200/40',
    label: 'text-rose-300',
    value: 'text-rose-200',
  },
  amber: {
    bar: 'bg-amber-400',
    ring: 'ring-amber-200/40',
    label: 'text-amber-300',
    value: 'text-amber-200',
  },
};

/**
 * A labeled stack of poker chips whose height scales to `amount / refAmount`
 * (~4 chips per reference unit, capped at 12). Shared by the MiniPot visuals
 * of the Auto-profit and SPR drills so a bet/all-in reads as "bigger than the
 * pot" at a glance. `format` renders the amount ($ / K / etc.).
 */
export function ChipColumn({
  eyebrow,
  tone,
  amount,
  refAmount,
  format,
  sub,
}: {
  eyebrow: string;
  tone: ChipTone;
  amount: number;
  refAmount: number;
  format: (n: number) => string;
  sub?: string;
}) {
  const palette = CHIP_TONE[tone];
  const chips = Math.max(
    1,
    Math.min(12, Math.round((amount / refAmount) * 4) || 1),
  );
  const CHIP_GAP_PX = 4;
  const CHIP_HEIGHT_PX = 6;
  const stackHeight = chips * CHIP_GAP_PX + CHIP_HEIGHT_PX;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative w-12" style={{ height: `${stackHeight}px` }} aria-hidden>
        {Array.from({ length: chips }, (_, i) => (
          <div
            key={i}
            className={cn(
              'absolute left-0 right-0 h-1.5 rounded-full ring-1',
              palette.bar,
              palette.ring,
            )}
            style={{ bottom: `${i * CHIP_GAP_PX}px` }}
          />
        ))}
      </div>
      <div className="flex flex-col items-center leading-tight">
        <span className={cn('text-[9px] font-semibold uppercase tracking-[0.14em]', palette.label)}>
          {eyebrow}
        </span>
        <span className={cn('font-mono text-sm font-bold tabular-nums', palette.value)}>
          {format(amount)}
        </span>
        <span className="text-[10px] tabular-nums text-content-muted min-h-[0.9rem]">{sub ?? ' '}</span>
      </div>
    </div>
  );
}
