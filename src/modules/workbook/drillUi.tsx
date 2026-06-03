// Shared presentational pieces for the /ejercicios drills. Each drill keeps its
// own question/answer logic and FeedbackPanel (they differ), but the score bar
// and auto-advance toggle are identical across drills. Score model + timing
// constants live in `drillScore.ts` (no JSX) so this file only exports
// components.

import { Trophy } from 'lucide-react';
import { cn } from '@/lib/cn';
import { AUTO_ADVANCE_MS, STREAK_BONUS_THRESHOLD, type Score } from './drillScore';

export function ScoreBar({ score, accuracy }: { score: Score; accuracy: number }) {
  const streakHot = score.streak >= STREAK_BONUS_THRESHOLD;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat label="Precisión" value={`${accuracy.toFixed(0)}%`} />
      <Stat label="Correctas" value={`${score.correct} / ${score.total}`} />
      <Stat
        label="Racha"
        value={String(score.streak)}
        accent={streakHot}
        {...(streakHot && {
          icon: <Trophy className="h-4 w-4" strokeWidth={2.5} />,
        })}
      />
      <Stat label="Mejor racha" value={String(score.bestStreak)} />
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: string;
  accent?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border px-3 py-2 transition-colors',
        accent ? 'border-amber-500/60 bg-amber-500/10' : 'border-border bg-surface/40',
      )}
    >
      <p
        className={cn(
          'text-[10px] uppercase tracking-wider',
          accent ? 'text-amber-300' : 'text-content-muted',
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          'flex items-center gap-1.5 text-lg font-semibold tabular-nums',
          accent ? 'text-amber-200' : 'text-content',
        )}
      >
        {icon && <span aria-hidden>{icon}</span>}
        <span>{value}</span>
      </p>
    </div>
  );
}

export function AutoAdvanceToggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label
      className={cn(
        'inline-flex cursor-pointer items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium',
        'transition-colors duration-150 ease-out-soft',
        'focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent-light',
        value
          ? 'border-accent/60 bg-accent/10 text-content'
          : 'border-border bg-surface/40 text-content-muted hover:bg-surface-hover hover:text-content',
      )}
    >
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span
        aria-hidden
        className={cn(
          'inline-block h-3 w-3 rounded-sm border',
          value ? 'border-accent bg-accent' : 'border-border bg-surface',
        )}
      />
      Auto-avance ({(AUTO_ADVANCE_MS / 1000).toFixed(1)}s)
    </label>
  );
}
