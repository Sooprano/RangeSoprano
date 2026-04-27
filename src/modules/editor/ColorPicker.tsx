import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { GROUP_FOLDER_COLORS } from '@/store/schemas';

type ColorPickerProps = {
  value: string;
  onChange: (color: string) => void;
  onClose: () => void;
  className?: string;
};

const PALETTE: readonly string[] = [
  ...GROUP_FOLDER_COLORS,
  '#ffffff',
  '#000000',
];

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export function ColorPicker({ value, onChange, onClose, className }: ColorPickerProps) {
  const [hex, setHex] = useState(value);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setHex(value);
  }, [value]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const tryCommitHex = (raw: string) => {
    setHex(raw);
    const trimmed = raw.trim();
    if (HEX_RE.test(trimmed)) onChange(trimmed);
  };

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-label="Pick color"
      className={cn(
        'absolute right-0 top-full z-30 mt-1 flex w-[208px] flex-col gap-2',
        'rounded-xl border border-border bg-surface p-2 shadow-surface',
        className,
      )}
    >
      <div className="grid grid-cols-6 gap-1.5">
        {PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Use ${c}`}
            aria-pressed={c.toLowerCase() === value.toLowerCase()}
            onClick={() => onChange(c)}
            className={cn(
              'h-6 w-6 rounded-md ring-1 ring-black/30 transition-transform hover:scale-110',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-light',
              c.toLowerCase() === value.toLowerCase() &&
                'ring-2 ring-accent ring-offset-1 ring-offset-surface',
            )}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      <label className="flex items-center gap-1.5 text-[11px] text-content-muted">
        <span>Hex</span>
        <input
          type="text"
          value={hex}
          maxLength={9}
          onChange={(e) => tryCommitHex(e.target.value)}
          className="flex-1 rounded-md border border-border bg-bg px-1.5 py-1 font-mono text-xs text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light"
          placeholder="#06b6d4"
        />
      </label>
    </div>
  );
}
