import { useId, useState, type FormEvent } from 'react';
import { cn } from '@/lib/cn';
import { POSITIONS, SITUATIONS, type Position, type Situation } from '@/types/poker';
import { sanitizeText, MAX_NAME_LEN } from '@/store/schemas';

const SITUATION_LABELS: Record<Situation, string> = {
  RFI: 'RFI',
  vs_RFI: 'vs RFI',
  vs_3BET: 'vs 3-Bet',
  vs_4BET: 'vs 4-Bet',
  SQUEEZE: 'Squeeze',
  DEFEND_BB: 'Defend BB',
};

export type NewRangePayload = {
  name: string;
  position: Position;
  situation: Situation;
};

type NewRangeFormProps = {
  onCreate: (payload: NewRangePayload) => void;
  onCancel: () => void;
  className?: string;
};

export function NewRangeForm({ onCreate, onCancel, className }: NewRangeFormProps) {
  const nameId = useId();
  const positionId = useId();
  const situationId = useId();

  const [name, setName] = useState('');
  const [position, setPosition] = useState<Position>('BTN');
  const [situation, setSituation] = useState<Situation>('RFI');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const cleanName = sanitizeText(name).slice(0, MAX_NAME_LEN);
    if (cleanName.length === 0) {
      setError('Name is required.');
      return;
    }
    setError(null);
    onCreate({ name: cleanName, position, situation });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-border bg-surface/60 p-3',
        className,
      )}
    >
      <div className="flex flex-col gap-1">
        <label htmlFor={nameId} className="text-xs font-medium text-content-muted">
          Name
        </label>
        <input
          id={nameId}
          type="text"
          autoFocus
          value={name}
          maxLength={MAX_NAME_LEN}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. BTN RFI 2.5x"
          className="rounded-md border border-border bg-bg px-2.5 py-1.5 text-sm text-content placeholder:text-content-disabled focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={positionId} className="text-xs font-medium text-content-muted">
            Position
          </label>
          <select
            id={positionId}
            value={position}
            onChange={(e) => setPosition(e.target.value as Position)}
            className="rounded-md border border-border bg-bg px-2 py-1.5 text-sm text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light"
          >
            {POSITIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={situationId} className="text-xs font-medium text-content-muted">
            Situation
          </label>
          <select
            id={situationId}
            value={situation}
            onChange={(e) => setSituation(e.target.value as Situation)}
            className="rounded-md border border-border bg-bg px-2 py-1.5 text-sm text-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light"
          >
            {SITUATIONS.map((s) => (
              <option key={s} value={s}>
                {SITUATION_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-content-muted hover:bg-surface-hover hover:text-content"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-accent-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-light"
        >
          Create
        </button>
      </div>
    </form>
  );
}
