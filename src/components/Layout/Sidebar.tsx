import { NavLink } from 'react-router-dom';
import { Eye, Home, Target, Pencil, Spade } from 'lucide-react';
import { cn } from '@/lib/cn';

type NavItem = {
  to: string;
  label: string;
  icon: typeof Eye;
  end?: boolean;
};

const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/viewer', label: 'Viewer', icon: Eye },
  { to: '/trainer', label: 'Trainer', icon: Target },
  { to: '/editor', label: 'Editor', icon: Pencil },
];

export function Sidebar() {
  return (
    <aside
      aria-label="Primary navigation"
      className="flex w-60 shrink-0 flex-col border-r border-border bg-bg-subtle"
    >
      <div className="flex items-center gap-2.5 px-6 py-6">
        <span
          aria-hidden
          className="grid h-9 w-9 place-items-center rounded-lg bg-accent/15 text-accent"
        >
          <Spade className="h-5 w-5" strokeWidth={2.25} />
        </span>
        <div className="flex flex-col">
          <span className="text-[15px] font-semibold leading-tight tracking-tight">
            Range Soprano
          </span>
          <span className="text-[11px] uppercase tracking-[0.14em] text-content-muted">
            Poker Ranges
          </span>
        </div>
      </div>

      <nav className="flex flex-col gap-1 px-3">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end ?? false}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200 ease-out-soft',
                isActive
                  ? 'bg-accent/15 text-content shadow-[inset_0_0_0_1px_rgb(var(--color-accent)/0.35)]'
                  : 'text-content-muted hover:bg-surface-hover hover:text-content',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  className={cn(
                    'h-[18px] w-[18px] transition-colors',
                    isActive ? 'text-accent-light' : 'text-content-muted group-hover:text-content',
                  )}
                  strokeWidth={2}
                />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto px-6 py-5 text-[11px] text-content-disabled">
        v0.1.0 · Preflop study
      </div>
    </aside>
  );
}
