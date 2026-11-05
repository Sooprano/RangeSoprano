// Default villain ranges for cash vs a regular (D138): the user's GTO ranges
// ("Cash GTO wizard range", 93 ranges at ~100bb, `cash-gto.json` built by
// scripts/build-spins-ranges.mjs --cash) plus, from the app's demo set, only
// what they lack (the user's call):
//   - the opens of 2bb (UTG, HJ) and 2.3bb (CO), and the BB defense and the
//     BTN cold call against those opens (the new ranges are vs 2.5bb);
//   - spots the new ranges do not have: BB calls the SB open, SB cold-calls
//     UTG / HJ.
// The picker takes the closest size (D138), so a 2.1bb open gets the 2bb
// ranges and a 2.5bb open the new ones.
//
// Names, as the user exported them: «XvsY …» = X decides, Y is the rival; the
// bb number is the size of the bet of the spot (3bet / 4bet), not the stack.
// «MP» = HJ, «UTB» is a typo of UTG, «BTNvUTG» has «v», case varies.

import type { Position } from '@/types/poker';
import { GTO_OPEN_RAW } from '@/modules/workbook/gtoOpenRanges';
import { GTO_CALL_RAW } from '@/modules/workbook/gtoCallRanges';
import { GTO_COLD_CALL_RAW } from '@/modules/workbook/gtoColdCallRanges';
import { parseRangeText } from '../engine/rangeText';

/** What the villain did preflop in that range. */
export type CashAction =
  | 'open' // raise first in
  | 'call-open' // calls an open (BB defense, BTN / SB cold call)
  | '3bet'
  | 'call-3bet' // opened, then calls the 3-bet
  | '4bet'
  | 'call-4bet'; // 3-bet, then calls the 4-bet

export type CashRange = {
  /** Unique: "<folder>/<name>". */
  id: string;
  group: string;
  name: string;
  /** The user's GTO ranges, or the demo set complementing them. */
  source: 'gto' | 'demo';
  position: Position;
  /** The other player of the spot; null = the open (anyone behind). */
  vs: Position | null;
  action: CashAction;
  /**
   * Size of the bet the spot is about, in bb "to": the open for open and
   * call-open, the 3-bet for 3bet / call-3bet, the 4-bet for 4bet /
   * call-4bet. 'AI' = all in; null = not in the name (matches any size).
   */
  size: number | 'AI' | null;
  /** Range text (exact combos). */
  range: string;
  combos: number;
};

const SEAT: Record<string, Position> = {
  utg: 'UTG',
  utb: 'UTG', // typo in «UTBvsBB 4bet All in»
  hj: 'HJ',
  mp: 'HJ',
  co: 'CO',
  btn: 'BTN',
  sb: 'SB',
  bb: 'BB',
};
const SEATS = 'utg|utb|hj|mp|co|btn|sb|bb';
const NUM = String.raw`(\d+(?:\.\d+)?)`;

/** The open size the new ranges answer: every open is 2.5bb (the SB's is 3x). */
const OPEN_OF: Partial<Record<Position, number>> = { SB: 3 };
const openOf = (p: Position) => OPEN_OF[p] ?? 2.5;

/**
 * What a range of the user's cash export is, from its name. Null when the
 * name does not follow the grammar (a test checks every bundled one).
 */
export function parseCashName(
  name: string,
): Pick<CashRange, 'position' | 'vs' | 'action' | 'size'> | null {
  const n = name.toLowerCase().replace(/\s+/g, '');
  const open = new RegExp(`^(${SEATS})or${NUM}x?$`).exec(n);
  if (open) {
    return { position: SEAT[open[1]!]!, vs: null, action: 'open', size: Number(open[2]) };
  }
  const m = new RegExp(`^(${SEATS})vs?(${SEATS})(.+)$`).exec(n);
  if (!m) return null;
  const position = SEAT[m[1]!]!;
  const vs = SEAT[m[2]!]!;
  const rest = m[3]!;
  const allin = /(allin|ai)$/.test(rest);
  const sized = new RegExp(`${NUM}bb`).exec(rest);
  const size = allin ? 'AI' : sized ? Number(sized[1]) : null;
  const base = { position, vs };
  if (/^(cc|callcold)$/.test(rest)) return { ...base, action: 'call-open', size: openOf(vs) };
  if (/^call(vs)?3bet/.test(rest)) return { ...base, action: 'call-3bet', size };
  if (/^call(vs)?4bet/.test(rest)) return { ...base, action: 'call-4bet', size };
  if (/^3bet/.test(rest)) return { ...base, action: '3bet', size };
  if (/^4bet/.test(rest)) return { ...base, action: '4bet', size };
  return null;
}

type RawFile = {
  groups: { name: string; ranges: { name: string; range: string; combos: number }[] }[];
};

const DEMO_GROUP = 'Demo (open 2bb)';
const vsOf = (vs: string) =>
  SEAT[
    vs
      .replace(/^vs\s+/i, '')
      .trim()
      .toLowerCase()
  ];
const bb = (s: string) => Number(/(\d+(?:\.\d+)?)/.exec(s)?.[1] ?? NaN);

function combosOf(text: string): number {
  const { weights } = parseRangeText(text);
  let sum = 0;
  for (let i = 0; i < weights.length; i++) sum += weights[i] ?? 0;
  return Math.round(sum * 1000) / 1000;
}

/** The demo ranges that complement the new ones (see the header). */
export function demoComplement(): CashRange[] {
  const out: CashRange[] = [];
  const put = (r: Omit<CashRange, 'id' | 'group' | 'source' | 'combos'>) =>
    out.push({
      ...r,
      id: `${DEMO_GROUP}/${r.name}`,
      group: DEMO_GROUP,
      source: 'demo',
      combos: combosOf(r.range),
    });
  // Opens smaller than the new 2.5bb: UTG / HJ 2bb, CO 2.3bb.
  const demoOpen = new Map<Position, number>();
  for (const r of GTO_OPEN_RAW) {
    const position = SEAT[r.position.toLowerCase()];
    const size = bb(r.sizing);
    if (!position || !(size < openOf(position))) continue;
    demoOpen.set(position, size);
    put({
      name: `${position} open ${size}bb`,
      position,
      vs: null,
      action: 'open',
      size,
      range: r.notation,
    });
  }
  // Calls vs those opens, and the spots the new ranges do not have.
  const calls = [
    ...GTO_CALL_RAW.map((r) => ({ ...r, cold: false })),
    ...GTO_COLD_CALL_RAW.map((r) => ({ ...r, cold: true })),
  ];
  for (const r of calls) {
    const position = SEAT[r.position.toLowerCase()];
    const vs = vsOf(r.vs);
    if (!position || !vs) continue;
    const missing = (position === 'BB' && vs === 'SB') || position === 'SB';
    const open = demoOpen.get(vs) ?? (missing ? openOf(vs) : undefined);
    if (open === undefined) continue;
    put({
      name: `${position} ${r.cold ? 'call cold' : 'call'} vs ${vs} (open ${open}bb)`,
      position,
      vs,
      action: 'call-open',
      size: open,
      range: r.notation,
    });
  }
  return out;
}

/** Bundled data → typed catalog (ranges whose name does not parse are left out). */
export function buildCashCatalog(data: RawFile): CashRange[] {
  const out: CashRange[] = [];
  for (const g of data.groups) {
    for (const r of g.ranges) {
      const meta = parseCashName(r.name);
      if (!meta) continue;
      out.push({
        id: `${g.name}/${r.name}`,
        group: g.name,
        name: r.name,
        source: 'gto',
        ...meta,
        range: r.range,
        combos: r.combos,
      });
    }
  }
  return [...out, ...demoComplement()];
}

let cache: Promise<CashRange[]> | null = null;

/** The cash GTO catalog, loaded on first use (its own chunk, ~35 KB). */
export function loadCashCatalog(): Promise<CashRange[]> {
  cache ??= import('./cash-gto.json').then((m) => buildCashCatalog(m.default as RawFile));
  return cache;
}

/** "COvsBTN callvs3Bet 7.5bb · Rangos GTO". */
export function cashRangeLabel(r: CashRange): string {
  return `${r.name} · Rangos GTO`;
}
