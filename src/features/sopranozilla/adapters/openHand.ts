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

export const SOURCE_LABEL = { mine: 'Mis rangos', gto: 'Rangos GTO' } as const;

export type OpenResult = { ok: true; saved: SavedHand } | { ok: false; error: string };

export type OpenOptions = {
  /** Library searched first; the other one is the fallback. */
  prefer?: RangeSource;
  /** Rival to analyze in a multiway pot (default: first to act on the flop). */
  villain?: string;
};

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
): Pick<HandMeta, 'spot' | 'rangeLabel' | 'rangeMissing'> & { range: string } {
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
  const { range, ...picked } = pickRange(villain, a.table, { mine, gto }, prefer);
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
  const { range, ...picked } = pickRange(opp, table, { mine, gto }, options.prefer ?? 'gto');
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
