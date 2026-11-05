// Analyzer state (spec §8). The store itself is not persisted: the last
// loaded hand is saved apart (`lastHand.ts`) and reloaded on the next visit.
// Derived values (effective weights, counts, equity) are NOT stored: they come
// from the memoized selectors in `selectors.ts`.

import { create } from 'zustand';
import type { HandNotation } from '@/types/poker';
import type { OpponentOption } from '../adapters/fromParsedHand';
import type { TableInfo } from '../adapters/tableInfo';
import type { CategoryId } from '../engine/categories';
import {
  availableStreets,
  recordFromWeights,
  type ActionRow,
  type AnalyzerHandInput,
  type AnalyzerMode,
  type StreetState,
} from '../engine/chain';
import { classOfCombo, combosOfClass, type ComboId, type ComboWeights } from '../engine/combos';
import type { Street } from '../engine/equity';
import type { CustomFilterId } from '../engine/filterExpr';
import { matchPreset, presetToActionRow, type Preset, type PresetAction } from '../engine/presets';
import type { RecordedAction, RecordedStreets, Response } from '../engine/recorded';
import { ACTIVE_PRESETS } from '../presets';
import {
  emptyActionRow,
  fullActionRow,
  type ActionRowState,
  type RowState,
} from '../engine/weights';

/** Default bet sizes (% of the pot) per street (§9). */
export const DEFAULT_BET_SIZES: Record<Street, readonly number[]> = {
  flop: [33, 75],
  turn: [50, 75],
  river: [33, 66, 125],
};

export const CHECK_ROW_ID = 'check';
export const FOLD_ROW_ID = 'fold';
export const CALL_ROW_ID = 'call';

/** Default villain bet (% of the pot) in "Villano apuesta". */
export const DEFAULT_VILLAIN_BET: Record<Street, number> = { flop: 33, turn: 50, river: 66 };
/** Default raise: to 3x the villain's bet. */
export const DEFAULT_RAISE_MULTIPLES: readonly number[] = [3];

export function raiseRowId(multiple: number): string {
  return `raise-${multiple}`;
}

function raiseRow(multiple: number): ActionRow {
  return {
    id: raiseRowId(multiple),
    label: `Raise ${multiple}x`,
    kind: 'raise',
    size: multiple,
    mode: 'villain',
    // Its range ("calls the raise") sits on the villain's betting range.
    basedOn: CALL_ROW_ID,
  };
}

export function reraiseRowId(multiple: number): string {
  return `reraise-${multiple}`;
}

/**
 * The villain re-raising all-in over Hero's raise (D133): its range sits on
 * the raise row's range (of what goes on vs the raise, what shoves). Starts
 * empty, so the raise EV is the old one until hands are marked.
 */
function reraiseRow(multiple: number): ActionRow {
  return {
    id: reraiseRowId(multiple),
    label: `Re-sube all-in (vs Raise ${multiple}x)`,
    kind: 'reraise',
    size: multiple,
    mode: 'villain',
    basedOn: raiseRowId(multiple),
  };
}

/** A raise row and its re-raise all-in row, in that order. */
const raiseRows = (m: number): ActionRow[] => [raiseRow(m), reraiseRow(m)];

/** Rows shown as EV cards for the street's current mode (a re-raise lives inside its raise). */
export function visibleRows(st: StreetState): ActionRow[] {
  const mode = st.mode ?? 'hero';
  return st.actionRows.filter((r) => (r.mode ?? 'hero') === mode && r.kind !== 'reraise');
}

export function betRowId(size: number): string {
  return `bet-${size}`;
}

function betRow(size: number): ActionRow {
  return { id: betRowId(size), label: `Bet ${size}%`, kind: 'bet', size, mode: 'hero' };
}

/** Where a row's initial state came from, for the preset band. */
export type PresetRef =
  | { kind: 'check' }
  | { kind: 'preset'; label: string }
  /** No preset for this action: the row starts as "Todo ✓ 100". */
  | { kind: 'none'; action: PresetAction | null };

/** A Hero bet row's preset: "call vs size", or "raise vs size" when asked. */
function betPreset(
  street: Street,
  size: number,
  action: PresetAction,
  presets: readonly Preset[],
): { row: ActionRowState; ref: PresetRef } {
  const p = matchPreset(presets, street, action, size);
  return p
    ? { row: presetToActionRow(p), ref: { kind: 'preset', label: p.label } }
    : { row: fullActionRow(), ref: { kind: 'none', action } };
}

/**
 * StreetState plus each row's preset (so "Restablecer preset" can restore it)
 * and, per mode, the rows that were selected / played when the user switched
 * away, so switching back restores them.
 */
export type AnalyzerStreetState = StreetState & {
  mode: AnalyzerMode;
  villainBetPct: number;
  presets: Record<string, ActionRowState>;
  presetRefs: Record<string, PresetRef>;
  /** The row of the action recorded in the hand (null: test hand). */
  recordedRow: string | null;
  /** How the other player answered the recorded action. */
  recordedResponse: Response | null;
  modeMemory: Record<AnalyzerMode, { selectedRow: string; playedRow: string }>;
  /** Effective stack behind at the start of the street, typed by hand (bb); null = from the hand (D133). */
  effStackBb: number | null;
};

/**
 * A street's rows, presets and played row. With a recorded action, the played
 * row is that action (its size is added if it is not a default one) and the
 * bet row Hero used takes the preset of the villain's real answer (call or
 * raise). Without one (test hand) the first bet row is the played one.
 */
export function defaultStreetState(
  street: Street,
  rec?: RecordedAction,
  presets: readonly Preset[] = ACTIVE_PRESETS,
): AnalyzerStreetState {
  const betSizes = new Set(DEFAULT_BET_SIZES[street]);
  if (rec?.mode === 'hero' && rec.kind === 'bet' && rec.sizePct > 0) betSizes.add(rec.sizePct);
  const recRaise =
    rec?.mode === 'villain' && rec.response === 'raise' && rec.raiseMultiple && rec.raiseMultiple > 1
      ? rec.raiseMultiple
      : null;
  const raiseMultiples = new Set(DEFAULT_RAISE_MULTIPLES);
  if (recRaise !== null) raiseMultiples.add(recRaise);
  const actionRows: ActionRow[] = [
    { id: CHECK_ROW_ID, label: 'Check', kind: 'check', mode: 'hero' },
    ...[...betSizes].sort((a, b) => a - b).map(betRow),
    // "Villano apuesta": Fold has no range (the hand ends there).
    { id: FOLD_ROW_ID, label: 'Fold', kind: 'fold', mode: 'villain' },
    { id: CALL_ROW_ID, label: 'Call', kind: 'call', mode: 'villain' },
    ...[...raiseMultiples].sort((a, b) => a - b).flatMap(raiseRows),
  ];

  let recordedRow: string | null = null;
  if (rec?.mode === 'hero') recordedRow = rec.kind === 'check' ? CHECK_ROW_ID : betRowId(rec.sizePct);
  else if (rec?.mode === 'villain') recordedRow = recRaise !== null ? raiseRowId(recRaise) : CALL_ROW_ID;
  const villainRaised = rec?.mode === 'hero' && rec.kind === 'bet' && rec.response === 'raise';

  const rows: Record<string, ActionRowState> = {};
  const presetRefs: Record<string, PresetRef> = {};
  for (const r of actionRows) {
    if (r.kind === 'fold') continue;
    if (r.kind === 'reraise') {
      // Nobody re-raises until hands are marked.
      rows[r.id] = emptyActionRow();
      presetRefs[r.id] = { kind: 'none', action: null };
      continue;
    }
    if (r.kind === 'check') {
      // §12: the Check preset is the whole range.
      rows[r.id] = fullActionRow();
      presetRefs[r.id] = { kind: 'check' };
    } else if (r.kind === 'bet' && r.size !== undefined) {
      const action: PresetAction = villainRaised && r.id === recordedRow ? 'raise' : 'call';
      const p = betPreset(street, r.size, action, presets);
      rows[r.id] = p.row;
      presetRefs[r.id] = p.ref;
    } else {
      // Villain-mode rows have no presets yet.
      rows[r.id] = fullActionRow();
      presetRefs[r.id] = { kind: 'none', action: null };
    }
  }

  const firstBet = actionRows.find((r) => r.kind === 'bet') ?? actionRows[0]!;
  const mode: AnalyzerMode = rec?.mode ?? 'hero';
  const played = recordedRow ?? firstBet.id;
  const heroPlayed = mode === 'hero' ? played : firstBet.id;
  const villainPlayed = mode === 'villain' ? played : CALL_ROW_ID;
  return {
    actionRows,
    rows,
    presets: { ...rows },
    presetRefs,
    recordedRow,
    recordedResponse: rec && 'response' in rec ? rec.response : null,
    mode,
    villainBetPct:
      rec?.mode === 'villain' && rec.betPct > 0 ? rec.betPct : DEFAULT_VILLAIN_BET[street],
    // Start by editing the played row: it is the one that feeds the next street.
    selectedRow: played,
    playedRow: played,
    modeMemory: {
      hero: { selectedRow: heroPlayed, playedRow: heroPlayed },
      villain: { selectedRow: villainPlayed, playedRow: villainPlayed },
    },
    effStackBb: null,
  };
}

function defaultStreets(recorded: RecordedStreets = {}): Record<Street, AnalyzerStreetState> {
  return {
    flop: defaultStreetState('flop', recorded.flop),
    turn: defaultStreetState('turn', recorded.turn),
    river: defaultStreetState('river', recorded.river),
  };
}

/** Where the loaded hand came from, shown above the analyzer. */
export type HandMeta = {
  title: string;
  /** "BTN abre · BB paga", or null if it could not be named. */
  spot: string | null;
  /** Range used for the villain ("BB call vs BTN · Rangos GTO"), null = typed by hand. */
  rangeLabel: string | null;
  /** Why the range must be picked by hand (no spot / nothing in the library). */
  rangeMissing: string | null;
  warnings: string[];
  /** Real hands only: format, blinds, positions and stacks. */
  table?: TableInfo | undefined;
  /** Real hands only: "Mano #123", to rebuild the title for another villain. */
  handLabel?: string | undefined;
  /** Real hands only: the rival analyzed, one of `opponents`. */
  villainName?: string | undefined;
  /** Real hands only: every opponent who saw the flop (D96). */
  opponents?: OpponentOption[] | undefined;
  /** Spins hands: the Regular range in use (`SpinsRange.id`), D128. */
  spinsRangeId?: string | undefined;
};

/** A table row: a category or a saved custom filter. */
export type RowTarget = { kind: 'cat'; id: CategoryId } | { kind: 'custom'; id: CustomFilterId };

export type AnalyzerState = {
  hand: AnalyzerHandInput | null;
  /** The recorded action of a real hand (empty for a test hand). */
  recorded: RecordedStreets;
  meta: HandMeta | null;
  /** ComboId → 0..1 (sparse: missing = 0). */
  villainPreflop: Record<ComboId, number>;
  streets: Record<Street, AnalyzerStreetState>;
  activeStreet: Street;
  selectedCategory: RowTarget | null;
  /** Brush weight, 0..100. */
  brush: number;
  /** What the grid edits: the continuation of the edited EV row, or the
   * range the street starts with (preflop on the flop). */
  gridTarget: GridTarget;
  /** Edits that «Deshacer» can still take back (0 = nothing to undo). */
  undoDepth: number;
};

export type GridTarget = 'row' | 'start';

/** One combo weight (0..1) for the start-range edits. */
export type StartEntry = { combo: ComboId; weight: number };

type AnalyzerActions = {
  /** Loads a hand and a villain range; resets every street (presets from
   * the recorded action, if any). */
  loadHand: (
    hand: AnalyzerHandInput,
    villainPreflop: ComboWeights,
    opts?: { recorded?: RecordedStreets; meta?: HandMeta | null },
  ) => void;
  setActiveStreet: (street: Street) => void;
  selectRow: (rowId: string) => void;
  /** "Marcar como jugada". Selecting a row never does this. */
  setPlayedRow: (street: Street, rowId: string) => void;
  /** "+ Tamaño" on the active street. Ignored if the size already exists. */
  addBetSize: (size: number) => void;
  /** "Hero decide" / "Villano apuesta" on the active street. Restores the
   * rows selected / played last time in that mode. */
  setMode: (mode: AnalyzerMode) => void;
  /** Villain's bet in % of the pot (active street). */
  setVillainBet: (pct: number) => void;
  /** "+ Raise": raise to `multiple` x the villain's bet. */
  addRaiseSize: (multiple: number) => void;
  /** Edits a row state (✓/✗/weight) of the selected EV row. */
  setRowState: (target: RowTarget, patch: Partial<RowState>) => void;
  /** Brush on a 13×13 cell; null removes the override. */
  setClassOverride: (hand: HandNotation, weight: number | null) => void;
  /** 4×4 suit picker; null removes the override. */
  setComboOverride: (combo: ComboId, weight: number | null) => void;
  /** Several combo overrides in one update (suit-row / "solo ♥" actions). */
  setComboOverrides: (entries: readonly { combo: ComboId; weight: number | null }[]) => void;
  /**
   * The whole table row at one weight (double click on a weight): sets the
   * row's weight and drops the hand edits on its combos, so every combo of
   * «Top pair» ends at `w`. A painted cell that also has combos outside the
   * row keeps its weight on those (written per combo).
   */
  applyRowWeight: (target: RowTarget, w: number, combos: readonly ComboId[]) => void;
  /** "Restablecer preset". */
  resetSelectedRow: () => void;
  /** "Todo ✓ 100": made rows at 100, everything else neutral (D53). */
  fillSelectedRow: () => void;
  /** "Vaciar (manual)": every row neutral, no overrides. */
  clearSelectedRow: () => void;
  selectCategory: (target: RowTarget | null) => void;
  setBrush: (weight: number) => void;
  setGridTarget: (target: GridTarget) => void;
  /**
   * Edits the range `street` starts with. Flop: the villain's preflop range
   * itself. Turn / river: the street's `startOverride`, seeded from `seed`
   * (the chained start on screen) the first time.
   */
  editStart: (street: Street, entries: readonly StartEntry[], seed: ComboWeights) => void;
  /** Import: the whole start range of `street` (flop = preflop range). */
  replaceStart: (street: Street, weights: ComboWeights) => void;
  /** Turn / river: back to the range chained from the previous street. */
  clearStartOverride: (street: Street) => void;
  /** «Inv» (D132): show / chain what does NOT pass this row of the active street. */
  toggleInverse: (rowId: string) => void;
  /** Effective stack behind on the active street, typed by hand (null = from the hand). */
  setEffStack: (bb: number | null) => void;
  /**
   * Removes a bet or raise size of the active street (its re-raise row goes
   * with a raise). The played row cannot be removed (it feeds the next street).
   * False when nothing was removed.
   */
  removeRow: (rowId: string) => boolean;
  /**
   * Saves the current range and street edits before an edit, so «Deshacer»
   * can go back to them. Calls with the same `key` in a row are one step (a
   * drag paints many cells, a slider fires many changes).
   */
  checkpoint: (key?: string) => void;
  /** Back to the last checkpoint. False when there is nothing to undo. */
  undo: () => boolean;
};

export type AnalyzerStore = AnalyzerState & AnalyzerActions;

/** Same row states and overrides (ignores `edited`; neutral rows = missing). */
export function sameActionRow(a: ActionRowState, b: ActionRowState): boolean {
  const norm = (r: ActionRowState) => {
    const live = (m: Record<string, RowState | undefined>) =>
      Object.entries(m)
        .filter(([, st]) => st && st.s !== null)
        .sort(([x], [y]) => x.localeCompare(y));
    const sorted = (m: Record<string, number>) =>
      Object.entries(m).sort(([x], [y]) => x.localeCompare(y));
    return JSON.stringify([
      live(r.cats),
      live(r.custom),
      sorted(r.classOverrides),
      sorted(r.comboOverrides),
    ]);
  };
  return norm(a) === norm(b);
}

function clampPct(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.min(100, Math.max(0, x));
}

const initialState: AnalyzerState = {
  hand: null,
  recorded: {},
  meta: null,
  villainPreflop: {},
  streets: defaultStreets(),
  activeStreet: 'flop',
  selectedCategory: null,
  brush: 100,
  gridTarget: 'row',
  undoDepth: 0,
};

/** Undo history: snapshots of what the edits change (kept out of the state). */
type Snapshot = Pick<AnalyzerState, 'villainPreflop' | 'streets'>;
const UNDO_LIMIT = 50;
let history: Snapshot[] = [];
let lastKey: string | null = null;

export const useAnalyzerStore = create<AnalyzerStore>()((set, get) => {
  /** Replaces the selected EV row of the active street; `edited` = differs from its preset. */
  const updateSelectedRow = (fn: (row: ActionRowState) => ActionRowState) => {
    const { streets, activeStreet } = get();
    const st = streets[activeStreet];
    const current = st.rows[st.selectedRow];
    if (!current) return;
    const next = fn(current);
    const preset = st.presets[st.selectedRow];
    const edited = preset ? !sameActionRow(next, preset) : true;
    set({
      streets: {
        ...streets,
        [activeStreet]: { ...st, rows: { ...st.rows, [st.selectedRow]: { ...next, edited } } },
      },
    });
  };

  return {
    ...initialState,

    loadHand: (hand, villainPreflop, opts) => {
      history = [];
      lastKey = null;
      set({
        undoDepth: 0,
        hand: { ...hand, hero: [hand.hero[0], hand.hero[1]], board: [...hand.board] },
        villainPreflop: recordFromWeights(villainPreflop),
        recorded: opts?.recorded ?? {},
        meta: opts?.meta ?? null,
        streets: defaultStreets(opts?.recorded),
        activeStreet: 'flop',
        selectedCategory: null,
      });
    },

    setActiveStreet: (street) => {
      const { hand } = get();
      if (hand && availableStreets(hand).includes(street)) set({ activeStreet: street });
    },

    selectRow: (rowId) => {
      const { streets, activeStreet } = get();
      const st = streets[activeStreet];
      if (!st.rows[rowId]) return;
      set({ streets: { ...streets, [activeStreet]: { ...st, selectedRow: rowId } } });
    },

    setPlayedRow: (street, rowId) => {
      const { streets } = get();
      const st = streets[street];
      if (!st.rows[rowId]) return;
      set({ streets: { ...streets, [street]: { ...st, playedRow: rowId } } });
    },

    addBetSize: (size) => {
      if (!Number.isFinite(size) || size <= 0) return;
      const rounded = Math.round(size);
      const { streets, activeStreet } = get();
      const st = streets[activeStreet];
      const id = betRowId(rounded);
      if (st.rows[id]) return;
      const { row, ref } = betPreset(activeStreet, rounded, 'call', ACTIVE_PRESETS);
      const heroRows = [
        ...st.actionRows.filter((r) => (r.mode ?? 'hero') === 'hero'),
        betRow(rounded),
      ].sort((a, b) => (a.size ?? 0) - (b.size ?? 0));
      const actionRows = [
        ...heroRows,
        ...st.actionRows.filter((r) => (r.mode ?? 'hero') !== 'hero'),
      ];
      set({
        streets: {
          ...streets,
          [activeStreet]: {
            ...st,
            actionRows,
            rows: { ...st.rows, [id]: row },
            presets: { ...st.presets, [id]: row },
            presetRefs: { ...st.presetRefs, [id]: ref },
          },
        },
      });
    },

    setMode: (mode) => {
      const { streets, activeStreet } = get();
      const st = streets[activeStreet];
      if (st.mode === mode) return;
      const memory = {
        ...st.modeMemory,
        [st.mode]: { selectedRow: st.selectedRow, playedRow: st.playedRow },
      };
      const restore = memory[mode];
      set({
        streets: {
          ...streets,
          [activeStreet]: { ...st, mode, modeMemory: memory, ...restore },
        },
        selectedCategory: null,
      });
    },

    setVillainBet: (pct) => {
      if (!Number.isFinite(pct) || pct <= 0) return;
      const { streets, activeStreet } = get();
      const st = streets[activeStreet];
      set({
        streets: { ...streets, [activeStreet]: { ...st, villainBetPct: Math.round(pct) } },
      });
    },

    addRaiseSize: (multiple) => {
      if (!Number.isFinite(multiple) || multiple <= 1) return;
      const m = Math.round(multiple * 10) / 10;
      const { streets, activeStreet } = get();
      const st = streets[activeStreet];
      const ar = raiseRow(m);
      if (st.rows[ar.id]) return;
      const rr = reraiseRow(m);
      const row = fullActionRow();
      const empty = emptyActionRow();
      const others = st.actionRows.filter((r) => r.kind !== 'raise' && r.kind !== 'reraise');
      const multiples = [
        ...st.actionRows.filter((r) => r.kind === 'raise').map((r) => r.size ?? 0),
        m,
      ].sort((a, b) => a - b);
      const none: PresetRef = { kind: 'none', action: null };
      set({
        streets: {
          ...streets,
          [activeStreet]: {
            ...st,
            actionRows: [...others, ...multiples.flatMap(raiseRows)],
            rows: { ...st.rows, [ar.id]: row, [rr.id]: empty },
            presets: { ...st.presets, [ar.id]: row, [rr.id]: empty },
            presetRefs: { ...st.presetRefs, [ar.id]: none, [rr.id]: none },
          },
        },
      });
    },

    setRowState: (target, patch) =>
      updateSelectedRow((row) => {
        if (target.kind === 'cat') {
          const prev = row.cats[target.id] ?? { s: null, w: 100 };
          const next: RowState = { ...prev, ...patch, w: clampPct(patch.w ?? prev.w) };
          return { ...row, cats: { ...row.cats, [target.id]: next } };
        }
        const prev = row.custom[target.id] ?? { s: null, w: 100 };
        const next: RowState = { ...prev, ...patch, w: clampPct(patch.w ?? prev.w) };
        return { ...row, custom: { ...row.custom, [target.id]: next } };
      }),

    setClassOverride: (hand, weight) =>
      updateSelectedRow((row) => {
        const classOverrides = { ...row.classOverrides };
        if (weight === null) delete classOverrides[hand];
        else classOverrides[hand] = clampPct(weight);
        return { ...row, classOverrides };
      }),

    setComboOverride: (combo, weight) =>
      updateSelectedRow((row) => {
        const comboOverrides = { ...row.comboOverrides };
        if (weight === null) delete comboOverrides[combo];
        else comboOverrides[combo] = clampPct(weight);
        return { ...row, comboOverrides };
      }),

    setComboOverrides: (entries) =>
      updateSelectedRow((row) => {
        const comboOverrides = { ...row.comboOverrides };
        for (const { combo, weight } of entries) {
          if (weight === null) delete comboOverrides[combo];
          else comboOverrides[combo] = clampPct(weight);
        }
        return { ...row, comboOverrides };
      }),

    applyRowWeight: (target, w, combos) =>
      updateSelectedRow((row) => {
        const inside = new Set(combos);
        const comboOverrides = { ...row.comboOverrides };
        const classOverrides = { ...row.classOverrides };
        for (const combo of inside) delete comboOverrides[combo];
        for (const hand of new Set(combos.map(classOfCombo))) {
          const painted = classOverrides[hand];
          if (painted === undefined) continue;
          delete classOverrides[hand];
          for (const other of combosOfClass(hand)) {
            if (!inside.has(other) && comboOverrides[other] === undefined) {
              comboOverrides[other] = painted;
            }
          }
        }
        const state: RowState = { s: 'follow', w: clampPct(w) };
        return target.kind === 'cat'
          ? { ...row, cats: { ...row.cats, [target.id]: state }, classOverrides, comboOverrides }
          : { ...row, custom: { ...row.custom, [target.id]: state }, classOverrides, comboOverrides };
      }),

    resetSelectedRow: () => {
      const { streets, activeStreet } = get();
      const preset = streets[activeStreet].presets[streets[activeStreet].selectedRow];
      if (preset) updateSelectedRow(() => preset);
    },

    fillSelectedRow: () => updateSelectedRow(() => fullActionRow()),

    clearSelectedRow: () => updateSelectedRow(() => ({ ...emptyActionRow() })),

    selectCategory: (target) => set({ selectedCategory: target }),

    setBrush: (weight) => set({ brush: clampPct(weight) }),

    setGridTarget: (target) => set({ gridTarget: target }),

    editStart: (street, entries, seed) => {
      if (entries.length === 0) return;
      const apply = (base: Readonly<Record<number, number>>) => {
        const next: Record<number, number> = { ...base };
        for (const { combo, weight } of entries) {
          const w = Number.isFinite(weight) ? Math.min(1, Math.max(0, weight)) : 0;
          if (w > 0) next[combo] = w;
          else delete next[combo];
        }
        return next;
      };
      if (street === 'flop') {
        set({ villainPreflop: apply(get().villainPreflop) });
        return;
      }
      const { streets } = get();
      const st = streets[street];
      const base = st.startOverride ?? recordFromWeights(seed);
      set({ streets: { ...streets, [street]: { ...st, startOverride: apply(base) } } });
    },

    replaceStart: (street, weights) => {
      if (street === 'flop') {
        set({ villainPreflop: recordFromWeights(weights) });
        return;
      }
      const { streets } = get();
      const st = streets[street];
      set({
        streets: { ...streets, [street]: { ...st, startOverride: recordFromWeights(weights) } },
      });
    },

    removeRow: (rowId) => {
      const { streets, activeStreet } = get();
      const st = streets[activeStreet];
      const row = st.actionRows.find((r) => r.id === rowId);
      if (!row || (row.kind !== 'bet' && row.kind !== 'raise')) return false;
      if (st.playedRow === rowId) return false;
      const gone = new Set([rowId]);
      if (row.kind === 'raise') gone.add(reraiseRowId(row.size ?? 3));
      const drop = <T,>(m: Record<string, T>) =>
        Object.fromEntries(Object.entries(m).filter(([k]) => !gone.has(k)));
      const safe = (id: string) => (gone.has(id) ? st.playedRow : id);
      set({
        streets: {
          ...streets,
          [activeStreet]: {
            ...st,
            actionRows: st.actionRows.filter((r) => !gone.has(r.id)),
            rows: drop(st.rows),
            presets: drop(st.presets),
            presetRefs: drop(st.presetRefs),
            invertedRows: (st.invertedRows ?? []).filter((r) => !gone.has(r)),
            selectedRow: safe(st.selectedRow),
            recordedRow: st.recordedRow && gone.has(st.recordedRow) ? null : st.recordedRow,
            modeMemory: {
              hero: {
                selectedRow: gone.has(st.modeMemory.hero.selectedRow)
                  ? st.modeMemory.hero.playedRow
                  : st.modeMemory.hero.selectedRow,
                playedRow: st.modeMemory.hero.playedRow,
              },
              villain: {
                selectedRow: gone.has(st.modeMemory.villain.selectedRow)
                  ? st.modeMemory.villain.playedRow
                  : st.modeMemory.villain.selectedRow,
                playedRow: st.modeMemory.villain.playedRow,
              },
            },
          },
        },
      });
      return true;
    },

    setEffStack: (bb) => {
      const { streets, activeStreet } = get();
      const st = streets[activeStreet];
      const v = bb !== null && Number.isFinite(bb) && bb > 0 ? Math.round(bb * 100) / 100 : null;
      set({ streets: { ...streets, [activeStreet]: { ...st, effStackBb: v } } });
    },

    toggleInverse: (rowId) => {
      const { streets, activeStreet } = get();
      const st = streets[activeStreet];
      const now = st.invertedRows ?? [];
      const invertedRows = now.includes(rowId) ? now.filter((r) => r !== rowId) : [...now, rowId];
      set({ streets: { ...streets, [activeStreet]: { ...st, invertedRows } } });
    },

    clearStartOverride: (street) => {
      const { streets } = get();
      const st = streets[street];
      if (!st.startOverride) return;
      set({ streets: { ...streets, [street]: { ...st, startOverride: null } } });
    },

    checkpoint: (key) => {
      if (key !== undefined && key === lastKey) return;
      lastKey = key ?? null;
      const { villainPreflop, streets } = get();
      history = [...history, { villainPreflop, streets }].slice(-UNDO_LIMIT);
      set({ undoDepth: history.length });
    },

    undo: () => {
      // A checkpoint whose edit changed nothing (a blocked stroke) is skipped.
      const { villainPreflop, streets } = get();
      while (
        history.length > 0 &&
        history[history.length - 1]!.villainPreflop === villainPreflop &&
        history[history.length - 1]!.streets === streets
      ) {
        history = history.slice(0, -1);
      }
      const last = history[history.length - 1];
      if (!last) {
        set({ undoDepth: 0 });
        return false;
      }
      history = history.slice(0, -1);
      lastKey = null;
      set({ ...last, undoDepth: history.length });
      return true;
    },
  };
});

/** Back to the initial state (tests and "close hand"). */
export function resetAnalyzerStore(): void {
  history = [];
  lastKey = null;
  useAnalyzerStore.setState({ ...initialState, streets: defaultStreets() });
}
