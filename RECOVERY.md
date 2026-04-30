# RECOVERY — Range Soprano

## Retomar sesión

> Lee CLAUDE.md + RECOVERY.md. Ejecuta `git log --oneline -5` y `git status`. Preséntame estado + plan. Espera confirmación antes de codificar.

## Plan B

`git reset --hard <hash>` al último commit estable de la fase deseada.

## Commits estables por fase

- Custom domain rangesoprano.com (base / + CNAME): `ae10d1f`

- Fase 1 (setup): `02f65ff`
- Fase 2 (RangeGrid): `6a3cf0e`
- Fase 3 (stores + persist): `e0278c6`
- Fase 4A (editor base): `acda2a4`
- Fase 4B (pesos mixtos + undo/redo): `9a9bc4a`
- Fase 4C (import/export): `eb9969a`
- Fase 5 (viewer scope/filters/compare/export): `f9374b9`
- Fase 6 (trainer classic/drawing/filters): `e6a6bbb`
- Fase 7A (toast system): `1359878`
- Fase 7B (a11y modals/menus): `2f1d368`
- Fase 7C (error boundary + 404 + meta): `caa190b`
- Fase 7D (deploy GitHub Pages): `477cd1e`
- Fase 9 (Home + onboarding + import perfil + BTC): `70e7e43`
- Fase 10 (villain + tableFormat HU/6max): `0d9bd8f`
- Fase 11 (palette reuse · folder rename · meta edit-in-place): `e3f7c36`
- Fase 12 (vs Limp · refactor labels · badges HU/villain · home tips): `e5fd2b5`
- Drawing trainer fix (paleta + diff action-aware): `76dd027`
- Fase 13 (Speed mode + Drawing session scoring): `490c291`
- Fase 13 (durations + Ctrl+RightClick hand+ en Drawing): `f61b41a`
- Fase 13 docs: `9e654de`
- Import cap 3.8 MB + classic auto-advance + home updates: `6e86b72`

## Estado actual

Todas las fases planificadas (1–13) completadas ✅.

Live en https://rangesoprano.com/ (custom domain Cloudflare → GitHub Pages).

**Settings → Pages debe quedar siempre en Source: GitHub Actions** (no "Deploy from a branch"). Si GitHub UI lo resetea al re-tocar el custom domain, hay que volver a ponerlo en "GitHub Actions" o servirá el `index.html` raíz del repo (modo dev) → MIME error en `/src/main.tsx`.

## Feature deferred

**Edit-in-place de metadatos de rango existente** — hoy solo se puede editar nombre y grupo en el panel lateral. `position`, `situation`, `villainPosition` y `tableFormat` solo se fijan al crear. Para cambiarlos hay que borrar y recrear. El store ya acepta `updateRange(id, patch)` con esos campos; falta la UI (un panel de propiedades en `RangeManager` o un modal en `EditorPage`, reutilizando lógica de `NewRangeForm`).

## Decisiones de diseño clave

### Editor (fase 4)
- **History**: `{ ranges, activeRangeId }[]` en store, NO persistido, cap 50, snapshot por sesión de drag (no por celda). `pushHistory()` lo llama el UI antes de cada mutación imperativa (create/duplicate/delete/rename/group).
- **WeightSlider** global en toolbar (step 5). weight=100 → reemplaza celda; weight<100 → acumula hasta sum≤100 (trunca al hueco, no reduce otras acciones).
- **RangeCell** siempre aplica `CATEGORY_BG`; `buildBackground` usa weights como % absolutos y mete `transparent` trailing si sum<100. Siempre devuelve gradient (un color sólido en `backgroundImage` es CSS inválido).
- **Keyboard listener** a nivel window en EditorPage ignora input/textarea/contenteditable (permite undo nativo en inputs).
- **Selectors**: subscribir a `s.ranges` (ref estable) + `useMemo` — el shim de useSyncExternalStoreWithSelector invalida memos por identidad si pasas `useShallow` sobre `.map(r => ({...}))`.

### Viewer/Trainer (fases 5-6)
- **Filtros viewer/trainer NO persistidos**: abrir app debe arrancar sin sesgo. Compare state (toggle + B id) tampoco persistido.
- **`viewerRangeId` y `trainerRangeId`**: en uiStore, nullable, default null, sin bump de versión. Auto-selección del primer rango si el id persistido es stale.
- **Compare**: en compare mode el sidebar derecho desaparece; cada `RangePanel` lleva sus propias stats/legend.
- **Sampling clásico**: P(hand) ∝ combos del hand (no ∝ peso de celda) — reproduce frecuencia natural de reparto. Acción esperada por draw muestreada de los pesos de la celda con FOLD residual. Hands fuera del rango: implícito FOLD.
- **Drawing trainer**: comparación binaria in/out por combos (Jaccard). Cualquier acción en la celda truth la cuenta como "in".
- **Score session NO persistido**. Switching range → reset; switching hand → score continúa.

### Home / onboarding (fase 9)
- **Ruta `/`**: monta `src/modules/home/HomePage.tsx` (lazy + Suspense). Reemplaza el viejo `Navigate to="/viewer"`. Sidebar añade item "Home" con `end` para no quedar siempre activo.
- **`ImportProfileButton`**: file picker oculto + botón visible. Lee con `file.text()`, valida `file.size ≤ MAX_IMPORT_BYTES` ANTES de leer, llama `importRanges(text, { replace: false })`. Reset `input.value = ''` al final para permitir reimportar el mismo archivo.
- **Donación BTC**: `bc1qyz4fd8msnedgjj9sv68qlu4theh7mdh57rea8w`. Reusa `copyToClipboard()` de `src/utils/exportRange.ts`.

### A11y / UX (fase 7)
- **Toasts NO persistidos**, cap 4 (slice por la cola). Errores en `aria-live="assertive"` separada del polite. Hover/focus cancela auto-dismiss (sin reanudación).
- **ImportModal**: focus trap (Tab/Shift+Tab loop), restore focus en unmount, `aria-describedby` apunta al panel de resultados.
- **Menus** (Export, RangeManager): ArrowUp/Down/Home/End/Tab nav, focus al primer item al abrir, restore al trigger en Escape.
- **ErrorBoundary**: class component envolviendo `<RouterProvider>`, fallback con botón Reload, log a console.error SOLO en DEV.

### PokerTable (trainer visual)
- **Forma**: stadium (`rounded-full` sobre felt 2.66:1) con `paddingBottom: '42%'` en container y `inset-y-[8%]` en felt → bordes rectos largos arriba/abajo + semicírculos en los extremos.
- **Slots con simetría bilateral**: hero abajo-centro (slot 0), uno directamente enfrente arriba-centro (slot 3); slots 2&4 a la misma altura (esquinas superiores), slots 1&5 a la misma altura (esquinas inferiores).
- **Hero overflow**: el stack hero (cartas + combos + badge ≈110px) excede el container; se compensa con `mb-12` en el wrapper para que la action grid no se solape con el badge.
- **HU mode**: cuando `range.tableFormat === 'HU'`, `getTableLayout` devuelve solo slots 0 (hero) y 3 (villano enfrente). Villano se calcula con `huVillainOf()` (BTN↔BB) ignorando el `villainPosition` persistido.

### Deploy GitHub Pages (fase 7D)
- **`vite.config.ts`**: `base: '/'` (apex domain rangesoprano.com). Antes era `/RangeSoprano/` cuando se servía bajo `sooprano.github.io/RangeSoprano/`.
- **`src/router.tsx`**: `basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'` — deriva de `base`, no se toca al cambiar el dominio.
- **`public/CNAME`**: contiene `rangesoprano.com`. Vite lo copia a `dist/CNAME` y GitHub Pages lo respeta como custom domain en cada deploy. NO crear un CNAME en la raíz del repo (lo hace GitHub UI automáticamente al setear el dominio; es redundante porque el workflow sube `dist/`, no la raíz).
- **DNS Cloudflare**: 4 A records apex `rangesoprano.com → 185.199.108-111.153` + CNAME `www → sooprano.github.io`. Todos en **"Solo DNS"** (nube gris). NO activar proxy de Cloudflare — rompe la emisión del cert Let's Encrypt de GitHub Pages.
- **Source en Settings → Pages**: debe ser **"GitHub Actions"** (no "Deploy from a branch"). Si lo resetea, hay que volver a setearlo manualmente.
- **Workflow**: build + deploy jobs con `actions/upload-pages-artifact` y `actions/deploy-pages` v4. Trigger en push a `main` y `workflow_dispatch`.
- **SPA fallback**: copia `dist/index.html` a `dist/404.html` antes del upload para que el refresh en `/editor`, `/trainer` no devuelva 404.

### Trainer Speed mode + Drawing fixes (fase 13)
- **Drawing trainer paleta action-aware**: `DrawingTrainer` lee `range.actions` ordenadas y muestra paleta radio-style. `computeRangeDiff` reescrito: match = la acción pintada existe (weight > 0) en la celda truth.
- **Speed mode**: tab con icono `Zap`. Tres fases internas (`config` / `running` / `finished`). Classic: PokerTable + ActionGrid + auto-advance 220ms flash. Drawing: paleta + RangeGrid editable, diff al expirar. Sub-runs con `key={runId}` para reset limpio.
- **Duraciones**: Classic = 30s / 60s / 5min / 10min; Drawing = 30s / 45s / 60s / 90s.
- **Timer pattern**: `setInterval(100ms)` con `performance.now()`; `doneRef` evita doble-finish; `scoreRef`/`guessRef`/`onFinishRef` mantienen efectos sin depender de props mutables.
- **Leaderboard** (`range-soprano/leaderboard`, version 1): `byRangeId: Record<rangeId, { classic: ClassicEntry[]; drawing: DrawingEntry[] }>`, cap 5 por estilo. Sort: Classic por accuracy → correct → hpm; Drawing por accuracy → matchCombos.
- **Drawing session scoring** (in-memory, NO persistido): `sessionRounds[]` con `Save round`. `SessionBar` muestra rounds / avg / best.
- **Classic auto-advance** (post fase 13): tras seleccionar acción, `drawNext()` se llama automáticamente a 1.5 s. `CountdownBar` animada muestra el countdown. Enter/Space/N siguen funcionando para avance manual.

### Villain + tableFormat (fase 10)
- **`Range.tableFormat: '6max' | 'HU'`**: schema Zod con `.default('6max')` para rangos viejos. Sin bump de versión.
- **`HU_POSITIONS` y `huVillainOf()`** en `src/types/poker.ts`.
- **NewRangeForm**: en HU, posiciones restringidas a `HU_POSITIONS`, villain deshabilitado y muestra seat implícito.

### Refactor labels + UX badges (fase 12)
- **Single source of truth** en `src/data/positions.ts` para `SITUATION_LABELS` y `TABLE_FORMAT_LABELS`. Eliminados 8 duplicados locales.
- **`vs_LIMP`** añadido al enum `SITUATIONS` (entre `RFI` y `vs_RFI`). Villain habilitado en vs Limp.
- **Subtítulo de rango**: `{position} · {situation}{villain ? ' · vs ' + villain : ''}{HU ? ' · HU' : ''}`.

## Convenciones de implementación

- TypeScript estricto (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), sin `any`.
- IDs vía `crypto.randomUUID()`.
- Persistencia en localStorage keys `range-soprano/ranges` y `range-soprano/ui`, hidratación validada con Zod, cap import 3.8 MB.
- Parser de import tolerante a errores de formato.
- `React.memo` en RangeCell NO se toca — todo cambio pasa por props estables.
- Conventional Commits: `feat(phase-Xa):`, `fix(phase-Xa):`, `docs:`, `chore:`.
- Antes de commitear: `npm run typecheck && npm run build` verdes + verificación en navegador.
