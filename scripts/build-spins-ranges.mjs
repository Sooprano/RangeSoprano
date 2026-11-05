// Builds Sopranozilla's default "Regular" spins ranges from the user's range
// export (a JSON tree of folders → ranges in bracket notation, one combo per
// token: "[53.09]Kh8d,Kh8s,…[/53.09],AdAh,…").
//
//   node scripts/build-spins-ranges.mjs <spins_gto_ranges.json>
//
// Writes src/features/sopranozilla/ranges/spins-regular.json. Each range is
// compacted: a hand whose 4 / 6 / 12 combos share one weight is written as the
// hand ("AKo"), otherwise combo by combo, grouped by weight. Weights are kept
// to 0.001 %. Before writing, every compacted range is expanded back and
// compared combo by combo with the original (and the script stops on any
// difference), so the file is exactly the user's ranges.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const RANKS = 'AKQJT98765432';
const SUITS = 'hdsc';
const OUT = resolve('src/features/sopranozilla/ranges/spins-regular.json');

const src = process.argv[2];
if (!src) {
  console.error('Uso: node scripts/build-spins-ranges.mjs <spins_gto_ranges.json>');
  process.exit(1);
}

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
    } else {
      throw new Error(`token desconocido: ${t}`);
    }
  };
  const rest = text.replace(/\[(\d+(?:\.\d+)?)\]([\s\S]*?)\[\/\1\]/g, (_m, w, inner) => {
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
const groups = [];
let total = 0;
let before = 0;
let after = 0;
for (const folder of tree.children ?? []) {
  const ranges = [];
  for (const node of folder.children ?? []) {
    if (node.children) throw new Error(`subcarpeta inesperada: ${folder.name}/${node.name}`);
    const original = expand(node.range ?? '');
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
  JSON.stringify({ source: tree.name, ranges: total, groups }, null, 1) + '\n',
  'utf8',
);
console.log(`${total} rangos en ${groups.length} grupos → ${OUT}`);
console.log(`texto: ${(before / 1024).toFixed(0)} KB → ${(after / 1024).toFixed(0)} KB`);
