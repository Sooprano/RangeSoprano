# RECOVERY — Range Soprano

> Convenciones, stack y reglas de implementación → ver `CLAUDE.md`.
> Este archivo guarda **contexto único de sesión a sesión**: hashes de rollback, estado del deploy, decisiones de diseño no obvias por código.

## Retomar sesión

> Lee CLAUDE.md + RECOVERY.md. Ejecuta `git log --oneline -5` y `git status`. Preséntame estado + plan. Espera confirmación antes de codificar.

## Plan B (rollback)

`git reset --hard <hash>` al último commit estable. Solo los hashes recientes son rollback realista — fases ≤12 están encadenadas en un único producto vivo.

| Hito | Hash |
|---|---|
| Fase 16a (Pot Odds Study trainer) | `c9517cb` |
| Fase 16 (trainer UX fix + viewer PNG branding) | `3985ffd` |
| Fase 15 (SEO técnico + GTOWizard import + ImportModal multi-acción) | `e2a01ff` → `b85d017` |
| Fase 14 (home FAQ + overview perf + print PDF + demo set) | `893eeed` |
| Fase 13 (Speed mode + Drawing scoring) | `490c291` |
| Custom domain rangesoprano.com (base + CNAME) | `ae10d1f` |

## Estado actual

Fases 1-16a completadas ✅. Última feature: Pot Odds Study trainer (4ª pestaña en `/trainer`).

Live en https://rangesoprano.com/ (custom domain Cloudflare → GitHub Pages). Indexado en Google Search Console (home + 3 rutas internas) y Bing Webmaster Tools. Lighthouse: SEO 100, Performance 99, Best Practices 100, Accessibility 95.

**Settings → Pages debe quedar siempre en Source: GitHub Actions** (no "Deploy from a branch"). Si GitHub UI lo resetea al re-tocar el custom domain, hay que volver a ponerlo en "GitHub Actions" o servirá el `index.html` raíz del repo (modo dev) → MIME error en `/src/main.tsx`.

## Roadmap pendiente

- **Fase 16b — OddsSpeed + leaderboard**: timer, mistake review, store separado en localStorage `range-soprano/odds-leaderboard`.
- **Fase 16c — Pulido Pot Odds**: mini-pot visual (barras pot vs bet escaladas), auto-advance toggle, streak bonus con Trophy.

## Feature deferred

**Edit-in-place de metadatos de rango existente** — hoy solo se puede editar nombre y grupo en el panel lateral. `position`, `situation`, `villainPosition` y `tableFormat` solo se fijan al crear. Para cambiarlos hay que borrar y recrear. El store ya acepta `updateRange(id, patch)` con esos campos; falta la UI (un panel de propiedades en `RangeManager` o un modal en `EditorPage`, reutilizando lógica de `NewRangeForm`).

**RangeManager scroll** — intenté `sticky top-4 + max-h + overflow-y-auto` pero rompía menús por clipping (overflow context atrapa absolute children) y aparecía scroll horizontal. Revertido al diseño original. Para implementar bien hace falta Portal de menús (no priorizado).

---

## Decisiones de diseño clave

Orden cronológico ascendente. Cada bloque captura el **por qué** detrás de algo no-obvio leyendo el código.

### Editor (fase 4)
- **History**: `{ ranges, activeRangeId }[]` en store, NO persistido, cap 50, snapshot por sesión de drag (no por celda). `pushHistory()` lo llama el UI antes de cada mutación imperativa (create/duplicate/delete/rename/group).
- **WeightSlider** global en toolbar (step 5). weight=100 → reemplaza celda; weight<100 → acumula hasta sum≤100 (trunca al hueco, no reduce otras acciones).
- **RangeCell** siempre aplica `CATEGORY_BG`; `buildBackground` usa weights como % absolutos y mete `transparent` trailing si sum<100. Siempre devuelve gradient (un color sólido en `backgroundImage` es CSS inválido).
- **Keyboard listener** a nivel window en EditorPage ignora input/textarea/contenteditable (permite undo nativo en inputs).
- **Selectors**: subscribir a `s.ranges` (ref estable) + `useMemo` — el shim de `useSyncExternalStoreWithSelector` invalida memos por identidad si pasás `useShallow` sobre `.map(r => ({...}))`.

### Viewer/Trainer (fases 5-6)
- **Filtros viewer/trainer NO persistidos**: abrir app debe arrancar sin sesgo. Compare state (toggle + B id) tampoco persistido.
- **`viewerRangeId` y `trainerRangeId`**: en uiStore, nullable, default null, sin bump de versión. Auto-selección del primer rango si el id persistido es stale.
- **Compare**: en compare mode el sidebar derecho desaparece; cada `RangePanel` lleva sus propias stats/legend.
- **Sampling clásico**: P(hand) ∝ combos del hand (no ∝ peso de celda) — reproduce frecuencia natural de reparto. Acción esperada por draw muestreada de los pesos de la celda con FOLD residual. Hands fuera del rango: implícito FOLD.
- **Drawing trainer**: comparación binaria in/out por combos (Jaccard). Cualquier acción en la celda truth la cuenta como "in".
- **Score session NO persistido**. Switching range → reset; switching hand → score continúa.

### A11y / UX (fase 7)
- **Toasts NO persistidos**, cap 4 (slice por la cola). Errores en `aria-live="assertive"` separada del polite. Hover/focus cancela auto-dismiss (sin reanudación).
- **ImportModal**: focus trap (Tab/Shift+Tab loop), restore focus en unmount, `aria-describedby` apunta al panel de resultados.
- **Menus** (Export, RangeManager): ArrowUp/Down/Home/End/Tab nav, focus al primer item al abrir, restore al trigger en Escape.
- **ErrorBoundary**: class component envolviendo `<RouterProvider>`, fallback con botón Reload, log a console.error SOLO en DEV.

### Deploy GitHub Pages (fase 7D)
- **`vite.config.ts`**: `base: '/'` (apex domain rangesoprano.com). Antes era `/RangeSoprano/` cuando se servía bajo `sooprano.github.io/RangeSoprano/`.
- **`src/router.tsx`**: `basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'` — deriva de `base`, no se toca al cambiar el dominio.
- **`public/CNAME`**: contiene `rangesoprano.com`. Vite lo copia a `dist/CNAME` y GitHub Pages lo respeta como custom domain en cada deploy. NO crear un CNAME en la raíz del repo (lo hace GitHub UI automáticamente al setear el dominio; es redundante porque el workflow sube `dist/`, no la raíz).
- **DNS Cloudflare**: 4 A records apex `rangesoprano.com → 185.199.108-111.153` + CNAME `www → sooprano.github.io`. Todos en **"Solo DNS"** (nube gris). NO activar proxy de Cloudflare — rompe la emisión del cert Let's Encrypt de GitHub Pages.
- **Source en Settings → Pages**: debe ser **"GitHub Actions"** (no "Deploy from a branch"). Si lo resetea, hay que volver a setearlo manualmente.
- **Workflow**: build + deploy jobs con `actions/upload-pages-artifact` y `actions/deploy-pages` v4. Trigger en push a `main` y `workflow_dispatch`.
- **SPA fallback**: copia `dist/index.html` a `dist/404.html` antes del upload + loop de pre-render para `/viewer /trainer /editor` (ver fase 15) → 200 en lugar de 404 para Googlebot.

### Home / onboarding (fase 9)
- **Ruta `/`**: monta `src/modules/home/HomePage.tsx` (lazy + Suspense). Reemplaza el viejo `Navigate to="/viewer"`. Sidebar añade item "Home" con `end` para no quedar siempre activo.
- **`ImportProfileButton`**: file picker oculto + botón visible. Lee con `file.text()`, valida `file.size ≤ MAX_IMPORT_BYTES` ANTES de leer, llama `importRanges(text, { replace: false })`. Reset `input.value = ''` al final para permitir reimportar el mismo archivo.
- **Donación BTC**: `bc1qyz4fd8msnedgjj9sv68qlu4theh7mdh57rea8w`. Reusa `copyToClipboard()` de `src/utils/exportRange.ts`.

### Villain + tableFormat HU/6max (fase 10)
- **`Range.tableFormat: '6max' | 'HU'`**: schema Zod con `.default('6max')` para rangos viejos. Sin bump de versión.
- **`HU_POSITIONS` y `huVillainOf()`** en `src/types/poker.ts`.
- **NewRangeForm**: en HU, posiciones restringidas a `HU_POSITIONS`, villain deshabilitado y muestra seat implícito.

### Refactor labels + vs Limp (fase 12)
- **Single source of truth** en `src/data/positions.ts` para `SITUATION_LABELS` y `TABLE_FORMAT_LABELS`. Eliminados 8 duplicados locales.
- **`vs_LIMP`** añadido al enum `SITUATIONS` (entre `RFI` y `vs_RFI`). Villain habilitado en vs Limp.
- **Subtítulo canónico de rango**: `{position} · {situation}{villain ? ' · vs ' + villain : ''}{HU ? ' · HU' : ''}`.

### PokerTable (trainer visual)
- **Forma**: stadium (`rounded-full` sobre felt 2.66:1) con `paddingBottom: '42%'` en container y `inset-y-[8%]` en felt → bordes rectos largos arriba/abajo + semicírculos en los extremos.
- **Slots con simetría bilateral**: hero abajo-centro (slot 0), uno directamente enfrente arriba-centro (slot 3); slots 2&4 a la misma altura (esquinas superiores), slots 1&5 a la misma altura (esquinas inferiores).
- **Hero overflow**: el stack hero (cartas + combos + badge ≈110px) excede el container; se compensa con `mb-12` en el wrapper para que la action grid no se solape con el badge.
- **HU mode**: cuando `range.tableFormat === 'HU'`, `getTableLayout` devuelve solo slots 0 (hero) y 3 (villano enfrente). Villano se calcula con `huVillainOf()` (BTN↔BB) ignorando el `villainPosition` persistido.

### Trainer Speed mode + Drawing fixes (fase 13)
- **Drawing trainer paleta action-aware**: `DrawingTrainer` lee `range.actions` ordenadas y muestra paleta radio-style. `computeRangeDiff` reescrito: match = la acción pintada existe (weight > 0) en la celda truth.
- **Speed mode**: tab con icono `Zap`. Tres fases internas (`config` / `running` / `finished`). Classic: PokerTable + ActionGrid + auto-advance 220ms flash. Drawing: paleta + RangeGrid editable, diff al expirar. Sub-runs con `key={runId}` para reset limpio.
- **Duraciones**: Classic = 30s / 60s / 5min / 10min; Drawing = 30s / 45s / 60s / 90s.
- **Timer pattern**: `setInterval(100ms)` con `performance.now()`; `doneRef` evita doble-finish; `scoreRef`/`guessRef`/`onFinishRef` mantienen efectos sin depender de props mutables.
- **Leaderboard** (`range-soprano/leaderboard`, version 1): `byRangeId: Record<rangeId, { classic: ClassicEntry[]; drawing: DrawingEntry[] }>`, cap 5 por estilo. Sort: Classic por accuracy → correct → hpm; Drawing por accuracy → matchCombos.
- **Drawing session scoring** (in-memory, NO persistido): `sessionRounds[]` con `Save round`. `SessionBar` muestra rounds / avg / best.
- **Classic auto-advance**: tras seleccionar acción, `drawNext()` se llama automáticamente a 1.5 s. `CountdownBar` animada muestra el countdown. Enter/Space/N siguen funcionando para avance manual.

### Home FAQ + Overview perf + Print PDF + demo (fase 14)
- **Demo set** (`src/data/sampleRanges.ts`): exporta `SAMPLE_RANGES` con 1 carpeta (`Demo`) + 2 sub-carpetas (`Demo/Opens`, `Demo/Defense`) + 4 rangos (BTN/CO/UTG RFI + BB vs BTN). `EmptyState.loadDemo` itera sobre todos. `SAMPLE_BTN_RFI` se mantiene exportado para compat con tests/imports antiguos.
- **HomePage FAQ**: usa `<details>` HTML nativo (accesible sin JS extra) con `<summary>` + `ChevronDown` rotando 180° en `group-open:`. Lista de 9 preguntas (qué es, login, .json, offline, contribuir, etc.).
- **Overview compact variant**: `RangeGrid` acepta `variant?: 'default' | 'compact'`, propaga `compact` a `RangeCell`. En compact, `RangeCell` omite el bloque `<div role="tooltip">` (ahorra ~169 nodos por tile × N tiles). El wrapper grid lleva `data-rg-variant` y CSS targetea `[data-rg-variant='compact'] [data-hand]:not([style])` (celdas vacías = sin atributo style inline) para forzar `bg-black + visibility:hidden` en el span del label. Tipografía a 9px bold para coincidir con PDFs de referencia.
- **OverviewTile.memo**: API cambió de `onClick: () => void` a `onSelect: (rangeId: string) => void`. El parent (ViewerPage) usa `useCallback` para mantener identidad estable, lo cual permite que `React.memo` evite re-renders al filtrar carpetas.
- **Print PDF — causa raíz fix**: el `position: absolute; inset: 0` en `.print-root` + `height: 273mm; overflow: hidden` en `.print-page` rompían la paginación del motor de impresión (cada section quedaba clipeada y los tiles overflowing iban a una página separada). Solución: dimensiones explícitas (width + height en mm) sobre `[role='grid']` por `data-per-page` (12→48mm, 9→56mm, 6→58mm, 4→88mm, 2→110mm). Esto sobreescribe el `aspect-square` que dependía del ancho de columna y daba al engine números deterministas.
- **Print PDF — chrome del tile constreñido**: `.print-no-break` recibe `width: <gridSize>mm; mx-auto` por perPage para que los labels (stack/sizing arriba, name/subtitle abajo) no desborden los costados del grid. Footer del tile apilado vertical (`text-[6.5px]`, `leading-tight`) en lugar de flex-justify-between para mejor truncate.
- **Print PDF — texto negro en celdas**: `.print-root [data-hand], .print-root [data-hand] * { color: #000 !important }` aplicado fuera de `@media print` (preview = print). El `text-white/95` Tailwind se vencía por specificity 0,2,0 + !important. `text-shadow: none` y `filter: none` quitan el drop-shadow del span interno.
- **Print PDF — logo en cada hoja**: bloque centrado arriba de cada `.print-page` con `<Spade />` (`text-accent`, NO override print → mantiene morado en PDF) + "Range Soprano" wordmark + "POKER RANGES" microcopy. `document.title` se setea a `"Range Soprano · {state.title}"` en el useEffect de PrintPage para que el header opcional del navegador no muestre "localhost".
- **Print PDF — browser headers/footers**: la fecha/URL que el navegador inyecta solo se quitan desde el diálogo de impresión (uncheck "Encabezados y pies de página"). No suprimibles desde CSS.

### SEO + GTOWizard import + ImportModal multi-acción (fase 15)
- **Archivos SEO** (`public/robots.txt`, `public/sitemap.xml`, `public/og-image.svg` 1200×630). Vite copia `public/*` a `dist/` automáticamente. `index.html`: `lang="es"`, title/description en español, canonical, Open Graph, Twitter card, JSON-LD `WebApplication`.
- **Per-route titles** vía `src/hooks/useDocumentTitle.ts` (hook minimal de ~30 líneas; setea `document.title`, `meta[name=description]` y opcional `noindex`. Restaura previo en cleanup). Aplicado en HomePage, ViewerPage, TrainerPage, EditorPage. NotFoundPage y PrintPage usan `noindex`.
- **Pre-render de rutas SPA** en `.github/workflows/deploy.yml`: antes era solo `cp dist/index.html dist/404.html` (truco que arreglaba refresh para usuarios pero servía HTTP 404 a Googlebot). Agregado loop `for route in viewer trainer editor; do mkdir -p dist/$route; cp dist/index.html dist/$route/index.html; done` → GitHub Pages devuelve 200 en todas las rutas. Sin esto Google rechazaba indexar /viewer /trainer /editor con "Descubierta: actualmente sin indexar".
- **FAQPage JSON-LD** en HomePage: `useEffect` que appenda/remueve `<script type="application/ld+json">` con las 9 FAQs. Para soportar respuestas con JSX el tipo `Faq` ahora tiene `aPlain?: string` opcional (solo se usa cuando `a` es ReactNode). Solo se monta en `/`, no en otras rutas.
- **Contenido SEO en HomePage**: 2 secciones nuevas entre Módulos y Atajos: "¿Qué es un rango preflop?" (educativa, captura visitantes desde búsqueda) y "Cómo estudiar rangos de poker con Range Soprano" (workflow 4 pasos: Editor → Viewer → Trainer → Print). Keywords integradas naturalmente.
- **GTOWizard parser** en `src/utils/handRangeParser.ts`: detección por regex `^[2-9TJQKA][cdhs][2-9TJQKA][cdhs]:\s*[0-9.]+$` en el primer token, dispatch a `parseGtoWizard()` antes del parser legacy. Conversión combo→hand: pares por mismos ranks, suited si mismos suits, offsuit si distintos. Cell weight = `sum(combo_weights) / total_combos × 100` (6/4/12 combos por par/suited/offsuit). Clamp combos a 1 (artefactos `1.0001` del solver), round a 1 decimal, filtra `rounded > 0` (descarta ruido `0.0001`). Cero cambios en `ImportModal` — sigue llamando `parseHandRange()` igual.
- **ImportModal multi-acción**: N panes dinámicos (uno por `range.actions`) con dropdown + textarea + parsing independiente, un solo Apply con `pushHistory()` único y toast de combos clampeados cuando la suma >100% por celda.
- **Export/import perfil JSON preserva `groupMeta`** (colores/orden/colapso de carpeta) vía nuevo `zExportPayload` opcional y `mergeGroupMeta()` en uiStore — JSONs viejos sin el campo siguen siendo válidos.

### Trainer UX (fase 16)
- **Scroll-reset al cambiar rango** era causado por `key={range.id}` en `TrainerPage` forzando unmount; el placeholder `min-h-[40vh]` del loading colapsaba `scrollHeight` y el navegador clampeaba `scrollY`. Cada modo (Classic/Drawing/Speed) ya tiene su propio `useEffect([range])` con `rangeIdRef` para reset interno → el `key` era redundante. Quitarlo en los 3 modos resuelve el bug sin tocar lógica de reset.
- **ActionGrid compacta** en Classic y Speed Classic: `grid-cols-2 sm:grid-cols-3`, botones `flex-row justify-between` con swatch (`h-2.5 w-2.5`) a la izquierda, label `flex-1 truncate text-left` al medio, tecla en pill `text-[10px] tabular-nums` a la derecha. Card de la zona de juego de `gap-6 p-6` → `gap-4 p-4 sm:p-5`; `min-h` del slot de feedback en Classic baja de `5rem` a `3.5rem`.

### Viewer PNG branding (fase 16)
- **`ExportHeader` local** en `ViewerPage` se monta condicional dentro de `captureRef` solo durante el snapshot: state `isExporting` + dos `requestAnimationFrame` antes de llamar `exportNodeToPng` para asegurar que el header está pintado cuando html-to-image clona el DOM. Tras el toPng, `setIsExporting(false)` en `finally`.
- **Composición**: `Spade text-accent` + "Range Soprano" wordmark + "Poker Ranges" microcopy `tracking-[0.18em]` + `<h2>` con `range.name` + subtítulo `${position} · ${SITUATION_LABELS[situation]}${villain ? ` · vs ${villain}` : ''}` + badge "HU" si `tableFormat==='HU'`. Compare mode usa título compuesto `${rangeA.name} vs ${rangeB.name}` sin subtítulo (los paneles ya llevan labels).
- **`aria-hidden`** en el header durante el flash de export para no contaminar accesibilidad. Cero cambios en `exportRange.ts`, `PrintPage` ni en el grid/store.

### Pot Odds Study trainer (fase 16a)
- **4ª pestaña en `/trainer`** con icono `Percent`, range-independent: en `TrainerPage`, branch dedicado para `mode === 'odds'` que oculta `ViewerRangeList` y `SituationSelector`, eyebrow `Math · pot odds`, y bypassa el early-return de `ranges.length === 0` (la herramienta funciona sin rangos cargados).
- **Lógica pura en `src/utils/potOdds.ts`**: 8 sizings canónicos (`1/4 · 1/3 · 1/2 · 2/3 · 3/4 · pot · 1.5x · 2x`) en `SIZINGS` y `SIZING_FRACTION`. Display values **hardcoded** en `BLUFF_FE_DISPLAY` (`20% · 25% · 33% · 40% · 43% · 50% · 60% · 66%`) y `CALL_EQ_DISPLAY` (`16% · 20% · 25% · 28% · 30% · 33% · 37.5% · 40%`) para matchear exactamente la tabla canónica del libro y permitir matching discreto de strings en MC sin drift de floating-point.
- **4 tipos de pregunta**: `bluff-fe` (apostás X, ¿FE?), `call-eq` (villano apuesta X, ¿equity?), `bluff-size` (necesitás X% FE, ¿qué tamaño?), `call-size` (tenés X% equity, ¿hasta qué bet podés pagar?). Filter chips en UI permiten activar/desactivar cada tipo (mínimo 1 activo, no se puede desactivar todos).
- **Distractores por proximidad**: `pickNeighborIndices(correctIdx, total, 3)` ordena por distancia absoluta al índice correcto en `SIZINGS`, ties broken random. Asegura 3 vecinos balanceados sin sesgo direccional cuando el correcto está en el medio. Output shuffleado con Fisher-Yates.
- **MC fijo de 4 opciones** (no 8): el objetivo en mesa real es discriminación entre buckets adyacentes, no memorización exhaustiva. Atajos `1-4` mantienen ergonomía de home row consistente con `ActionGrid` del Classic.
- **Explicación con números sustituidos**: tras responder, FeedbackPanel muestra `bet / (pot + bet) = 0.5 / (1 + 0.5) = 33%` en `font-mono`. Helper `fmtFrac()` redondea a 2 decimales, trim trailing zeros.
- **Estado in-memory only** (sin persistencia): score (correct/total/streak/bestStreak) se reinicia al recargar o al cambiar a otra tab. No hay leaderboard todavía — eso viene en fase 16b.
