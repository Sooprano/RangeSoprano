import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { RangeGrid } from '@/components/RangeGrid';
import { RangeStats } from '@/components/RangeStats';
import { ActionLegend } from '@/components/ActionLegend';
import { computeRangeStats } from '@/utils/rangeStats';
import { buildActionDefMap } from '@/utils/actionMeta';
import { upsertActionInCell } from '@/utils/cellUtils';
import { expandPlus } from '@/utils/handRangeParser';
import { useRangeStore } from '@/store/rangeStore';
import { pushToast } from '@/store/toastStore';
import { useActiveRange } from '@/store/selectors';
import type { ActionId, HandNotation } from '@/types/poker';
import { ActionPalette } from './ActionPalette';
import { RangeMetaForm } from './RangeMetaForm';
import { WeightSlider } from './WeightSlider';
import { HistoryToolbar } from './HistoryToolbar';
import { ImportModal, type ImportPlan } from './ImportModal';
import { ExportMenu } from './ExportMenu';
import { CopyRangeMenu } from '@/components/CopyRangeMenu/CopyRangeMenu';
import { EditActionsToolbar } from './EditActionsToolbar';
import { NotesButton } from './NotesButton';
import { RangeManager } from './RangeManager';
import { EmptyEditorState } from './EmptyEditorState';
import { SITUATION_LABELS } from '@/data/positions';

const DIGIT_KEYS = '123456789';

export default function EditorPage() {
  useDocumentTitle('Editor de rangos · Range Soprano', {
    description:
      'Editor visual con pesos mixtos, paleta de acciones por rango, undo/redo, carpetas e import/export JSON.',
    canonical: 'https://rangesoprano.com/editor/',
  });
  const activeRange = useActiveRange();
  const activeRangeId = activeRange?.id ?? null;
  const allRanges = useRangeStore((s) => s.ranges);
  const totalRanges = allRanges.length;
  const upsertCell = useRangeStore((s) => s.upsertCell);
  const clearCell = useRangeStore((s) => s.clearCell);
  const clearAllCells = useRangeStore((s) => s.clearAllCells);
  const pushHistory = useRangeStore((s) => s.pushHistory);
  const snapshotRange = useRangeStore((s) => s.snapshotRange);
  const undo = useRangeStore((s) => s.undo);
  const redo = useRangeStore((s) => s.redo);

  const [activeAction, setActiveAction] = useState<ActionId | null>(null);
  const [weight, setWeight] = useState(100);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const gridRef = useRef<HTMLDivElement | null>(null);

  const orderedActions = useMemo(
    () => (activeRange ? [...activeRange.actions].sort((a, b) => a.order - b.order) : []),
    [activeRange],
  );
  const actionsMap = useMemo(
    () => (activeRange ? buildActionDefMap(activeRange.actions) : new Map()),
    [activeRange],
  );

  // Keep activeAction in sync with the active range's available actions.
  useEffect(() => {
    if (orderedActions.length === 0) {
      setActiveAction(null);
      return;
    }
    if (!activeAction || !orderedActions.some((a) => a.id === activeAction)) {
      setActiveAction(orderedActions[0]!.id);
    }
  }, [orderedActions, activeAction]);

  const handleCellPaint = useCallback(
    (hand: HandNotation) => {
      if (!activeRangeId || !activeAction) return;
      const existing = activeRange?.cells[hand];
      const result = upsertActionInCell(existing, hand, activeAction, weight);
      if (result.kind === 'clear') clearCell(activeRangeId, hand);
      else upsertCell(activeRangeId, result.cell);
    },
    [activeRangeId, activeRange, activeAction, weight, upsertCell, clearCell],
  );

  const handleCellErase = useCallback(
    (hand: HandNotation) => {
      if (!activeRangeId) return;
      clearCell(activeRangeId, hand);
    },
    [activeRangeId, clearCell],
  );

  const handleCellPaintPlus = useCallback(
    (hand: HandNotation) => {
      if (!activeRangeId || !activeAction) return;
      const hands = expandPlus(hand);
      let cells = activeRange?.cells ?? {};
      for (const h of hands) {
        const existing = cells[h];
        const result = upsertActionInCell(existing, h, activeAction, weight);
        if (result.kind === 'clear') {
          clearCell(activeRangeId, h);
          if (h in cells) {
            const { [h]: _omit, ...rest } = cells;
            void _omit;
            cells = rest;
          }
        } else {
          upsertCell(activeRangeId, result.cell);
          cells = { ...cells, [h]: result.cell };
        }
      }
    },
    [activeRangeId, activeRange, activeAction, weight, upsertCell, clearCell],
  );

  const presentActions = useMemo(
    () => (activeRange ? computeRangeStats(activeRange.cells).presentActions : []),
    [activeRange],
  );

  const requestNewRange = useCallback(() => {
    setIsFormOpen(true);
  }, []);

  const handleImport = useCallback(
    (plans: ImportPlan[], replace: boolean) => {
      if (!activeRangeId) return;
      if (plans.length === 0) {
        setIsImportOpen(false);
        return;
      }
      pushHistory();
      if (replace) clearAllCells(activeRangeId);

      let cells = replace ? {} : { ...(activeRange?.cells ?? {}) };
      let totalHands = 0;
      let clampedCount = 0;

      for (const plan of plans) {
        for (const { hand, weight: w } of plan.hands) {
          totalHands++;
          const existing = cells[hand];
          const result = upsertActionInCell(existing, hand, plan.actionId, w);
          if (result.kind === 'clear') {
            clearCell(activeRangeId, hand);
            if (hand in cells) {
              const { [hand]: _omit, ...rest } = cells;
              void _omit;
              cells = rest;
            }
          } else {
            const deposited =
              result.cell.actions.find((a) => a.action === plan.actionId)
                ?.weight ?? 0;
            if (w < 100 && deposited < w) {
              clampedCount++;
            } else if (w >= 100) {
              const overwrote = (existing?.actions ?? []).some(
                (a) => a.action !== plan.actionId && a.weight > 0,
              );
              if (overwrote) clampedCount++;
            }
            upsertCell(activeRangeId, result.cell);
            cells = { ...cells, [hand]: result.cell };
          }
        }
      }

      setIsImportOpen(false);

      const summary = `${totalHands} mano${totalHands === 1 ? '' : 's'} importada${totalHands === 1 ? '' : 's'}${
        replace ? ' (reemplazó las existentes)' : ''
      }`;
      const clampNote =
        clampedCount > 0
          ? ` · ${clampedCount} combo${clampedCount === 1 ? '' : 's'} ajustado${clampedCount === 1 ? '' : 's'} a ≤100% por celda`
          : '';
      pushToast({ kind: 'success', message: `${summary}${clampNote}` });
    },
    [
      activeRangeId,
      activeRange,
      pushHistory,
      clearAllCells,
      clearCell,
      upsertCell,
    ],
  );

  // Ensure the active range has a baseline snapshot for Discard.
  useEffect(() => {
    if (activeRangeId) snapshotRange(activeRangeId);
    // Only on range switch: capture the on-entry state once per id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRangeId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, [contenteditable="true"]')) return;

      const cmd = e.ctrlKey || e.metaKey;
      if (cmd && !e.altKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (cmd && !e.altKey && !e.shiftKey && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        redo();
        return;
      }

      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      const idx = DIGIT_KEYS.indexOf(e.key);
      if (idx < 0 || idx >= orderedActions.length) return;
      e.preventDefault();
      setActiveAction(orderedActions[idx]!.id);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo, orderedActions]);

  return (
    <>
      <PageHeader
        eyebrow={
          activeRange
            ? `${activeRange.position} · ${SITUATION_LABELS[activeRange.situation] ?? activeRange.situation}`
            : 'Module'
        }
        title={activeRange ? activeRange.name : 'Editor'}
        description="Construye, importa y exporta rangos preflop con frecuencias mixtas."
      />

      <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_280px]">
        <RangeManager
          isFormOpen={isFormOpen}
          onFormOpenChange={setIsFormOpen}
        />

        {activeRange ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <EditActionsToolbar range={activeRange} />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsImportOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-content-muted hover:bg-surface-hover hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
                >
                  <Upload className="h-3.5 w-3.5" strokeWidth={2.25} />
                  Importar
                </button>
                <CopyRangeMenu range={activeRange} />
                <ExportMenu
                  activeRange={activeRange}
                  allRanges={allRanges}
                  gridRef={gridRef}
                />
                <NotesButton range={activeRange} />
                <HistoryToolbar />
              </div>
            </div>
            <WeightSlider value={weight} onChange={setWeight} />
            <div ref={gridRef} className="rounded-xl bg-bg p-2">
              <RangeGrid
                cells={activeRange.cells}
                actionsMap={actionsMap}
                editable
                onCellPaint={handleCellPaint}
                onCellErase={handleCellErase}
                onCellPaintPlus={handleCellPaintPlus}
                onSessionStart={pushHistory}
              />
            </div>
            <p className="text-xs text-content-muted">
              Clic para pintar · arrastra para pintar varias · clic derecho para
              borrar · Ctrl+clic derecho rellena mano+ (ej. A5o → A5o..AKo, 44 →
              44..AA) · flechas + Espacio/Enter · 1-9 para cambiar de acción ·
              peso &lt; 100 acumula con acciones existentes · Ctrl+Z deshacer ·
              Ctrl+Shift+Z rehacer.
            </p>
          </div>
        ) : (
          <EmptyEditorState
            hasRanges={totalRanges > 0}
            onCreate={requestNewRange}
          />
        )}

        {activeRange && (
          <aside className="flex flex-col gap-4 md:col-span-2 md:grid md:grid-cols-2 md:gap-4 xl:col-span-1 xl:flex xl:flex-col">
            <RangeMetaForm range={activeRange} />
            <ActionPalette
              range={activeRange}
              activeAction={activeAction}
              onActiveActionChange={setActiveAction}
            />
            <RangeStats cells={activeRange.cells} actionDefs={activeRange.actions} />
            <ActionLegend actionDefs={activeRange.actions} presentActions={presentActions} />
          </aside>
        )}
      </div>

      {isImportOpen && activeRange && (
        <ImportModal
          range={activeRange}
          onImport={handleImport}
          onClose={() => setIsImportOpen(false)}
        />
      )}
    </>
  );
}
