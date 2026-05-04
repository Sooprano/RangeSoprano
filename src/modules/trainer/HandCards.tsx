type Suit = '♠' | '♥' | '♣';

const SUIT_BG: Record<Suit, string> = {
  '♠': '#1e293b',
  '♥': '#b91c1c',
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

export function HandCards({ hand }: { hand: string }) {
  const [c1, c2] = parseHandCards(hand);
  return (
    <div className="flex items-center gap-2">
      <CardFace rank={c1.rank} suit={c1.suit} />
      <CardFace rank={c2.rank} suit={c2.suit} />
    </div>
  );
}
