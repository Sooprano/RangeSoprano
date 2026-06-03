// Shared score model + timing constants for the /ejercicios drills (no JSX, so
// the component file `drillUi.tsx` stays fast-refresh friendly).

export const AUTO_ADVANCE_MS = 2000;
export const STREAK_BONUS_THRESHOLD = 5;

export type Score = {
  correct: number;
  total: number;
  streak: number;
  bestStreak: number;
};

export const INITIAL_SCORE: Score = {
  correct: 0,
  total: 0,
  streak: 0,
  bestStreak: 0,
};

/** Folds a graded answer into the running score. */
export function tallyScore(prev: Score, wasCorrect: boolean): Score {
  const streak = wasCorrect ? prev.streak + 1 : 0;
  return {
    correct: prev.correct + (wasCorrect ? 1 : 0),
    total: prev.total + 1,
    streak,
    bestStreak: Math.max(prev.bestStreak, streak),
  };
}
