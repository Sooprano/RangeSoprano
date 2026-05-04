import { cn } from '@/lib/cn';
import { combosOf } from '@/utils/handUtils';
import { POSITIONS, huVillainOf } from '@/types/poker';
import type { Position, TableFormat } from '@/types/poker';
import { CardFace, parseHandCards } from './HandCards';

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

function getTableLayout(
  heroPosition: Position,
  tableFormat: TableFormat,
): { position: Position; slot: Slot }[] {
  if (tableFormat === 'HU') {
    // Heads-up: only hero (slot 0, bottom-center) and villain (slot 3, top-center).
    const heroSlot = VISUAL_SLOTS[0]!;
    const villainSlot = VISUAL_SLOTS[3]!;
    const heroSeat = heroPosition === 'BB' ? 'BB' : 'BTN';
    const villainSeat = huVillainOf(heroSeat);
    return [
      { position: heroSeat, slot: heroSlot },
      { position: villainSeat, slot: villainSlot },
    ];
  }
  const heroIdx = POSITIONS.indexOf(heroPosition as (typeof POSITIONS)[number]);
  const base = heroIdx < 0 ? 0 : heroIdx;
  return VISUAL_SLOTS.map((slot, i) => {
    const posIdx = (base - i + N) % N;
    return { position: POSITIONS[posIdx]!, slot };
  });
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
  const [card1, card2] = parseHandCards(hand);
  const combos = combosOf(hand);
  // In HU the villain seat is implicit (BTN↔BB); honor that even if the prop is missing or stale.
  const effectiveHero =
    tableFormat === 'HU' && heroPosition !== 'BTN' && heroPosition !== 'BB'
      ? 'BTN'
      : heroPosition;
  const effectiveVillain =
    tableFormat === 'HU' ? huVillainOf(effectiveHero) : villainPosition;
  const layout = getTableLayout(effectiveHero, tableFormat);

  return (
    // Container 2.38:1 (W × 0.42W). All children absolute.
    // mb-12 reserves space for the hero seat which overflows below the felt
    // (cards + combos text + badge stack ~110px tall, anchored at y=96%).
    <div className="relative mx-auto mb-12 w-full max-w-md" style={{ paddingBottom: '42%' }}>

      {/* ── Stadium felt: long straight top/bottom, semicircular left/right ends ── */}
      <div
        className="absolute inset-x-[3%] inset-y-[8%] rounded-full"
        style={{
          background: 'radial-gradient(ellipse at 50% 35%, #1e3a4a 0%, #112233 55%, #0b1928 100%)',
          border: '3px solid #2a5070',
          boxShadow: '0 8px 32px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.06), 0 0 0 5px #0d2030',
        }}
      />

      {/* ── Seat tokens ── */}
      {layout.map(({ position, slot }) => {
        const isHero = position === effectiveHero;
        const isVillain = !isHero && position === effectiveVillain;
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
                <div className="rounded-md px-4 py-2.5 text-sm font-semibold uppercase tracking-wide bg-accent text-white shadow-sm">
                  {position}
                </div>
              </div>
            ) : (
              <div
                className={cn(
                  'rounded-md px-4 py-2.5 text-sm font-semibold uppercase tracking-wide',
                  isVillain
                    ? 'border border-accent/50 bg-surface text-content'
                    : 'border border-border bg-surface/80 text-content-disabled',
                )}
              >
                {position}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
