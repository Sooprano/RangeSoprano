// 4-color deck: spades slate, hearts red, diamonds blue, clubs green. The
// abstract trainer hands only ever use ♠♥♣; ♦ is here for real cards (board,
// hand-history) rendered by the análisis module via the same CardFace.
export const SUIT_BG: Record<'♠' | '♥' | '♦' | '♣', string> = {
  '♠': '#1e293b',
  '♥': '#b91c1c',
  '♦': '#2563eb',
  '♣': '#15803d',
};
