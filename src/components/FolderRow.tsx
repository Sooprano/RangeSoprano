import { ChevronDown, ChevronRight, Folder, FolderOpen } from 'lucide-react';
import { GroupColorPicker } from './GroupColorPicker';
import type { GroupTreeNode } from '@/utils/groupUtils';
import type { GroupMeta } from '@/store/schemas';

type Props = {
  node: GroupTreeNode;
  meta: GroupMeta | undefined;
  forceExpand?: boolean;
  onToggleCollapse: () => void;
  onColorDotClick?: () => void;
  colorPickerOpen?: boolean;
  onColorChange?: (color: string | undefined) => void;
  onColorPickerClose?: () => void;
  trailing?: React.ReactNode;
};

export function FolderRow({
  node,
  meta,
  forceExpand = false,
  onToggleCollapse,
  onColorDotClick,
  colorPickerOpen = false,
  onColorChange,
  onColorPickerClose,
  trailing,
}: Props) {
  const isCollapsed = !forceExpand && (meta?.collapsed ?? false);
  const color = meta?.color;

  return (
    <div
      className="relative flex items-center gap-1"
      style={{ paddingLeft: node.depth * 16 }}
    >
      <button
        type="button"
        onClick={onToggleCollapse}
        aria-expanded={!isCollapsed}
        aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${node.label}`}
        className="flex flex-1 items-center gap-1.5 rounded-md px-1 py-0.5 text-left text-[10px] font-semibold uppercase tracking-wider text-content-muted hover:bg-surface-hover hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light"
      >
        {isCollapsed ? (
          <ChevronRight className="h-3 w-3 shrink-0 text-content-disabled" strokeWidth={2.5} />
        ) : (
          <ChevronDown className="h-3 w-3 shrink-0 text-content-disabled" strokeWidth={2.5} />
        )}
        {isCollapsed ? (
          <Folder className="h-3 w-3 shrink-0" strokeWidth={2} />
        ) : (
          <FolderOpen className="h-3 w-3 shrink-0" strokeWidth={2} />
        )}
        <span className="truncate">{node.label}</span>
      </button>

      {onColorDotClick ? (
        <div className="relative mr-1 shrink-0">
          <button
            type="button"
            aria-label={`Set color for ${node.label}`}
            onClick={onColorDotClick}
            className="block h-3 w-3 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light"
            style={
              color
                ? { backgroundColor: color }
                : { border: '1.5px dashed currentColor', color: 'var(--color-text-muted)' }
            }
          />
          {colorPickerOpen && onColorChange && onColorPickerClose && (
            <GroupColorPicker
              currentColor={color}
              onChange={onColorChange}
              onClose={onColorPickerClose}
            />
          )}
        </div>
      ) : color ? (
        <span
          className="mr-1 h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
      ) : null}
      {trailing}
    </div>
  );
}
