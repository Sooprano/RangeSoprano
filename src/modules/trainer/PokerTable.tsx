import { cn } from '@/lib/cn';
import { combosOf } from '@/utils/handUtils';
import { brighten, shade, withAlpha } from '@/utils/color';
import { POSITIONS, huVillainOf } from '@/types/poker';
import type { Position, TableFormat } from '@/types/poker';
import { useTableThemeStore } from '@/store/tableThemeStore';
import type { PlayerBoxStyle, TableShape } from '@/data/tableThemes';
import { CardBackPair, CardFace, parseHandCards } from './HandCards';

// ── Table layout ─────────────────────────────────────────────────────────────

// POSITIONS is already in clockwise seat order: UTG → HJ → CO → BTN → SB → BB
const N = POSITIONS.length; // 6

// Stadium shape: paddingBottom=42% → container is 2.38:1 (W × 0.42W).
// Felt: inset-x-[3%] inset-y-[8%] → felt is 94% × 84% of container = 0.94W × 0.353W → ratio 2.66:1.
// border-radius:9999px on 2.66:1 element → long straight top/bottom + semicircular ends.
// Right semicircle center: (~79%, 50%). Left: (~21%, 50%). r ≈ 0.176W.
//
// 6-seat layout with bilateral symmetry:
// - Slot 0 (hero) at bottom-center; slot 3 directly across at top-center.
// - Slots 2 & 4 at same y (upper-right/upper-left corners) — BTN/HJ same height.
// - Slots 1 & 5 at same y (lower-right/lower-left corners) — SB/UTG same height.
type Slot = { x: number; y: number };
const VISUAL_SLOTS: Slot[] = [
  { x: 50, y: 96 }, // 0 — hero (bottom-center, just below felt bottom rail)
  { x: 91, y: 78 }, // 1 — lower-right corner  ← same y as slot 5
  { x: 91, y: 22 }, // 2 — upper-right corner  ← same y as slot 4
  { x: 50, y:  4 }, // 3 — top-center (directly across hero)
  { x:  9, y: 22 }, // 4 — upper-left corner   ← mirrors slot 2
  { x:  9, y: 78 }, // 5 — lower-left corner   ← mirrors slot 1
];

// Long oval: a flatter container (34% vs 42%) makes the felt ≈3.2:1 instead of
// 2.66:1 — the racetrack proportion used by desktop replayers. The container
// loses ~36px of height at max-w-md, so the corner seats have to open up
// (22/78 → 17/83) or the badges collide with the top and bottom rails.
const OVAL_SLOTS: Slot[] = [
  { x: 50, y: 97 },
  { x: 92, y: 83 },
  { x: 92, y: 17 },
  { x: 50, y:  1 },
  { x:  8, y: 17 },
  { x:  8, y: 83 },
];

const SLOTS_BY_SHAPE: Record<TableShape, Slot[]> = {
  stadium: VISUAL_SLOTS,
  oval: OVAL_SLOTS,
};

type ShapeGeom = {
  /** Container aspect ratio driver. */
  paddingBottom: string;
  /** Vertical inset of the table body inside the container. */
  insetY: string;
  /** Space reserved for the hero stack, which overflows below the felt. */
  heroSpace: string;
};

const SHAPE_GEOM: Record<TableShape, ShapeGeom> = {
  stadium: { paddingBottom: '42%', insetY: '8%', heroSpace: 'mb-12' },
  oval: { paddingBottom: '34%', insetY: '6%', heroSpace: 'mb-14' },
};

// The frame band sits *outside* the old felt box and its padding pulls the felt
// back in, so the `clasico` preset renders pixel-identical to the pre-theming
// hardcoded table: outer edge = old felt box + 5px (the old `0 0 0 5px` ring),
// felt surface = old felt box − 3px (the old 3px border).
const FRAME_OUTSET = 5;
const FRAME_PAD = 5;
const FRAME_BORDER = 3;

function getTableLayout(
  heroPosition: Position,
  tableFormat: TableFormat,
  shape: TableShape,
): { position: Position; slot: Slot }[] {
  const slots = SLOTS_BY_SHAPE[shape];
  if (tableFormat === 'HU') {
    // Heads-up: only hero (slot 0, bottom-center) and villain (slot 3, top-center).
    const heroSlot = slots[0]!;
    const villainSlot = slots[3]!;
    const heroSeat = heroPosition === 'BB' ? 'BB' : 'BTN';
    const villainSeat = huVillainOf(heroSeat);
    return [
      { position: heroSeat, slot: heroSlot },
      { position: villainSeat, slot: villainSlot },
    ];
  }
  const heroIdx = POSITIONS.indexOf(heroPosition as (typeof POSITIONS)[number]);
  const base = heroIdx < 0 ? 0 : heroIdx;
  return slots.map((slot, i) => {
    const posIdx = (base - i + N) % N;
    return { position: POSITIONS[posIdx]!, slot };
  });
}

// ── Player box ───────────────────────────────────────────────────────────────

type SeatRole = 'hero' | 'villain' | 'idle';

/**
 * The hero always keeps `bg-accent`: "this one is you" must never depend on a
 * cosmetic setting. Only the villain/idle boxes change with the style.
 */
function playerBoxStyle(
  variant: PlayerBoxStyle,
  role: SeatRole,
  accent: string,
): { className: string; style: React.CSSProperties } {
  const base =
    'rounded-md px-4 py-2.5 text-sm font-semibold uppercase tracking-wide';

  if (role === 'hero') {
    return {
      className: cn(base, 'bg-accent text-white shadow-sm'),
      style:
        variant === 'neon'
          ? { boxShadow: `0 0 14px ${withAlpha(accent, 0.55)}` }
          : {},
    };
  }

  if (variant === 'glass') {
    return {
      className: cn(
        base,
        'border backdrop-blur-sm',
        role === 'villain'
          ? 'border-white/25 bg-white/15 text-white'
          : 'border-white/10 bg-white/5 text-white/55',
      ),
      style: {},
    };
  }

  if (variant === 'neon') {
    return {
      className: cn(
        base,
        'border bg-surface/70',
        role === 'villain'
          ? 'border-accent/60 text-content'
          : 'border-border text-content-disabled',
      ),
      style:
        role === 'villain'
          ? { boxShadow: `0 0 12px ${withAlpha(accent, 0.45)}` }
          : {},
    };
  }

  // solid — the original look
  return {
    className: cn(
      base,
      role === 'villain'
        ? 'border border-accent/50 bg-surface text-content'
        : 'border border-border bg-surface/80 text-content-disabled',
    ),
    style: {},
  };
}

// ── PokerTable ───────────────────────────────────────────────────────────────

type PokerTableProps = {
  heroPosition: Position;
  villainPosition?: Position;
  hand: string;
  tableFormat?: TableFormat;
};

export function PokerTable({
  heroPosition,
  villainPosition,
  hand,
  tableFormat = '6max',
}: PokerTableProps) {
  const theme = useTableThemeStore();
  const [card1, card2] = parseHandCards(hand);
  const combos = combosOf(hand);
  // In HU the villain seat is implicit (BTN↔BB); honor that even if the prop is missing or stale.
  const effectiveHero =
    tableFormat === 'HU' && heroPosition !== 'BTN' && heroPosition !== 'BB'
      ? 'BTN'
      : heroPosition;
  const effectiveVillain =
    tableFormat === 'HU' ? huVillainOf(effectiveHero) : villainPosition;
  const layout = getTableLayout(effectiveHero, tableFormat, theme.shape);
  const geom = SHAPE_GEOM[theme.shape];

  // One stored hex per layer; the felt's three gradient stops are derived.
  // brighten() (multiplicative) keeps the felt's saturation on the highlight —
  // mixing toward white would wash a deep blue-green out to grey.
  const feltGradient = `radial-gradient(ellipse at 50% 35%, ${brighten(
    theme.felt,
    1.7,
  )} 0%, ${theme.felt} 55%, ${shade(theme.felt, -0.28)} 100%)`;

  return (
    // Container 2.38:1 (W × 0.42W) in stadium. All children absolute.
    // The bottom margin reserves space for the hero seat, which overflows below
    // the felt (cards + combos text + badge stack ~110px tall).
    <div
      className={cn('relative mx-auto w-full max-w-md', geom.heroSpace)}
      style={{ paddingBottom: geom.paddingBottom }}
    >
      {/* The `background` layer is NOT painted here — it belongs to the whole
          trainer panel (see TableSurface), otherwise it renders as a second
          rounded rectangle hugging the felt inside the default surface. */}

      {/* ── Frame (rim) + outer border, wrapping the felt ── */}
      <div
        className="absolute rounded-full"
        style={{
          left: `calc(3% - ${FRAME_OUTSET}px)`,
          right: `calc(3% - ${FRAME_OUTSET}px)`,
          top: `calc(${geom.insetY} - ${FRAME_OUTSET}px)`,
          bottom: `calc(${geom.insetY} - ${FRAME_OUTSET}px)`,
          backgroundColor: theme.frame,
          border: `${FRAME_BORDER}px solid ${theme.outerBorder}`,
          padding: FRAME_PAD,
          boxShadow: '0 8px 32px rgba(0,0,0,0.75)',
        }}
      >
        {/* ── Felt ── */}
        <div
          className="h-full w-full rounded-full"
          style={{
            background: feltGradient,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
            ...(theme.innerRail !== null && {
              border: `2px solid ${theme.innerRail}`,
            }),
          }}
        />
      </div>

      {/* ── Seat tokens ── */}
      {layout.map(({ position, slot }) => {
        const isHero = position === effectiveHero;
        const isVillain = !isHero && position === effectiveVillain;
        const role: SeatRole = isHero ? 'hero' : isVillain ? 'villain' : 'idle';
        const box = playerBoxStyle(theme.playerBox, role, theme.outerBorder);
        // Bottom-half seats stack their cards above the badge; top-half seats
        // put them below, so nothing is clipped by the container edge (slot 3
        // sits at y≈4% — cards above it would render off-canvas).
        const cardsAbove = slot.y > 50;

        return (
          <div
            key={position}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
          >
            {isHero ? (
              // Hero: cards stacked directly above the position badge
              <div className="flex flex-col items-center gap-1.5">
                <div className="flex items-center gap-2">
                  <CardFace rank={card1.rank} suit={card1.suit} />
                  <CardFace rank={card2.rank} suit={card2.suit} />
                </div>
                <span className="text-[10px] text-white/30">{combos} combos</span>
                <div className={box.className} style={box.style}>
                  {position}
                </div>
              </div>
            ) : isVillain ? (
              // Villain: face-down cards make the matchup readable at a glance.
              <div className="flex flex-col items-center gap-1">
                {cardsAbove && <CardBackPair />}
                <div className={box.className} style={box.style}>
                  {position}
                </div>
                {!cardsAbove && <CardBackPair />}
              </div>
            ) : (
              <div className={box.className} style={box.style}>
                {position}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
