import { cn } from '@/lib/cn';
import type { Action } from '@/types/poker';
import { ACTION_META, ORDERED_ACTIONS } from '@/utils/actionMeta';

type ActionToolbarProps = {
  active: Action;
  onChange: (action: Action) => void;
  disabled?: boolean;
  className?: string;
};

export function ActionToolbar({
  active,
  onChange,
  disabled = false,
  className,
}: ActionToolbarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Active action"
      className={cn(
        'flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-surface/60 p-1.5',
        className,
      )}
    >
      {ORDERED_ACTIONS.map((action) => {
        const meta = ACTION_META[action];
        const isActive = action === active;
        return (
          <button
            key={action}
            type="button"
            disabled={disabled}
            aria-pressed={isActive}
            onClick={() => onChange(action)}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium',
              'transition-colors duration-150 ease-out-soft',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light',
              isActive
                ? 'bg-surface text-content shadow-[inset_0_0_0_1px_rgb(var(--color-accent)/0.6)]'
                : 'text-content-muted hover:bg-surface-hover hover:text-content',
              disabled && 'cursor-not-allowed opacity-50 hover:bg-transparent hover:text-content-muted',
            )}
          >
            <span
              aria-hidden
              className={cn('h-3 w-3 rounded-sm', meta.swatchClass)}
            />
            <span>{meta.label}</span>
          </button>
        );
      })}
    </div>
  );
}
