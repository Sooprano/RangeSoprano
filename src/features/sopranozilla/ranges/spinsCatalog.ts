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
  | '3bet'; // 3-bet over an open

export type SpinsRange = {
  /** Unique: "<folder>/<name>". */
  id: string;
  group: string;
  name: string;
  format: SpinsFormat;
  /** Villain's seat. Heads-up the button (the SB) is "BTN", like positionsOf(). */
  position: Position;
  action: SpinsAction;
  stackBb: number;
  /** Raise size in bb (open, ROL, 3-bet, or the raise that was called); 'AI' = all in. */
  size: number | 'AI' | null;
  /** Range text (bracket notation, exact combos). */
  range: string;
  combos: number;
};

type Folder = { format: SpinsFormat; position: Position; prefix: RegExp | null };

/** Folder → table format and villain seat. */
const FOLDERS: Record<string, Folder> = {
  'bu 3h': { format: '3H', position: 'BTN', prefix: /^bu\s+/ },
  'bb vs bu 3h': { format: '3H', position: 'BB', prefix: /^bbvsbu\s+/ },
  'sb vs bb 3h': { format: '3H', position: 'SB', prefix: null },
  'bb vs sb 3h': { format: '3H', position: 'BB', prefix: null },
  sbhu: { format: 'HU', position: 'BTN', prefix: /^sbhu\s+/ },
  'sbhu call vs rol': { format: 'HU', position: 'BTN', prefix: /^sbhu\s+/ },
  'bbhu vs lp': { format: 'HU', position: 'BB', prefix: /^bbhu\s+/ },
  'bbhu vs or': { format: 'HU', position: 'BB', prefix: /^bbhu\s+/ },
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
): Pick<SpinsRange, 'format' | 'position' | 'action' | 'stackBb' | 'size'> | null {
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

  const base = { format: folder.format, position: folder.position, stackBb };
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

type RawFile = {
  groups: { name: string; ranges: { name: string; range: string; combos: number }[] }[];
};

/** Bundled data → typed catalog (ranges whose name does not parse are left out). */
export function buildSpinsCatalog(data: RawFile): SpinsRange[] {
  const out: SpinsRange[] = [];
  for (const g of data.groups) {
    for (const r of g.ranges) {
      const meta = parseSpinsName(g.name, r.name);
      if (!meta) continue;
      out.push({
        id: `${g.name}/${r.name}`,
        group: g.name,
        name: r.name,
        ...meta,
        range: r.range,
        combos: r.combos,
      });
    }
  }
  return out;
}

let cache: Promise<SpinsRange[]> | null = null;

/** The Regular spins catalog, loaded on first use (its own chunk, ~480 KB). */
export function loadSpinsRegular(): Promise<SpinsRange[]> {
  cache ??= import('./spins-regular.json').then((m) => buildSpinsCatalog(m.default as RawFile));
  return cache;
}
