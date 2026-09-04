import { z } from 'zod';
import { POSITIONS, SITUATIONS, TABLE_FORMATS } from '@/types/poker';
import type { Range } from '@/types/poker';
import { DEFAULT_ACTION_DEFS } from '@/utils/actionMeta';
import {
  CARD_BACK_IDS,
  CHIP_STYLE_IDS,
  PLAYER_BOX_STYLES,
  TABLE_SHAPES,
} from '@/data/tableThemes';

export const CURRENT_RANGE_STORE_VERSION = 1;
export const CURRENT_UI_STORE_VERSION = 2;
export const CURRENT_LEADERBOARD_STORE_VERSION = 1;
export const CURRENT_HOTKEY_STORE_VERSION = 1;
export const CURRENT_TABLE_THEME_VERSION = 2;
export const LEADERBOARD_TOP_N = 5;
export const CURRENT_ODDS_LEADERBOARD_VERSION = 1;
export const ODDS_LEADERBOARD_TOP_N = 5;
export const ODDS_DURATIONS = [30, 60, 120] as const;
export const CURRENT_PUSHFOLD_LEADERBOARD_VERSION = 1;
export const PUSHFOLD_LEADERBOARD_TOP_N = 5;
export const PUSHFOLD_DURATIONS = [30, 60, 120] as const;
export const PUSHFOLD_KINDS = ['push-or-fold', 'call-or-fold'] as const;
export const CURRENT_RANDOMIZER_VERSION = 1;
export const RANDOMIZER_FREQUENCIES = [500, 1000, 2000, 5000] as const;
export const RANDOMIZER_SETS_COUNT = 3;
export const RANDOMIZER_PRESETS_PER_SET = 4;
export const MAX_RANDOMIZER_LABEL_LEN = 24;

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

/**
 * Shape of the JSON payload produced by `allRangesToJson` and consumed by the
 * profile importer. Keeps `groupMeta` and `randomizer` optional so files
 * exported before folder metadata or the randomizer existed still validate.
 */
export const zExportPayload = z
  .object({
    version: z.number().optional(),
    exportedAt: z.string().optional(),
    ranges: z.array(zRange).max(MAX_RANGES),
    groupMeta: z.record(z.string(), zGroupMeta).optional(),
    randomizer: z.lazy(() => zPersistedRandomizerState).optional(),
  })
  .passthrough();

export const zTheme = z.enum(['dark', 'light', 'system']);

export const zPersistedUiState = z
  .object({
    theme: zTheme,
    showActionLegend: z.boolean(),
    gridTooltipEnabled: z.boolean(),
    viewerRangeId: z.string().nullable().default(null),
    trainerRangeId: z.string().nullable().default(null),
    // Folder currently targeted by the trainer (train every range inside it).
    // `.default(null)` on a `.strict()` object: strict rejects UNKNOWN keys, not
    // missing ones, so an older persisted blob still parses — no version bump.
    trainerFolderPath: z.string().nullable().default(null),
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

/**
 * Trainer custom hotkeys: normalized action label → single key char. Global by
 * label so the same key carries across every range that has an action of that
 * name (and across Classic/Speed).
 */
export const zPersistedHotkeyState = z
  .object({
    bindings: z.record(z.string(), z.string()).default({}),
  })
  .strict();

export type PersistedHotkeyState = z.infer<typeof zPersistedHotkeyState>;

/**
 * Trainer table skin + card back. Every color lands in an inline `style`, so the
 * value space is closed to `#rrggbb` — a tampered/corrupt localStorage blob can
 * never inject a CSS declaration.
 */
const zHexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const zPersistedTableTheme = z
  .object({
    presetId: z.string().max(40),
    felt: zHexColor,
    outerBorder: zHexColor,
    frame: zHexColor,
    innerRail: zHexColor.nullable(),
    background: zHexColor.nullable(),
    shape: z.enum(TABLE_SHAPES),
    playerBox: z.enum(PLAYER_BOX_STYLES),
    cardBack: z.enum(CARD_BACK_IDS),
    chipStyle: z.enum(CHIP_STYLE_IDS),
    showLogo: z.boolean(),
    showStack: z.boolean(),
    // Added after v2. `.default(true)` instead of a version bump + `migrate`
    // entry: `.strict()` rejects UNKNOWN keys, not missing ones, so a stored v2
    // blob still parses and just picks up the default.
    showVillainAction: z.boolean().default(true),
    showSpotName: z.boolean().default(true),
    showBlinds: z.boolean().default(true),
  })
  .strict();

export type PersistedTableTheme = z.infer<typeof zPersistedTableTheme>;

const ODDS_DURATION_VALUES = ODDS_DURATIONS as readonly number[];

export const zOddsEntry = z
  .object({
    durationSec: z
      .number()
      .int()
      .positive()
      .refine((n) => ODDS_DURATION_VALUES.includes(n), {
        message: 'unsupported duration',
      }),
    correct: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
    qpm: z.number().nonnegative(),
    accuracyPct: z.number().min(0).max(100),
    dateIso: z.string().datetime({ offset: true }),
  })
  .strict();

export const zOddsLeaderboard = z
  .object({
    byDuration: z
      .record(z.string(), z.array(zOddsEntry).max(ODDS_LEADERBOARD_TOP_N))
      .default({}),
  })
  .strict();

export type OddsEntry = z.infer<typeof zOddsEntry>;
export type OddsLeaderboard = z.infer<typeof zOddsLeaderboard>;

export const CURRENT_ODDS_LEADERBOARD_EXPORT_VERSION = 1;

export const zOddsLeaderboardExportPayload = z
  .object({
    version: z.literal(CURRENT_ODDS_LEADERBOARD_EXPORT_VERSION),
    exportedAt: z.string().optional(),
    byDuration: z.record(z.string(), z.array(zOddsEntry)),
  })
  .strict();

export type OddsLeaderboardExportPayload = z.infer<
  typeof zOddsLeaderboardExportPayload
>;

const PUSHFOLD_DURATION_VALUES = PUSHFOLD_DURATIONS as readonly number[];
const PUSHFOLD_KIND_VALUES = PUSHFOLD_KINDS as readonly string[];

export const zPushFoldEntry = z
  .object({
    durationSec: z
      .number()
      .int()
      .positive()
      .refine((n) => PUSHFOLD_DURATION_VALUES.includes(n), {
        message: 'unsupported duration',
      }),
    correct: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
    qpm: z.number().nonnegative(),
    accuracyPct: z.number().min(0).max(100),
    dateIso: z.string().datetime({ offset: true }),
    enabledKinds: z
      .array(z.string().refine((k) => PUSHFOLD_KIND_VALUES.includes(k)))
      .optional(),
  })
  .strict();

export const zPushFoldLeaderboard = z
  .object({
    byDuration: z
      .record(z.string(), z.array(zPushFoldEntry).max(PUSHFOLD_LEADERBOARD_TOP_N))
      .default({}),
  })
  .strict();

export type PushFoldEntry = z.infer<typeof zPushFoldEntry>;
export type PushFoldLeaderboard = z.infer<typeof zPushFoldLeaderboard>;

const RANDOMIZER_FREQUENCY_VALUES = RANDOMIZER_FREQUENCIES as readonly number[];

export const zRandomizerPreset = z
  .object({
    id: z.string().min(1).max(64),
    label: z.string().max(MAX_RANDOMIZER_LABEL_LEN).transform(sanitizeText),
    value: z.number().int().min(1).max(100),
  })
  .strict();

export const zRandomizerSet = z
  .object({
    label: z.string().max(MAX_RANDOMIZER_LABEL_LEN).transform(sanitizeText),
    presets: z.array(zRandomizerPreset).length(RANDOMIZER_PRESETS_PER_SET),
  })
  .strict();

/**
 * Not `.strict()` on purpose: legacy persisted v1 includes a `listSize` field
 * that we removed in fase 20a. Stripping it silently preserves the rest of the
 * config (sets, frequency); .strict() would fail safeParse and reset to defaults.
 *
 * `highlightEnabled` defaults to `true` so v1 payloads (which lack the field)
 * hydrate cleanly without bumping the store version.
 */
export const zPersistedRandomizerState = z.object({
  activeSet: z
    .number()
    .int()
    .min(0)
    .max(RANDOMIZER_SETS_COUNT - 1),
  sets: z.array(zRandomizerSet).length(RANDOMIZER_SETS_COUNT),
  frequency: z
    .number()
    .int()
    .refine((n) => RANDOMIZER_FREQUENCY_VALUES.includes(n), {
      message: 'unsupported frequency',
    }),
  expanded: z.boolean(),
  highlightEnabled: z.boolean().default(true),
});

export type RandomizerPreset = z.infer<typeof zRandomizerPreset>;
export type RandomizerSet = z.infer<typeof zRandomizerSet>;
export type PersistedRandomizerState = z.infer<typeof zPersistedRandomizerState>;
export type RandomizerFrequency = (typeof RANDOMIZER_FREQUENCIES)[number];

// ─── Chronometer ─────────────────────────────────────────────────────────────

export const CURRENT_CHRONOMETER_VERSION = 1;
export const MAX_CHRONOMETER_LAPS = 50;

export const zChronometerLap = z.object({
  n: z.number().int().positive(),
  delta: z.number().nonnegative(),
  total: z.number().nonnegative(),
});

export const zChronometerState = z.object({
  running: z.boolean(),
  elapsed: z.number().nonnegative(),
  lastStartedAt: z.number().nullable(),
  laps: z.array(zChronometerLap).max(MAX_CHRONOMETER_LAPS),
});

export type ChronometerLap = z.infer<typeof zChronometerLap>;
export type ChronometerPersistedState = z.infer<typeof zChronometerState>;
