import { cn } from '@/lib/cn';

type WeightSliderProps = {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  className?: string;
};

const STEP = 5;

export function WeightSlider({
  value,
  onChange,
  disabled = false,
  className,
}: WeightSliderProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border border-border bg-surface/60 px-3 py-2',
        className,
      )}
    >
      <label
        htmlFor="weight-slider"
        className="text-xs font-medium uppercase tracking-wider text-content-muted"
      >
        Weight
      </label>
      <input
        id="weight-slider"
        type="range"
        min={0}
        max={100}
        step={STEP}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cn(
          'h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-border accent-accent-light',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light',
          disabled && 'cursor-not-allowed opacity-50',
        )}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
      />
      <span className="w-10 text-right text-sm font-semibold tabular-nums text-content">
        {value}%
      </span>
    </div>
  );
}
