import { CARD_BACKS } from '@/data/tableThemes';
import { useTableThemeStore } from '@/store/tableThemeStore';

type Suit = '♠' | '♥' | '♦' | '♣';

// 4-color deck: spades slate, hearts red, diamonds blue, clubs green. The
// abstract trainer hands only ever use ♠♥♣; ♦ is here for real cards (board,
// hand-history) rendered by the análisis module via the same CardFace.
const SUIT_BG: Record<Suit, string> = {
  '♠': '#1e293b',
  '♥': '#b91c1c',
  '♦': '#2563eb',
  '♣': '#15803d',
};

export function parseHandCards(
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

export function CardFace({ rank, suit }: { rank: string; suit: Suit }) {
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

/**
 * Face-down card, themed by the user's chosen back color. Sibling of CardFace,
 * which it deliberately does not touch — CardFace is shared by Push/Fold,
 * /analisis and the Floating drill.
 *
 * `sm` is the villain size on the poker table (smaller than the hero's
 * h-14 w-10 so the seat reads as secondary and still fits the corner slots).
 */
export function CardBack({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const backId = useTableThemeStore((s) => s.cardBack);
  const back = CARD_BACKS[backId];
  const dims = size === 'sm' ? 'h-9 w-[26px] rounded-md' : 'h-14 w-10 rounded-lg';

  return (
    <div
      aria-hidden="true"
      className={`${dims} shadow-md select-none`}
      style={{
        backgroundColor: back.base,
        // Woven diagonal weave + a lighter inset frame, the way a real deck back
        // reads at small sizes. Pure CSS, no assets.
        backgroundImage: `repeating-linear-gradient(45deg, ${back.accent}33 0 2px, transparent 2px 5px)`,
        boxShadow: `inset 0 0 0 1px ${back.accent}66, inset 0 0 0 3px ${back.base}, 0 2px 6px rgba(0,0,0,0.5)`,
      }}
    />
  );
}

/** The villain's two face-down cards, fanned so they fit the corner seats. */
export function CardBackPair({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  return (
    <div className="flex items-center">
      <div className="-rotate-6">
        <CardBack size={size} />
      </div>
      <div className="-ml-2 rotate-6">
        <CardBack size={size} />
      </div>
    </div>
  );
}

export function HandCards({ hand }: { hand: string }) {
  const [c1, c2] = parseHandCards(hand);
  return (
    <div className="flex items-center gap-2">
      <CardFace rank={c1.rank} suit={c1.suit} />
      <CardFace rank={c2.rank} suit={c2.suit} />
    </div>
  );
}
