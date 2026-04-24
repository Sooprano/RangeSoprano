import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { RangeGrid } from '@/components/RangeGrid';
import { RangeStats } from '@/components/RangeStats';
import { ActionLegend } from '@/components/ActionLegend';
import { computeRangeStats } from '@/utils/rangeStats';
import { ORDERED_ACTIONS } from '@/utils/actionMeta';
import { upsertActionInCell } from '@/utils/cellUtils';
import { useRangeStore } from '@/store/rangeStore';
import { useActiveRange } from '@/store/selectors';
import type { Action, HandNotation } from '@/types/poker';
import { ActionToolbar } from './ActionToolbar';
import { WeightSlider } from './WeightSlider';
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
  const totalRanges = useRangeStore((s) => s.ranges.length);
  const upsertCell = useRangeStore((s) => s.upsertCell);
  const clearCell = useRangeStore((s) => s.clearCell);

  const [activeAction, setActiveAction] = useState<Action>('RAISE');
  const [weight, setWeight] = useState(100);
  const [isFormOpen, setIsFormOpen] = useState(false);

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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, [contenteditable="true"]')) return;
      const idx = DIGIT_KEYS.indexOf(e.key);
      if (idx < 0 || idx >= ORDERED_ACTIONS.length) return;
      e.preventDefault();
      setActiveAction(ORDERED_ACTIONS[idx]!);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

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
            <ActionToolbar active={activeAction} onChange={setActiveAction} />
            <WeightSlider value={weight} onChange={setWeight} />
            <RangeGrid
              cells={activeRange.cells}
              editable
              onCellPaint={handleCellPaint}
              onCellErase={handleCellErase}
            />
            <p className="text-xs text-content-muted">
              Click paints · drag to paint multiple · right-click to erase ·
              arrow keys + Space/Enter · press 1-5 to switch action · weight
              &lt; 100 stacks with existing actions.
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
    </>
  );
}
