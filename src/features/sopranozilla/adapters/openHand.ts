// A real hand → the saved hand the analyzer loads. The villain's range comes
// from the library when the preflop spot is known; otherwise it stays empty
// and the page asks for one. The saved hand keeps every flop opponent (D96),
// so the villain and the library searched first (D97) can be changed later
// without the hand history.

import type { Range, TableFormat } from '@/types/poker';
import type { ParsedHand } from '@/utils/handHistory';
import { toSavedHand, type SavedHand } from '../store/lastHand';
import type { HandMeta } from '../store/analyzerStore';
import { rangeToText } from '../ui/rangeLibrary';
import { fromParsedHand, handTitle, type OpponentOption } from './fromParsedHand';
import type { TableInfo } from './tableInfo';
import { findVillainRange, type RangeSource } from './villainRange';
import {
  bandText,
  loadSpinsCatalog,
  RIVAL_LABEL,
  spinsRangeLabel,
  type SpinsRange,
  type SpinsRival,
} from '../ranges/spinsCatalog';
import { pickSpinsRange, spinsSpotRanges } from './spinsPick';
import type { SpinsLine, SpinsRole } from './spinsSpot';
import { cashRangeLabel, loadCashCatalog, type CashRange } from '../ranges/cashCatalog';
import { pickCashRange } from './cashPick';
import { isCashHand } from './cashSpot';
import { positionsOf } from './positions';
import { isSpinsHand, type SpinsInfo } from './spinsSpot';

export const SOURCE_LABEL = { mine: 'Mis rangos', gto: 'Rangos GTO' } as const;

export type OpenResult = { ok: true; saved: SavedHand } | { ok: false; error: string };

export type OpenOptions = {
  /** Library searched first; the other one is the fallback. */
  prefer?: RangeSource;
  /** Rival to analyze in a multiway pot (default: first to act on the flop). */
  villain?: string;
  /** Spins hands: the catalog, Regular + FISH (D128, D137). Without it they use the library. */
  spins?: readonly SpinsRange[] | null;
  /** Spins hands: the kind of rival (default: the one saved with the hand, else Regular). */
  rival?: SpinsRival;
  /** Cash hands: the GTO catalog (D138). Without it they use the library. */
  cash?: readonly CashRange[] | null;
};

export { spinsRangeLabel };

/** The line and role the picker reads, from what the saved hand kept. */
export function spinsLineOf(info: SpinsInfo): { line: SpinsLine; role: SpinsRole } | null {
  if (!info.role || info.effectiveBb === null || info.description === null) return null;
  return {
    line: {
      format: info.format,
      effectiveBb: info.effectiveBb,
      description: info.description,
      roles: [],
    },
    role: { name: '', ...info.role },
  };
}

/** Why a spins opponent has no range of this rival, in the user's words. */
export function spinsMissing(
  info: SpinsInfo,
  catalog: readonly SpinsRange[],
  rival: SpinsRival,
): string {
  const spot = info.description ?? 'este spot';
  const lr = spinsLineOf(info);
  if (!lr) {
    return `${info.reason ?? 'No pude leer la línea preflop.'} Elige un rango de la lista de spins.`;
  }
  const name = RIVAL_LABEL[rival];
  const found = spinsSpotRanges(catalog, lr.line, lr.role, rival);
  if (rival === 'fish' && found) {
    const lowest = Math.min(...found.sameSpot.map((r) => r.band?.min ?? 0));
    const bands = [...found.sameSpot]
      .sort((a, b) => a.stackBb - b.stackBb)
      .map((r) => (r.band ? bandText(r.band) : ''))
      .join(' · ');
    return `No hay rango de ${name} para «${spot}» con ${info.effectiveBb}bb: sus tramos son ${bands} (desde ${lowest}bb). Elige uno de la lista de spins.`;
  }
  return `No hay rango de ${name} para «${spot}». Elige uno de la lista de spins.`;
}

/** The pick for a spins opponent, or why there is none. */
function pickSpins(
  info: SpinsInfo,
  catalog: readonly SpinsRange[],
  rival: SpinsRival,
): Pick<HandMeta, 'spot' | 'rangeLabel' | 'rangeMissing' | 'spinsRangeId' | 'spinsRival'> & {
  range: string;
} {
  const spot = info.description;
  const lr = spinsLineOf(info);
  const pick = lr ? pickSpinsRange(catalog, lr.line, lr.role, rival) : null;
  if (!pick) {
    return {
      range: '',
      spot,
      rangeLabel: null,
      rangeMissing: spinsMissing(info, catalog, rival),
      spinsRangeId: undefined,
      spinsRival: rival,
    };
  }
  return {
    range: pick.range.range,
    spot,
    rangeLabel: spinsRangeLabel(pick.range, pick.want.approx),
    rangeMissing: null,
    spinsRangeId: pick.range.id,
    spinsRival: rival,
  };
}

type Library = { mine: readonly Range[]; gto: readonly Range[] };

type Picked = Pick<
  HandMeta,
  'spot' | 'rangeLabel' | 'rangeMissing' | 'spinsRangeId' | 'spinsRival' | 'cashRangeId'
> & { range: string };

function formatOf(table: TableInfo | undefined): TableFormat | undefined {
  if (!table) return undefined;
  return table.format === 'HU' || table.seats.length === 2 ? 'HU' : '6max';
}

/** Range text + the meta fields that depend on the villain and the library. */
function pickRange(
  opp: OpponentOption,
  table: TableInfo | undefined,
  lib: Library,
  prefer: RangeSource,
  spins: readonly SpinsRange[] | null | undefined,
  rival: SpinsRival,
  cash: readonly CashRange[] | null | undefined,
): Picked {
  if (opp.spins) {
    if (spins) return { ...pickSpins(opp.spins, spins, rival), cashRangeId: undefined };
    // A spins hand never falls back to the cash library.
    return {
      range: '',
      spot: opp.spins.description,
      rangeLabel: null,
      rangeMissing: 'Faltan los rangos de spins: vuelve a abrir la mano.',
      spinsRangeId: undefined,
      spinsRival: rival,
      cashRangeId: undefined,
    };
  }
  if (opp.cash && cash) return pickCash(opp, opp.cash, cash, table, lib.mine, prefer);
  const pick = opp.spot
    ? findVillainRange(opp.spot, lib.mine, lib.gto, prefer, {
        format: formatOf(table),
        effectiveBb: table?.effectiveBb,
      })
    : null;
  return {
    range: pick ? rangeToText(pick.range, pick.actionIds) : '',
    spot: opp.spot?.description ?? null,
    rangeLabel: pick ? `${pick.range.name} · ${SOURCE_LABEL[pick.source]}` : null,
    rangeMissing: pick
      ? null
      : (opp.spotNote ??
        `No hay un rango para «${opp.spot?.description ?? 'este spot'}» en la biblioteca.`),
    spinsRangeId: undefined,
    spinsRival: undefined,
    cashRangeId: undefined,
  };
}

/**
 * Cash (D138): the GTO catalog (the user's 93 ranges + the demo complement)
 * or «Mis rangos» first, as the user chose; the other one is the fallback.
 * Spots without a GTO range (limps, multiway, BB vs SB…) only take the
 * user's own library, never an invented one.
 */
function pickCash(
  opp: OpponentOption,
  info: NonNullable<OpponentOption['cash']>,
  catalog: readonly CashRange[],
  table: TableInfo | undefined,
  mine: readonly Range[],
  prefer: RangeSource,
): Picked {
  const spot = info.description ?? opp.spot?.description ?? null;
  const fromMine = (): Picked | null => {
    const p = opp.spot
      ? findVillainRange(opp.spot, mine, [], 'mine', {
          format: formatOf(table),
          effectiveBb: table?.effectiveBb,
        })
      : null;
    return p
      ? {
          range: rangeToText(p.range, p.actionIds),
          spot,
          rangeLabel: `${p.range.name} · ${SOURCE_LABEL.mine}`,
          rangeMissing: null,
          spinsRangeId: undefined,
          spinsRival: undefined,
          cashRangeId: undefined,
        }
      : null;
  };
  const fromGto = (): Picked | null => {
    const p = info.want ? pickCashRange(catalog, info.want) : null;
    return p
      ? {
          range: p.range.range,
          spot,
          rangeLabel: cashRangeLabel(p.range),
          rangeMissing: null,
          spinsRangeId: undefined,
          spinsRival: undefined,
          cashRangeId: p.range.id,
        }
      : null;
  };
  const first = prefer === 'mine' ? (fromMine() ?? fromGto()) : (fromGto() ?? fromMine());
  if (first) return first;
  return {
    range: '',
    spot,
    rangeLabel: null,
    rangeMissing: info.want
      ? `No hay rango GTO para «${spot ?? 'este spot'}». Elige uno de la lista de cash o de la biblioteca.`
      : `${info.reason ?? 'No pude leer la línea preflop.'} Elige uno de la lista de cash o de la biblioteca.`,
    spinsRangeId: undefined,
    spinsRival: undefined,
    cashRangeId: undefined,
  };
}

/** Same table, with the villain role moved to `name`. */
function withVillainRole(table: TableInfo | undefined, name: string): TableInfo | undefined {
  if (!table) return undefined;
  const seats = table.seats.map((s) => ({
    ...s,
    role: s.role === 'hero' ? s.role : s.name === name ? ('villain' as const) : null,
  }));
  const h = seats.find((s) => s.role === 'hero');
  const v = seats.find((s) => s.role === 'villain');
  const effective = h && v && h.stack > 0 && v.stack > 0 ? Math.min(h.stack, v.stack) : null;
  const ratio = h && h.stackBb !== null && h.stack > 0 ? h.stackBb / h.stack : null;
  return {
    ...table,
    seats,
    effective: effective !== null ? Math.round(effective * 100) / 100 : null,
    effectiveBb:
      effective !== null && ratio !== null ? Math.round(effective * ratio * 100) / 100 : null,
  };
}

export function savedHandFromParsed(
  parsed: ParsedHand,
  mine: readonly Range[],
  gto: readonly Range[],
  options: OpenOptions = {},
): OpenResult {
  const adapted = fromParsedHand(parsed, options.villain);
  if (!adapted.ok) return adapted;
  const a = adapted.value;
  const prefer = options.prefer ?? 'gto';
  const villain = a.opponents.find((o) => o.name === a.villainName)!;
  const { range, ...picked } = pickRange(
    villain,
    a.table,
    { mine, gto },
    prefer,
    options.spins,
    options.rival ?? 'regular',
    options.cash,
  );
  return {
    ok: true,
    saved: toSavedHand(a.hand, range, a.recorded, {
      title: a.title,
      ...picked,
      warnings: a.warnings,
      table: a.table,
      handLabel: a.handLabel,
      villainName: a.villainName,
      opponents: a.opponents,
    }),
  };
}

/**
 * The saved real hand against another villain and / or with the other
 * library first. Null when the hand has no opponents saved (a test hand, or
 * one saved before D96) or the name is not one of them.
 */
export function repickSaved(
  saved: SavedHand,
  options: OpenOptions,
  mine: readonly Range[],
  gto: readonly Range[],
): SavedHand | null {
  const meta = saved.meta;
  if (!meta?.opponents || meta.opponents.length === 0) return null;
  const name = options.villain ?? meta.villainName ?? meta.opponents[0]!.name;
  const opp = meta.opponents.find((o) => o.name === name);
  if (!opp) return null;
  const table = withVillainRole(meta.table, opp.name);
  const { range, ...picked } = pickRange(
    opp,
    table,
    { mine, gto },
    options.prefer ?? 'gto',
    options.spins,
    options.rival ?? meta.spinsRival ?? 'regular',
    options.cash,
  );
  const heroPosition = saved.heroPosition as Parameters<typeof handTitle>[1];
  return {
    ...saved,
    ...(opp.position ? { villainPosition: opp.position } : { villainPosition: undefined }),
    range,
    stacks: opp.stacks ? { ...opp.stacks } : undefined,
    recorded: opp.recorded,
    meta: {
      ...meta,
      ...picked,
      title: handTitle(meta.handLabel ?? 'Mano', heroPosition, opp),
      villainName: opp.name,
      ...(table && { table }),
    },
  };
}

/** Does this hand need the spins catalog (a 2- or 3-handed tournament hand)? */
export function needsSpinsCatalog(parsed: ParsedHand): boolean {
  return isSpinsHand(parsed, positionsOf(parsed));
}

/**
 * `savedHandFromParsed` for the UI: a spins hand first loads the spins
 * catalog (its own chunks, only then), so cash hands never download it.
 */
export async function openParsedHand(
  parsed: ParsedHand,
  mine: readonly Range[],
  gto: readonly Range[],
  options: OpenOptions = {},
): Promise<OpenResult> {
  const spins = needsSpinsCatalog(parsed) ? await loadSpinsCatalog() : null;
  const cash = !spins && isCashHand(parsed) ? await loadCashCatalog() : null;
  return savedHandFromParsed(parsed, mine, gto, { ...options, spins, cash });
}
