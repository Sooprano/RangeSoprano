import { useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Calculator,
  ChevronsLeft,
  ChevronsRight,
  Dumbbell,
  Eye,
  FileSearch,
  Home,
  Pencil,
  Spade,
  Target,
  X,
} from 'lucide-react';
import { cn } from '@/lib/cn';

type NavItem = {
  to: string;
  label: string;
  icon: typeof Eye;
  end?: boolean;
};

type NavSection = {
  label?: string;
  items: readonly NavItem[];
};

// Dos bloques conceptuales: "Rangos" (crear/ver/entrenar rangos) y
// "Matemáticas" (calculadoras, análisis y ejercicios). Inicio queda suelto arriba.
const NAV_SECTIONS: readonly NavSection[] = [
  {
    items: [{ to: '/', label: 'Inicio', icon: Home, end: true }],
  },
  {
    label: 'Rangos',
    items: [
      { to: '/viewer', label: 'Visualizador', icon: Eye },
      { to: '/trainer', label: 'Entrenador', icon: Target },
      { to: '/editor', label: 'Editor', icon: Pencil },
    ],
  },
  {
    label: 'Matemáticas',
    items: [
      { to: '/calculadoras', label: 'Calculadoras', icon: Calculator },
      { to: '/analisis', label: 'Análisis', icon: FileSearch },
      { to: '/ejercicios', label: 'Ejercicios', icon: Dumbbell },
    ],
  },
];

type SidebarProps = {
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapsed: () => void;
  onCloseMobile: () => void;
};

export function Sidebar({
  collapsed,
  mobileOpen,
  onToggleCollapsed,
  onCloseMobile,
}: SidebarProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  // Close mobile drawer on Escape.
  useEffect(() => {
    if (!mobileOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseMobile();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [mobileOpen, onCloseMobile]);

  // Focus close button when drawer opens.
  useEffect(() => {
    if (mobileOpen) closeButtonRef.current?.focus();
  }, [mobileOpen]);

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          aria-hidden
          onClick={onCloseMobile}
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
        />
      )}

      <aside
        aria-label="Primary navigation"
        className={cn(
          'flex shrink-0 flex-col border-r border-border bg-bg-subtle transition-[width,transform] duration-200 ease-out-soft',
          // Desktop: in flow, width depends on collapsed flag.
          'lg:static lg:translate-x-0',
          collapsed ? 'lg:w-16' : 'lg:w-60',
          // Mobile: off-canvas drawer.
          'fixed inset-y-0 left-0 z-40 w-60',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div
          className={cn(
            'flex items-center gap-2.5 px-6 py-6',
            collapsed && 'lg:justify-center lg:px-3',
          )}
        >
          <span
            aria-hidden
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent/15 text-accent"
          >
            <Spade className="h-5 w-5" strokeWidth={2.25} />
          </span>
          <div
            className={cn(
              'flex flex-col',
              collapsed && 'lg:hidden',
            )}
          >
            <span className="text-[15px] font-semibold leading-tight tracking-tight">
              Range Soprano
            </span>
            <span className="text-[11px] uppercase tracking-[0.14em] text-content-muted">
              Poker Ranges
            </span>
          </div>

          {/* Mobile close button */}
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onCloseMobile}
            aria-label="Cerrar navegación"
            className="ml-auto rounded-md p-1 text-content-muted hover:bg-surface-hover hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light lg:hidden"
          >
            <X className="h-4 w-4" strokeWidth={2.25} />
          </button>
        </div>

        <nav className={cn('flex flex-col gap-3', collapsed ? 'lg:px-2' : 'px-3')}>
          {NAV_SECTIONS.map((section, sectionIdx) => (
            <div key={section.label ?? `section-${sectionIdx}`} className="flex flex-col gap-1">
              {section.label && (
                <span
                  className={cn(
                    'px-3 pb-0.5 pt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-content-muted',
                    collapsed && 'lg:hidden',
                  )}
                >
                  {section.label}
                </span>
              )}
              {/* En modo colapsado, separa las secciones con etiqueta mediante un divisor. */}
              {section.label && collapsed && (
                <div aria-hidden className="mx-2 hidden h-px bg-border/60 lg:block" />
              )}
              {section.items.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end ?? false}
                  onClick={onCloseMobile}
                  title={collapsed ? label : undefined}
                  className={({ isActive }) =>
                    cn(
                      'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200 ease-out-soft',
                      collapsed && 'lg:justify-center lg:px-2',
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
                          'h-[18px] w-[18px] shrink-0 transition-colors',
                          isActive ? 'text-accent-light' : 'text-content-muted group-hover:text-content',
                        )}
                        strokeWidth={2}
                      />
                      <span className={cn(collapsed && 'lg:hidden')}>{label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-2 px-3 pb-4 pt-5">
          {/* Desktop collapse toggle */}
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'}
            aria-pressed={collapsed}
            title={collapsed ? 'Expandir barra lateral' : 'Colapsar barra lateral'}
            className={cn(
              'hidden items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-content-muted hover:bg-surface-hover hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light lg:inline-flex',
              collapsed && 'lg:justify-center lg:px-2',
            )}
          >
            {collapsed ? (
              <ChevronsRight className="h-4 w-4 shrink-0" strokeWidth={2.25} />
            ) : (
              <>
                <ChevronsLeft className="h-4 w-4 shrink-0" strokeWidth={2.25} />
                <span>Colapsar</span>
              </>
            )}
          </button>

          <div
            className={cn(
              'px-3 text-[11px] text-content-disabled',
              collapsed && 'lg:hidden',
            )}
          >
            v0.1.0 · Estudio preflop
          </div>
        </div>
      </aside>
    </>
  );
}
