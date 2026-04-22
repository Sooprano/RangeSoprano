import { z } from 'zod';
import { ACTIONS, POSITIONS, SITUATIONS } from '@/types/poker';
import type { Range } from '@/types/poker';

export const CURRENT_RANGE_STORE_VERSION = 1;
export const CURRENT_UI_STORE_VERSION = 1;

export const MAX_RANGES = 500;
export const MAX_CELLS_PER_RANGE = 169;
export const MAX_ACTIONS_PER_CELL = 5;
export const MAX_NAME_LEN = 80;
export const MAX_GROUP_LEN = 40;

export function sanitizeText(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\x00-\x1F\x7F]/g, '').trim();
}

const zPosition = z.enum(POSITIONS);
const zSituation = z.enum(SITUATIONS);
const zAction = z.enum(ACTIONS);

const HAND_REGEX = /^(?:([2-9TJQKA])\1|[2-9TJQKA]{2}[so])$/;

const zHandAction = z
  .object({
    action: zAction,
    weight: z.number().finite().min(0).max(100),
  })
  .strict();

const zRangeCellData = z
  .object({
    hand: z.string().regex(HAND_REGEX, 'invalid hand notation'),
    actions: z.array(zHandAction).max(MAX_ACTIONS_PER_CELL),
  })
  .strict()
  .refine(
    (c) => c.actions.reduce((s, a) => s + a.weight, 0) <= 100.01,
    { message: 'action weights sum > 100' },
  );

export const zRange = z
  .object({
    id: z.string().min(1).max(64),
    name: z.string().min(1).max(MAX_NAME_LEN).transform(sanitizeText),
    position: zPosition,
    situation: zSituation,
    villainPosition: zPosition.optional(),
    cells: z
      .record(z.string(), zRangeCellData)
      .refine(
        (obj) => Object.keys(obj).length <= MAX_CELLS_PER_RANGE,
        { message: `too many cells (>${MAX_CELLS_PER_RANGE})` },
      ),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
    group: z
      .string()
      .min(1)
      .max(MAX_GROUP_LEN)
      .transform(sanitizeText)
      .optional(),
  })
  .strict()
  .superRefine((r, ctx) => {
    // name post-sanitization must still be non-empty
    if (r.name.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'name empty after sanitization',
        path: ['name'],
      });
    }
    // every cell key must match its inner `hand`
    for (const [key, cell] of Object.entries(r.cells)) {
      if (cell.hand !== key) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `cell key "${key}" does not match inner hand "${cell.hand}"`,
          path: ['cells', key],
        });
        return;
      }
    }
  });

export const zPersistedRangeState = z
  .object({
    ranges: z.array(zRange).max(MAX_RANGES),
    activeRangeId: z.string().nullable(),
  })
  .strict();

export const zTheme = z.enum(['dark', 'light', 'system']);

export const zPersistedUiState = z
  .object({
    theme: zTheme,
    showActionLegend: z.boolean(),
    gridTooltipEnabled: z.boolean(),
  })
  .strict();

export type PersistedRangeState = {
  ranges: Range[];
  activeRangeId: string | null;
};

export type PersistedUiState = z.infer<typeof zPersistedUiState>;
