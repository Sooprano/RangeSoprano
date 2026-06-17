import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardCopy } from 'lucide-react';
import { cn } from '@/lib/cn';
import { pushToast } from '@/store/toastStore';
import type { Range } from '@/types/poker';
import { actionColor, actionLabel, actionOrder } from '@/utils/actionMeta';
import {
  copyToClipboard,
  rangeActionToFlopzilla,
  rangeToFlopzilla,
} from '@/utils/exportRange';
import { computeRangeStats } from '@/utils/rangeStats';

type CopyRangeMenuProps = {
  range: Range | null;
};

type MenuEntry = {
  key: string;
  label: string;
  color?: string;
  text: string;
};

/**
 * "Copiar" dropdown: copies the range to the clipboard in Flopzilla format,
 * either whole ("Todo") or filtered to a single color/action. Shared by the
 * Editor and the Viewer.
 */
export function CopyRangeMenu({ range }: CopyRangeMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLUListElement | null>(null);

  const closeAndRestore = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  const entries: MenuEntry[] = useMemo(() => {
    if (!range) return [];
    const present = computeRangeStats(range.cells).presentActions;
    const colorEntries = [...present]
      .sort((a, b) => actionOrder(range.actions, a) - actionOrder(range.actions, b))
      .map<MenuEntry>((id) => ({
        key: id,
        label: actionLabel(range.actions, id),
        color: actionColor(range.actions, id),
        text: rangeActionToFlopzilla(range, id),
      }));
    return [
      { key: '__all__', label: 'Todo', text: rangeToFlopzilla(range) },
      ...colorEntries,
    ];
  }, [range]);

  const handleSelect = useCallback(
    async (entry: MenuEntry) => {
      closeAndRestore();
      const ok = await copyToClipboard(entry.text);
      if (ok) {
        pushToast({
          kind: 'success',
          message:
            entry.key === '__all__'
              ? 'Rango completo copiado para Flopzilla'
              : `"${entry.label}" copiado para Flopzilla`,
        });
      } else {
        pushToast({ kind: 'error', message: 'No se pudo copiar el rango' });
      }
    },
    [closeAndRestore],
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
    items.find((el) => !el.disabled)?.focus();
  }, [open]);

  const onMenuKeyDown = (e: React.KeyboardEvent<HTMLUListElement>) => {
    const items = menuItemElements(menuRef.current).filter((el) => !el.disabled);
    if (items.length === 0) return;
    const active = document.activeElement as HTMLElement | null;
    const idx = items.findIndex((el) => el === active);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(idx + 1 + items.length) % items.length]!.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(idx - 1 + items.length) % items.length]!.focus();
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

  const disabled = !range;

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light',
          disabled
            ? 'cursor-not-allowed text-content-disabled'
            : 'text-content-muted hover:bg-surface-hover hover:text-content',
        )}
      >
        <ClipboardCopy className="h-3.5 w-3.5" strokeWidth={2.25} />
        Copiar
      </button>
      {open && (
        <ul
          ref={menuRef}
          role="menu"
          aria-label="Copiar rango para Flopzilla"
          onKeyDown={onMenuKeyDown}
          className="absolute right-0 z-30 mt-1 flex w-60 flex-col rounded-lg border border-border bg-surface p-1 text-sm shadow-surface"
        >
          <li role="none" className="px-2.5 pb-1 pt-1.5 text-xs text-content-disabled">
            Formato Flopzilla
          </li>
          {entries.map((entry) => (
            <MenuItem key={entry.key} entry={entry} onClick={() => handleSelect(entry)} />
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
  entry: MenuEntry;
  onClick: () => void;
};

function MenuItem({ entry, onClick }: MenuItemProps) {
  return (
    <li role="none">
      <button
        type="button"
        role="menuitem"
        onClick={onClick}
        aria-label={entry.label}
        className={cn(
          'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm',
          'text-content-muted hover:bg-surface-hover hover:text-content',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light',
        )}
      >
        {entry.color ? (
          <span
            aria-hidden="true"
            className="h-3 w-3 shrink-0 rounded-sm"
            style={{ backgroundColor: entry.color }}
          />
        ) : (
          <span aria-hidden="true" className="h-3 w-3 shrink-0" />
        )}
        {entry.label}
      </button>
    </li>
  );
}
