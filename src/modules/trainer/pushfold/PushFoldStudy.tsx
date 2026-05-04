import { useState } from 'react';
import { Grid2x2, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/cn';
import { PushFoldTable } from './PushFoldTable';
import { PushFoldQuiz } from './PushFoldQuiz';

type StudyView = 'table' | 'quiz';

export function PushFoldStudy() {
  const [view, setView] = useState<StudyView>('table');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-center">
        <ViewToggle value={view} onChange={setView} />
      </div>
      {view === 'table' ? <PushFoldTable /> : <PushFoldQuiz />}
    </div>
  );
}

function ViewToggle({
  value,
  onChange,
}: {
  value: StudyView;
  onChange: (next: StudyView) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Vista de estudio"
      className="inline-flex items-center gap-1 rounded-xl border border-border bg-surface/60 p-1"
    >
      <ViewButton
        active={value === 'table'}
        onClick={() => onChange('table')}
        icon={<Grid2x2 className="h-3.5 w-3.5" strokeWidth={2.25} />}
        label="Tabla"
      />
      <ViewButton
        active={value === 'quiz'}
        onClick={() => onChange('quiz')}
        icon={<HelpCircle className="h-3.5 w-3.5" strokeWidth={2.25} />}
        label="Quiz"
      />
    </div>
  );
}

function ViewButton({
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
        'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium',
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
