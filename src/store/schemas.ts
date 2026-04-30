import { z } from 'zod';
import { POSITIONS, SITUATIONS, TABLE_FORMATS } from '@/types/poker';
import type { Range } from '@/types/poker';
import { DEFAULT_ACTION_DEFS } from '@/utils/actionMeta';

export const CURRENT_RANGE_STORE_VERSION = 1;
export const CURRENT_UI_STORE_VERSION = 2;
export const CURRENT_LEADERBOARD_STORE_VERSION = 1;
export const LEADERBOARD_TOP_N = 5;

export const MAX_RANGES = 500;
export const MAX_CELLS_PER_RANGE = 169;
export const MAX_ACTIONS_PER_CELL = 5;
export const MAX_NAME_LEN = 80;
export const MAX_GROUP_LEN = 80;
export const MAX_NOTES_LEN = 5000;
export const MAX_ACTION_LABEL_LEN = 40;
export const MAX_ACTIONS_PER_RANGE = 20;
export const MAX_PRINT_LABEL_LEN = 20;

export const GROUP_FOLDER_COLORS = [
  '#8b5cf6', '#a855f7', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#6366f1', '#78716c',
] as const;
export type GroupFolderColor = (typeof GROUP_FOLDER_COLORS)[number];

export const zGroupMeta = z.object({
  color: z.string().optional(),
  collapsed: z.boolean().optional(),
  order: z.number().finite().optional(),
});
export type GroupMeta = z.infer<typeof zGroupMeta>;

export function sanitizeText(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\x00-\x1F\x7F]/g, '').trim();
}

// Migrate legacy UTG+1 / UTG+2 positions (removed; both collapse to UTG).
const zPosition = z.preprocess(
  (v) => (v === 'UTG+1' || v === 'UTG+2' ? 'UTG' : v),
  z.enum(POSITIONS),
);
const zSituation = z.enum(SITUATIONS);
const zAction = z.string().min(1).max(64);

const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export const zActionDef = z
  .object({
    id: z.string().min(1).max(64),
    label: z.string().min(1).max(MAX_ACTION_LABEL_LEN).transform(sanitizeText),
    color: z.string().regex(HEX_COLOR_RE, 'invalid hex color'),
    order: z.number().finite(),
  })
  .strict();

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
    notes: z.string().max(MAX_NOTES_LEN).optional(),
    order: z.number().finite().optional(),
    actions: z
      .array(zActionDef)
      .max(MAX_ACTIONS_PER_RANGE)
      .default(() => DEFAULT_ACTION_DEFS.map((d) => ({ ...d }))),
    tableFormat: z.enum(TABLE_FORMATS).default('6max'),
    printLabels: z
      .object({
        stack: z.string().max(MAX_PRINT_LABEL_LEN).optional(),
        sizing1: z.string().max(MAX_PRINT_LABEL_LEN).optional(),
        sizing2: z.string().max(MAX_PRINT_LABEL_LEN).optional(),
      })
      .strict()
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
    viewerRangeId: z.string().nullable().default(null),
    trainerRangeId: z.string().nullable().default(null),
    groupMeta: z.record(z.string(), zGroupMeta).default({}),
    sidebarCollapsed: z.boolean().default(false),
    overviewSelectedGroups: z.array(z.string()).default([]),
  })
  .strict();

export type PersistedRangeState = {
  ranges: Range[];
  activeRangeId: string | null;
};

export type PersistedUiState = z.infer<typeof zPersistedUiState>;

const zSpeedClassicEntry = z
  .object({
    style: z.literal('classic'),
    durationSec: z.number().int().positive().max(600),
    correct: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
    hpm: z.number().nonnegative(),
    accuracyPct: z.number().min(0).max(100),
    dateIso: z.string().datetime({ offset: true }),
  })
  .strict();

const zSpeedDrawingEntry = z
  .object({
    style: z.literal('drawing'),
    durationSec: z.number().int().positive().max(600),
    matchCombos: z.number().nonnegative(),
    truthCombos: z.number().nonnegative(),
    guessCombos: z.number().nonnegative(),
    accuracyPct: z.number().min(0).max(100),
    dateIso: z.string().datetime({ offset: true }),
  })
  .strict();

export const zSpeedEntry = z.discriminatedUnion('style', [
  zSpeedClassicEntry,
  zSpeedDrawingEntry,
]);

export const zRangeLeaderboard = z
  .object({
    classic: z.array(zSpeedClassicEntry).max(LEADERBOARD_TOP_N).default([]),
    drawing: z.array(zSpeedDrawingEntry).max(LEADERBOARD_TOP_N).default([]),
  })
  .strict();

export const zPersistedLeaderboardState = z
  .object({
    byRangeId: z.record(z.string(), zRangeLeaderboard).default({}),
  })
  .strict();

export type SpeedClassicEntry = z.infer<typeof zSpeedClassicEntry>;
export type SpeedDrawingEntry = z.infer<typeof zSpeedDrawingEntry>;
export type SpeedEntry = z.infer<typeof zSpeedEntry>;
export type RangeLeaderboard = z.infer<typeof zRangeLeaderboard>;
export type PersistedLeaderboardState = z.infer<typeof zPersistedLeaderboardState>;
