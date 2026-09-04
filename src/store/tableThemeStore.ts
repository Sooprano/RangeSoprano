import { create } from 'zustand';
import { persist, type PersistStorage } from 'zustand/middleware';
import {
  CURRENT_TABLE_THEME_VERSION,
  zPersistedTableTheme,
  type PersistedTableTheme,
} from './schemas';
import { TABLE_THEME_STORE_KEY, createSafeJSONStorage } from './persist';
import {
  DEFAULT_CARD_BACK,
  DEFAULT_CHIP_STYLE,
  DEFAULT_PRESET_ID,
  presetById,
  type CardBackId,
  type ChipStyleId,
  type PlayerBoxStyle,
  type TableLayer,
  type TableShape,
} from '@/data/tableThemes';

/** Defaults reproduce the pre-theming look exactly (preset `clasico`). */
function buildInitial(): PersistedTableTheme {
  const preset = presetById(DEFAULT_PRESET_ID)!;
  return {
    presetId: preset.id,
    felt: preset.felt,
    outerBorder: preset.outerBorder,
    frame: preset.frame,
    innerRail: preset.innerRail,
    background: preset.background,
    shape: 'stadium',
    playerBox: 'solid',
    cardBack: DEFAULT_CARD_BACK,
    chipStyle: DEFAULT_CHIP_STYLE,
    showLogo: true,
    showStack: true,
    showVillainAction: true,
    showSpotName: true,
    showBlinds: true,
  };
}

const INITIAL: PersistedTableTheme = buildInitial();

type TableThemeState = PersistedTableTheme & {
  /** Apply a named preset (replaces the four colors + the inner rail). */
  applyPreset: (id: string) => void;
  /** Edit one color layer. `null` is only meaningful for optional layers. */
  setLayer: (layer: TableLayer, color: string | null) => void;
  setInnerRail: (color: string | null) => void;
  setShape: (shape: TableShape) => void;
  setPlayerBox: (style: PlayerBoxStyle) => void;
  setCardBack: (back: CardBackId) => void;
  setChipStyle: (chip: ChipStyleId) => void;
  setShowLogo: (show: boolean) => void;
  setShowStack: (show: boolean) => void;
  setShowVillainAction: (show: boolean) => void;
  setShowSpotName: (show: boolean) => void;
  setShowBlinds: (show: boolean) => void;
  reset: () => void;
};

export const useTableThemeStore = create<TableThemeState>()(
  persist(
    (set) => ({
      ...INITIAL,

      applyPreset: (id) => {
        const preset = presetById(id);
        if (!preset) return;
        set({
          presetId: preset.id,
          felt: preset.felt,
          outerBorder: preset.outerBorder,
          frame: preset.frame,
          innerRail: preset.innerRail,
          background: preset.background,
        });
      },

      // Any manual layer edit detaches from the preset — the chip in the modal
      // stops reading as "you are on Navy" once Navy has been altered.
      setLayer: (layer, color) =>
        set(() => {
          if (layer === 'background') {
            return { background: color, presetId: 'custom' };
          }
          if (color === null) return {};
          if (layer === 'felt') return { felt: color, presetId: 'custom' };
          if (layer === 'outerBorder') {
            return { outerBorder: color, presetId: 'custom' };
          }
          return { frame: color, presetId: 'custom' };
        }),

      setInnerRail: (color) => set({ innerRail: color, presetId: 'custom' }),
      setShape: (shape) => set({ shape }),
      setPlayerBox: (playerBox) => set({ playerBox }),
      setCardBack: (cardBack) => set({ cardBack }),
      setChipStyle: (chipStyle) => set({ chipStyle }),
      setShowLogo: (showLogo) => set({ showLogo }),
      setShowStack: (showStack) => set({ showStack }),
      setShowVillainAction: (showVillainAction) => set({ showVillainAction }),
      setShowSpotName: (showSpotName) => set({ showSpotName }),
      setShowBlinds: (showBlinds) => set({ showBlinds }),
      reset: () => set({ ...INITIAL }),
    }),
    {
      name: TABLE_THEME_STORE_KEY,
      version: CURRENT_TABLE_THEME_VERSION,
      storage: createSafeJSONStorage() as PersistStorage<PersistedTableTheme>,
      partialize: (s) => ({
        presetId: s.presetId,
        felt: s.felt,
        outerBorder: s.outerBorder,
        frame: s.frame,
        innerRail: s.innerRail,
        background: s.background,
        shape: s.shape,
        playerBox: s.playerBox,
        cardBack: s.cardBack,
        chipStyle: s.chipStyle,
        showLogo: s.showLogo,
        showStack: s.showStack,
        showVillainAction: s.showVillainAction,
        showSpotName: s.showSpotName,
        showBlinds: s.showBlinds,
      }),
      // v1 → v2 added chipStyle/showLogo/showStack. zPersistedTableTheme is
      // `.strict()`, so without this a v1 blob would fail safeParse in `merge`
      // and silently wipe a customized table back to defaults. Runs before
      // `merge`, so it only has to fill the gaps.
      // The return type is annotated so zustand keeps inferring
      // PersistedTableTheme as the persisted shape (it drives the `storage`
      // cast below). The casts are safe because `merge` still runs the blob
      // through zPersistedTableTheme.safeParse — this only fills gaps.
      migrate: (persisted, version): PersistedTableTheme => {
        if (persisted == null || typeof persisted !== 'object') return INITIAL;
        if (version >= 2) return persisted as PersistedTableTheme;
        return {
          chipStyle: DEFAULT_CHIP_STYLE,
          showLogo: true,
          showStack: true,
          ...(persisted as Record<string, unknown>),
        } as PersistedTableTheme;
      },
      merge: (persisted, current) => {
        if (persisted == null) return current;
        const parsed = zPersistedTableTheme.safeParse(persisted);
        if (parsed.success) return { ...current, ...parsed.data };
        if (import.meta.env.DEV) {
          console.warn(
            '[range-soprano] persisted table theme failed validation; using defaults.',
            parsed.error.issues,
          );
        }
        return { ...current, ...INITIAL };
      },
    },
  ),
);
