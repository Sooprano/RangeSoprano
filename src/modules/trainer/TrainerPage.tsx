import { useEffect, useState } from 'react';
import { Brush, Dices } from 'lucide-react';
import { cn } from '@/lib/cn';
import { PageHeader } from '@/components/ui/PageHeader';
import { useRangeStore } from '@/store/rangeStore';
import { useUiStore } from '@/store/uiStore';
import { useRangeSummaries, useTrainerRange } from '@/store/selectors';
import { ViewerRangeList } from '@/modules/viewer/ViewerRangeList';
import { TrainerEmptyState } from './TrainerEmptyState';
import { ClassicTrainer } from './ClassicTrainer';

const SITUATION_LABEL: Record<string, string> = {
  RFI: 'RFI',
  vs_RFI: 'vs RFI',
  vs_3BET: 'vs 3-Bet',
  vs_4BET: 'vs 4-Bet',
  SQUEEZE: 'Squeeze',
  DEFEND_BB: 'Defend BB',
};

type TrainerMode = 'classic' | 'drawing';

export default function TrainerPage() {
  const ranges = useRangeStore((s) => s.ranges);
  const summaries = useRangeSummaries();
  const trainerRangeId = useUiStore((s) => s.trainerRangeId);
  const setTrainerRangeId = useUiStore((s) => s.setTrainerRangeId);
  const range = useTrainerRange();

  const [mode, setMode] = useState<TrainerMode>('classic');

  useEffect(() => {
    if (ranges.length === 0) {
      if (trainerRangeId !== null) setTrainerRangeId(null);
      return;
    }
    const stillValid = trainerRangeId
      ? ranges.some((r) => r.id === trainerRangeId)
      : false;
    if (!stillValid) {
      setTrainerRangeId(ranges[0]!.id);
    }
  }, [ranges, trainerRangeId, setTrainerRangeId]);

  if (ranges.length === 0) {
    return (
      <>
        <PageHeader
          title="Trainer"
          description="Practice decisions against your saved ranges. Classic and drawing modes."
        />
        <TrainerEmptyState />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow={
          range
            ? `${range.position} · ${SITUATION_LABEL[range.situation] ?? range.situation}`
            : 'Module'
        }
        title={range ? range.name : 'Trainer'}
        description="Practice decisions against your saved ranges. Classic and drawing modes."
      />

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <ViewerRangeList
          summaries={summaries}
          selectedId={trainerRangeId}
          onSelect={setTrainerRangeId}
          emptyMessage="No ranges yet. Create one in the Editor."
        />

        <div className="flex min-w-0 flex-col gap-4">
          <ModeToggle value={mode} onChange={setMode} />
          {range ? (
            mode === 'classic' ? (
              <ClassicTrainer key={range.id} range={range} />
            ) : (
              <ModePlaceholder mode={mode} />
            )
          ) : (
            <div className="flex min-h-[40vh] items-center justify-center rounded-xl border border-dashed border-border p-6 text-center text-sm text-content-muted">
              Pick a range from the list to start a session.
            </div>
          )}
        </div>
      </div>
    </>
  );
}

type ModeToggleProps = {
  value: TrainerMode;
  onChange: (mode: TrainerMode) => void;
};

function ModeToggle({ value, onChange }: ModeToggleProps) {
  return (
    <div
      role="tablist"
      aria-label="Trainer mode"
      className="inline-flex w-fit items-center gap-1 rounded-xl border border-border bg-surface/60 p-1"
    >
      <ModeButton
        active={value === 'classic'}
        onClick={() => onChange('classic')}
        icon={<Dices className="h-3.5 w-3.5" strokeWidth={2.25} />}
        label="Classic"
      />
      <ModeButton
        active={value === 'drawing'}
        onClick={() => onChange('drawing')}
        icon={<Brush className="h-3.5 w-3.5" strokeWidth={2.25} />}
        label="Drawing"
      />
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium',
        'transition-colors duration-150 ease-out-soft',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light',
        active
          ? 'bg-surface text-content shadow-[inset_0_0_0_1px_rgb(var(--color-accent)/0.6)]'
          : 'text-content-muted hover:bg-surface-hover hover:text-content',
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function ModePlaceholder({ mode }: { mode: TrainerMode }) {
  const label = mode === 'classic' ? 'Classic mode' : 'Drawing mode';
  return (
    <div className="flex min-h-[40vh] items-center justify-center rounded-xl border border-dashed border-border p-6 text-center text-sm text-content-muted">
      {label} arrives in the next sub-phase.
    </div>
  );
}
