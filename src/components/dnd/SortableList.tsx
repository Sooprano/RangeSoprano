import { useId, type ReactNode } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/cn';

type SortableListProps = {
  ids: string[];
  onReorder: (orderedIds: string[]) => void;
  children: ReactNode;
};

export function SortableList({ ids, onReorder, children }: SortableListProps) {
  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = ids.indexOf(String(active.id));
    const newIdx = ids.indexOf(String(over.id));
    if (oldIdx < 0 || newIdx < 0) return;
    onReorder(arrayMove(ids, oldIdx, newIdx));
  };

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

type SortableItemProps = {
  id: string;
  className?: string;
  handleClassName?: string;
  ariaLabel?: string;
  children: ReactNode;
};

export function SortableItem({
  id,
  className,
  handleClassName,
  ariaLabel = 'Drag to reorder',
  children,
}: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className={cn('relative flex items-stretch', className)}>
      <button
        type="button"
        aria-label={ariaLabel}
        {...attributes}
        {...listeners}
        className={cn(
          'flex shrink-0 cursor-grab items-center px-1 text-content-disabled opacity-0 hover:text-content-muted group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light active:cursor-grabbing',
          handleClassName,
        )}
        tabIndex={0}
      >
        <GripVertical className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
