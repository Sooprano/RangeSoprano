// Default villain ranges for spins (D127): the user's GTO ranges for a
// "Regular" rival, 3-handed (3H) and heads-up (HU). The data comes from
// `spins-regular.json` (built by scripts/build-spins-ranges.mjs from the
// user's export); this module reads what each range IS from its name and
// folder, so the picker can match a hand's preflop line.
//
// Name grammar (case-insensitive), always "<stack>bb" first:
//   BU OR 25bb · BU OS 12bb             BU opens / open-shoves (3H)
//   BBvsBU 18bb call                    BB calls BU's open (3H)
//   20bb limp · 25bb or 3bb · 13bb MR   SB limps / opens to 3bb / min-raises (3H, BU folded)
//   16bb X · 20bb call 2.5bb            BB checks SB's limp / calls SB's open (3H)
//   SBHU 30bb OR 2.5bb · MR · LP · OS   HU button: open / min-raise / limp / shove
//   SBHU 25bb callvsRol 4.5bb           HU button limped, calls BB's raise to 4.5bb
//   BBHU 25bb ROL 6.5bb · ROL AI · X    HU BB raises over the limp / shoves / checks
//   BBHU 25bb 3B 6.5bb · 3B AI · CALL   HU BB 3-bets / 3-bet shoves / calls the open
// MR = min-raise (2bb). "RIK" is a typo of "ROL" in one name (confirmed).
//
// FISH ranges (D137, `spins-fish.json`): the user's ranges for a recreational
// rival. Their names carry a stack BAND, not a stack ("MNR 16-20", "LIMP 20+";
// the lower bound is in the band: 20bb → "20+") and some a size band
// ("MNR" ≤ 2.25bb, "3x" 2.25–3.5bb). See `parseFishName`.

import type { Position } from '@/types/poker';

export type SpinsFormat = '3H' | 'HU';

/** What the villain did preflop in that range. */
export type SpinsAction =
  | 'open' // raise first in (OR, MR)
  | 'shove' // open shove (OS)
  | 'limp' // limp (limp, LP)
  | 'check' // BB checks behind a limp (X)
  | 'call-open' // calls an open raise
  | 'call-rol' // limped, then calls a raise over the limp
  | 'rol' // raise over a limp (ROL)
  | '3bet' // 3-bet over an open
  | 'call-3bet'; // opened, then calls a 3-bet that is not all-in (FISH only)

/** Kind of rival the ranges are for: GTO "Regular" or recreational "FISH". */
export type SpinsRival = 'regular' | 'fish';

export const RIVAL_LABEL: Record<SpinsRival, string> = { regular: 'Regular', fish: 'Fish' };

/** Effective stacks a FISH range is for: min ≤ eff < max (max null = and up). */
export type StackBand = { min: number; max: number | null };

export type SpinsRange = {
  /** Unique: "<folder>/<name>". */
  id: string;
  group: string;
  name: string;
  format: SpinsFormat;
  /** Villain's seat. Heads-up the button (the SB) is "BTN", like positionsOf(). */
  position: Position;
  /** The other player in the pot; null = anyone (the BU opening first in, 3H). */
  vs: Position | null;
  action: SpinsAction;
  stackBb: number;
  /** Raise size in bb (open, ROL, 3-bet, or the raise that was called); 'AI' = all in. */
  size: number | 'AI' | null;
  rival: SpinsRival;
  /** FISH: the stacks the range is for (`stackBb` is its lower bound). Regular: null. */
  band: StackBand | null;
  /** FISH: sizes the range takes, min < size ≤ max (bb). Regular: null (closest size). */
  sizeBand: { min: number; max: number } | null;
  /** Range text (bracket notation, exact combos). */
  range: string;
  combos: number;
};

type Folder = {
  format: SpinsFormat;
  position: Position;
  /** The other player in the pot; null = anyone (BU first in, 3H). */
  vs: Position | null;
  prefix: RegExp | null;
};

/** Folder → table format and villain seat. */
const FOLDERS: Record<string, Folder> = {
  'bu 3h': { format: '3H', position: 'BTN', vs: null, prefix: /^bu\s+/ },
  'bb vs bu 3h': { format: '3H', position: 'BB', vs: 'BTN', prefix: /^bbvsbu\s+/ },
  'sb vs bb 3h': { format: '3H', position: 'SB', vs: 'BB', prefix: null },
  'bb vs sb 3h': { format: '3H', position: 'BB', vs: 'SB', prefix: null },
  sbhu: { format: 'HU', position: 'BTN', vs: 'BB', prefix: /^sbhu\s+/ },
  'sbhu call vs rol': { format: 'HU', position: 'BTN', vs: 'BB', prefix: /^sbhu\s+/ },
  'bbhu vs lp': { format: 'HU', position: 'BB', vs: 'BTN', prefix: /^bbhu\s+/ },
  'bbhu vs or': { format: 'HU', position: 'BB', vs: 'BTN', prefix: /^bbhu\s+/ },
};

const BB = /^(\d+(?:\.\d+)?)bb$/;

function sizeOf(token: string | undefined): number | 'AI' | null | undefined {
  if (token === undefined) return null;
  if (token === 'ai') return 'AI';
  const m = BB.exec(token);
  return m ? Number(m[1]) : undefined;
}

/**
 * What a range is, from its folder and name. Null when the name does not
 * follow the grammar (a test checks that every bundled range parses).
 */
export function parseSpinsName(
  group: string,
  name: string,
): Pick<SpinsRange, 'format' | 'position' | 'vs' | 'action' | 'stackBb' | 'size'> | null {
  const folder = FOLDERS[group.trim().toLowerCase()];
  if (!folder) return null;
  let rest = name.trim().toLowerCase().replace(/\s+/g, ' ');
  if (folder.prefix) {
    if (!folder.prefix.test(rest)) return null;
    rest = rest.replace(folder.prefix, '');
  }
  const words = rest.split(' ');
  // "BU OR 25bb": the action comes before the stack there.
  const stackAt = words.findIndex((w) => BB.test(w));
  if (stackAt < 0) return null;
  const stackBb = Number(BB.exec(words[stackAt]!)![1]);
  const before = words.slice(0, stackAt);
  const after = words.slice(stackAt + 1);
  const tokens = [...before, ...after];
  const [kw, arg, extra] = tokens;
  if (kw === undefined || extra !== undefined) return null;

  const base = { format: folder.format, position: folder.position, vs: folder.vs, stackBb };
  const size = sizeOf(arg);
  if (size === undefined) return null;
  switch (kw) {
    case 'or':
      return { ...base, action: 'open', size };
    case 'mr':
      return arg === undefined ? { ...base, action: 'open', size: 2 } : null;
    case 'os':
      return arg === undefined ? { ...base, action: 'shove', size: 'AI' } : null;
    case 'limp':
    case 'lp':
      return arg === undefined ? { ...base, action: 'limp', size: null } : null;
    case 'x':
      return arg === undefined ? { ...base, action: 'check', size: null } : null;
    case 'call':
      return { ...base, action: 'call-open', size };
    case 'callvsrol':
      return size !== null ? { ...base, action: 'call-rol', size } : null;
    case 'rol':
    case 'rik': // typo in one name: "BBHU 11bb RIK 2.5bb"
      return size !== null ? { ...base, action: 'rol', size } : null;
    case '3b':
      return size !== null ? { ...base, action: '3bet', size } : null;
    default:
      return null;
  }
}

type Meta = Pick<
  SpinsRange,
  'format' | 'position' | 'vs' | 'action' | 'stackBb' | 'size' | 'band' | 'sizeBand'
>;

/**
 * FISH folder → table format and villain seat. "FISH 3H BU" and
 * "FISH 3w SBvBU" are added by the build script.
 */
const FISH_FOLDERS: Record<string, Omit<Folder, 'prefix'>> = {
  'fish hu sb': { format: 'HU', position: 'BTN', vs: 'BB' },
  'fish hu bb': { format: 'HU', position: 'BB', vs: 'BTN' },
  'fish 3w bbvbu': { format: '3H', position: 'BB', vs: 'BTN' },
  'fish 3wsbvbb': { format: '3H', position: 'SB', vs: 'BB' },
  'fish 3wbbvsb': { format: '3H', position: 'BB', vs: 'SB' },
  'fish 3h bu': { format: '3H', position: 'BTN', vs: null },
  'fish 3w sbvbu': { format: '3H', position: 'SB', vs: 'BTN' },
};

const MNR = { min: 0, max: 2.25 };
const THREE_X = { min: 2.25, max: 3.5 };
const ANY = { min: 0, max: Number.POSITIVE_INFINITY };

/** FISH actions, by the name without its stack band. */
const FISH_ACTIONS: Record<string, Pick<SpinsRange, 'action' | 'size' | 'sizeBand'>> = {
  mnr: { action: 'open', size: 2, sizeBand: MNR },
  '3x': { action: 'open', size: 3, sizeBand: THREE_X },
  limp: { action: 'limp', size: null, sizeBand: null },
  os: { action: 'shove', size: 'AI', sizeBand: null },
  'x vs limp': { action: 'check', size: null, sizeBand: null },
  'check vs limp': { action: 'check', size: null, sizeBand: null },
  'iso v limp': { action: 'rol', size: null, sizeBand: ANY },
  'call vs mnr': { action: 'call-open', size: 2, sizeBand: MNR },
  'call vs 2,5-3x': { action: 'call-open', size: 3, sizeBand: THREE_X },
  'call vs 3bet nai': { action: 'call-3bet', size: null, sizeBand: ANY },
  // Calls an open of any size that is not all-in.
  'call vs or': { action: 'call-open', size: null, sizeBand: ANY },
};

/**
 * What a FISH range is: "MNR 16-20" · "LIMP 20+" · "CALL vs 3Bet NAI" (no
 * band = any stack). Null when the folder or the name is unknown.
 */
export function parseFishName(group: string, name: string): Meta | null {
  const folder = FISH_FOLDERS[group.trim().toLowerCase()];
  if (!folder) return null;
  let rest = name.trim().toLowerCase().replace(/\s+/g, ' ');
  let band: StackBand = { min: 0, max: null };
  const m = /\s(\d+(?:\.\d+)?)(?:\+|-(\d+(?:\.\d+)?))$/.exec(rest);
  if (m) {
    band = { min: Number(m[1]), max: m[2] !== undefined ? Number(m[2]) : null };
    rest = rest.slice(0, m.index);
  }
  const act = FISH_ACTIONS[rest];
  if (!act) return null;
  return { ...folder, ...act, stackBb: band.min, band };
}

/** Does a FISH range take this effective stack? */
export function inBand(band: StackBand, eff: number): boolean {
  return eff >= band.min - 1e-9 && (band.max === null || eff < band.max - 1e-9);
}

/** "16-20" · "20+" · "todos" (a FISH band, as the user names it). */
export function bandText(band: StackBand): string {
  if (band.max === null) return band.min > 0 ? `${band.min}+` : 'todos';
  return `${band.min}-${band.max}`;
}

type RawFile = {
  groups: { name: string; ranges: { name: string; range: string; combos: number }[] }[];
};

/** Bundled data → typed catalog (ranges whose name does not parse are left out). */
export function buildSpinsCatalog(data: RawFile, rival: SpinsRival = 'regular'): SpinsRange[] {
  const out: SpinsRange[] = [];
  for (const g of data.groups) {
    for (const r of g.ranges) {
      let meta: Meta | null;
      if (rival === 'fish') meta = parseFishName(g.name, r.name);
      else {
        const m = parseSpinsName(g.name, r.name);
        meta = m && { ...m, band: null, sizeBand: null };
      }
      if (!meta) continue;
      out.push({
        id: `${g.name}/${r.name}`,
        group: g.name,
        name: r.name,
        ...meta,
        rival,
        range: r.range,
        combos: r.combos,
      });
    }
  }
  return out;
}

let cache: Promise<SpinsRange[]> | null = null;

/**
 * Every spins range, Regular and FISH, loaded on first use (their own chunks,
 * ~480 KB + 16 KB). The picker filters by rival.
 */
export function loadSpinsCatalog(): Promise<SpinsRange[]> {
  cache ??= Promise.all([import('./spins-regular.json'), import('./spins-fish.json')]).then(
    ([reg, fish]) => [
      ...buildSpinsCatalog(reg.default as RawFile),
      ...buildSpinsCatalog(fish.default as RawFile, 'fish'),
    ],
  );
  return cache;
}

/** Label of a spins range: "BBHU 13bb ROL 4.5bb · Regular" · "FISH HU SB / LIMP 20+ · Fish". */
export function spinsRangeLabel(r: SpinsRange, approx: boolean): string {
  const name = r.rival === 'fish' ? `${r.group} / ${r.name}` : r.name;
  return `${name} · ${RIVAL_LABEL[r.rival]}${approx ? ' (aproximado)' : ''}`;
}
