import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { Download } from 'lucide-react';
import { cn } from '@/lib/cn';
import { pushToast } from '@/store/toastStore';
import { useUiStore } from '@/store/uiStore';
import type { Range } from '@/types/poker';
import {
  allRangesToJson,
  copyToClipboard,
  downloadBlob,
  exportNodeToPng,
  rangeToJson,
  rangeToNotation,
  slugify,
  todayIsoDate,
} from '@/utils/exportRange';

type ExportMenuProps = {
  activeRange: Range | null;
  allRanges: Range[];
  gridRef: RefObject<HTMLDivElement | null>;
};

type MenuEntry = {
  label: string;
  disabled: boolean;
  onSelect: () => void;
};

export function ExportMenu({ activeRange, allRanges, gridRef }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLUListElement | null>(null);
  const groupMeta = useUiStore((s) => s.groupMeta);

  const closeAndRestore = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  const handleCopy = useCallback(async () => {
    if (!activeRange) return;
    closeAndRestore();
    const text = rangeToNotation(activeRange);
    const ok = await copyToClipboard(text);
    if (ok) pushToast({ kind: 'success', message: 'Notation copied to clipboard' });
    else pushToast({ kind: 'error', message: 'Could not copy notation' });
  }, [activeRange, closeAndRestore]);

  const handleDownloadOne = useCallback(() => {
    if (!activeRange) return;
    closeAndRestore();
    downloadBlob(
      rangeToJson(activeRange),
      `${slugify(activeRange.name)}.json`,
      'application/json',
    );
    pushToast({ kind: 'success', message: `Downloaded "${activeRange.name}.json"` });
  }, [activeRange, closeAndRestore]);

  const handleDownloadAll = useCallback(() => {
    if (allRanges.length === 0) return;
    closeAndRestore();
    downloadBlob(
      allRangesToJson(allRanges, groupMeta),
      `range-soprano-${todayIsoDate()}.json`,
      'application/json',
    );
    pushToast({
      kind: 'success',
      message: `Downloaded ${allRanges.length} range${allRanges.length === 1 ? '' : 's'} as JSON`,
    });
  }, [allRanges, groupMeta, closeAndRestore]);

  const handleExportPng = useCallback(async () => {
    const node = gridRef.current;
    if (!activeRange || !node) return;
    closeAndRestore();
    try {
      await exportNodeToPng(node, `${slugify(activeRange.name)}.png`);
      pushToast({ kind: 'success', message: 'PNG guardado' });
    } catch {
      pushToast({ kind: 'error', message: 'No se pudo exportar el PNG' });
    }
  }, [activeRange, gridRef, closeAndRestore]);

  const entries: MenuEntry[] = useMemo(
    () => [
      { label: 'Copiar notación', disabled: !activeRange, onSelect: handleCopy },
      { label: 'Descargar JSON', disabled: !activeRange, onSelect: handleDownloadOne },
      {
        label: 'Descargar todos los rangos JSON',
        disabled: allRanges.length === 0,
        onSelect: handleDownloadAll,
      },
      { label: 'Exportar PNG', disabled: !activeRange, onSelect: handleExportPng },
    ],
    [
      activeRange,
      allRanges.length,
      handleCopy,
      handleDownloadOne,
      handleDownloadAll,
      handleExportPng,
    ],
  );

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeAndRestore();
      }
    };
    window.addEventListener('mousedown', onDocClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDocClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, closeAndRestore]);

  useEffect(() => {
    if (!open) return;
    const items = menuItemElements(menuRef.current);
    const firstEnabled = items.find((el) => !el.disabled);
    firstEnabled?.focus();
  }, [open]);

  const onMenuKeyDown = (e: React.KeyboardEvent<HTMLUListElement>) => {
    const items = menuItemElements(menuRef.current).filter((el) => !el.disabled);
    if (items.length === 0) return;
    const active = document.activeElement as HTMLElement | null;
    const idx = items.findIndex((el) => el === active);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = items[(idx + 1 + items.length) % items.length]!;
      next.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = items[(idx - 1 + items.length) % items.length]!;
      prev.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0]!.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1]!.focus();
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-content-muted hover:bg-surface-hover hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
      >
        <Download className="h-3.5 w-3.5" strokeWidth={2.25} />
        Exportar
      </button>
      {open && (
        <ul
          ref={menuRef}
          role="menu"
          aria-label="Opciones de exportación"
          onKeyDown={onMenuKeyDown}
          className="absolute right-0 z-30 mt-1 flex w-60 flex-col rounded-lg border border-border bg-surface p-1 text-sm shadow-surface"
        >
          {entries.map((entry) => (
            <MenuItem
              key={entry.label}
              label={entry.label}
              disabled={entry.disabled}
              onClick={entry.onSelect}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function menuItemElements(root: HTMLElement | null): HTMLButtonElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]'));
}

type MenuItemProps = {
  label: string;
  disabled?: boolean;
  onClick: () => void;
};

function MenuItem({ label, disabled = false, onClick }: MenuItemProps) {
  return (
    <li role="none">
      <button
        type="button"
        role="menuitem"
        disabled={disabled}
        onClick={onClick}
        aria-label={label}
        className={cn(
          'w-full rounded-md px-2.5 py-1.5 text-left text-sm',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light',
          disabled
            ? 'cursor-not-allowed text-content-disabled'
            : 'text-content-muted hover:bg-surface-hover hover:text-content',
        )}
      >
        {label}
      </button>
    </li>
  );
}
