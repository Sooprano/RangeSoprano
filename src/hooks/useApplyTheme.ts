import { useEffect } from 'react';
import { useUiStore } from '@/store/uiStore';

function resolveTheme(theme: 'dark' | 'light' | 'system'): 'dark' | 'light' {
  if (theme !== 'system') return theme;
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Applies the current theme to <html data-theme>. The initial value is set by
 * an inline script in index.html to prevent FOUC; this hook keeps it in sync
 * with store changes and with system preference changes when theme === 'system'.
 */
export function useApplyTheme(): void {
  const theme = useUiStore((s) => s.theme);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.dataset.theme = resolveTheme(theme);

    if (theme !== 'system' || typeof window === 'undefined' || !window.matchMedia) {
      return;
    }

    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      root.dataset.theme = mql.matches ? 'dark' : 'light';
    };
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [theme]);
}
