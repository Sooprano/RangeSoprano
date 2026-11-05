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
import { loadSpinsRegular, type SpinsRange } from '../ranges/spinsCatalog';
import { pickSpinsRange } from './spinsPick';
import { positionsOf } from './positions';
import { isSpinsHand, type SpinsInfo } from './spinsSpot';

export const SOURCE_LABEL = { mine: 'Mis rangos', gto: 'Rangos GTO' } as const;

export type OpenResult = { ok: true; saved: SavedHand } | { ok: false; error: string };

export type OpenOptions = {
  /** Library searched first; the other one is the fallback. */
  prefer?: RangeSource;
  /** Rival to analyze in a multiway pot (default: first to act on the flop). */
  villain?: string;
  /** Spins hands: the Regular catalog (D128). Without it they use the library. */
  spins?: readonly SpinsRange[] | null;
};

/** Label of a spins range: "BBHU 13bb ROL 4.5bb · Regular". */
export function spinsRangeLabel(r: SpinsRange, approx: boolean): string {
  return `${r.name} · Regular${approx ? ' (aproximado)' : ''}`;
}

/** The Regular pick for a spins opponent, or why there is none. */
function pickSpins(
  info: SpinsInfo,
  catalog: readonly SpinsRange[],
): Pick<HandMeta, 'spot' | 'rangeLabel' | 'rangeMissing' | 'spinsRangeId'> & { range: string } {
  const spot = info.description;
  const role = info.role;
  const pick =
    role && info.effectiveBb !== null && info.description !== null
      ? pickSpinsRange(
          catalog,
          {
            format: info.format,
            effectiveBb: info.effectiveBb,
            description: info.description,
            roles: [],
          },
          { name: '', ...role },
        )
      : null;
  if (!pick) {
    return {
      range: '',
      spot,
      rangeLabel: null,
      rangeMissing: role
        ? `No hay rango de Regular para «${spot ?? 'este spot'}». Elige uno de la lista de spins.`
        : `${info.reason ?? 'No pude leer la línea preflop.'} Elige un rango de la lista de spins.`,
      spinsRangeId: undefined,
    };
  }
  return {
    range: pick.range.range,
    spot,
    rangeLabel: spinsRangeLabel(pick.range, pick.want.approx),
    rangeMissing: null,
    spinsRangeId: pick.range.id,
  };
}

type Library = { mine: readonly Range[]; gto: readonly Range[] };

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
): Pick<HandMeta, 'spot' | 'rangeLabel' | 'rangeMissing' | 'spinsRangeId'> & { range: string } {
  if (opp.spins) {
    if (spins) return pickSpins(opp.spins, spins);
    // A spins hand never falls back to the cash library.
    return {
      range: '',
      spot: opp.spins.description,
      rangeLabel: null,
      rangeMissing: 'Faltan los rangos de spins: vuelve a abrir la mano.',
      spinsRangeId: undefined,
    };
  }
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
  const { range, ...picked } = pickRange(villain, a.table, { mine, gto }, prefer, options.spins);
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
  );
  const heroPosition = saved.heroPosition as Parameters<typeof handTitle>[1];
  return {
    ...saved,
    ...(opp.position ? { villainPosition: opp.position } : { villainPosition: undefined }),
    range,
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
 * `savedHandFromParsed` for the UI: a spins hand first loads the Regular
 * catalog (its own chunk, only then), so cash hands never download it.
 */
export async function openParsedHand(
  parsed: ParsedHand,
  mine: readonly Range[],
  gto: readonly Range[],
  options: OpenOptions = {},
): Promise<OpenResult> {
  const spins = needsSpinsCatalog(parsed) ? await loadSpinsRegular() : null;
  return savedHandFromParsed(parsed, mine, gto, { ...options, spins });
}
