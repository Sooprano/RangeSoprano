import { useEffect, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useRangeStore } from '@/store/rangeStore';
import { MAX_ACTION_LABEL_LEN, MAX_ACTIONS_PER_RANGE } from '@/store/schemas';
import type { ActionDef, ActionId, Range } from '@/types/poker';
import { SortableItem, SortableList } from '@/components/dnd/SortableList';
import { ColorPicker } from './ColorPicker';

type ActionPaletteProps = {
  range: Range;
  activeAction: ActionId | null;
  onActiveActionChange: (id: ActionId) => void;
  className?: string;
};

export function ActionPalette({
  range,
  activeAction,
  onActiveActionChange,
  className,
}: ActionPaletteProps) {
  const addAction = useRangeStore((s) => s.addAction);
  const updateAction = useRangeStore((s) => s.updateAction);
  const deleteAction = useRangeStore((s) => s.deleteAction);
  const reorderActions = useRangeStore((s) => s.reorderActions);

  const sorted = useMemo(
    () => [...range.actions].sort((a, b) => a.order - b.order),
    [range.actions],
  );
  const ids = useMemo(() => sorted.map((d) => d.id), [sorted]);
  const atLimit = sorted.length >= MAX_ACTIONS_PER_RANGE;

  const [pickerOpenFor, setPickerOpenFor] = useState<ActionId | null>(null);

  const handleAdd = () => {
    if (atLimit) return;
    const newId = addAction(range.id);
    if (newId) onActiveActionChange(newId);
  };

  const handleDelete = (def: ActionDef) => {
    if (sorted.length === 1) {
      window.alert('A range must have at least one action.');
      return;
    }
    const usedInCells = Object.values(range.cells).some((c) =>
      c.actions.some((a) => a.action === def.id),
    );
    const msg = usedInCells
      ? `Delete "${def.label}" and remove it from every cell that uses it?`
      : `Delete "${def.label}"?`;
    if (!window.confirm(msg)) return;
    deleteAction(range.id, def.id);
    if (activeAction === def.id) {
      const next = sorted.find((a) => a.id !== def.id);
      if (next) onActiveActionChange(next.id);
    }
  };

  return (
    <aside
      aria-label="Range actions"
      className={cn(
        'flex flex-col gap-1.5 rounded-xl border border-border bg-surface/60 p-2',
        className,
      )}
    >
      <SortableList
        ids={ids}
        onReorder={(orderedIds) => reorderActions(range.id, orderedIds)}
      >
        <ul className="flex flex-col gap-1">
          {sorted.map((def) => (
            <li key={def.id} className="group">
              <SortableItem id={def.id} ariaLabel={`Drag ${def.label}`}>
                <ActionRow
                  def={def}
                  isActive={def.id === activeAction}
                  onSelect={() => onActiveActionChange(def.id)}
                  onLabelChange={(label) =>
                    updateAction(range.id, def.id, { label })
                  }
                  onColorChange={(color) =>
                    updateAction(range.id, def.id, { color })
                  }
                  onDelete={() => handleDelete(def)}
                  pickerOpen={pickerOpenFor === def.id}
                  onTogglePicker={() =>
                    setPickerOpenFor((prev) => (prev === def.id ? null : def.id))
                  }
                  onClosePicker={() => setPickerOpenFor(null)}
                />
              </SortableItem>
            </li>
          ))}
        </ul>
      </SortableList>

      <button
        type="button"
        onClick={handleAdd}
        disabled={atLimit}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium',
          'transition-colors duration-150 ease-out-soft',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light',
          atLimit
            ? 'cursor-not-allowed text-content-disabled'
            : 'text-accent hover:bg-surface-hover',
        )}
      >
        <Plus className="h-4 w-4" strokeWidth={2.25} />
        Agregar color
        {atLimit && (
          <span className="text-[10px] text-content-muted">
            (max {MAX_ACTIONS_PER_RANGE})
          </span>
        )}
      </button>
    </aside>
  );
}

type ActionRowProps = {
  def: ActionDef;
  isActive: boolean;
  onSelect: () => void;
  onLabelChange: (label: string) => void;
  onColorChange: (color: string) => void;
  onDelete: () => void;
  pickerOpen: boolean;
  onTogglePicker: () => void;
  onClosePicker: () => void;
};

function ActionRow({
  def,
  isActive,
  onSelect,
  onLabelChange,
  onColorChange,
  onDelete,
  pickerOpen,
  onTogglePicker,
  onClosePicker,
}: ActionRowProps) {
  const [draftLabel, setDraftLabel] = useState(def.label);

  useEffect(() => {
    setDraftLabel(def.label);
  }, [def.label]);

  const commitLabel = () => {
    const next = draftLabel.trim().slice(0, MAX_ACTION_LABEL_LEN);
    if (next.length === 0) {
      setDraftLabel(def.label);
      return;
    }
    if (next !== def.label) onLabelChange(next);
  };

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-lg px-1.5 py-1.5',
        isActive ? 'bg-accent/10' : 'hover:bg-surface-hover',
      )}
    >
      <input
        type="radio"
        name="active-action"
        checked={isActive}
        onChange={onSelect}
        aria-label={`Select ${def.label} as active action`}
        className="h-3.5 w-3.5 accent-accent-light"
      />

      <div className="relative">
        <button
          type="button"
          onClick={onTogglePicker}
          aria-label={`Color for ${def.label}`}
          className="block h-6 w-6 rounded-md ring-1 ring-black/30 transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-light"
          style={{ backgroundColor: def.color }}
        />
        {pickerOpen && (
          <ColorPicker
            value={def.color}
            onChange={onColorChange}
            onClose={onClosePicker}
          />
        )}
      </div>

      <input
        type="text"
        value={draftLabel}
        data-action-label={def.id}
        maxLength={MAX_ACTION_LABEL_LEN}
        onChange={(e) => setDraftLabel(e.target.value)}
        onBlur={commitLabel}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            (e.currentTarget as HTMLInputElement).blur();
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            setDraftLabel(def.label);
            (e.currentTarget as HTMLInputElement).blur();
          }
        }}
        aria-label={`Rename ${def.label}`}
        className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-sm text-content hover:border-border focus:border-accent-light focus:bg-bg focus:outline-none"
      />

      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${def.label}`}
        className="rounded-md p-1 text-content-muted opacity-0 transition-opacity hover:bg-surface hover:text-rose-400 focus-visible:opacity-100 group-hover:opacity-100"
      >
        <X className="h-3.5 w-3.5" strokeWidth={2.25} />
      </button>
    </div>
  );
}
