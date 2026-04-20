import type { Action } from '@/types/poker';

export type ActionCssKey = 'raise' | 'threebet' | 'allin' | 'call' | 'fold';

export type ActionMeta = {
  label: string;
  cssKey: ActionCssKey;
  /** Full CSS color expression reading from theme vars. */
  cssColor: string;
  /** Tailwind utility for solid swatches. */
  swatchClass: string;
  /** Render order for stripe painting and legend display. */
  order: number;
};

export const ACTION_META: Record<Action, ActionMeta> = {
  RAISE: {
    label: 'Raise',
    cssKey: 'raise',
    cssColor: 'rgb(var(--color-action-raise))',
    swatchClass: 'bg-action-raise',
    order: 0,
  },
  '3BET': {
    label: '3-Bet',
    cssKey: 'threebet',
    cssColor: 'rgb(var(--color-action-threebet))',
    swatchClass: 'bg-action-threebet',
    order: 1,
  },
  ALL_IN: {
    label: 'All-In',
    cssKey: 'allin',
    cssColor: 'rgb(var(--color-action-allin))',
    swatchClass: 'bg-action-allin',
    order: 2,
  },
  CALL: {
    label: 'Call',
    cssKey: 'call',
    cssColor: 'rgb(var(--color-action-call))',
    swatchClass: 'bg-action-call',
    order: 3,
  },
  FOLD: {
    label: 'Fold',
    cssKey: 'fold',
    cssColor: 'rgb(var(--color-action-fold))',
    swatchClass: 'bg-action-fold',
    order: 4,
  },
};

export const ORDERED_ACTIONS = (Object.keys(ACTION_META) as Action[]).sort(
  (a, b) => ACTION_META[a].order - ACTION_META[b].order,
);
