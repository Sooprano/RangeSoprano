import { useCallback, useRef, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useApplyTheme } from '@/hooks/useApplyTheme';
import { Toaster } from '@/components/Toaster';
import { useUiStore } from '@/store/uiStore';
import { Sidebar } from './Sidebar';
import { FloatingToolsHost } from './FloatingToolsHost';

export function AppLayout() {
  useApplyTheme();

  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebarCollapsed = useUiStore((s) => s.toggleSidebarCollapsed);

  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);

  const handleOpenMobile = useCallback(() => setMobileOpen(true), []);
  const handleCloseMobile = useCallback(() => {
    setMobileOpen(false);
    // Restore focus to the menu trigger.
    requestAnimationFrame(() => menuButtonRef.current?.focus());
  }, []);

  return (
    <div className="flex h-full w-full bg-bg text-content">
      <Sidebar
        collapsed={sidebarCollapsed}
        mobileOpen={mobileOpen}
        onToggleCollapsed={toggleSidebarCollapsed}
        onCloseMobile={handleCloseMobile}
      />
      <main className="flex min-w-0 flex-1 flex-col overflow-auto">
        <button
          ref={menuButtonRef}
          type="button"
          onClick={handleOpenMobile}
          aria-label="Open navigation"
          aria-expanded={mobileOpen}
          className="sticky top-0 z-20 inline-flex w-fit items-center gap-2 px-4 py-3 text-sm font-medium text-content-muted hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light lg:hidden"
        >
          <Menu className="h-5 w-5" strokeWidth={2.25} />
          <span className="sr-only">Menu</span>
        </button>
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
          <Outlet />
        </div>
      </main>
      <Toaster />
      <FloatingToolsHost />
    </div>
  );
}
