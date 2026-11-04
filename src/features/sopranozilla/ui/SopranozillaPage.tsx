// /sopranozilla — dev-only hand analyzer (registered only when
// import.meta.env.DEV). Opens the last loaded hand (a real one from /analisis
// or the test hand); the first visit starts with the default test hand.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { useLocation, useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { RotateCcw, CheckCheck, ClipboardPaste, Eraser, FlaskConical, Library } from 'lucide-react';
import { useRangeStore } from '@/store/rangeStore';
import { SAMPLE_RANGES } from '@/data/sampleRanges';
import { PageHeader } from '@/components/ui/PageHeader';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import type { HandNotation, Range } from '@/types/poker';
import { repickSaved, SOURCE_LABEL, type OpenOptions } from '../adapters/openHand';
import { PRESETS_ENABLED } from '../presets';
import type { RangeSource } from '../adapters/villainRange';
import { CATEGORY_INFO } from '../engine/categories';
import { availableStreets, STREETS, type AnalyzerHandInput } from '../engine/chain';
import { formatCard, type CardId } from '../engine/cards';
import { combosOfClass, type ComboId, type ComboWeights } from '../engine/combos';
import { rangeToSavedText } from '../engine/rangeExport';
import { parseFiltersExport, exportFilters } from '../schemas/filters';
import type { CustomFilter, FilterExpr } from '../engine/filterExpr';
import { useFiltersStore } from '../store/filtersStore';
import { pushToast } from '@/store/toastStore';
import { FilterBuilder } from './FilterBuilder';
import { useAnalyzerShortcuts } from './shortcuts';
import {
  CALL_ROW_ID,
  useAnalyzerStore,
  visibleRows,
  type AnalyzerStreetState,
  type RowTarget,
} from '../store/analyzerStore';
import {
  fromSavedHand,
  readLastHand,
  readRangeSource,
  toSavedHand,
  writeLastHand,
  writeRangeSource,
  type SavedHand,
} from '../store/lastHand';
import type { OpenInSopranozillaState } from './OpenInSopranozillaButton';
import { RangeLibraryDialog } from './RangeLibraryDialog';
import { selectStreetView, useStreetView } from '../store/selectors';
import {
  bluffThreshold,
  calledBreakEven,
  evTable,
  potOddsNeeded,
  raiseThreshold,
  villainEvTable,
  type EvRowInput,
  type VillainRowInput,
} from '../engine/ev';
import { EvPanel, type EvRowView } from './EvPanel';
import type { StreetEquityRow } from './StreetEquityTable';
import { CategoryTable } from './CategoryTable';
import { SzGrid, type PaintStroke } from './SzGrid';
import { GridEditBar } from './GridEditBar';
import { ExportRangeDialog, ImportRangeDialog } from './RangeIODialog';
import { buildTestHand, DEFAULT_TEST_HAND, type TestHandValues } from './testHand';
import { TestHandForm } from './TestHandForm';
import { EditCardsDialog } from './EditCardsDialog';
import { ConfirmDeleteFilter } from './ConfirmDeleteFilter';
import { preflopWeights } from '../store/selectors';
import { PasteHandForm } from './PasteHandForm';
import { TopBar, type StreetTab } from './TopBar';
import { BoardStrip } from './BoardStrip';
import { TableSeats } from './TableSeats';
import { useEquity, useStreetTables } from './useEquity';
import {
  classCombos,
  equityOf,
  gridCells,
  rowSuitEntries,
  startCategoryEntries,
  tableModel,
  targetCombos,
  type SuitRule,
} from './viewModel';
import { HoverCombos } from './HoverCombos';
import { FloatingPanel } from './FloatingPanel';
import { RowSuitFilter } from './RowSuitFilter';
import { SuitPicker } from './SuitPicker';
import { WeightControl } from './WeightControl';
import { useElementWidth } from './useElementWidth';

/**
 * The violet control's last edit of a whole table row (D124). `applied` is
 * what it left (the start range or the EV row): if something else changed it
 * since (a stroke, an undo), the next edit starts over from what is on screen.
 * `base` (start range only): the row's combo weights when the edit began, so
 * 0 and back to 100, or a suit turned off and on, restores them.
 */
type CategoryEdit = {
  key: string;
  w: number;
  rule: SuitRule;
  base: Map<ComboId, number> | null;
  applied: unknown;
};

/** Id of the filter being built: highlighted in the grid, never saved. */
const DRAFT_ID = '__draft__';
const noop = () => {};

/**
 * Columns by the width the content really has (D95): from WIDE_MIN the
 * calculator gets its own column next to the table, as on big screens; from
 * MEDIUM_MIN the grid sits next to the table and the calculator goes below.
 */
const WIDE_MIN = 1050;
const MEDIUM_MIN = 720;
/** Grid and calculator stay in view while scrolling the table. */
const STICKY_COLUMN =
  'sticky top-4 max-h-[calc(100vh-2rem)] self-start overflow-y-auto [scrollbar-gutter:stable]';

function sum(w: ComboWeights): number {
  let s = 0;
  for (let i = 0; i < w.length; i++) s += w[i] ?? 0;
  return s;
}

function loadDefaultTestHand(load: (h: AnalyzerHandInput, v: ComboWeights) => void): void {
  const built = buildTestHand(DEFAULT_TEST_HAND);
  if (built.ok) load(built.hand, built.villain);
}

/** Preset band: where the selected row's initial state came from. */
function presetText(st: AnalyzerStreetState): string {
  // Presets off for now (not calibrated): every row starts at 100.
  if (!PRESETS_ENABLED) return 'empieza con todo ✓ 100 (sin presets por ahora)';
  const ref = st.presetRefs[st.selectedRow];
  if (!ref) return 'sin preset para esta acción (Todo ✓ 100)';
  if (ref.kind === 'check') return 'preset «Check»: rango completo';
  if (ref.kind === 'preset') return `preset «${ref.label}»`;
  return ref.action === 'raise'
    ? 'sin preset de check-raise para este tamaño (Todo ✓ 100)'
    : 'sin preset para esta acción (Todo ✓ 100)';
}

const RESPONSE_TEXT = {
  hero: { call: 'el villano pagó', raise: 'el villano subió', fold: 'el villano foldeó' },
  villain: { call: 'pagaste', raise: 'subiste', fold: 'foldeaste' },
} as const;

export default function SopranozillaPage() {
  useDocumentTitle('Sopranozilla · Analizador de manos · Range Soprano', {
    description:
      'Analizador de manos postflop: filtra el rango del villano por categorías con pesos, calle por calle, y mira tu equity exacta y el EV de cada acción. Abre las manos de Análisis o carga una de prueba. Sin login, sin tracking.',
    canonical: 'https://rangesoprano.com/sopranozilla/',
  });

  const { hand, activeStreet, streets, selectedCategory, brush, gridTarget, undoDepth } =
    useAnalyzerStore(
      useShallow((s) => ({
        hand: s.hand,
        activeStreet: s.activeStreet,
        streets: s.streets,
        selectedCategory: s.selectedCategory,
        brush: s.brush,
        gridTarget: s.gridTarget,
        undoDepth: s.undoDepth,
      })),
    );
  const editingStart = gridTarget === 'start';
  const loadHand = useAnalyzerStore((s) => s.loadHand);
  const setActiveStreet = useAnalyzerStore((s) => s.setActiveStreet);
  const selectRow = useAnalyzerStore((s) => s.selectRow);
  const setPlayedRow = useAnalyzerStore((s) => s.setPlayedRow);
  const addBetSize = useAnalyzerStore((s) => s.addBetSize);
  const setMode = useAnalyzerStore((s) => s.setMode);
  const setVillainBet = useAnalyzerStore((s) => s.setVillainBet);
  const addRaiseSize = useAnalyzerStore((s) => s.addRaiseSize);
  const setRowState = useAnalyzerStore((s) => s.setRowState);
  const setClassOverride = useAnalyzerStore((s) => s.setClassOverride);
  const setComboOverrides = useAnalyzerStore((s) => s.setComboOverrides);
  const resetSelectedRow = useAnalyzerStore((s) => s.resetSelectedRow);
  const fillSelectedRow = useAnalyzerStore((s) => s.fillSelectedRow);
  const clearSelectedRow = useAnalyzerStore((s) => s.clearSelectedRow);
  const selectCategory = useAnalyzerStore((s) => s.selectCategory);
  const setBrush = useAnalyzerStore((s) => s.setBrush);
  const setGridTarget = useAnalyzerStore((s) => s.setGridTarget);
  const editStart = useAnalyzerStore((s) => s.editStart);
  const replaceStart = useAnalyzerStore((s) => s.replaceStart);
  const clearStartOverride = useAnalyzerStore((s) => s.clearStartOverride);
  const checkpoint = useAnalyzerStore((s) => s.checkpoint);
  const [io, setIo] = useState<'import' | 'export' | null>(null);
  // Painting a hand that is not in the range only filters: say how to add it.
  const [notice, setNotice] = useState<string | null>(null);

  // Grid / import edits of the preflop range are saved with the hand (the
  // street edits are not, like every other street edit). Debounced: a drag
  // paints many cells.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistPreflop = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const s = useAnalyzerStore.getState();
      if (!s.hand) return;
      const label = s.meta?.rangeLabel ?? null;
      const meta = s.meta
        ? {
            ...s.meta,
            rangeLabel:
              label === null
                ? 'editado a mano'
                : label.endsWith(' · editado')
                  ? label
                  : `${label} · editado`,
            rangeMissing: null,
          }
        : null;
      writeLastHand(
        toSavedHand(s.hand, rangeToSavedText(preflopWeights(s.villainPreflop)), s.recorded, meta),
      );
      if (meta) useAnalyzerStore.setState({ meta });
    }, 400);
  }, []);
  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    [],
  );
  /** «Deshacer» / Ctrl+Z; an undone preflop edit is saved with the hand too. */
  const undo = useCallback(() => {
    const before = useAnalyzerStore.getState().villainPreflop;
    if (!useAnalyzerStore.getState().undo()) return;
    if (useAnalyzerStore.getState().villainPreflop !== before) persistPreflop();
  }, [persistPreflop]);
  const filtersForEdit = useFiltersStore(useShallow((s) => s.filters));
  const [catEdit, setCatEdit] = useState<CategoryEdit | null>(null);
  /** The whole selected row: weight and / or suits, on what the grid shows. */
  const editCategory = useCallback(
    (patch: { w?: number; rule?: SuitRule }) => {
      const s = useAnalyzerStore.getState();
      const target = s.selectedCategory;
      if (!target || !s.hand) return;
      const street = s.activeStreet;
      const v = selectStreetView(s, street, filtersForEdit);
      const stt = s.streets[street];
      const row = stt.rows[stt.selectedRow];
      if (!v || !row) return;
      const start = s.gridTarget === 'start';
      const key = `${street}|${s.gridTarget}|${stt.selectedRow}|${target.kind}:${target.id}`;
      const fresh =
        catEdit && catEdit.key === key && catEdit.applied === (start ? v.start : row)
          ? catEdit
          : null;
      const ids = targetCombos(v, target, filtersForEdit);
      const rowW = (target.kind === 'cat' ? row.cats[target.id] : row.custom[target.id])?.w ?? 100;
      const base =
        fresh?.base ??
        (start
          ? new Map(
              ids.filter((id) => (v.start[id] ?? 0) > 0).map((id) => [id, v.start[id] ?? 0] as const),
            )
          : null);
      const w = patch.w ?? fresh?.w ?? (start ? 100 : rowW);
      const rule = patch.rule ?? fresh?.rule ?? { kind: 'all' };
      // A slider drag is one undo step; each suit button is its own.
      s.checkpoint(patch.w !== undefined ? `cat:${key}` : undefined);
      if (start && base) {
        s.editStart(street, startCategoryEntries(base, w, rule), v.start);
        if (street === 'flop') persistPreflop();
      } else {
        s.applyRowWeight(target, w, ids);
        if (rule.kind !== 'all') s.setComboOverrides(rowSuitEntries(v, target, filtersForEdit, rule));
      }
      const after = useAnalyzerStore.getState();
      const afterSt = after.streets[street];
      setCatEdit({
        key,
        w,
        rule,
        base,
        applied: start
          ? selectStreetView(after, street, filtersForEdit)?.start
          : afterSt.rows[afterSt.selectedRow],
      });
    },
    [catEdit, filtersForEdit, persistPreflop],
  );
  const meta = useAnalyzerStore((s) => s.meta);
  const [layoutRef, layoutWidth] = useElementWidth();
  const layout = layoutWidth >= WIDE_MIN ? 'wide' : layoutWidth >= MEDIUM_MIN ? 'medium' : 'narrow';
  const location = useLocation();
  const navigate = useNavigate();
  const fromAnalysis =
    (location.state as Partial<OpenInSopranozillaState> | null)?.fromAnalysis === true;

  const [formOpen, setFormOpen] = useState(false);
  // «Mano de prueba» opens with the hand on screen (D102), not the example.
  const [formInitial, setFormInitial] = useState<TestHandValues>(DEFAULT_TEST_HAND);
  const [editCardsOpen, setEditCardsOpen] = useState(false);
  const [deleting, setDeleting] = useState<CustomFilter | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  // Library searched first for the villain's range (D97), remembered.
  const [rangeSource, setRangeSource] = useState<RangeSource>(readRangeSource);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const closeLibrary = useCallback(() => setLibraryOpen(false), []);

  // Saved custom filters (phase 7) and the filter builder.
  const filters = useFiltersStore(useShallow((s) => s.filters));
  const [builder, setBuilder] = useState<{ initial: CustomFilter | null; key: number } | null>(
    null,
  );
  const [draft, setDraft] = useState<FilterExpr | null>(null);
  const gridFilters = useMemo<readonly CustomFilter[]>(
    () =>
      builder && draft
        ? [...filters, { id: DRAFT_ID, name: 'Borrador', expr: draft, createdAt: '' }]
        : filters,
    [builder, draft, filters],
  );
  const [hovered, setHovered] = useState<HandNotation | null>(null);
  const [openHand, setOpenHand] = useState<HandNotation | null>(null);
  // Hovering a table row previews it in the grid; a click keeps it (selectedCategory).
  const [hoverCategory, setHoverCategory] = useState<RowTarget | null>(null);
  const highlightTarget = useMemo<RowTarget | null>(
    () =>
      // With the builder open the grid shows only the draft (nothing while
      // it is empty), not the row that was selected before (D111).
      builder
        ? draft
          ? { kind: 'custom', id: DRAFT_ID }
          : null
        : (hoverCategory ?? selectedCategory),
    [builder, draft, hoverCategory, selectedCategory],
  );

  const loadSaved = useCallback(
    (saved: SavedHand): boolean => {
      const loaded = fromSavedHand(saved);
      if (!loaded) return false;
      loadHand(loaded.hand, loaded.villain, { recorded: loaded.recorded, meta: loaded.meta });
      return true;
    },
    [loadHand],
  );

  // Coming from /analisis: load the hand it just saved. Otherwise keep the
  // hand in memory, or reopen the last saved one, or the default test hand.
  useEffect(() => {
    if (!fromAnalysis && useAnalyzerStore.getState().hand) return;
    const saved = readLastHand();
    if (!saved || !loadSaved(saved)) loadDefaultTestHand(loadHand);
    // Clear the flag so going back and forth does not reload (and reset) the hand.
    if (fromAnalysis) void navigate('.', { replace: true, state: null });
  }, [fromAnalysis, loadHand, loadSaved, navigate]);

  const loadTestHand = (h: AnalyzerHandInput, v: ComboWeights, rangeText: string) => {
    loadHand(h, v);
    writeLastHand(toSavedHand(h, rangeText, {}, null));
  };

  // "Cambiar rango" on a real hand: same hand and recorded action, new range.
  const changeRange = (text: string, range: Range) => {
    const state = useAnalyzerStore.getState();
    if (!state.hand) return;
    const source = SAMPLE_RANGES.some((r) => r.id === range.id) ? 'gto' : 'mine';
    const saved = toSavedHand(state.hand, text, state.recorded, {
      ...(state.meta ?? { title: 'Mano', spot: null, warnings: [] }),
      rangeLabel: `${range.name} · ${SOURCE_LABEL[source]}`,
      rangeMissing: null,
    });
    writeLastHand(saved);
    loadSaved(saved);
  };

  // «Editar cartas» (D102): same hand, range, pots and recorded action; new cards.
  const applyCards = (heroCards: [CardId, CardId], board: CardId[]) => {
    const state = useAnalyzerStore.getState();
    if (!state.hand) return;
    const next: AnalyzerHandInput = { ...state.hand, hero: heroCards, board };
    const note = 'Cartas editadas: la acción registrada es la de la mano original.';
    const meta =
      state.meta && !state.meta.warnings.includes(note)
        ? { ...state.meta, warnings: [...state.meta.warnings, note] }
        : state.meta;
    loadHand(next, preflopWeights(state.villainPreflop), { recorded: state.recorded, meta });
    writeLastHand(toSavedHand(next, readLastHand()?.range ?? '', state.recorded, meta));
    setEditCardsOpen(false);
  };

  const openTestForm = () => {
    const state = useAnalyzerStore.getState();
    const h = state.hand;
    const text = (ids: readonly CardId[]) => ids.map(formatCard).join(' ');
    const pot = (x: number | undefined) => (x === undefined ? '' : String(x));
    setFormInitial(
      h
        ? {
            hero: text(h.hero),
            board: text(h.board),
            range: readLastHand()?.range || DEFAULT_TEST_HAND.range,
            heroPosition: h.heroPosition ?? '',
            villainPosition: h.villainPosition ?? '',
            pots: { flop: pot(h.pots?.flop), turn: pot(h.pots?.turn), river: pot(h.pots?.river) },
          }
        : DEFAULT_TEST_HAND,
    );
    setFormOpen(true);
    setPasteOpen(false);
  };

  // Real hand from "Pegar mano".
  const loadPasted = (saved: SavedHand) => {
    writeLastHand(saved);
    loadSaved(saved);
    setPasteOpen(false);
  };

  // Another villain (multiway) or the other library first: same real hand,
  // rebuilt from the opponents it saved (D96, D97). Reloads from the presets.
  const repick = (options: OpenOptions) => {
    const state = useAnalyzerStore.getState();
    if (!state.hand) return;
    const current = toSavedHand(state.hand, '', state.recorded, state.meta);
    const next = repickSaved(
      current,
      { prefer: rangeSource, ...options },
      useRangeStore.getState().ranges,
      SAMPLE_RANGES,
    );
    if (!next) return;
    writeLastHand(next);
    loadSaved(next);
  };

  const changeSource = (source: RangeSource) => {
    setRangeSource(source);
    writeRangeSource(source);
    if (useAnalyzerStore.getState().meta?.opponents) repick({ prefer: source });
  };

  const view = useStreetView(activeStreet, filters);
  const st = streets[activeStreet];
  const editedRow = st.rows[st.selectedRow];
  const cont = view?.rows[st.selectedRow] ?? null;
  const eq = useEquity(hand?.hero ?? null, view?.board ?? null, view?.start ?? null);

  const cells = useMemo(
    () =>
      view && cont
        ? gridCells(
            view,
            editingStart ? view.start : cont,
            editingStart ? undefined : editedRow,
            highlightTarget,
            gridFilters,
          )
        : [],
    [view, cont, editedRow, highlightTarget, gridFilters, editingStart],
  );
  const model = useMemo(
    () => (view && cont ? tableModel(view, cont, editedRow, eq.table, filters) : null),
    // eq.version: the equity table is filled in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [view, cont, editedRow, eq.table, eq.version, filters],
  );
  const heroEq = useMemo(
    () => (view ? equityOf(view.start, eq.table) : Number.NaN),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [view, eq.table, eq.version],
  );
  const pot = hand?.pots?.[activeStreet];
  const ev = useMemo(() => {
    if (!view) return null;
    const total = sum(view.start);
    const shown = visibleRows(st);
    const call = view.rows[CALL_ROW_ID];
    const betRange = call ? sum(call) : 0;
    let table;
    if (st.mode === 'villain') {
      const inputs: VillainRowInput[] = shown.map((r) => {
        const w = view.rows[r.id];
        if (r.kind === 'fold') return { id: r.id, kind: 'fold' };
        if (r.kind === 'raise') {
          return {
            id: r.id,
            kind: 'raise',
            multiple: r.size ?? 3,
            betRange,
            cont: w ? sum(w) : 0,
            eqCont: w ? equityOf(w, eq.table) : Number.NaN,
          };
        }
        return { id: r.id, kind: 'call', betRange, eq: w ? equityOf(w, eq.table) : Number.NaN };
      });
      table = villainEvTable(inputs, { pot: pot ?? 1, betPct: st.villainBetPct });
    } else {
      const inputs: EvRowInput[] = shown.map((r) => {
        const w = view.rows[r.id];
        return r.kind === 'check' || r.size === undefined
          ? { id: r.id, kind: 'check' }
          : {
              id: r.id,
              kind: 'bet',
              sizePct: r.size,
              cont: w ? sum(w) : 0,
              eqCont: w ? equityOf(w, eq.table) : Number.NaN,
            };
      });
      table = evTable(inputs, { pot: pot ?? 1, total, heroEqFull: heroEq });
    }
    const rows: EvRowView[] = shown.map((r, i) => ({
      ...r,
      ...table.rows[i]!,
      edited: st.rows[r.id]?.edited ?? false,
    }));
    return { rows, bestId: table.bestId, betShare: total > 0 ? betRange / total : Number.NaN };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, st, pot, heroEq, eq.table, eq.version]);

  // Every street, for "Equity por calle" (the background worker fills them).
  const flopView = useStreetView('flop', filters);
  const turnView = useStreetView('turn', filters);
  const riverView = useStreetView('river', filters);
  const streetTables = useStreetTables(hand?.hero ?? null, [flopView, turnView, riverView]);
  const streetEquity = useMemo<StreetEquityRow[]>(
    () =>
      [flopView, turnView, riverView]
        .filter((v) => v !== null)
        .map((v, i, all) => {
          // How much of the previous street continued after its played row.
          const prevView = i > 0 ? all[i - 1]! : null;
          const prevState = prevView ? streets[prevView.street] : null;
          const prevPlayed = prevView && prevState ? prevView.rows[prevState.playedRow] : undefined;
          const prevRow = prevState?.actionRows.find((r) => r.id === prevState.playedRow);
          const prevTotal = prevView ? sum(prevView.start) : 0;
          const kept =
            prevView && prevPlayed && prevTotal > 0
              ? {
                  share: sum(prevPlayed) / prevTotal,
                  // MDF = 1 − B/(P+B) = 1 / (1 + s).
                  // Only Hero's bets have an MDF; villain-mode rows stay neutral.
                  mdf:
                    prevRow?.kind === 'bet' && prevRow.size !== undefined
                      ? 1 / (1 + prevRow.size / 100)
                      : null,
                }
              : null;
          const table = streetTables.tables[v.street] ?? null;
          const s = streets[v.street];
          const played = v.rows[s.playedRow];
          const playedRow = s.actionRows.find((r) => r.id === s.playedRow);
          const total = sum(v.start);
          // Thresholds only depend on the sizes (pot = 1):
          // bet s → B/(P+B) = s/(1+s), B/(P+2B) = s/(1+2s);
          // raise m× a bet b → R/(P+V+R) and R/(P+2R) with V = b, R = m·b;
          // call → pot odds V/(P+2V).
          let playedInfo: StreetEquityRow['played'] = null;
          if (played && total > 0 && playedRow) {
            if (playedRow.kind === 'bet' && playedRow.size !== undefined) {
              const b = playedRow.size / 100;
              playedInfo = {
                foldEq: 1 - sum(played) / total,
                threshold: bluffThreshold(1, b),
                calledBreakEven: calledBreakEven(1, b),
              };
            } else if (playedRow.kind === 'raise' && playedRow.size !== undefined) {
              const callW = v.rows[CALL_ROW_ID];
              const betRange = callW ? sum(callW) : 0;
              const b = s.villainBetPct / 100;
              const r = b * playedRow.size;
              playedInfo = {
                foldEq: betRange > 0 ? 1 - sum(played) / betRange : Number.NaN,
                threshold: raiseThreshold(1, b, r),
                calledBreakEven: calledBreakEven(1, r),
              };
            } else if (playedRow.kind === 'call') {
              playedInfo = {
                foldEq: null,
                threshold: null,
                calledBreakEven: potOddsNeeded(1, s.villainBetPct / 100),
              };
            }
          }
          return {
            street: v.street,
            combos: total,
            heroEq: equityOf(v.start, table),
            playedLabel: playedRow?.label ?? '',
            playedEq: played ? equityOf(played, table) : Number.NaN,
            kept,
            played: playedInfo,
          };
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flopView, turnView, riverView, streets, streetTables.tables, streetTables.version],
  );
  const openCombos = useMemo(
    () =>
      view && cont && openHand
        ? classCombos(
            view,
            editingStart ? view.start : cont,
            editingStart ? undefined : editedRow,
            openHand,
            filters,
          )
        : null,
    [view, cont, editedRow, openHand, filters, editingStart],
  );
  const hoverCells = useMemo(
    () =>
      view && cont && hovered
        ? classCombos(
            view,
            editingStart ? view.start : cont,
            editingStart ? undefined : editedRow,
            hovered,
            filters,
          )
        : [],
    [view, cont, editedRow, hovered, filters, editingStart],
  );
  const hoverTarget = useMemo<ReadonlySet<ComboId> | null>(
    () =>
      view && hovered && highlightTarget && !builder
        ? new Set(targetCombos(view, highlightTarget, gridFilters, hovered))
        : null,
    [view, hovered, highlightTarget, builder, gridFilters],
  );
  const rowTargets = useMemo(
    () => (model ? model.groups.flatMap((g) => g.rows.map((r) => r.target)) : []),
    [model],
  );
  const streetList = useMemo(() => (hand ? availableStreets(hand) : []), [hand]);
  const shortcutsOn =
    builder === null &&
    !libraryOpen &&
    !formOpen &&
    !pasteOpen &&
    !editCardsOpen &&
    io === null &&
    deleting === null;
  useEffect(() => {
    if (!shortcutsOn) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || e.key.toLowerCase() !== 'z') return;
      const t = e.target;
      if (t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (document.querySelector('[role="dialog"]')) return;
      e.preventDefault();
      undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shortcutsOn, undo]);
  useAnalyzerShortcuts(
    builder === null &&
      !libraryOpen &&
      !formOpen &&
      !pasteOpen &&
      !editCardsOpen &&
      io === null &&
      deleting === null,
    rowTargets,
    streetList,
    (w) => editCategory({ w }),
  );

  if (!hand || !view || !editedRow || !model || !ev) {
    return (
      <p role="status" className="text-sm text-content-muted">
        Cargando…
      </p>
    );
  }

  const available = availableStreets(hand);
  const tabs: StreetTab[] = STREETS.map((s, i) => {
    const prev = i > 0 ? streets[STREETS[i - 1]!] : null;
    return {
      street: s,
      available: available.includes(s),
      fedBy: prev ? (prev.actionRows.find((r) => r.id === prev.playedRow) ?? null) : null,
    };
  });

  const selectedState =
    selectedCategory?.kind === 'cat'
      ? editedRow.cats[selectedCategory.id]
      : selectedCategory
        ? editedRow.custom[selectedCategory.id]
        : undefined;
  const targetLabel = (t: RowTarget | null): string | null =>
    t === null
      ? null
      : t.kind === 'cat'
        ? CATEGORY_INFO[t.id].label
        : t.id === DRAFT_ID
          ? 'filtro en construcción'
          : (filters.find((f) => f.id === t.id)?.name ?? 'Filtro');
  const selectedLabel = targetLabel(selectedCategory);
  const catKey = selectedCategory
    ? `${activeStreet}|${gridTarget}|${st.selectedRow}|${selectedCategory.kind}:${selectedCategory.id}`
    : '';
  const catFresh =
    catEdit && catEdit.key === catKey && catEdit.applied === (editingStart ? view.start : editedRow)
      ? catEdit
      : null;
  const catValue = catFresh?.w ?? (editingStart ? 100 : (selectedState?.w ?? 100));
  const catRule: SuitRule = catFresh?.rule ?? { kind: 'all' };
  const highlightLabel = targetLabel(highlightTarget);

  const streetName = { flop: 'flop', turn: 'turn', river: 'river' }[activeStreet];
  const startLabel = activeStreet === 'flop' ? 'Rango preflop' : `Rango al empezar el ${streetName}`;

  // With a table row selected («Top pair») a stroke only touches that row's
  // combos: a stray drag over other hands does nothing to them.
  const limitTo = (h: HandNotation): ComboId[] | null => {
    if (!selectedCategory) return null;
    return targetCombos(view, selectedCategory, filters, h);
  };
  const blockedNotice = (h: HandNotation) =>
    setNotice(
      `${h} no tiene combos de «${selectedLabel}»: con esa fila elegida el pincel solo pinta sus combos. Tócala otra vez en la tabla para soltarla.`,
    );

  const paintCell = (h: HandNotation, stroke: PaintStroke) => {
    const limited = limitTo(h);
    if (limited && limited.length === 0) {
      blockedNotice(h);
      return;
    }
    if (editingStart) {
      if (stroke === 'restore') return;
      const weight = stroke === 'remove' ? 0 : brush / 100;
      editStart(
        activeStreet,
        (limited ?? combosOfClass(h)).map((combo) => ({ combo, weight })),
        view.start,
      );
      if (activeStreet === 'flop') persistPreflop();
      setNotice(null);
      return;
    }
    const cell = cells.find((c) => c.hand === h);
    if (stroke === 'paint' && cell && cell.live > 0 && cell.inRange === 0) {
      setNotice(
        `${h} no está en el rango del villano en el ${streetName}: aquí el pincel solo filtra lo que ya está. Para agregarla, elige «${startLabel}» arriba del grid.`,
      );
      return;
    }
    setNotice(null);
    const weight = stroke === 'restore' ? null : stroke === 'remove' ? 0 : brush;
    if (limited) {
      // Only the row's combos of this hand, written per combo.
      setComboOverrides(limited.map((combo) => ({ combo, weight })));
      return;
    }
    setClassOverride(h, weight);
    // The whole hand follows the stroke: drop the per-suit tweaks on it.
    const own = combosOfClass(h).filter((id) => editedRow.comboOverrides[id] !== undefined);
    if (own.length > 0) setComboOverrides(own.map((combo) => ({ combo, weight: null })));
  };

  const setStartCombos = (entries: { combo: number; weight: number | null }[]) => {
    const picked = entries.flatMap((e) =>
      e.weight === null ? [] : [{ combo: e.combo, weight: e.weight / 100 }],
    );
    editStart(activeStreet, picked, view.start);
    if (activeStreet === 'flop') persistPreflop();
  };

  const importRange = (weights: ComboWeights) => {
    checkpoint();
    replaceStart(activeStreet, weights);
    if (activeStreet === 'flop') persistPreflop();
    setIo(null);
    pushToast({
      kind: 'success',
      message:
        activeStreet === 'flop'
          ? 'Rango preflop del villano reemplazado.'
          : `Rango del ${streetName} fijado con el rango importado.`,
    });
  };

  const deleteFilter = (id: string) => {
    setDeleting(null);
    const result = useFiltersStore.getState().deleteFilter(id);
    if (!result.ok) {
      pushToast({
        kind: 'error',
        message: `No se puede borrar: lo usa ${result.usedBy.map((n) => `«${n}»`).join(', ')}.`,
      });
    } else if (selectedCategory?.kind === 'custom' && selectedCategory.id === id) {
      selectCategory(null);
    }
  };

  const filterActions = {
    onNew: () => setBuilder({ initial: null, key: Date.now() }),
    onEdit: (id: string) => {
      const f = filters.find((x) => x.id === id);
      if (f) setBuilder({ initial: f, key: Date.now() });
    },
    onDuplicate: (id: string) => {
      const copy = useFiltersStore.getState().duplicateFilter(id);
      if (copy) pushToast({ kind: 'success', message: `Duplicado como «${copy.name}».` });
    },
    // Asks first in the app's own dialog (D103), not window.confirm.
    onDelete: (id: string) => {
      const f = filters.find((x) => x.id === id);
      if (f) setDeleting(f);
    },
    onExport: () => {
      const blob = new Blob([JSON.stringify(exportFilters(filters), null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sopranozilla-filtros.json';
      a.click();
      URL.revokeObjectURL(url);
    },
    onImport: (file: File) => {
      if (file.size > 1_000_000) {
        pushToast({ kind: 'error', message: 'El archivo es demasiado grande.' });
        return;
      }
      void file.text().then((text) => {
        let raw: unknown;
        try {
          raw = JSON.parse(text);
        } catch {
          pushToast({ kind: 'error', message: 'El archivo no es un JSON válido.' });
          return;
        }
        const parsed = parseFiltersExport(raw);
        if (!parsed.ok) {
          pushToast({ kind: 'error', message: `No se pudo importar: ${parsed.error}.` });
          return;
        }
        const result = useFiltersStore.getState().importFilters(parsed.filters);
        pushToast(
          result.ok
            ? { kind: 'success', message: `Importados ${parsed.filters.length} filtros.` }
            : { kind: 'error', message: 'No se pudo importar: crearía una referencia circular.' },
        );
      });
    },
  };
  const actionLabel = st.actionRows.find((r) => r.id === st.selectedRow)?.label ?? '';
  const playedLabel = st.actionRows.find((r) => r.id === st.playedRow)?.label ?? '';
  const hoveredCell = hovered ? cells.find((c) => c.hand === hovered) : undefined;

  const toggle = (target: RowTarget, mark: 'follow' | 'exclude') => {
    const current =
      target.kind === 'cat' ? editedRow.cats[target.id]?.s : editedRow.custom[target.id]?.s;
    setRowState(target, { s: current === mark ? null : mark });
  };

  const evPanel = (
    <EvPanel
      mode={st.mode}
      onMode={setMode}
      villainBetPct={st.villainBetPct}
      onVillainBet={setVillainBet}
      betShare={ev.betShare}
      onAddRaise={addRaiseSize}
      rows={ev.rows}
      bestId={ev.bestId}
      pot={pot}
      pending={eq.table === null || eq.progress !== null}
      selectedRow={st.selectedRow}
      playedRow={st.playedRow}
      onSelect={selectRow}
      onMarkPlayed={(id) => setPlayedRow(activeStreet, id)}
      onAddSize={addBetSize}
    />
  );

  return (
    <>
      <PageHeader
        eyebrow="Beta"
        title="Sopranozilla"
        description="Filtra el rango del villano por categorías, con pesos, y mira tu equity al instante."
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setPasteOpen((o) => !o);
                setFormOpen(false);
              }}
              aria-expanded={pasteOpen}
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-content-muted hover:bg-surface-hover hover:text-content"
            >
              <ClipboardPaste className="h-4 w-4" /> Pegar mano
            </button>
            <button
              type="button"
              onClick={() => (formOpen ? setFormOpen(false) : openTestForm())}
              aria-expanded={formOpen}
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-content-muted hover:bg-surface-hover hover:text-content"
            >
              <FlaskConical className="h-4 w-4" /> Mano de prueba
            </button>
          </div>
        }
      />

      {pasteOpen && (
        <PasteHandForm
          prefer={rangeSource}
          onLoad={loadPasted}
          onClose={() => setPasteOpen(false)}
        />
      )}
      {formOpen && (
        <TestHandForm
          initial={formInitial}
          onLoad={loadTestHand}
          onClose={() => setFormOpen(false)}
        />
      )}
      {deleting && (
        <ConfirmDeleteFilter
          filter={deleting}
          filters={filters}
          onConfirm={() => deleteFilter(deleting.id)}
          onClose={() => setDeleting(null)}
        />
      )}
      {editCardsOpen && (
        <EditCardsDialog
          hero={hand.hero}
          board={hand.board}
          onApply={applyCards}
          onClose={() => setEditCardsOpen(false)}
        />
      )}

      {meta && (
        <section className="mb-3 rounded-xl border border-border bg-surface/40 px-3 py-2 text-sm">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-medium">{meta.title}</span>
            {meta.spot && <span className="text-content-muted">{meta.spot}</span>}
            <span className="text-content-muted">
              Rango del villano:{' '}
              <span className="text-content">{meta.rangeLabel ?? 'sin elegir'}</span>
            </span>
            {meta.opponents && (
              <span
                role="group"
                aria-label="Buscar el rango primero en"
                className="ml-auto flex items-center gap-1 text-xs text-content-muted"
              >
                Buscar primero en
                {(['gto', 'mine'] as const).map((src) => (
                  <button
                    key={src}
                    type="button"
                    aria-pressed={rangeSource === src}
                    onClick={() => changeSource(src)}
                    className={cn(
                      'rounded-md border px-2 py-0.5',
                      rangeSource === src
                        ? 'border-accent bg-accent/15 text-content'
                        : 'border-border hover:bg-surface-hover',
                    )}
                  >
                    {SOURCE_LABEL[src]}
                  </button>
                ))}
              </span>
            )}
            <button
              type="button"
              onClick={() => setLibraryOpen(true)}
              className={cn(
                'flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-surface-hover',
                !meta.opponents && 'ml-auto',
              )}
            >
              <Library className="h-3.5 w-3.5" />{' '}
              {meta.rangeLabel ? 'Cambiar rango' : 'Elegir rango'}
            </button>
          </div>
          {meta.table && (
            <TableSeats
              table={meta.table}
              pickable={
                meta.opponents && meta.opponents.length > 1
                  ? meta.opponents.map((o) => o.name)
                  : []
              }
              onPickVillain={(name) => repick({ villain: name })}
            />
          )}
          {meta.opponents && meta.opponents.length > 1 && (
            <p className="mt-1 text-xs text-sky-700 dark:text-sky-300">
              Bote multiway: se analiza contra {meta.villainName}. Toca otro rival en la mesa
              (borde punteado) para analizar contra él.
            </p>
          )}
          {meta.rangeMissing && (
            <p role="alert" className="mt-1 text-xs text-amber-700 dark:text-amber-300">
              {meta.rangeMissing} Elige el rango del villano en la biblioteca.
            </p>
          )}
          {meta.warnings.map((w) => (
            <p key={w} className="mt-1 text-xs text-content-muted">
              {w}
            </p>
          ))}
        </section>
      )}
      {io === 'export' && cont && (
        <ExportRangeDialog
          street={activeStreet}
          rowLabel={actionLabel}
          start={view.start}
          row={cont}
          live={view.liveMask}
          onClose={() => setIo(null)}
        />
      )}
      {io === 'import' && (
        <ImportRangeDialog
          street={activeStreet}
          live={view.liveMask}
          onImport={importRange}
          onClose={() => setIo(null)}
        />
      )}
      {libraryOpen && (
        <RangeLibraryDialog
          onUse={(text, range) => {
            changeRange(text, range);
            setLibraryOpen(false);
          }}
          onClose={closeLibrary}
        />
      )}

      <TopBar
        hero={hand.hero}
        heroPosition={hand.heroPosition}
        villainPosition={hand.villainPosition}
        board={view.board}
        street={activeStreet}
        tabs={tabs}
        onStreet={setActiveStreet}
        pot={hand.pots?.[activeStreet]}
        rangeCombos={model.total}
        heroEq={heroEq}
        progress={eq.progress}
        streetEquity={streetEquity}
        onEditCards={() => setEditCardsOpen(true)}
      />

      <section className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface/40 px-3 py-2 text-sm">
        <p className="min-w-0 flex-1 text-content-muted">
          Fila <span className="font-medium text-content">«{actionLabel}»</span> → {presetText(st)}
          {st.recordedRow === st.selectedRow && (
            <span className="text-content">
              {' '}
              · detectado en la mano
              {st.recordedResponse && ` (${RESPONSE_TEXT[st.mode][st.recordedResponse]})`}
            </span>
          )}
          {editedRow.edited && (
            <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-px text-[11px] font-medium text-amber-700 dark:text-amber-300">
              editado
            </span>
          )}
          {st.selectedRow !== st.playedRow && activeStreet !== 'river' && (
            <span role="note" className="mt-1 block text-xs text-sky-700 dark:text-sky-300">
              No es la fila jugada: la siguiente calle usa «{playedLabel}». Para que use esta, toca
              «Marcar como jugada».
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={() => {
            checkpoint();
            resetSelectedRow();
          }}
          className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-surface-hover"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Restablecer preset
        </button>
        <button
          type="button"
          onClick={() => {
            checkpoint();
            fillSelectedRow();
          }}
          className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-surface-hover"
        >
          <CheckCheck className="h-3.5 w-3.5" /> Todo ✓ 100
        </button>
        <button
          type="button"
          onClick={() => {
            checkpoint();
            clearSelectedRow();
          }}
          className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-surface-hover"
        >
          <Eraser className="h-3.5 w-3.5" /> Vaciar (manual)
        </button>
      </section>

      {builder && (
        <FilterBuilder
          key={builder.key}
          initial={builder.initial}
          filters={filters}
          view={view}
          onDraft={setDraft}
          onSaved={(f) => {
            setBuilder(null);
            selectCategory({ kind: 'custom', id: f.id });
            pushToast({ kind: 'success', message: `Filtro «${f.name}» guardado.` });
          }}
          onClose={() => setBuilder(null)}
          renderGrid={(onHover) => (
            <>
              <BoardStrip
                street={activeStreet}
                board={view.board}
                hero={hand.hero}
                pot={hand.pots?.[activeStreet]}
              />
              {/* Read-only here: it shows the draft, editing stays on the page. */}
              <SzGrid
                cells={cells}
                readOnly
                onPaint={noop}
                onHover={onHover}
                onOpen={noop}
                openHand={null}
              />
            </>
          )}
        />
      )}

      {eq.error && (
        <p role="alert" className="mb-3 text-sm text-danger">
          No se pudo calcular la equity: {eq.error}
        </p>
      )}

      <div ref={layoutRef}>
        <div
          className={cn(
            'grid gap-3',
            layout === 'wide' && 'grid-cols-[minmax(20rem,24rem)_minmax(26rem,1fr)_18rem]',
            layout === 'medium' && 'grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)]',
          )}
        >
          {/* Sticky so the grid stays in view while scrolling the category table. */}
          <div className={cn('min-w-0', layout !== 'narrow' && STICKY_COLUMN)}>
            <BoardStrip
              street={activeStreet}
              board={view.board}
              hero={hand.hero}
              pot={hand.pots?.[activeStreet]}
              onEdit={() => setEditCardsOpen(true)}
            />
            <GridEditBar
              street={activeStreet}
              target={gridTarget}
              onTarget={(t) => {
                setGridTarget(t);
                setNotice(null);
              }}
              rowLabel={actionLabel}
              brush={brush}
              onBrush={setBrush}
              startFixed={Boolean(st.startOverride)}
              onUnfix={() => {
                checkpoint();
                clearStartOverride(activeStreet);
              }}
              onImport={() => setIo('import')}
              onExport={() => setIo('export')}
              targetLabel={selectedLabel}
              canUndo={undoDepth > 0}
              onUndo={undo}
            />
            <SzGrid
              cells={cells}
              onPaint={paintCell}
              onStrokeStart={() => checkpoint()}
              onHover={setHovered}
              onOpen={(h) => setOpenHand((o) => (o === h ? null : h))}
              openHand={openHand}
            />
            <HoverCombos
              hand={hoveredCell && hoveredCell.live > 0 ? hoveredCell.hand : null}
              cells={hoverCells}
              inTarget={hoverTarget}
              targetLabel={highlightLabel}
              mode={editingStart ? 'start' : 'row'}
              hint={
                highlightLabel
                  ? `Marco violeta: manos con «${highlightLabel}». Pasa el cursor por una mano para ver qué palos entran.`
                  : 'Pasa el cursor por una mano para ver sus combos por palo. Shift+clic para editarlos.'
              }
            />
            {notice && (
              <p role="alert" className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                {notice}
              </p>
            )}
            {openHand && openCombos && (
              <FloatingPanel
                hand={openHand}
                label={`Combos de ${openHand}`}
                onClose={() => setOpenHand(null)}
              >
                <SuitPicker
                  key={`${openHand}-${gridTarget}`}
                  hand={openHand}
                  cells={openCombos}
                  mode={editingStart ? 'start' : 'row'}
                  className="p-3"
                  onSet={(entries) => {
                    checkpoint();
                    if (editingStart) setStartCombos(entries);
                    else setComboOverrides(entries);
                  }}
                  onClose={() => setOpenHand(null)}
                />
              </FloatingPanel>
            )}
            <WeightControl
              targetLabel={selectedLabel}
              meaning={
                editingStart ? (
                  <>
                    peso de sus combos en el{' '}
                    <span className="text-content">
                      {activeStreet === 'flop' ? 'rango preflop' : `rango del ${streetName}`}
                    </span>{' '}
                    (100 = como estaba)
                  </>
                ) : (
                  <>
                    qué % sigue en <span className="text-content">«{actionLabel}»</span>
                  </>
                )
              }
              value={catValue}
              onChange={(w) => editCategory({ w })}
            >
              {selectedLabel && (
                <RowSuitFilter
                  label={selectedLabel}
                  rule={catRule}
                  onApply={(rule) => editCategory({ rule })}
                />
              )}
            </WeightControl>
          </div>
          <div className="min-w-0">
            <CategoryTable
              model={model}
              filters={filters}
              filterActions={filterActions}
              selected={selectedCategory}
              hovered={hoverCategory}
              onHover={setHoverCategory}
              onSelect={(t) =>
                selectCategory(
                  selectedCategory &&
                    selectedCategory.kind === t.kind &&
                    selectedCategory.id === t.id
                    ? null
                    : t,
                )
              }
              onToggle={toggle}
              equityPending={eq.progress !== null || eq.table === null}
              compact={layout !== 'narrow'}
            />
          </div>
          {layout === 'wide' && <div className={cn('min-w-0', STICKY_COLUMN)}>{evPanel}</div>}
        </div>
        {layout !== 'wide' && <div className="mt-3">{evPanel}</div>}
      </div>
    </>
  );
}
