import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { RangeGrid } from '@/components/RangeGrid';
import { RangeStats } from '@/components/RangeStats';
import { ActionLegend } from '@/components/ActionLegend';
import { computeRangeStats } from '@/utils/rangeStats';
import { ORDERED_ACTIONS } from '@/utils/actionMeta';
import { upsertActionInCell } from '@/utils/cellUtils';
import type { WeightedHand } from '@/utils/handRangeParser';
import { useRangeStore } from '@/store/rangeStore';
import { pushToast } from '@/store/toastStore';
import { useActiveRange } from '@/store/selectors';
import type { Action, HandNotation } from '@/types/poker';
import { ActionToolbar } from './ActionToolbar';
import { WeightSlider } from './WeightSlider';
import { HistoryToolbar } from './HistoryToolbar';
import { ImportModal } from './ImportModal';
import { ExportMenu } from './ExportMenu';
import { RangeManager } from './RangeManager';
import { EmptyEditorState } from './EmptyEditorState';

const DIGIT_KEYS = '12345';

const SITUATION_LABEL: Record<string, string> = {
  RFI: 'RFI',
  vs_RFI: 'vs RFI',
  vs_3BET: 'vs 3-Bet',
  vs_4BET: 'vs 4-Bet',
  SQUEEZE: 'Squeeze',
  DEFEND_BB: 'Defend BB',
};

export default function EditorPage() {
  const activeRange = useActiveRange();
  const activeRangeId = activeRange?.id ?? null;
  const allRanges = useRangeStore((s) => s.ranges);
  const totalRanges = allRanges.length;
  const upsertCell = useRangeStore((s) => s.upsertCell);
  const clearCell = useRangeStore((s) => s.clearCell);
  const clearAllCells = useRangeStore((s) => s.clearAllCells);
  const pushHistory = useRangeStore((s) => s.pushHistory);
  const undo = useRangeStore((s) => s.undo);
  const redo = useRangeStore((s) => s.redo);

  const [activeAction, setActiveAction] = useState<Action>('RAISE');
  const [weight, setWeight] = useState(100);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const gridRef = useRef<HTMLDivElement | null>(null);

  const handleCellPaint = useCallback(
    (hand: HandNotation) => {
      if (!activeRangeId) return;
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

  const presentActions = useMemo(
    () => (activeRange ? computeRangeStats(activeRange.cells).presentActions : []),
    [activeRange],
  );

  const requestNewRange = useCallback(() => {
    setIsFormOpen(true);
  }, []);

  const handleImport = useCallback(
    (hands: WeightedHand[], replace: boolean) => {
      if (!activeRangeId) return;
      pushHistory();
      if (replace) {
        clearAllCells(activeRangeId);
        for (const { hand, weight: w } of hands) {
          upsertCell(activeRangeId, {
            hand,
            actions: [{ action: activeAction, weight: w }],
          });
        }
      } else {
        const baseCells = activeRange?.cells ?? {};
        for (const { hand, weight: w } of hands) {
          const existing = baseCells[hand];
          const result = upsertActionInCell(existing, hand, activeAction, w);
          if (result.kind === 'clear') clearCell(activeRangeId, hand);
          else upsertCell(activeRangeId, result.cell);
        }
      }
      setIsImportOpen(false);
      pushToast({
        kind: 'success',
        message: `Imported ${hands.length} hand${hands.length === 1 ? '' : 's'}${
          replace ? ' (replaced existing)' : ''
        }`,
      });
    },
    [
      activeRangeId,
      activeRange,
      activeAction,
      pushHistory,
      clearAllCells,
      clearCell,
      upsertCell,
    ],
  );

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
      if (idx < 0 || idx >= ORDERED_ACTIONS.length) return;
      e.preventDefault();
      setActiveAction(ORDERED_ACTIONS[idx]!);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  return (
    <>
      <PageHeader
        eyebrow={
          activeRange
            ? `${activeRange.position} · ${SITUATION_LABEL[activeRange.situation] ?? activeRange.situation}`
            : 'Module'
        }
        title={activeRange ? activeRange.name : 'Editor'}
        description="Build, import and export preflop ranges with mixed frequencies."
      />

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)_300px]">
        <RangeManager
          isFormOpen={isFormOpen}
          onFormOpenChange={setIsFormOpen}
        />

        {activeRange ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <ActionToolbar active={activeAction} onChange={setActiveAction} />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsImportOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-content-muted hover:bg-surface-hover hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
                >
                  <Upload className="h-3.5 w-3.5" strokeWidth={2.25} />
                  Import
                </button>
                <ExportMenu
                  activeRange={activeRange}
                  allRanges={allRanges}
                  gridRef={gridRef}
                />
                <HistoryToolbar />
              </div>
            </div>
            <WeightSlider value={weight} onChange={setWeight} />
            <div ref={gridRef} className="rounded-xl bg-bg p-2">
              <RangeGrid
                cells={activeRange.cells}
                editable
                onCellPaint={handleCellPaint}
                onCellErase={handleCellErase}
                onSessionStart={pushHistory}
              />
            </div>
            <p className="text-xs text-content-muted">
              Click paints · drag to paint multiple · right-click to erase ·
              arrow keys + Space/Enter · press 1-5 to switch action · weight
              &lt; 100 stacks with existing actions · Ctrl+Z undo · Ctrl+Shift+Z
              redo.
            </p>
          </div>
        ) : (
          <EmptyEditorState
            hasRanges={totalRanges > 0}
            onCreate={requestNewRange}
          />
        )}

        {activeRange && (
          <aside className="flex flex-col gap-4">
            <RangeStats cells={activeRange.cells} />
            <ActionLegend actions={presentActions} />
          </aside>
        )}
      </div>

      {isImportOpen && activeRange && (
        <ImportModal
          action={activeAction}
          onImport={handleImport}
          onClose={() => setIsImportOpen(false)}
        />
      )}
    </>
  );
}
