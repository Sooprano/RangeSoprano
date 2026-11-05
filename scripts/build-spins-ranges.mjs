// Builds Sopranozilla's default spins ranges from the user's range exports (a
// JSON tree of folders → ranges in bracket notation: one combo per token,
// "[53.09]Kh8d,Kh8s,…[/53.09],AdAh,…", or hands and hand runs, "AA-JJ,K9s-K7s").
//
//   node scripts/build-spins-ranges.mjs <spins_gto_ranges.json>        → spins-regular.json
//   node scripts/build-spins-ranges.mjs --fish <rangos_fish.json>      → spins-fish.json
//   node scripts/build-spins-ranges.mjs --cash <rangos_cash_gto.json>  → cash-gto.json
//
// The cash export writes weights with a percent sign: "[13.4%]5d5c[/13.4%]".
//
// The FISH export has no BU folder for 3-handed spins: the user's call
// (D137) is to give the BU the ranges of the heads-up button, with the
// weights of "LIMP 20+" doubled (capped at 100 %, ~50 % of hands). The user
// also gave, by hand, the SB calling the BU's open (`FISH_EXTRA`).
//
// Each range is
// compacted: a hand whose 4 / 6 / 12 combos share one weight is written as the
// hand ("AKo"), otherwise combo by combo, grouped by weight. Weights are kept
// to 0.001 %. Before writing, every compacted range is expanded back and
// compared combo by combo with the original (and the script stops on any
// difference), so the file is exactly the user's ranges.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const RANKS = 'AKQJT98765432';
const SUITS = 'hdsc';
const args = process.argv.slice(2);
const FISH = args[0] === '--fish';
const CASH = args[0] === '--cash';
const src = FISH || CASH ? args[1] : args[0];
if (!src) {
  console.error('Uso: node scripts/build-spins-ranges.mjs [--fish] <export.json>');
  process.exit(1);
}
const OUT = resolve(
  `src/features/sopranozilla/ranges/${FISH ? 'spins-fish' : CASH ? 'cash-gto' : 'spins-regular'}.json`,
);

/** "Kh8d" → canonical "Kh8d" with the higher rank first (pairs: suit order). */
function canonical(combo) {
  const a = combo.slice(0, 2);
  const b = combo.slice(2, 4);
  const ra = RANKS.indexOf(a[0].toUpperCase());
  const rb = RANKS.indexOf(b[0].toUpperCase());
  if (ra < 0 || rb < 0 || !SUITS.includes(a[1]) || !SUITS.includes(b[1]) || a === b) return null;
  const first =
    ra < rb || (ra === rb && SUITS.indexOf(a[1]) < SUITS.indexOf(b[1])) ? [a, b] : [b, a];
  return first[0][0].toUpperCase() + first[0][1] + first[1][0].toUpperCase() + first[1][1];
}

/** Hand class of a canonical combo: "AKs" / "AKo" / "AA". */
function classOf(c) {
  if (c[0] === c[2]) return c[0] + c[2];
  return c[0] + c[2] + (c[1] === c[3] ? 's' : 'o');
}

/** Every canonical combo of a class. */
function combosOf(cls) {
  const out = [];
  for (const s1 of SUITS) {
    for (const s2 of SUITS) {
      const c = canonical(cls[0] + s1 + cls[1] + s2);
      if (!c || out.includes(c)) continue;
      const isPair = cls.length === 2;
      const suited = s1 === s2;
      if (isPair || (cls[2] === 's') === suited) out.push(c);
    }
  }
  return out;
}

/** "AA-JJ" → AA,KK,QQ,JJ · "K9s-K7s" → K9s,K8s,K7s (same first card, same suit kind). */
function handRun(token) {
  const [a, b] = token.split('-');
  if (a.length !== b.length || a.slice(2) !== b.slice(2))
    throw new Error(`rango inválido: ${token}`);
  const pair = a[0] === a[1];
  if (pair !== (b[0] === b[1]) || (!pair && a[0] !== b[0]))
    throw new Error(`rango inválido: ${token}`);
  const at = pair ? 0 : 1;
  const [i, j] = [RANKS.indexOf(a[at]), RANKS.indexOf(b[at])].sort((x, y) => x - y);
  const out = [];
  for (let k = i; k <= j; k++) {
    const r = RANKS[k];
    out.push(pair ? r + r : a[0] + r + a.slice(2));
  }
  return out;
}

const round = (w) => Math.round(w * 1000) / 1000;

/** Bracket text → Map(canonical combo → weight %). Classes are expanded. */
function expand(text) {
  const out = new Map();
  const put = (token, w) => {
    const t = token.trim();
    if (!t) return;
    if (/^[2-9TJQKA][hdsc][2-9TJQKA][hdsc]$/i.test(t)) {
      const c = canonical(t);
      if (!c) throw new Error(`combo inválido: ${t}`);
      out.set(c, w);
    } else if (/^[2-9TJQKA]{2}[so]?$/.test(t)) {
      for (const c of combosOf(t)) out.set(c, w);
    } else if (/^[2-9TJQKA]{2}[so]?-[2-9TJQKA]{2}[so]?$/.test(t)) {
      for (const cls of handRun(t)) for (const c of combosOf(cls)) out.set(c, w);
    } else {
      throw new Error(`token desconocido: ${t}`);
    }
  };
  const rest = text.replace(/\[(\d+(?:\.\d+)?)%?\]([\s\S]*?)\[\/\1%?\]/g, (_m, w, inner) => {
    for (const t of inner.split(',')) put(t, Number(w));
    return '';
  });
  for (const t of rest.split(',')) put(t, 100);
  return out;
}

/** Map(combo → weight %) → compact bracket text. */
function compact(weights) {
  const byClass = new Map();
  for (const [c, w] of weights) {
    const cls = classOf(c);
    if (!byClass.has(cls)) byClass.set(cls, new Map());
    byClass.get(cls).set(c, w);
  }
  const byWeight = new Map();
  const add = (w, token) => {
    if (!byWeight.has(w)) byWeight.set(w, []);
    byWeight.get(w).push(token);
  };
  for (const [cls, combos] of byClass) {
    const all = combosOf(cls);
    const ws = new Set(combos.values());
    if (combos.size === all.length && ws.size === 1) add([...ws][0], cls);
    else for (const [c, w] of combos) add(w, c);
  }
  return [...byWeight.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([w, tokens]) => (w >= 100 ? tokens.join(',') : `[${w}]${tokens.join(',')}[/${w}]`))
    .join(',');
}

const tree = JSON.parse(readFileSync(src, 'utf8'));
// The Regular export is one root folder; the FISH one is the list of folders.
const folders = Array.isArray(tree) ? tree : (tree.children ?? []);
// Ranges the user sent outside the export (D137).
const FISH_EXTRA = [
  {
    name: 'FISH 3w SBvBU',
    children: [
      {
        name: 'CALL vs OR 18+',
        range:
          '[85]A7s-A2s,KQs-K7s,QJs-Q9s,JTs-J9s,T9s,98s,87s,76s,65s,54s,43s,A8o-A2o,KQo-K8o,QJo-Q8o,JTo,J8o[/85],' +
          '[70]K6s-K3s,Q8s,J8s,T8s,97s,86s,75s,64s,K7o[/70],' +
          '[50]K6o-K4o,Q7o-Q6o,J9o,J7o-J6o,T9o-T6o,98o-96o,87o-85o,76o-75o,65o-64o,54o[/50],' +
          '[45]K2s,Q7s-Q2s,J7s,T7s,96s[/45],' +
          '[40]99-22,J6s-J5s,T6s-T5s,95s,85s[/40],' +
          '[25]AKs-A8s,J4s-J2s,T4s,94s,84s,74s,63s,53s-52s,42s,32s,AKo-A9o[/25],' +
          '[15]AA-TT,T3s-T2s,93s-92s,83s-82s,73s-72s,62s,K3o-K2o,Q5o-Q2o,J5o-J2o,T5o,95o,74o,53o,43o,32o[/15]',
      },
      {
        name: 'CALL vs OR 14-18',
        range:
          '[85]A7s-A2s,KQs-K7s,QJs-Q9s,JTs-J9s,T9s,98s,87s,76s,65s,54s,43s,A8o-A2o,KQo-K8o,QJo-Q8o,JTo,J8o[/85],' +
          '[70]K7o[/70],' +
          '[50]K6s-K3s,Q8s,J8s,T8s,97s,86s,75s,64s,K6o-K4o,Q7o,J9o,T9o-T8o,98o,87o,76o,65o,54o[/50],' +
          '[45]K2s[/45],' +
          '[33.3333]K3o-K2o,Q6o,J7o,T7o,97o[/33.3333],' +
          '[20]99-55,AKs-A8s,Q7s-Q2s,J7s,T7s,AKo-A9o[/20],' +
          '[15]AA-TT[/15],' +
          '[10]44-22,J6s-J2s,T6s,96s[/10]',
      },
    ],
  },
];

if (FISH) {
  folders.push(...FISH_EXTRA);
  const button = folders.find((f) => f.name.trim() === 'FISH HU SB');
  if (!button) throw new Error('falta la carpeta FISH HU SB');
  folders.push({
    name: 'FISH 3H BU',
    children: button.children.map((n) => ({
      ...n,
      double: n.name.trim() === 'LIMP 20+',
    })),
  });
}
const groups = [];
let total = 0;
let before = 0;
let after = 0;
for (const folder of folders) {
  const ranges = [];
  for (const node of folder.children ?? []) {
    if (node.children) throw new Error(`subcarpeta inesperada: ${folder.name}/${node.name}`);
    const read = expand(node.range ?? '');
    const original = node.double
      ? new Map([...read].map(([c, w]) => [c, Math.min(100, w * 2)]))
      : read;
    const rounded = new Map([...original].map(([c, w]) => [c, round(w)]).filter(([, w]) => w > 0));
    const text = compact(rounded);
    // Round trip: the compact text must give back the same combos and weights.
    const back = expand(text);
    if (back.size !== rounded.size)
      throw new Error(`${node.name}: ${back.size} ≠ ${rounded.size} combos`);
    for (const [c, w] of rounded) {
      if (back.get(c) !== w) throw new Error(`${node.name}: ${c} ${back.get(c)} ≠ ${w}`);
    }
    for (const [c, w] of original) {
      if (Math.abs((rounded.get(c) ?? 0) - w) > 0.0005 + 1e-9)
        throw new Error(`${node.name}: redondeo de ${c}`);
    }
    const combos = [...rounded.values()].reduce((s, w) => s + w / 100, 0);
    ranges.push({ name: node.name.trim(), range: text, combos: Math.round(combos * 1000) / 1000 });
    before += (node.range ?? '').length;
    after += text.length;
    total += 1;
  }
  groups.push({ name: folder.name.trim(), ranges });
}

writeFileSync(
  OUT,
  JSON.stringify(
    {
      source: FISH ? 'spins FISH ranges' : CASH ? 'Cash GTO wizard range' : tree.name,
      ranges: total,
      groups,
    },
    null,
    1,
  ) + '\n',
  'utf8',
);
console.log(`${total} rangos en ${groups.length} grupos → ${OUT}`);
console.log(`texto: ${(before / 1024).toFixed(0)} KB → ${(after / 1024).toFixed(0)} KB`);
