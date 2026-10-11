import { useState } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { ActionDef, ActionId } from '@/types/poker';
import { actionColor, actionLabel } from '@/utils/actionMeta';
import { formatFrequency, type TrainerDraw } from '@/utils/trainerSource';
import { stackLabelOf } from '@/utils/rangeStack';

export type ClassicMistake = { draw: TrainerDraw; picked: ActionId };

/**
 * Collapsible list of the session's misses (answers with 0% frequency), shared
 * by Speed (results screen) and Classic (live, under the table).
 *
 * `live` is for a list that grows WHILE you train: newest miss first, and the
 * body scrolls inside a fixed max height so a new row never changes the height
 * of the page. It also keeps the header on screen with a 0 count, so the first
 * miss changes a number instead of making a panel pop in.
 */
export function SessionErrorsPanel({
  mistakes,
  answerActions,
  showRange,
  live = false,
}: {
  mistakes: ClassicMistake[];
  /** The session's answer palette — resolves what the player picked. */
  answerActions: ActionDef[];
  /** Folder sessions mix ranges, so each miss names the range it came from. */
  showRange: boolean;
  live?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const empty = mistakes.length === 0;
  const rows = live ? [...mistakes].reverse() : mistakes;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface/40">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-content hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-accent-light"
      >
        <span className="flex items-center gap-2">
          <X
            className={cn('h-4 w-4', empty ? 'text-content-muted' : 'text-rose-400')}
            strokeWidth={2.5}
          />
          Errores de sesión
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums',
              empty
                ? 'bg-surface text-content-muted'
                : 'bg-rose-500/15 text-rose-300',
            )}
          >
            {mistakes.length}
          </span>
        </span>
        {open
          ? <ChevronUp className="h-4 w-4 text-content-muted" strokeWidth={2} />
          : <ChevronDown className="h-4 w-4 text-content-muted" strokeWidth={2} />}
      </button>

      {open && (
        <div
          className={cn(
            'border-t border-border px-4 py-3',
            live && 'max-h-64 overflow-y-auto',
          )}
        >
          {empty ? (
            <p className="text-xs text-content-muted">
              Sin errores en esta sesión.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {/* Both sides live in the session's answer space (merged label keys
                  in a folder), so they resolve against the same palette. */}
              {rows.map(({ draw, picked }, i) => {
                return (
                  <div
                    // Keyed from the oldest miss so a new row mounts on top
                    // without remounting the ones already listed.
                    key={live ? mistakes.length - 1 - i : i}
                    className="flex items-center gap-3 rounded-lg border border-border bg-surface/60 px-3 py-2 text-sm"
                  >
                    <span className="w-8 shrink-0 font-mono font-semibold text-content">
                      {draw.hand.hand}
                    </span>
                    <span className="flex items-center gap-1.5 text-rose-400">
                      <span
                        aria-hidden
                        className="h-2.5 w-2.5 shrink-0 rounded-sm"
                        style={{ backgroundColor: actionColor(answerActions, picked) }}
                      />
                      {actionLabel(answerActions, picked)}
                    </span>
                    <span className="text-content-muted">→</span>
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <span
                        aria-hidden
                        className="h-2.5 w-2.5 shrink-0 rounded-sm"
                        style={{
                          backgroundColor: actionColor(answerActions, draw.strategy.bestKey),
                        }}
                      />
                      {actionLabel(answerActions, draw.strategy.bestKey)}
                      <span className="tabular-nums text-content-muted">
                        {formatFrequency(draw.strategy.bestWeight)}
                      </span>
                    </span>
                    {showRange && (
                      <span className="ml-auto truncate rounded-full bg-surface px-2 py-0.5 text-xs text-content-muted">
                        {stackLabelOf(draw.range) ?? draw.range.name}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
