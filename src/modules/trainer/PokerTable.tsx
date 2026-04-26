import { cn } from '@/lib/cn';
import { combosOf } from '@/utils/handUtils';
import { POSITIONS } from '@/types/poker';
import type { Position } from '@/types/poker';

// ── Card rendering ──────────────────────────────────────────────────────────

type Suit = '♠' | '♥' | '♣';

const SUIT_BG: Record<Suit, string> = {
  '♠': '#1e293b',
  '♥': '#b91c1c',
  '♣': '#15803d',
};

function parseHandCards(
  hand: string,
): [{ rank: string; suit: Suit }, { rank: string; suit: Suit }] {
  if (hand.length === 2) {
    return [{ rank: hand[0]!, suit: '♠' }, { rank: hand[1]!, suit: '♥' }];
  }
  if (hand.endsWith('s')) {
    return [{ rank: hand[0]!, suit: '♣' }, { rank: hand[1]!, suit: '♣' }];
  }
  return [{ rank: hand[0]!, suit: '♥' }, { rank: hand[1]!, suit: '♠' }];
}

function CardFace({ rank, suit }: { rank: string; suit: Suit }) {
  return (
    <div
      className="flex h-14 w-10 flex-col items-center justify-center gap-0.5 rounded-lg shadow-md select-none"
      style={{ backgroundColor: SUIT_BG[suit] }}
    >
      <span className="text-xl font-bold leading-none text-white">{rank}</span>
      <span className="text-[10px] leading-none text-white/50">{suit}</span>
    </div>
  );
}

// ── Table layout ─────────────────────────────────────────────────────────────

// POSITIONS is already in clockwise seat order: UTG → HJ → CO → BTN → SB → BB
const N = POSITIONS.length; // 6

// Fixed visual slots.
// Slot 0 = hero (always bottom-center).
// Slots 1-5 go counter-clockwise in seating order (right → top-right → top-left → left).
type Slot = { x: number; y: number };
const VISUAL_SLOTS: Slot[] = [
  { x: 50, y: 91 }, // 0 — hero, bottom-center
  { x: 84, y: 79 }, // 1 — bottom-right
  { x: 97, y: 47 }, // 2 — right
  { x: 80, y: 11 }, // 3 — top-right
  { x: 20, y: 11 }, // 4 — top-left
  { x: 3,  y: 47 }, // 5 — left
];

function getTableLayout(heroPosition: Position): { position: Position; slot: Slot }[] {
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
};

export function PokerTable({ heroPosition, villainPosition, hand }: PokerTableProps) {
  const [card1, card2] = parseHandCards(hand);
  const combos = combosOf(hand);
  const layout = getTableLayout(heroPosition);

  return (
    // Aspect-ratio container via padding-bottom trick; all children absolute.
    <div className="relative mx-auto w-full max-w-md" style={{ paddingBottom: '52%' }}>

      {/* ── Oval felt ── */}
      <div
        className="absolute inset-x-[4%] inset-y-[10%] rounded-[50%]"
        style={{
          background: 'radial-gradient(ellipse at center, #122a1a 0%, #0d1f12 100%)',
          border: '3px solid #1e3d26',
          boxShadow: '0 4px 24px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)',
        }}
      />

      {/* ── Cards: just above the hero seat ── */}
      <div
        className="absolute flex flex-col items-center gap-1"
        style={{ left: '50%', top: '62%', transform: 'translate(-50%, -50%)' }}
      >
        <div className="flex items-center gap-2">
          <CardFace rank={card1.rank} suit={card1.suit} />
          <CardFace rank={card2.rank} suit={card2.suit} />
        </div>
        <span className="text-[10px] text-white/30">{combos} combos</span>
      </div>

      {/* ── Seat tokens ── */}
      {layout.map(({ position, slot }) => {
        const isHero = position === heroPosition;
        const isVillain = !isHero && position === villainPosition;
        return (
          <div
            key={position}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
          >
            <div
              className={cn(
                'rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                isHero
                  ? 'bg-accent text-white shadow-sm'
                  : isVillain
                    ? 'border border-accent/50 bg-surface text-content'
                    : 'border border-border bg-surface/80 text-content-disabled',
              )}
            >
              {position}
            </div>
          </div>
        );
      })}
    </div>
  );
}
