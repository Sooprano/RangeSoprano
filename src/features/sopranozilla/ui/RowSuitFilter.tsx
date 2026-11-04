// Under the category weight: keep only the combos of the selected row with
// some suits ("Top pair con ♣ o ♦"), suited or offsuit — without building a
// custom filter. The suit buttons toggle and add up, like in the suit picker;
// «Todos los palos» brings them all back. It edits what the grid shows (the
// continuation of the EV row, or the start range), see `SopranozillaPage`.

import { cn } from '@/lib/cn';
import { ruleSuits, toggleSuit, type SuitRule } from './viewModel';

const SUITS = ['♠', '♥', '♦', '♣'] as const;
const SUIT_TEXT = [
  'text-slate-500 dark:text-slate-300',
  'text-red-600 dark:text-red-400',
  'text-blue-600 dark:text-blue-400',
  'text-green-600 dark:text-green-400',
] as const;

const btn =
  'rounded-md border px-1.5 py-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light';
const on = 'border-violet-500 bg-violet-500/15 text-content';
const off = 'border-border hover:bg-surface-hover';

type Props = {
  label: string;
  /** The rule in force (for the pressed buttons). */
  rule: SuitRule;
  onApply: (rule: SuitRule) => void;
};

export function RowSuitFilter({ label, rule, onApply }: Props) {
  const active = ruleSuits(rule);
  return (
    <div className="mt-3 border-t border-border pt-2 text-xs text-content-muted">
      <p className="mb-1">
        Dejar en <span className="text-content">«{label}»</span> solo los combos (los palos se
        suman):
      </p>
      <div className="flex flex-wrap gap-1">
        {SUITS.map((s, i) => (
          <button
            key={s}
            type="button"
            aria-pressed={active.includes(i)}
            onClick={() => onApply(toggleSuit(rule, i))}
            aria-label={`Combos con ${s}`}
            title={`Combos con ${s}`}
            className={cn(btn, 'text-sm', SUIT_TEXT[i], active.includes(i) ? on : off)}
          >
            con {s}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={rule.kind === 'suited'}
          onClick={() => onApply(rule.kind === 'suited' ? { kind: 'all' } : { kind: 'suited' })}
          className={cn(btn, rule.kind === 'suited' ? on : off)}
        >
          Suited
        </button>
        <button
          type="button"
          aria-pressed={rule.kind === 'offsuit'}
          onClick={() => onApply(rule.kind === 'offsuit' ? { kind: 'all' } : { kind: 'offsuit' })}
          className={cn(btn, rule.kind === 'offsuit' ? on : off)}
        >
          Offsuit
        </button>
        <button
          type="button"
          aria-pressed={rule.kind === 'all'}
          onClick={() => onApply({ kind: 'all' })}
          title="Devuelve todos los palos de la categoría"
          className={cn(btn, rule.kind === 'all' ? on : off)}
        >
          Todos los palos
        </button>
      </div>
    </div>
  );
}
