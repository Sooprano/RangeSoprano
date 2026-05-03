import { useState } from 'react';
import { BookOpen, Zap } from 'lucide-react';
import { cn } from '@/lib/cn';
import { OddsStudy } from './OddsStudy';
import { OddsSpeed } from './OddsSpeed';

type OddsSubMode = 'study' | 'speed';

export function OddsTrainer() {
  const [subMode, setSubMode] = useState<OddsSubMode>('study');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <SubModeToggle value={subMode} onChange={setSubMode} />
      </div>
      {subMode === 'study' ? <OddsStudy /> : <OddsSpeed />}
    </div>
  );
}

function SubModeToggle({
  value,
  onChange,
}: {
  value: OddsSubMode;
  onChange: (next: OddsSubMode) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Odds sub-mode"
      className="inline-flex w-fit items-center gap-1 rounded-xl border border-border bg-surface/60 p-1"
    >
      <SubButton
        active={value === 'study'}
        onClick={() => onChange('study')}
        icon={<BookOpen className="h-3.5 w-3.5" strokeWidth={2.25} />}
        label="Study"
      />
      <SubButton
        active={value === 'speed'}
        onClick={() => onChange('speed')}
        icon={<Zap className="h-3.5 w-3.5" strokeWidth={2.25} />}
        label="Speed"
      />
    </div>
  );
}

function SubButton({
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
