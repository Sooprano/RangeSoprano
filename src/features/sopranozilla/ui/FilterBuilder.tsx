// Custom filter builder (§6.2), in a dialog over the page (D99): elements on
// the left, the expression with nested groups in the middle, and on the right
// the live grid (the page renders it, highlighting the draft) plus the
// preview. Elements go in by click (into the active group) or by dragging
// them onto a group.

import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from 'react';
import { ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { ENGINE_RANKS, formatCard, fromCardId, type CardId, type EngineRank } from '../engine/cards';
import {
  AGGREGATE_CATEGORIES,
  CATEGORY_INFO,
  COMBO_DRAW_CATEGORIES,
  DRAW_CATEGORIES,
  isCategoryId,
  MADE_CATEGORIES,
  type CategoryId,
} from '../engine/categories';
import type { StreetView } from '../engine/chain';
import { classOfCombo, COMBO_COUNT } from '../engine/combos';
import {
  CircularFilterError,
  describeExpr,
  describeModifier,
  exprMatches,
  makeFilterContext,
  type CustomFilter,
  type FilterExpr,
  type FilterIssue,
  type SuitRule,
} from '../engine/filterExpr';
import { modifierAppliesTo, type Modifier, type ModifierKind } from '../engine/modifiers';
import { useFiltersStore } from '../store/filtersStore';
import {
  defaultModifier,
  EMPTY_ROOT,
  ensureWorkspace,
  EXCLUDE_PATH,
  INCLUDE_PATH,
  isWorkspaceGroup,
  workspaceOf,
  getAt,
  insertInto,
  isContainer,
  normalizeExpr,
  removeAt,
  updateAt,
  type Path,
} from './builderModel';
import { combos as fmtCombos, pct } from './format';
import { filterComboBreakdown, type FilterComboCell } from './viewModel';
import { SUIT_BG } from '@/data/suitColors';
import type { HandNotation } from '@/types/poker';
import { SzDialog } from './SzDialog';

type Props = {
  /** The filter being edited, or null for a new one. */
  initial: CustomFilter | null;
  filters: readonly CustomFilter[];
  view: StreetView;
  /** The normalized draft, for the grid highlight (null = nothing yet). */
  onDraft: (expr: FilterExpr | null) => void;
  onSaved: (filter: CustomFilter) => void;
  onClose: () => void;
  /** The page's grid, highlighting the draft; `onHover` feeds the suit breakdown (D108). */
  renderGrid?: (onHover: (hand: HandNotation | null) => void) => ReactNode;
};

function MiniCard({ id }: { id: CardId }) {
  const c = fromCardId(id);
  return (
    <span
      className="inline-flex h-5 w-4 items-center justify-center rounded-sm text-[10px] font-bold leading-none text-white"
      style={{ backgroundColor: SUIT_BG[c.suit] }}
    >
      {c.rank}
    </span>
  );
}

/** Which suits of the hovered hand the draft keeps (D108). */
function ComboBreakdown({ hand, cells }: { hand: HandNotation | null; cells: FilterComboCell[] }) {
  if (!hand) {
    return (
      <p className="text-content-muted">
        Pasa el cursor por una mano del grid para ver <b>qué palos</b> cumplen el filtro.
      </p>
    );
  }
  const inRange = cells.filter((c) => !c.blocked && c.weight > 0);
  const pass = inRange.filter((c) => c.passes);
  return (
    <>
      <p>
        <b className="text-content">{hand}</b> ·{' '}
        <span className="tabular-nums text-violet-700 dark:text-violet-300">{pass.length}</span>{' '}
        de {inRange.length} combos del rango cumplen
      </p>
      <ul className="mt-1.5 flex flex-wrap gap-1">
        {cells.map((c) => {
          const out = !c.blocked && c.weight <= 0;
          const label = c.cards.map((id) => formatCard(id)).join('');
          return (
            <li
              key={c.combo}
              title={
                c.blocked
                  ? `${label}: bloqueado por tus cartas o el board`
                  : out
                    ? `${label}: fuera del rango`
                    : `${label}: ${c.passes ? 'cumple' : 'no cumple'}`
              }
              className={cn(
                'flex items-center gap-0.5 rounded px-1 py-0.5 ring-1',
                c.blocked
                  ? 'line-through opacity-25 ring-border'
                  : out
                    ? 'opacity-35 ring-border'
                    : c.passes
                      ? 'bg-violet-500/20 ring-violet-400'
                      : 'ring-border',
              )}
            >
              <MiniCard id={c.cards[0]} />
              <MiniCard id={c.cards[1]} />
              <span
                className={cn(
                  'w-3 text-center text-[11px] font-bold',
                  c.passes ? 'text-violet-700 dark:text-violet-300' : 'text-content-disabled',
                )}
              >
                {c.blocked || out ? '' : c.passes ? '✓' : '✗'}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-1 text-[10px] text-content-disabled">
        Violeta ✓ cumple · ✗ no cumple · tenue = fuera del rango · tachado = bloqueado
      </p>
    </>
  );
}

type PaletteItem = { key: string; label: string; hint: string; node: FilterExpr };

const leaf = (category: string): FilterExpr => ({ type: 'leaf', category });
const catItem = (c: CategoryId): PaletteItem => ({
  key: c,
  label: CATEGORY_INFO[c].label,
  hint: CATEGORY_INFO[c].definition,
  node: leaf(c),
});

const BASE_PALETTE: { label: string; items: PaletteItem[] }[] = [
  {
    // Ready-made elements with their modifier already set (D100).
    label: 'Atajos',
    items: [
      {
        key: 'nut-fd',
        label: 'Nut FD',
        hint: 'Flush draw (1 o 2 cartas) al nuts: «Flush draw» + «Top N al nuts» = 1.',
        node: { type: 'leaf', category: 'any-fd', modifiers: [{ kind: 'nutRankMax', k: 1 }] },
      },
      {
        key: 'top3-fd',
        label: 'Top 3 FD',
        hint: 'Flush draw a uno de los 3 mejores colores posibles: «Flush draw» + «Top N al nuts» = 3.',
        node: { type: 'leaf', category: 'any-fd', modifiers: [{ kind: 'nutRankMax', k: 3 }] },
      },
      {
        key: 'top3-bdfd',
        label: 'Top 3 BDFD',
        hint: 'Backdoor flush draw a uno de los 3 mejores colores: «BDFD» + «Top N al nuts» = 3.',
        node: { type: 'leaf', category: 'any-bdfd', modifiers: [{ kind: 'nutRankMax', k: 3 }] },
      },
    ],
  },
  { label: 'Manos hechas', items: MADE_CATEGORIES.map(catItem) },
  { label: 'Proyectos', items: DRAW_CATEGORIES.map(catItem) },
  { label: 'Combo draws', items: COMBO_DRAW_CATEGORIES.map(catItem) },
  { label: 'Agrupados', items: AGGREGATE_CATEGORIES.map(catItem) },
  {
    label: 'Negados',
    items: [
      {
        key: 'not-fd',
        label: 'Sin flush draw',
        hint: 'Combos sin FD de 1 ni de 2 cartas.',
        node: { type: 'not', child: leaf('any-fd') },
      },
      {
        key: 'not-pair',
        label: 'Sin par',
        hint: 'Combos sin pareja ni nada mejor.',
        node: { type: 'not', child: leaf('pair-or-better') },
      },
    ],
  },
];

/** Name and a one-line explanation of each modifier (D100). */
const MODIFIER_INFO: Record<ModifierKind, { label: string; help: string }> = {
  nutRankMax: {
    label: 'Top N al nuts (color)',
    help: 'Colores y proyectos de color: 1 = al nuts, 2 = segundo mejor, 3 = tercero… Ej.: FD 2 cartas + 3 = top 3 FD.',
  },
  kickerMin: {
    label: 'Kicker mínimo',
    help: 'Pares con una carta y tríos: el kicker es al menos este valor. Ej.: Top pair + Q = top pair con kicker Q o mejor.',
  },
  topN: {
    label: 'Top N carta alta',
    help: 'Tu carta relevante está entre las N más altas que no están en el board (kicker en pares, tu carta alta en el resto). No mira el palo.',
  },
  rankRange: {
    label: 'Carta entre (desde–hasta)',
    help: 'Tu carta relevante entre dos valores (kicker en pares, carta del palo en proyectos de color).',
  },
  cardsUsed: {
    label: 'Cartas propias usadas',
    help: 'Cuántas de tus 2 cartas forman la jugada: 1 o 2 (ej.: escalera o color con las 2 cartas).',
  },
  includeMade: {
    label: 'Incluir manos hechas',
    help: 'Solo proyectos: desmarcado deja fuera los combos que además tienen par o algo mejor.',
  },
  overcardsMin: {
    label: 'Overcards mínimas',
    help: 'Al menos 1 o 2 de tus cartas por encima de la carta más alta del board.',
  },
};
const MODIFIER_LABEL = Object.fromEntries(
  Object.entries(MODIFIER_INFO).map(([k, v]) => [k, v.label]),
) as Record<ModifierKind, string>;
const MODIFIER_KINDS = Object.keys(MODIFIER_INFO) as ModifierKind[];

/** "+ modificador" as a menu that says what each option does. */
function ModifierMenu({
  label,
  kinds,
  onPick,
}: {
  label: string;
  kinds: readonly ModifierKind[];
  onPick: (kind: ModifierKind) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', away);
    return () => window.removeEventListener('pointerdown', away);
  }, [open]);
  return (
    <div
      ref={ref}
      className="relative ml-auto"
      onKeyDown={(e) => {
        // Escape closes the menu, not the dialog.
        if (e.key === 'Escape' && open) {
          e.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Agregar modificador a ${label}`}
        onClick={() => setOpen((o) => !o)}
        className={cn(small, 'flex items-center gap-0.5 text-content-muted hover:text-content')}
      >
        + modificador <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <ul
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 w-72 rounded-lg border border-border bg-surface p-1 shadow-lg"
        >
          {kinds.map((k) => (
            <li key={k} role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onPick(k);
                  setOpen(false);
                }}
                className="w-full rounded-md px-2 py-1.5 text-left hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none"
              >
                <span className="block text-xs font-medium text-content">
                  {MODIFIER_INFO[k].label}
                </span>
                <span className="block text-[11px] leading-snug text-content-muted">
                  {MODIFIER_INFO[k].help}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const SUIT_OPTIONS: { value: string; label: string; short: string; rule: SuitRule }[] = [
  { value: 'suited', label: 'Suited', short: 'Suited', rule: { kind: 'suited' } },
  { value: 'offsuit', label: 'Offsuit', short: 'Offsuit', rule: { kind: 'offsuit' } },
  { value: 's', label: 'Con ♠ (picas)', short: '♠', rule: { kind: 'hasSuit', suit: 's' } },
  { value: 'h', label: 'Con ♥ (corazones)', short: '♥', rule: { kind: 'hasSuit', suit: 'h' } },
  { value: 'd', label: 'Con ♦ (diamantes)', short: '♦', rule: { kind: 'hasSuit', suit: 'd' } },
  { value: 'c', label: 'Con ♣ (tréboles)', short: '♣', rule: { kind: 'hasSuit', suit: 'c' } },
  { value: 'board', label: 'Con un palo presente en el board', short: 'Palo del board', rule: { kind: 'suitOnBoard' } },
  { value: 'board2', label: 'Con un palo que está 2 veces en el board', short: '2 en el board', rule: { kind: 'suitTwiceOnBoard' } },
];
/** The four suits, by option value, for their deck colors. */
const SUIT_BY_VALUE: Record<string, '♠' | '♥' | '♦' | '♣' | undefined> = {
  s: '♠',
  h: '♥',
  d: '♦',
  c: '♣',
};
const suitValue = (r: SuitRule) =>
  r.kind === 'hasSuit'
    ? r.suit
    : r.kind === 'suitOnBoard'
      ? 'board'
      : r.kind === 'suitTwiceOnBoard'
        ? 'board2'
        : r.kind;

const DRAG_TYPE = 'application/x-sopranozilla-element';
/** Left bar of a group by nesting level (D104). */
const DEPTH_BAR = ['border-l-violet-500', 'border-l-sky-500', 'border-l-emerald-500', 'border-l-amber-500'];
const RANKS_DESC = [...ENGINE_RANKS].reverse();

const small =
  'rounded border border-border bg-bg px-1 py-0.5 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light';

function issueText(issue: FilterIssue, filters: readonly CustomFilter[]): string {
  const name = (id: string) => filters.find((f) => f.id === id)?.name ?? 'filtro borrado';
  switch (issue.kind) {
    case 'circular':
      return `Referencia circular: ${issue.cycle.map(name).join(' → ')}.`;
    case 'unknownReference':
      return `Usa un filtro que ya no existe («${name(issue.id)}»).`;
    case 'modifierOnReference':
      return `Un filtro guardado («${name(issue.id)}») no admite modificadores.`;
  }
}

function ModifierControls({
  mod,
  isComboDraw,
  onChange,
}: {
  mod: Modifier;
  isComboDraw: boolean;
  onChange: (m: Modifier) => void;
}) {
  const rankSelect = (value: EngineRank, set: (r: EngineRank) => void, label: string) => (
    <select
      aria-label={label}
      className={small}
      value={value}
      onChange={(e) => set(e.target.value as EngineRank)}
    >
      {RANKS_DESC.map((r) => (
        <option key={r}>{r}</option>
      ))}
    </select>
  );
  switch (mod.kind) {
    case 'topN':
      return (
        <select
          aria-label="N"
          className={small}
          value={mod.n}
          onChange={(e) => onChange({ ...mod, n: Number(e.target.value) })}
        >
          {Array.from({ length: 13 }, (_, i) => i + 1).map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      );
    case 'rankRange':
      return (
        <>
          {rankSelect(mod.min, (min) => onChange({ ...mod, min }), 'Desde')}–
          {rankSelect(mod.max, (max) => onChange({ ...mod, max }), 'Hasta')}
        </>
      );
    case 'nutRankMax':
      return (
        <select
          aria-label="Nut-rank"
          className={small}
          value={mod.k}
          onChange={(e) => onChange({ ...mod, k: Number(e.target.value) })}
        >
          {[1, 2, 3, 4, 5, 6, 7, 8].map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
      );
    case 'cardsUsed':
      return (
        <>
          <select
            aria-label="Cartas"
            className={small}
            value={mod.value}
            onChange={(e) => onChange({ ...mod, value: e.target.value === '1' ? 1 : 2 })}
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
          </select>
          {isComboDraw && (
            <select
              aria-label="Parte"
              className={small}
              value={mod.part ?? ''}
              onChange={(e) => {
                const v = e.target.value;
                onChange(
                  v === 'straight' || v === 'flush'
                    ? { ...mod, part: v }
                    : { kind: 'cardsUsed', value: mod.value },
                );
              }}
            >
              <option value="">en todo</option>
              <option value="straight">en la escalera</option>
              <option value="flush">en el color</option>
            </select>
          )}
        </>
      );
    case 'includeMade':
      return (
        <input
          type="checkbox"
          aria-label="Incluir manos hechas"
          checked={mod.value}
          onChange={(e) => onChange({ ...mod, value: e.target.checked })}
        />
      );
    case 'kickerMin':
      return rankSelect(mod.rank, (rank) => onChange({ ...mod, rank }), 'Kicker');
    case 'overcardsMin':
      return (
        <select
          aria-label="Overcards"
          className={small}
          value={mod.n}
          onChange={(e) => onChange({ ...mod, n: e.target.value === '1' ? 1 : 2 })}
        >
          <option value={1}>1</option>
          <option value={2}>2</option>
        </select>
      );
  }
}

export function FilterBuilder({
  initial,
  filters,
  view,
  onDraft,
  onSaved,
  onClose,
  renderGrid,
}: Props) {
  const saveFilter = useFiltersStore((s) => s.saveFilter);
  const [name, setName] = useState(initial?.name ?? '');
  // Fixed shape: Incluir Y NO(Excluir) (D106). Every edit keeps it.
  const [root, setRootRaw] = useState<FilterExpr>(() => workspaceOf(initial?.expr ?? null));
  const setRoot = (next: FilterExpr | ((r: FilterExpr) => FilterExpr)) =>
    setRootRaw((r) => ensureWorkspace(typeof next === 'function' ? next(r) : next));
  const [target, setTarget] = useState<Path>(INCLUDE_PATH);
  const [issues, setIssues] = useState<FilterIssue[]>([]);
  const [hoverHand, setHoverHand] = useState<HandNotation | null>(null);
  // Group that would receive what is being dragged (D110), as a path key.
  const [dragOver, setDragOver] = useState<string | null>(null);

  const others = useMemo(() => filters.filter((f) => f.id !== initial?.id), [filters, initial]);
  const palette = useMemo(
    () => [
      ...BASE_PALETTE,
      {
        label: 'Mis filtros',
        items: others.map<PaletteItem>((f) => ({
          key: `filter:${f.id}`,
          label: f.name,
          hint: describeExpr(f.expr, filters),
          node: leaf(f.id),
        })),
      },
    ],
    [others, filters],
  );
  const byKey = useMemo(
    () => new Map(palette.flatMap((g) => g.items).map((i) => [i.key, i.node])),
    [palette],
  );

  const draft = useMemo(() => normalizeExpr(root), [root]);
  useEffect(() => onDraft(draft), [draft, onDraft]);
  useEffect(() => () => onDraft(null), [onDraft]);

  // Live preview: combos of the current street's range that match.
  const preview = useMemo(() => {
    if (!draft) return null;
    const ctx = makeFilterContext(view.board, others);
    let total = 0;
    let hit = 0;
    const byClass = new Map<string, number>();
    let error: string | null = null;
    for (let id = 0; id < COMBO_COUNT; id++) {
      const w = view.start[id] ?? 0;
      if (w <= 0) continue;
      total += w;
      const cls = view.classes.get(id);
      if (!cls) continue;
      try {
        if (!exprMatches(draft, id, cls, ctx)) continue;
      } catch (err) {
        if (!(err instanceof CircularFilterError)) throw err;
        error = 'La expresión tiene una referencia circular.';
        break;
      }
      hit += w;
      const c = classOfCombo(id);
      byClass.set(c, (byClass.get(c) ?? 0) + w);
    }
    const top = [...byClass.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
    return { total, hit, top, error };
  }, [draft, view, others]);

  const breakdown = useMemo(
    () => (hoverHand ? filterComboBreakdown(view, draft, others, hoverHand) : []),
    [hoverHand, view, draft, others],
  );

  // Puts the group inside a new one with the other operator, so what comes
  // next is required on top of it (D109): O[A, K] → Y[ O[A, K], … ].
  const wrapGroup = (path: Path) => {
    setRoot((r) =>
      updateAt(r, path, (g) =>
        g.type === 'and' || g.type === 'or'
          ? { type: g.type === 'or' ? 'and' : 'or', children: [g] }
          : g,
      ),
    );
    setTarget(path);
  };
  const toggleOperator = (path: Path) =>
    setRoot((r) =>
      updateAt(r, path, (e) =>
        e.type === 'and' || e.type === 'or' ? { ...e, type: e.type === 'and' ? 'or' : 'and' } : e,
      ),
    );

  const insert = (node: FilterExpr, at: Path = target) => {
    const r = insertInto(root, at, node);
    setRoot(r.root);
    const inserted = getAt(r.root, r.path);
    // A new group becomes the place where the next elements go.
    if (inserted && isContainer(inserted)) setTarget(r.path);
  };
  const remove = (path: Path) => {
    const next = removeAt(root, path);
    setRoot(next);
    const t = getAt(ensureWorkspace(next), target);
    if (!t || !isContainer(t)) setTarget(INCLUDE_PATH);
  };
  const onDrop = (path: Path) => (e: DragEvent) => {
    const key = e.dataTransfer.getData(DRAG_TYPE);
    const node = byKey.get(key);
    if (!node) return;
    e.preventDefault();
    e.stopPropagation();
    setDragOver(null);
    const r = insertInto(root, path, node);
    setRoot(r.root);
  };
  const isDrag = (e: DragEvent) => e.dataTransfer.types.includes(DRAG_TYPE);

  const save = () => {
    if (!draft || !name.trim()) return;
    const filter: CustomFilter = {
      id: initial?.id ?? crypto.randomUUID(),
      name: name.trim().slice(0, 80),
      expr: draft,
      createdAt: initial?.createdAt ?? new Date().toISOString(),
    };
    const result = saveFilter(filter);
    if (!result.ok) {
      setIssues(result.issues);
      return;
    }
    onSaved(filter);
  };

  const renderNode = (node: FilterExpr, path: Path): ReactNode => {
    const key = path.join('.');
    if (node.type === 'leaf') {
      const isCat = isCategoryId(node.category);
      const label = isCat
        ? CATEGORY_INFO[node.category as CategoryId].label
        : `«${filters.find((f) => f.id === node.category)?.name ?? 'filtro borrado'}»`;
      const mods = node.modifiers ?? [];
      const free = isCat
        ? MODIFIER_KINDS.filter(
            (k) =>
              modifierAppliesTo(k, node.category as CategoryId) && !mods.some((m) => m.kind === k),
          )
        : [];
      const setMods = (next: Modifier[]) =>
        setRoot((r) =>
          updateAt(r, path, (e) =>
            e.type === 'leaf'
              ? next.length > 0
                ? { ...e, modifiers: next }
                : { type: 'leaf', category: e.category }
              : e,
          ),
        );
      return (
        <li key={key} className="rounded-md border border-border bg-surface px-2 py-1 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-medium text-content">{label}</span>
            {free.length > 0 && (
              <ModifierMenu
                label={label}
                kinds={free}
                onPick={(k) => setMods([...mods, defaultModifier(k)])}
              />
            )}
            <button
              type="button"
              aria-label={`Quitar ${label}`}
              data-noactivate
              onClick={() => remove(path)}
              className={cn('rounded p-0.5 text-content-muted hover:bg-surface-hover', free.length === 0 && 'ml-auto')}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          {mods.length > 0 && (
            <ul className="mt-1 space-y-1">
              {mods.map((m, i) => (
                <li
                  key={m.kind}
                  title={MODIFIER_INFO[m.kind].help}
                  className="flex flex-wrap items-center gap-1 text-content-muted"
                >
                  <span>{MODIFIER_LABEL[m.kind]}</span>
                  <ModifierControls
                    mod={m}
                    isComboDraw={(COMBO_DRAW_CATEGORIES as readonly string[]).includes(node.category)}
                    onChange={(next) => setMods(mods.map((x, k) => (k === i ? next : x)))}
                  />
                  <span className="text-[10px]">({describeModifier(m)})</span>
                  <button
                    type="button"
                    aria-label={`Quitar ${MODIFIER_LABEL[m.kind]}`}
                    onClick={() => setMods(mods.filter((_, k) => k !== i))}
                    className="rounded p-0.5 hover:bg-surface-hover"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </li>
      );
    }

    const isTarget = target.join('.') === key;
    const children =
      'children' in node
        ? node.children
        : node.type === 'not'
          ? node.child.type === 'and' && node.child.children.length === 0
            ? []
            : [node.child]
          : node.child
            ? [node.child]
            : [];
    const childPath = (i: number): Path => [...path, i];
    const isGroup = node.type === 'and' || node.type === 'or';
    const isInclude = key === INCLUDE_PATH.join('.');
    const isExclude = key === EXCLUDE_PATH.join('.');
    // Left bar: groups by nesting level, NO in rose, PALOS in sky (D104).
    const bar =
      node.type === 'not' || isExclude
        ? 'border-l-rose-500'
        : node.type === 'suits'
          ? 'border-l-sky-500'
          : (DEPTH_BAR[(path.length - 1) % DEPTH_BAR.length] ?? 'border-l-violet-500');
    const joiner = node.type === 'or' ? 'O' : 'Y';
    const groupName = isInclude
      ? 'INCLUIR'
      : isExclude
        ? 'EXCLUIR'
        : node.type === 'and'
          ? 'el subgrupo Y'
          : node.type === 'or'
            ? 'el subgrupo O'
            : node.type === 'not'
              ? 'el NO'
              : 'PALOS';
    return (
      <li
        key={key}
        onDragOver={(e) => {
          if (!isDrag(e)) return;
          // The innermost group under the pointer receives it; say which.
          e.preventDefault();
          e.stopPropagation();
          if (dragOver !== key) setDragOver(key);
        }}
        onDrop={onDrop(path)}
        // A click anywhere in a group makes it the active one (D104).
        onClick={(e) => {
          e.stopPropagation();
          if (!(e.target as Element).closest('[data-noactivate]')) setTarget(path);
        }}
        className={cn(
          'rounded-lg border border-l-4 p-1.5 pl-2 transition-colors',
          bar,
          dragOver === key
            ? 'border-emerald-400 bg-emerald-500/10 shadow-[0_0_0_2px_rgb(52_211_153/0.6)]'
            : isTarget
              ? 'border-violet-500 bg-violet-500/[0.07] shadow-[0_0_0_1px_rgb(139_92_246/0.35)]'
              : 'cursor-pointer border-dashed border-border hover:bg-surface-hover/40',
        )}
      >
        <div className="mb-1 flex flex-wrap items-center gap-1.5 text-xs">
          {isExclude ? (
            <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-rose-700 dark:text-rose-300">
              EXCLUIR · se quita lo que cumpla alguno
            </span>
          ) : 'children' in node ? (
            <>
              <div
                className="inline-flex rounded border border-border text-[11px] font-semibold"
                role="group"
                aria-label="Operador del grupo"
              >
                {(['and', 'or'] as const).map((op) => (
                  <button
                    key={op}
                    type="button"
                    aria-pressed={node.type === op}
                    onClick={() =>
                      setRoot((r) =>
                        updateAt(r, path, (e) =>
                          e.type === 'and' || e.type === 'or' ? { ...e, type: op } : e,
                        ),
                      )
                    }
                    className={cn(
                      'px-1.5 py-0.5',
                      node.type === op
                        ? 'bg-accent text-white'
                        : 'text-content-muted hover:bg-surface-hover',
                    )}
                  >
                    {op === 'and' ? 'Y' : 'O'}
                  </button>
                ))}
              </div>
              <span className="text-[11px] text-content-muted">
                {isInclude ? 'INCLUIR' : 'Subgrupo'}:{' '}
                {node.type === 'and' ? 'se cumplen todos' : 'alcanza con uno'}
              </span>
            </>
          ) : node.type === 'not' ? (
            <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-rose-700 dark:text-rose-300">
              NO · excluye lo de adentro
            </span>
          ) : (
            <>
              <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-sky-700 dark:text-sky-300">
                PALOS
              </span>
              {/* Buttons instead of a <select>: the suits in their deck colors (D111). */}
              <span role="radiogroup" aria-label="Regla de palos" className="flex flex-wrap gap-1">
                {SUIT_OPTIONS.map((o) => {
                  const on = suitValue(node.rule) === o.value;
                  const suit = SUIT_BY_VALUE[o.value];
                  return (
                    <button
                      key={o.value}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      aria-label={o.label}
                      title={o.label}
                      onClick={() =>
                        setRoot((r) =>
                          updateAt(r, path, (x) => (x.type === 'suits' ? { ...x, rule: o.rule } : x)),
                        )
                      }
                      style={suit ? { backgroundColor: SUIT_BG[suit] } : undefined}
                      className={cn(
                        'rounded px-1.5 py-0.5 text-[11px] font-semibold',
                        suit
                          ? cn(
                              'min-w-[1.6rem] text-sm leading-none text-white',
                              // A light edge so ♠ (slate) still reads on the dark surface.
                              on
                                ? 'ring-2 ring-sky-300 ring-offset-1 ring-offset-bg'
                                : 'opacity-70 ring-1 ring-white/25 hover:opacity-100',
                            )
                          : on
                            ? 'bg-sky-500/25 text-sky-800 ring-1 ring-sky-400 dark:text-sky-200'
                            : 'text-content-muted ring-1 ring-border hover:bg-surface-hover',
                      )}
                    >
                      {suit ?? o.short}
                    </button>
                  );
                })}
              </span>
            </>
          )}
          {isGroup && !isExclude && 'children' in node && node.children.length > 0 && (
            <button
              type="button"
              onClick={() => wrapGroup(path)}
              title={
                node.type === 'or'
                  ? 'Mete este grupo en uno nuevo con Y: lo que agregues después se exige ADEMÁS (ej.: (A-high o K-high) y BDFD).'
                  : 'Mete este grupo en uno nuevo con O: lo que agregues después vale COMO ALTERNATIVA.'
              }
              className="rounded border border-violet-500/40 px-1.5 py-0.5 text-[11px] text-violet-700 hover:bg-violet-500/10 dark:text-violet-300"
            >
              {node.type === 'or' ? '+ Y además…' : '+ O también…'}
            </button>
          )}
          {dragOver === key ? (
            <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
              ⤓ Suelta aquí: entra en {groupName}
            </span>
          ) : isTarget ? (
            <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[11px] font-medium text-violet-700 dark:text-violet-300">
              ● Activo: aquí entran los elementos
            </span>
          ) : (
            <span className="text-[11px] text-content-disabled">clic para activarlo</span>
          )}
          {!isWorkspaceGroup(path) && (
            <button
              type="button"
              aria-label="Quitar grupo"
              data-noactivate
              onClick={() => remove(path)}
              className="ml-auto rounded p-0.5 text-content-muted hover:bg-surface-hover"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        {children.length === 0 ? (
          <p className="px-1 py-1 text-[11px] text-content-disabled">
            {isExclude
              ? isTarget
                ? 'Nada excluido. Toca lo que quieras quitar (ej.: Gutshot 1 carta).'
                : 'Nada excluido. Haz clic aquí y agrega lo que quieras quitar de lo incluido.'
              : isTarget
                ? 'Vacío: toca un elemento de la izquierda y entra aquí (o arrástralo).'
                : 'Vacío: haz clic aquí para activarlo, o arrastra un elemento.'}
          </p>
        ) : (
          <ul className="space-y-1">
            {children.map((c, i) => (
              <Fragment key={`${key}.${i}`}>
                {/* The operator between elements, so the logic reads at a glance. */}
                {isGroup && i > 0 && (
                  <li>
                    {isExclude ? (
                      <span className="pl-1 text-[10px] font-bold tracking-wide text-rose-700 dark:text-rose-300">
                        {joiner}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleOperator(path)}
                        title={`Cambiar a ${joiner === 'Y' ? 'O' : 'Y'} (aplica a todo este grupo)`}
                        className="rounded px-1 text-[10px] font-bold tracking-wide text-violet-700 hover:bg-violet-500/15 dark:text-violet-300"
                      >
                        {joiner} ⇄
                      </button>
                    )}
                  </li>
                )}
                {renderNode(c, childPath(i))}
              </Fragment>
            ))}
          </ul>
        )}
      </li>
    );
  };

  const btn =
    'rounded-md border border-border px-2 py-1 text-xs hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light';

  return (
    <SzDialog
      label={initial ? 'Editar filtro personalizado' : 'Nuevo filtro personalizado'}
      onClose={onClose}
      closeOnOutsideClick={false}
      className="max-w-[92rem]"
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">
          {initial ? 'Editar filtro personalizado' : 'Nuevo filtro personalizado'}
        </h2>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre (ej.: Top 3 BDFD)"
          aria-label="Nombre del filtro"
          maxLength={80}
          className="min-w-0 flex-1 rounded-md border border-border bg-bg px-2 py-1 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-light"
        />
        <button
          type="button"
          onClick={save}
          disabled={!draft || !name.trim()}
          className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-white disabled:opacity-40"
        >
          Guardar
        </button>
        <button type="button" onClick={onClose} className={btn}>
          Cancelar
        </button>
      </div>
      <ol className="mb-3 flex flex-wrap gap-x-4 gap-y-1 rounded-lg bg-violet-500/5 px-3 py-2 text-[11px] text-content-muted">
        <li>
          <b className="text-content">1.</b> Toca un elemento de la izquierda: entra en el{' '}
          <b className="text-violet-700 dark:text-violet-300">grupo activo</b> (resaltado). Clic en
          un grupo para activarlo.
        </li>
        <li>
          <b className="text-content">2.</b> El interruptor <b className="text-content">Y / O</b> de
          cada grupo: Y = se cumplen todos · O = alcanza con uno. Entre los elementos se ve cuál
          aplica.
        </li>
        <li>
          <b className="text-content">3.</b> «+ modificador» afina un elemento (ej.: FD 2 cartas + Top
          N al nuts = 3 → top 3 FD).
        </li>
        <li>
          <b className="text-content">4.</b> Mira el grid: las manos que cumplen llevan contorno
          violeta.
        </li>
      </ol>
      {issues.length > 0 && (
        <ul role="alert" className="mb-2 text-xs text-danger">
          {issues.map((i, k) => (
            <li key={k}>{issueText(i, filters)}</li>
          ))}
        </ul>
      )}

      <div className="grid gap-3 lg:grid-cols-[13rem_minmax(0,1fr)] xl:grid-cols-[13rem_minmax(0,1fr)_minmax(18rem,24rem)]">
        {/* Elements */}
        <div className="max-h-[32rem] overflow-y-auto pr-1">
          {palette
            .filter((g) => g.items.length > 0)
            .map((g) => (
              <div key={g.label} className="mb-2">
                <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-content-muted">
                  {g.label}
                </h3>
                <div className="flex flex-wrap gap-1">
                  {g.items.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData(DRAG_TYPE, item.key);
                        e.dataTransfer.effectAllowed = 'copy';
                      }}
                      onDragEnd={() => setDragOver(null)}
                      onClick={() => insert(item.node)}
                      title={item.hint}
                      className="cursor-grab rounded border border-border bg-bg px-1.5 py-0.5 text-[11px] hover:border-violet-500/60 hover:bg-violet-500/10"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
        </div>

        {/* Expression. Dropped outside any group, an element goes into the active one (D110). */}
        <div
          className="min-w-0"
          onDragOver={(e) => {
            if (!isDrag(e)) return;
            e.preventDefault();
            const k = target.join('.');
            if (dragOver !== k) setDragOver(k);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(null);
          }}
          onDrop={onDrop(target)}
        >
          <div className="mb-2 flex flex-wrap items-center gap-1 text-xs text-content-muted">
            <span>Dentro del grupo activo, crear:</span>
            <button
              type="button"
              className={btn}
              title="Un grupo nuevo DENTRO del activo, donde se cumplen todos sus elementos."
              onClick={() => insert({ type: 'and', children: [] })}
            >
              + Subgrupo Y
            </button>
            <button
              type="button"
              className={btn}
              title="Un grupo nuevo DENTRO del activo, donde alcanza con uno de sus elementos."
              onClick={() => insert({ type: 'or', children: [] })}
            >
              + Subgrupo O
            </button>
            <button
              type="button"
              className={btn}
              title="Excluye lo que pongas adentro."
              onClick={() => insert({ type: 'not', child: EMPTY_ROOT })}
            >
              + NO ( … )
            </button>
            <button
              type="button"
              className={btn}
              title="Limita por palos lo que pongas adentro (suited, con ♥…)."
              onClick={() => insert({ type: 'suits', rule: { kind: 'suited' } })}
            >
              + PALOS
            </button>
          </div>
          <p className="mb-2 text-[11px] text-content-muted">
            ¿«A-high <b>O</b> K-high»? Cambia el interruptor <b>Y / O</b> de Incluir y agrega los
            dos. ¿«(A-high o K-high) <b>y</b> BDFD»? Toca <b>+ Y además…</b> en ese grupo y agrega
            BDFD. ¿Sin gutshots? Activa <b>Excluir</b> (clic) y agrega los gutshots ahí.
          </p>
          <ul className="space-y-2">
            {renderNode(getAt(root, INCLUDE_PATH) ?? EMPTY_ROOT, INCLUDE_PATH)}
            {renderNode(getAt(root, EXCLUDE_PATH) ?? EMPTY_ROOT, EXCLUDE_PATH)}
          </ul>
          <p className="mt-2 text-xs text-content-muted">
            <span className="font-medium text-content">Se lee:</span>{' '}
            {draft ? describeExpr(draft, filters) : 'todavía vacío'}
          </p>
        </div>

        {/* Live grid + preview */}
        <div className="text-xs lg:col-span-2 xl:col-span-1">
          {renderGrid && (
            <div className="mb-2">
              {renderGrid(setHoverHand)}
              {/* Fixed height: the dialog is centered, a box that grew or shrank per
                  hovered hand moved the grid under the cursor (it shook). */}
              <div className="mt-2 h-[9.5rem] overflow-y-auto rounded-lg border border-border p-2">
                <ComboBreakdown hand={hoverHand} cells={breakdown} />
              </div>
            </div>
          )}
          <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-content-muted">
            Vista previa en este board
          </h3>
          {!preview ? (
            <p className="text-content-muted">Agrega un elemento para ver qué combos cumplen.</p>
          ) : preview.error ? (
            <p className="text-danger">{preview.error}</p>
          ) : (
            <>
              <p>
                <span className="text-base font-semibold tabular-nums text-violet-700 dark:text-violet-300">
                  {fmtCombos(preview.hit)}
                </span>{' '}
                combos · {pct(preview.total > 0 ? preview.hit / preview.total : 0)} del rango
              </p>
              {preview.hit <= 0 ? (
                <p role="note" className="mt-1 text-amber-700 dark:text-amber-300">
                  Ningún combo del rango cumple en este board. Puedes guardarlo igual: en otro board
                  puede cumplirse.
                </p>
              ) : (
                <ul className="mt-2 flex flex-wrap gap-1">
                  {preview.top.map(([c, w]) => (
                    <li key={c} className="rounded bg-violet-500/10 px-1.5 py-0.5 tabular-nums">
                      {c} <span className="text-content-muted">{fmtCombos(w)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </SzDialog>
  );
}
