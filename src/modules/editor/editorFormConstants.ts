import type { Situation } from '@/types/poker';

export { SITUATION_LABELS, TABLE_FORMAT_LABELS } from '@/data/positions';

export const villainDisabledFor = (s: Situation): boolean => s === 'RFI';

export const FORM_SELECT_CLASS =
  'rounded-md border border-border bg-bg px-2 py-1.5 text-sm text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light';
