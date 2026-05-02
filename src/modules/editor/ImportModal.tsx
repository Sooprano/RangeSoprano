import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { parseHandRange, type WeightedHand } from '@/utils/handRangeParser';
import { actionDefOf } from '@/utils/actionMeta';
import type { ActionId, Range } from '@/types/poker';

export type ImportPlan = { actionId: ActionId; hands: WeightedHand[] };

type ImportModalProps = {
  range: Range;
  onImport: (plans: ImportPlan[], replace: boolean) => void;
  onClose: () => void;
};

type Pane = { id: string; actionId: ActionId; text: string };

const MAX_ERROR_LIST = 4;

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function makePaneId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `pane-${Math.random().toString(36).slice(2)}`;
}

export function ImportModal({ range, onImport, onClose }: ImportModalProps) {
  const orderedActions = useMemo(
    () => [...range.actions].sort((a, b) => a.order - b.order),
    [range.actions],
  );

  const [panes, setPanes] = useState<Pane[]>(() =>
    orderedActions.map((a) => ({ id: makePaneId(), actionId: a.id, text: '' })),
  );
  const [replace, setReplace] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const firstTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    firstTextareaRef.current?.focus();
    return () => {
      previouslyFocused.current?.focus?.();
    };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const root = dialogRef.current;
      if (!root) return;
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => !el.hasAttribute('aria-hidden') && el.offsetParent !== null);
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || !root.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !root.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const parsedByPane = useMemo(
    () => panes.map((p) => ({ pane: p, result: parseHandRange(p.text) })),
    [panes],
  );

  const totalHands = parsedByPane.reduce(
    (acc, { result }) => acc + result.hands.length,
    0,
  );

  const usedActionIds = useMemo(
    () => new Set(panes.map((p) => p.actionId)),
    [panes],
  );

  const nextAvailableAction = useMemo(
    () => orderedActions.find((a) => !usedActionIds.has(a.id)),
    [orderedActions, usedActionIds],
  );

  const canAddPane = nextAvailableAction !== undefined;
  const canRemove = panes.length > 1;

  const addPane = () => {
    if (!nextAvailableAction) return;
    setPanes((prev) => [
      ...prev,
      { id: makePaneId(), actionId: nextAvailableAction.id, text: '' },
    ]);
  };

  const removePane = (id: string) => {
    setPanes((prev) => (prev.length <= 1 ? prev : prev.filter((p) => p.id !== id)));
  };

  const updatePaneAction = (id: string, actionId: ActionId) => {
    setPanes((prev) => prev.map((p) => (p.id === id ? { ...p, actionId } : p)));
  };

  const updatePaneText = (id: string, text: string) => {
    setPanes((prev) => prev.map((p) => (p.id === id ? { ...p, text } : p)));
  };

  const handleImportClick = () => {
    if (totalHands === 0) return;
    const plans: ImportPlan[] = parsedByPane
      .filter(({ result }) => result.hands.length > 0)
      .map(({ pane, result }) => ({
        actionId: pane.actionId,
        hands: result.hands,
      }));
    onImport(plans, replace);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
        aria-describedby="import-desc"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col gap-3 rounded-xl border border-border bg-surface p-5 shadow-surface"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 id="import-title" className="text-base font-semibold text-content">
              Import range
            </h2>
            <p id="import-desc" className="text-xs text-content-muted">
              Paste one block per action. Each block is parsed independently and
              all are applied in a single step (one undo).
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close import"
            className="rounded-md p-1 text-content-muted hover:bg-surface-hover hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light"
          >
            <X className="h-4 w-4" strokeWidth={2.25} />
          </button>
        </div>

        <div className="flex max-h-[55vh] flex-col gap-3 overflow-y-auto pr-1">
          {parsedByPane.map(({ pane, result }, idx) => {
            const def = actionDefOf(range.actions, pane.actionId);
            const color = def?.color ?? '#9ca3af';
            return (
              <div
                key={pane.id}
                className="flex flex-col gap-2 rounded-md border border-border bg-bg/30 p-3"
              >
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="h-3 w-3 shrink-0 rounded-sm"
                    style={{ backgroundColor: color }}
                  />
                  <select
                    value={pane.actionId}
                    onChange={(e) => updatePaneAction(pane.id, e.target.value)}
                    aria-label={`Action for paste block ${idx + 1}`}
                    className="rounded-md border border-border bg-bg px-2 py-1 text-xs font-medium text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light"
                  >
                    {orderedActions.map((a) => (
                      <option
                        key={a.id}
                        value={a.id}
                        disabled={
                          a.id !== pane.actionId && usedActionIds.has(a.id)
                        }
                      >
                        {a.label}
                      </option>
                    ))}
                  </select>
                  <span className="ml-auto text-[11px] text-content-muted">
                    <span className="font-semibold text-content">
                      {result.hands.length}
                    </span>{' '}
                    hand{result.hands.length === 1 ? '' : 's'}
                    {result.errors.length > 0 && (
                      <>
                        {' · '}
                        <span className="text-danger">
                          {result.errors.length} unrecognized
                        </span>
                      </>
                    )}
                  </span>
                  {canRemove && (
                    <button
                      type="button"
                      onClick={() => removePane(pane.id)}
                      aria-label={`Remove paste block ${idx + 1}`}
                      className="rounded-md p-1 text-content-muted hover:bg-surface-hover hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} />
                    </button>
                  )}
                </div>

                <textarea
                  ref={idx === 0 ? firstTextareaRef : undefined}
                  value={pane.text}
                  onChange={(e) => updatePaneText(pane.id, e.target.value)}
                  rows={5}
                  spellCheck={false}
                  aria-label={`Paste tokens for ${def?.label ?? pane.actionId}`}
                  placeholder="AA,AKs,KK,[98%]AQs[/98%],88+,T9s-65s   —or—   AcKs: 0.78,AdKc: 1,…"
                  className="w-full resize-y rounded-md border border-border bg-bg px-3 py-2 font-mono text-xs text-content placeholder:text-content-disabled focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light"
                />

                {result.errors.length > 0 && (
                  <ul className="flex flex-col gap-0.5 text-[11px] text-content-muted">
                    {result.errors.slice(0, MAX_ERROR_LIST).map((err, i) => (
                      <li key={i}>
                        <span className="font-mono text-danger">{err.token}</span>
                        {' · '}
                        {err.reason}
                      </li>
                    ))}
                    {result.errors.length > MAX_ERROR_LIST && (
                      <li>+{result.errors.length - MAX_ERROR_LIST} more…</li>
                    )}
                  </ul>
                )}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={addPane}
          disabled={!canAddPane}
          className={cn(
            'inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light',
            canAddPane
              ? 'text-accent-light hover:bg-surface-hover'
              : 'cursor-not-allowed text-content-disabled',
          )}
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
          Add action
        </button>

        <label className="inline-flex items-center gap-2 text-xs text-content-muted">
          <input
            type="checkbox"
            checked={replace}
            onChange={(e) => setReplace(e.target.checked)}
            className="accent-accent-light"
          />
          Replace current range (clears existing cells first)
        </label>

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-content-muted hover:bg-surface-hover hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImportClick}
            disabled={totalHands === 0}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light',
              totalHands === 0
                ? 'cursor-not-allowed bg-surface-hover text-content-disabled'
                : 'bg-accent text-white hover:bg-accent-deep',
            )}
          >
            Import {totalHands > 0 && `(${totalHands})`}
          </button>
        </div>
      </div>
    </div>
  );
}
