// Post-build SEO pre-render for the GitHub Pages SPA.
//
// Vite emits a single dist/index.html. On a client-rendered SPA every sub-route
// would otherwise share that file's <title>/<meta description> until the JS runs
// (useDocumentTitle). Crawlers/scrapers that don't execute JS (social previews,
// some AI summarizers) then read the HOME meta on every route. This script writes
// one dist/<route>/index.html per route with the correct static meta baked in, so
// the right title/description/canonical/OG are present in the first HTML wave.
//
// Keep ROUTES in sync with each page's useDocumentTitle(...) call.

import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dist = resolve(__dirname, '..', 'dist');
const ORIGIN = 'https://rangesoprano.com';

/** @type {{ path: string; title: string; description: string }[]} */
const ROUTES = [
  {
    path: 'viewer',
    title: 'Visualizador de rangos · Range Soprano',
    description:
      'Visualiza rangos preflop de poker con filtros por posición, situación y villano. Compara dos rangos, exporta PNG, imprime PDF o copia a Flopzilla.',
  },
  {
    path: 'trainer',
    title: 'Entrenador de rangos · Range Soprano',
    description:
      'Entrena manos preflop de poker en mesa 6-max o HU. Modo Clásico, Speed contrarreloj con leaderboard local o Drawing.',
  },
  {
    path: 'editor',
    title: 'Editor de rangos · Range Soprano',
    description:
      'Editor visual de rangos de poker con pesos mixtos, paleta de acciones por rango, undo/redo, carpetas, import/export JSON y copia a Flopzilla.',
  },
  {
    path: 'calculadoras',
    title: 'Calculadoras de poker · Range Soprano',
    description:
      'Diecisiete calculadoras de EV (expected value), fold equity, implied odds, all-in, doble barrel, value/bluff y más para analizar manos de poker. Sin login, sin tracking.',
  },
  {
    path: 'analisis',
    title: 'Análisis de manos de poker · Range Soprano',
    description:
      'Pega el historial de mano (.txt) de tu sala y la web extrae el spot y abre la calculadora de EV correcta pre-llenada. La equity la traes de Flopzilla. Sin login, sin tracking.',
  },
  {
    path: 'ejercicios',
    title: 'Ejercicios de poker · Range Soprano',
    description:
      'Drills de matemática de poker: elige la calculadora de EV correcta, cuenta combos con bloqueadores, balancea value/bluff, fold equity, SPR, pot odds y push/fold de Nash. Sin login, sin tracking.',
  },
];

const esc = (s) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Rewrite the SEO-relevant head tags of the home HTML for a single route.
 * @param {string} html
 * @param {{ title: string; description: string; canonical: string }} meta
 */
function rewrite(html, { title, description, canonical }) {
  const t = esc(title);
  const d = esc(description);
  const replacements = [
    [/<title>[\s\S]*?<\/title>/, `<title>${t}</title>`],
    [
      /<meta\s+name="description"[\s\S]*?\/>/,
      `<meta name="description" content="${d}" />`,
    ],
    [
      /<link rel="canonical"[^>]*\/>/,
      `<link rel="canonical" href="${canonical}" />`,
    ],
    [
      /<meta property="og:title"[^>]*\/>/,
      `<meta property="og:title" content="${t}" />`,
    ],
    [
      /<meta\s+property="og:description"[\s\S]*?\/>/,
      `<meta property="og:description" content="${d}" />`,
    ],
    [
      /<meta property="og:url"[^>]*\/>/,
      `<meta property="og:url" content="${canonical}" />`,
    ],
    [
      /<meta name="twitter:title"[^>]*\/>/,
      `<meta name="twitter:title" content="${t}" />`,
    ],
    [
      /<meta\s+name="twitter:description"[\s\S]*?\/>/,
      `<meta name="twitter:description" content="${d}" />`,
    ],
  ];
  let out = html;
  for (const [re, sub] of replacements) {
    if (!re.test(out)) {
      console.warn(`prerender: pattern not found for ${canonical}: ${re}`);
      continue;
    }
    out = out.replace(re, sub);
  }
  return out;
}

const home = readFileSync(resolve(dist, 'index.html'), 'utf8');

for (const route of ROUTES) {
  const canonical = `${ORIGIN}/${route.path}/`;
  const html = rewrite(home, { title: route.title, description: route.description, canonical });
  const dir = resolve(dist, route.path);
  mkdirSync(dir, { recursive: true });
  writeFileSync(resolve(dir, 'index.html'), html, 'utf8');
  console.log(`prerender: wrote dist/${route.path}/index.html`);
}

// SPA fallback: GitHub Pages serves 404.html for unknown paths; the SPA router
// then resolves client-side. Keep the home meta here.
copyFileSync(resolve(dist, 'index.html'), resolve(dist, '404.html'));
console.log('prerender: wrote dist/404.html');
