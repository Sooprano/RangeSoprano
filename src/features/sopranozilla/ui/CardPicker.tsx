// Card picker (D105): named slots on top (Mi mano ·
// Flop · Turn · River) and the 4×13 deck below. Pick a slot, then a card; a
// card on the table carries a corner tag (H / F / T / R) and the slot color,
// so it reads at a glance what each card is. Tapping a placed card takes it
// out and leaves its slot ready for the next one.

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { SUIT_BG } from '@/data/suitColors';
import { ENGINE_RANKS, fromCardId, makeCardId, type CardId } from '../engine/cards';
import {
  cardAt,
  clearSlot,
  nextEmpty,
  place,
  sameSlot,
  slotOf,
  slotsFromText,
  slotsToText,
  streetOfBoardSlot,
  type SlotKey,
  type Slots,
  type Street,
} from './cardSlots';

// Deck rows: ♥ ♣ ♦ ♠ (engine suit index: 1, 3, 2, 0).
const ROWS = [
  { suit: 1, symbol: '♥' },
  { suit: 3, symbol: '♣' },
  { suit: 2, symbol: '♦' },
  { suit: 0, symbol: '♠' },
] as const;
const RANKS_DESC = [...ENGINE_RANKS].reverse();

type Group = Street | 'hero';

/** Colors of «Equity por calle» for the streets; amber for Hero. */
const RING: Record<Group, string> = {
  hero: 'ring-amber-400',
  flop: 'ring-sky-400',
  turn: 'ring-indigo-400',
  river: 'ring-fuchsia-400',
};
const TEXT: Record<Group, string> = {
  hero: 'text-amber-600 dark:text-amber-300',
  flop: 'text-sky-600 dark:text-sky-300',
  turn: 'text-indigo-600 dark:text-indigo-300',
  river: 'text-fuchsia-600 dark:text-fuchsia-300',
};
const TAG_BG: Record<Group, string> = {
  hero: 'bg-amber-400',
  flop: 'bg-sky-400',
  turn: 'bg-indigo-400',
  river: 'bg-fuchsia-400',
};
const TAG: Record<Group, string> = { hero: 'H', flop: 'F', turn: 'T', river: 'R' };
const LABEL: Record<Group, string> = { hero: 'Mi mano', flop: 'Flop', turn: 'Turn', river: 'River' };

const groupOf = (k: SlotKey): Group => (k.kind === 'hero' ? 'hero' : streetOfBoardSlot(k.i));

type Props = {
  hero: string;
  board: string;
  onChange: (next: { hero: string; board: string }) => void;
};

function Face({ id }: { id: CardId }) {
  const c = fromCardId(id);
  return (
    <span
      className="flex h-11 w-8 flex-col items-center justify-center rounded text-white shadow-sm"
      style={{ backgroundColor: SUIT_BG[c.suit] }}
    >
      <span className="text-base font-bold leading-none">{c.rank}</span>
      <span className="text-[9px] leading-none text-white/70">{c.suit}</span>
    </span>
  );
}

/** The card taken out of a slot flies off up and to the right (D105). */
function LiftingCard({ id, onDone }: { id: CardId; onDone: () => void }) {
  const ref = useRef<HTMLSpanElement>(null);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);
  useEffect(() => {
    const el = ref.current;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!el || reduce || typeof el.animate !== 'function') {
      done.current();
      return;
    }
    const a = el.animate(
      [
        { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
        { transform: 'translate(16px, -26px) rotate(16deg)', opacity: 0 },
      ],
      { duration: 300, easing: 'ease-out', fill: 'forwards' },
    );
    a.onfinish = () => done.current();
    return () => a.cancel();
  }, []);
  return (
    <span ref={ref} aria-hidden className="pointer-events-none absolute left-0.5 top-0.5 z-10">
      <Face id={id} />
    </span>
  );
}

const keyOf = (k: SlotKey) => `${k.kind}${k.i}`;

export function CardPicker({ hero, board, onChange }: Props) {
  const [slots, setSlots] = useState<Slots>(() => slotsFromText(hero, board));
  // The text fields of «Mano de prueba» can change the cards too: follow them.
  const [seen, setSeen] = useState({ hero, board });
  if (seen.hero !== hero || seen.board !== board) {
    setSeen({ hero, board });
    const mine = slotsToText(slots);
    if (mine.hero !== hero || mine.board !== board) setSlots(slotsFromText(hero, board));
  }
  const [active, setActive] = useState<SlotKey | null>(() =>
    nextEmpty(slotsFromText(hero, board)),
  );

  // Card leaving a slot, for the lift-off animation.
  const [leaving, setLeaving] = useState<{ key: string; id: CardId; n: number } | null>(null);
  const takeOut = (k: SlotKey) => {
    const id = cardAt(slots, k);
    if (id === null) return;
    setLeaving((l) => ({ key: keyOf(k), id, n: (l?.n ?? 0) + 1 }));
    commit(clearSlot(slots, k), k);
  };

  const commit = (next: Slots, nextActive: SlotKey | null) => {
    setSlots(next);
    setActive(nextActive);
    const t = slotsToText(next);
    setSeen(t);
    onChange(t);
  };

  const pick = (id: CardId) => {
    const at = slotOf(slots, id);
    if (at) {
      // Placed card: take it out; its slot is the next one to fill.
      takeOut(at);
      return;
    }
    const target = active ?? nextEmpty(slots);
    if (!target) return;
    const next = place(slots, target, id);
    commit(next, nextEmpty(next, target));
  };

  const clearAll = (kind: 'hero' | 'board') => {
    const next: Slots =
      kind === 'hero'
        ? { ...slots, hero: [null, null] }
        : { ...slots, board: [null, null, null, null, null] };
    commit(next, nextEmpty(next, { kind, i: 0 }));
  };

  const slotButton = (k: SlotKey) => {
    const id = cardAt(slots, k);
    const g = groupOf(k);
    const isActive = sameSlot(active, k);
    return (
      <button
        key={keyOf(k)}
        type="button"
        aria-pressed={isActive}
        aria-label={`${LABEL[g]} ${k.kind === 'board' && g === 'flop' ? k.i + 1 : ''}: ${id === null ? 'vacío' : 'ocupado'}${isActive ? ', se llena ahora' : ''}`}
        // A filled slot gives its card back and waits for the new one.
        onClick={() => (id !== null ? takeOut(k) : setActive(k))}
        title={id !== null ? 'Quitar esta carta y elegir otra' : 'Elegir la carta de este hueco'}
        className={cn(
          'relative rounded-md p-0.5 ring-2 ring-offset-1 ring-offset-bg transition',
          id !== null || isActive ? RING[g] : 'ring-transparent',
          isActive && 'scale-105 shadow-[0_0_0_4px_rgb(139_92_246/0.35)]',
        )}
      >
        {id !== null ? (
          <Face id={id} />
        ) : (
          <span
            className={cn(
              'flex h-11 w-8 items-center justify-center rounded border border-dashed text-sm',
              isActive ? 'border-violet-400 text-violet-400' : 'border-border text-content-disabled',
            )}
          >
            +
          </span>
        )}
        {leaving?.key === keyOf(k) && (
          <LiftingCard key={leaving.n} id={leaving.id} onDone={() => setLeaving(null)} />
        )}
      </button>
    );
  };

  const group = (g: Group, keys: SlotKey[]) => (
    <div className="flex flex-col items-start gap-1">
      <span className={cn('text-[11px] font-semibold uppercase tracking-wide', TEXT[g])}>
        {LABEL[g]}
      </span>
      <div className="flex gap-1">{keys.map(slotButton)}</div>
    </div>
  );

  const full = nextEmpty(slots) === null && active === null;

  return (
    <div className="rounded-lg border border-border p-2">
      <div className="mb-2 flex flex-wrap items-end gap-4">
        {group('hero', [
          { kind: 'hero', i: 0 },
          { kind: 'hero', i: 1 },
        ])}
        {group('flop', [
          { kind: 'board', i: 0 },
          { kind: 'board', i: 1 },
          { kind: 'board', i: 2 },
        ])}
        {group('turn', [{ kind: 'board', i: 3 }])}
        {group('river', [{ kind: 'board', i: 4 }])}
        <div className="ml-auto flex gap-1">
          <button
            type="button"
            onClick={() => clearAll('board')}
            className="rounded-md px-2 py-1 text-xs text-content-muted hover:bg-surface-hover hover:text-content"
          >
            Vaciar board
          </button>
          <button
            type="button"
            onClick={() => clearAll('hero')}
            className="rounded-md px-2 py-1 text-xs text-content-muted hover:bg-surface-hover hover:text-content"
          >
            Vaciar mi mano
          </button>
        </div>
      </div>
      <p className="mb-2 text-[11px] text-content-muted">
        {active
          ? `Toca una carta para ponerla en ${LABEL[groupOf(active)]}${active.kind === 'board' && groupOf(active) === 'flop' ? ` (${active.i + 1}ª)` : ''}. `
          : 'Toca una carta de arriba para quitarla y elegir otra. '}
        Tocar una carta ya puesta la quita.
      </p>
      <div className="flex flex-col gap-1 overflow-x-auto">
        {ROWS.map((row) => (
          <div key={row.suit} className="flex gap-1">
            {RANKS_DESC.map((rank) => {
              const id = makeCardId(ENGINE_RANKS.indexOf(rank), row.suit);
              const at = slotOf(slots, id);
              const g = at ? groupOf(at) : null;
              const c = fromCardId(id);
              return (
                <button
                  key={rank}
                  type="button"
                  aria-pressed={at !== null}
                  aria-label={`${rank}${row.symbol}${g ? ` (${LABEL[g].toLowerCase()})` : ''}`}
                  disabled={!at && full}
                  onClick={() => pick(id)}
                  className={cn(
                    'relative flex h-8 w-8 shrink-0 items-center justify-center rounded text-[11px] font-semibold text-white transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400',
                    g
                      ? cn('ring-2 ring-offset-1 ring-offset-bg', RING[g])
                      : full
                        ? 'opacity-30'
                        : 'opacity-60 hover:opacity-100',
                  )}
                  style={{ backgroundColor: SUIT_BG[c.suit] }}
                >
                  {rank}
                  {row.symbol}
                  {g && (
                    <span
                      aria-hidden
                      className={cn(
                        'absolute -right-1 -top-1 rounded px-0.5 text-[9px] font-bold leading-tight text-slate-950',
                        TAG_BG[g],
                      )}
                    >
                      {TAG[g]}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
