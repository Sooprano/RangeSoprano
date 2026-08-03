import type { Range } from '@/types/poker';

/** Pulls "12" out of a range named "BBvsBU 12bb" / "HU BTN 8 bb". */
const STACK_FROM_NAME_RE = /(\d+(?:\.\d+)?)\s*bb/i;

/**
 * Effective stack depth of a range, as the raw number the user typed.
 *
 * The explicit Editor field wins; otherwise it falls back to the range NAME,
 * which is what makes a folder of `BBvsBU 25bb … BBvsBU 8bb` work without
 * anyone filling in a single field.
 *
 * Returns '' when there is no stack information at all.
 */
export function deriveStack(range: Range): string {
  if (range.printLabels?.stack) return range.printLabels.stack;
  const m = range.name.match(STACK_FROM_NAME_RE);
  return m ? m[1]! : '';
}

/**
 * Display label for the trainer table: `"12"` → `"12bb"`.
 *
 * The Editor field is free text (capped at MAX_PRINT_LABEL_LEN), so a user may
 * well have typed "12bb" already — don't produce "12bbbb". Returns `null` when
 * there is nothing to show, so the caller renders no chip at all rather than an
 * empty placeholder.
 */
export function stackLabelOf(range: Range): string | null {
  const raw = deriveStack(range).trim();
  if (raw === '') return null;
  return /bb$/i.test(raw) ? raw : `${raw}bb`;
}
