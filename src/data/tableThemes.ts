/**
 * Single source of truth for the trainer table skin (Entrenador · Clásico y
 * Velocidad) and the card back.
 *
 * Layer model, outside-in — mirrors how a real felt table is built:
 *   background  → the area around the table (null = inherit the app card)
 *   outerBorder → the thin rim line around the frame
 *   frame       → the wooden/metal band between the outer border and the felt
 *   innerRail   → the hairline around the felt itself (null = none)
 *   felt        → the playing surface; its gradient is derived via shade()
 *
 * Colors are hand-picked; every value is a literal `#rrggbb` so the persisted
 * blob can be validated against a strict regex before it ever reaches a `style`
 * attribute (see zPersistedTableTheme).
 */

export const TABLE_SHAPES = ['stadium', 'oval'] as const;
export type TableShape = (typeof TABLE_SHAPES)[number];

export const PLAYER_BOX_STYLES = ['solid', 'glass', 'neon'] as const;
export type PlayerBoxStyle = (typeof PLAYER_BOX_STYLES)[number];

export const CARD_BACK_IDS = [
  'blue',
  'red',
  'green',
  'purple',
  'black',
  'gold',
] as const;
export type CardBackId = (typeof CARD_BACK_IDS)[number];

/** The four user-editable color layers (innerRail is folded into the preset). */
export const TABLE_LAYERS = ['felt', 'outerBorder', 'frame', 'background'] as const;
export type TableLayer = (typeof TABLE_LAYERS)[number];

export type TableColors = {
  felt: string;
  outerBorder: string;
  frame: string;
  /** null = no hairline around the felt. */
  innerRail: string | null;
  /** null = transparent, the surrounding app card shows through. */
  background: string | null;
};

export type TablePreset = TableColors & {
  id: string;
  label: string;
};

/**
 * `clasico` MUST reproduce the pre-theming hardcoded look of PokerTable:
 * felt `#112233` mid-stop, `3px solid #2a5070` border, `0 0 0 5px #0d2030` ring
 * (that ring was, in effect, the frame). Keeping it as the default means an
 * existing user sees zero visual change until they opt into another skin.
 */
export const TABLE_PRESETS: TablePreset[] = [
  {
    id: 'clasico',
    label: 'Clásico',
    felt: '#112233',
    outerBorder: '#2a5070',
    frame: '#0d2030',
    innerRail: null,
    background: null,
  },
  {
    id: 'navy',
    label: 'Navy',
    felt: '#16234a',
    outerBorder: '#33457e',
    frame: '#101836',
    innerRail: null,
    background: '#0a0a1a',
  },
  {
    id: 'wine',
    label: 'Wine',
    felt: '#4a1526',
    outerBorder: '#8a2547',
    frame: '#2a0d18',
    innerRail: '#b4476b',
    background: '#17070d',
  },
  {
    id: 'emerald',
    label: 'Emerald',
    felt: '#0d4a35',
    outerBorder: '#1f7a58',
    frame: '#072a1e',
    innerRail: null,
    background: '#04140e',
  },
  {
    id: 'teal',
    label: 'Teal',
    felt: '#0d4247',
    outerBorder: '#1c7a83',
    frame: '#06272a',
    innerRail: null,
    background: '#041416',
  },
  {
    id: 'morado',
    label: 'Morado',
    felt: '#2e1252',
    outerBorder: '#5b2a94',
    frame: '#1a0a2f',
    innerRail: '#8b5cf6',
    background: '#0d0518',
  },
  {
    id: 'amber',
    label: 'Amber',
    felt: '#4a3208',
    outerBorder: '#96660f',
    frame: '#2a1c04',
    innerRail: '#d99a2b',
    background: '#150e03',
  },
  {
    id: 'midnight',
    label: 'Midnight',
    felt: '#14142a',
    outerBorder: '#2f2f57',
    frame: '#0a0a18',
    innerRail: null,
    background: '#050510',
  },
  {
    id: 'charcoal',
    label: 'Charcoal',
    felt: '#1f2225',
    outerBorder: '#3f464c',
    frame: '#131517',
    innerRail: null,
    background: '#0a0b0c',
  },
];

export const DEFAULT_PRESET_ID = 'clasico';

export function presetById(id: string): TablePreset | undefined {
  return TABLE_PRESETS.find((p) => p.id === id);
}

/**
 * Curated swatches per layer. All felt/frame/background values stay dark enough
 * that the white badge text keeps its contrast — that's why there is no free
 * color picker: it would let a user make their own table unreadable.
 */
export const LAYER_SWATCHES: Record<TableLayer, string[]> = {
  felt: [
    '#112233', '#16234a', '#4a1526', '#0d4a35', '#0d4247',
    '#2e1252', '#4a3208', '#14142a', '#1f2225', '#3a1a0d',
  ],
  outerBorder: [
    '#2a5070', '#33457e', '#8a2547', '#1f7a58', '#1c7a83',
    '#5b2a94', '#96660f', '#2f2f57', '#3f464c', '#8a4a22',
  ],
  frame: [
    '#0d2030', '#101836', '#2a0d18', '#072a1e', '#06272a',
    '#1a0a2f', '#2a1c04', '#0a0a18', '#131517', '#241208',
  ],
  background: [
    '#0a0a1a', '#17070d', '#04140e', '#041416', '#0d0518',
    '#150e03', '#050510', '#0a0b0c', '#000000',
  ],
};

/** Optional layers offer a "none" choice in the modal. */
export const OPTIONAL_LAYERS: readonly TableLayer[] = ['background'];

export const LAYER_LABEL: Record<TableLayer, string> = {
  felt: 'Color de la mesa',
  outerBorder: 'Borde de la mesa',
  frame: 'Marco (rim)',
  background: 'Fondo',
};

export const SHAPE_LABEL: Record<TableShape, string> = {
  stadium: 'Estadio',
  oval: 'Oval largo',
};

export const PLAYER_BOX_LABEL: Record<PlayerBoxStyle, string> = {
  solid: 'Sólido',
  glass: 'Cristal',
  neon: 'Neón',
};

export type CardBackDef = {
  label: string;
  /** Base surface of the back. */
  base: string;
  /** Lighter tone used for the woven diagonal pattern and the inner frame. */
  accent: string;
};

export const CARD_BACKS: Record<CardBackId, CardBackDef> = {
  blue: { label: 'Azul', base: '#1d4ed8', accent: '#60a5fa' },
  red: { label: 'Rojo', base: '#b91c1c', accent: '#f87171' },
  green: { label: 'Verde', base: '#15803d', accent: '#4ade80' },
  purple: { label: 'Morado', base: '#6d28d9', accent: '#a78bfa' },
  black: { label: 'Negro', base: '#1c1f24', accent: '#6b7280' },
  gold: { label: 'Oro', base: '#b45309', accent: '#fbbf24' },
};

export const DEFAULT_CARD_BACK: CardBackId = 'blue';

export const CHIP_STYLE_IDS = [
  'amber',
  'red',
  'blue',
  'green',
  'black',
  'purple',
  'ivory',
] as const;
export type ChipStyleId = (typeof CHIP_STYLE_IDS)[number];

export type ChipStyleDef = {
  label: string;
  /** Face of the chip. */
  base: string;
  /** Edge stripe — the ring that gives the disc its volume. */
  edge: string;
  /** Light tint for the "12bb" label so number and chips read as one object. */
  text: string;
};

/**
 * Casino chip colors for the hero's stack. Three hex each, same idea as
 * CARD_BACKS (base + accent): pairing the label tone with the chip avoids a red
 * stack sitting next to an unrelated amber number.
 *
 * Every `text` is a light tint that clears the luminance check against the dark
 * felt swatches — which is why, here too, there is no free color picker.
 */
export const CHIP_STYLES: Record<ChipStyleId, ChipStyleDef> = {
  // Default: matches the established "variable numeric datum" convention
  // (amber-200) used by the drills and the Push/Fold stack chip.
  amber: { label: 'Ámbar', base: '#d97706', edge: '#fbbf24', text: '#fde68a' },
  red: { label: 'Rojo', base: '#b91c1c', edge: '#f87171', text: '#fecaca' },
  blue: { label: 'Azul', base: '#1d4ed8', edge: '#60a5fa', text: '#bfdbfe' },
  green: { label: 'Verde', base: '#15803d', edge: '#4ade80', text: '#bbf7d0' },
  black: { label: 'Negro', base: '#1c1f24', edge: '#6b7280', text: '#e5e7eb' },
  purple: { label: 'Morado', base: '#6d28d9', edge: '#a78bfa', text: '#ddd6fe' },
  ivory: { label: 'Marfil', base: '#e7e5e4', edge: '#a8a29e', text: '#f5f5f4' },
};

export const DEFAULT_CHIP_STYLE: ChipStyleId = 'amber';
