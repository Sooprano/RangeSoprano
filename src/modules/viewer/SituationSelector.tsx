import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { POSITIONS, SITUATIONS, type Position, type Situation } from '@/types/poker';

export type ViewerFilters = {
  position: Position | null;
  situation: Situation | null;
  villainPosition: Position | null;
};

export const EMPTY_FILTERS: ViewerFilters = {
  position: null,
  situation: null,
  villainPosition: null,
};

const SITUATION_LABEL: Record<Situation, string> = {
  RFI: 'RFI',
  vs_RFI: 'vs RFI',
  vs_3BET: 'vs 3-Bet',
  vs_4BET: 'vs 4-Bet',
  SQUEEZE: 'Squeeze',
  DEFEND_BB: 'Defend BB',
};

type SituationSelectorProps = {
  filters: ViewerFilters;
  onChange: (filters: ViewerFilters) => void;
  className?: string;
};

export function hasAnyFilter(f: ViewerFilters): boolean {
  return (
    f.position !== null || f.situation !== null || f.villainPosition !== null
  );
}

export function matchesFilters<
  T extends {
    position: Position;
    situation: Situation;
    villainPosition?: Position | undefined;
  },
>(r: T, f: ViewerFilters): boolean {
  if (f.position !== null && r.position !== f.position) return false;
  if (f.situation !== null && r.situation !== f.situation) return false;
  if (f.villainPosition !== null && r.villainPosition !== f.villainPosition) {
    return false;
  }
  return true;
}

const villainDisabled = (s: Situation | null) => s === 'RFI';

export function SituationSelector({
  filters,
  onChange,
  className,
}: SituationSelectorProps) {
  const disabledVillain = villainDisabled(filters.situation);

  const handlePosition = (v: string) =>
    onChange({
      ...filters,
      position: v === '' ? null : (v as Position),
    });

  const handleSituation = (v: string) => {
    const next = v === '' ? null : (v as Situation);
    onChange({
      ...filters,
      situation: next,
      villainPosition: villainDisabled(next) ? null : filters.villainPosition,
    });
  };

  const handleVillain = (v: string) =>
    onChange({
      ...filters,
      villainPosition: v === '' ? null : (v as Position),
    });

  const clear = () => onChange(EMPTY_FILTERS);
  const anyActive = hasAnyFilter(filters);

  return (
    <div
      role="group"
      aria-label="Filter ranges"
      className={cn(
        'flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface/60 p-3',
        className,
      )}
    >
      <Field label="Position">
        <select
          value={filters.position ?? ''}
          onChange={(e) => handlePosition(e.target.value)}
          className={selectClass}
          aria-label="Filter by hero position"
        >
          <option value="">Any</option>
          {POSITIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Situation">
        <select
          value={filters.situation ?? ''}
          onChange={(e) => handleSituation(e.target.value)}
          className={selectClass}
          aria-label="Filter by situation"
        >
          <option value="">Any</option>
          {SITUATIONS.map((s) => (
            <option key={s} value={s}>
              {SITUATION_LABEL[s]}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Villain">
        <select
          value={filters.villainPosition ?? ''}
          onChange={(e) => handleVillain(e.target.value)}
          disabled={disabledVillain}
          className={cn(selectClass, disabledVillain && 'cursor-not-allowed opacity-40')}
          aria-label="Filter by villain position"
        >
          <option value="">Any</option>
          {POSITIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </Field>

      {anyActive && (
        <button
          type="button"
          onClick={clear}
          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-content-muted hover:bg-surface-hover hover:text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
        >
          <X className="h-3 w-3" strokeWidth={2.25} />
          Clear
        </button>
      )}
    </div>
  );
}

const selectClass =
  'rounded-md border border-border bg-bg px-2 py-1 text-sm text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light';

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-content-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
