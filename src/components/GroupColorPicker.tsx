import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { GROUP_FOLDER_COLORS } from '@/store/schemas';

type Props = {
  currentColor: string | undefined;
  onChange: (color: string | undefined) => void;
  onClose: () => void;
};

export function GroupColorPicker({ currentColor, onChange, onClose }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('mousedown', handleDown);
    window.addEventListener('keydown', handleKey, true);
    return () => {
      window.removeEventListener('mousedown', handleDown);
      window.removeEventListener('keydown', handleKey, true);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute left-0 top-full z-30 mt-1 rounded-lg border border-border bg-surface p-2 shadow-surface"
    >
      <div className="grid grid-cols-4 gap-1.5">
        {GROUP_FOLDER_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={color}
            aria-pressed={currentColor === color}
            onClick={() => {
              onChange(color);
              onClose();
            }}
            className="h-5 w-5 rounded-full transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light"
            style={{
              backgroundColor: color,
              outline: currentColor === color ? `2px solid ${color}` : undefined,
              outlineOffset: currentColor === color ? 2 : undefined,
            }}
          />
        ))}
        <button
          type="button"
          aria-label="Clear color"
          onClick={() => {
            onChange(undefined);
            onClose();
          }}
          className="flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-content-muted text-content-muted transition-colors hover:border-content hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light"
        >
          <X className="h-3 w-3" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
