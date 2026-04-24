import { GitCompare, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { RangeSummary } from '@/store/selectors';

const SITUATION_LABEL: Record<string, string> = {
  RFI: 'RFI',
  vs_RFI: 'vs RFI',
  vs_3BET: 'vs 3-Bet',
  vs_4BET: 'vs 4-Bet',
  SQUEEZE: 'Squeeze',
  DEFEND_BB: 'Defend BB',
};

type CompareToolbarProps = {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  summaries: RangeSummary[];
  compareId: string | null;
  onChangeCompareId: (id: string | null) => void;
  className?: string;
};

export function CompareToolbar({
  enabled,
  onToggle,
  summaries,
  compareId,
  onChangeCompareId,
  className,
}: CompareToolbarProps) {
  const canEnable = summaries.length >= 2;

  return (
    <div
      role="group"
      aria-label="Compare ranges"
      className={cn('flex flex-wrap items-center gap-2', className)}
    >
      <button
        type="button"
        onClick={() => onToggle(!enabled)}
        disabled={!canEnable}
        aria-pressed={enabled}
        title={
          canEnable
            ? 'Compare with a second range'
            : 'Need at least two ranges to compare'
        }
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light',
          enabled
            ? 'bg-accent/15 text-accent-light shadow-[inset_0_0_0_1px_rgb(var(--color-accent)/0.45)]'
            : 'text-content-muted hover:bg-surface-hover hover:text-content',
          !canEnable && 'cursor-not-allowed opacity-40 hover:bg-transparent hover:text-content-muted',
        )}
      >
        <GitCompare className="h-3.5 w-3.5" strokeWidth={2.25} />
        Compare
      </button>

      {enabled && (
        <>
          <label className="flex items-center gap-2 text-xs text-content-muted">
            <span>vs</span>
            <select
              value={compareId ?? ''}
              onChange={(e) =>
                onChangeCompareId(e.target.value === '' ? null : e.target.value)
              }
              aria-label="Compare against range"
              className="max-w-[14rem] rounded-md border border-border bg-bg px-2 py-1 text-sm text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light"
            >
              <option value="">Pick a range…</option>
              {summaries.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.position}{' '}
                  {SITUATION_LABEL[s.situation] ?? s.situation}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => onToggle(false)}
            aria-label="Exit compare mode"
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-content-muted hover:bg-surface-hover hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
          >
            <X className="h-3 w-3" strokeWidth={2.25} />
            Exit
          </button>
        </>
      )}
    </div>
  );
}
