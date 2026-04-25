# RECOVERY — Range Soprano

## Retomar sesión

> Lee CLAUDE.md + RECOVERY.md. Ejecuta `git log --oneline -5` y `git status`. Preséntame estado + plan. Espera confirmación antes de codificar.

## Plan B

`git reset --hard <hash>` al último commit estable.

## Últimos commits estables por fase

- Fase 1: `02f65ff`
- Fase 2 (RangeGrid): `6a3cf0e`
- Fase 3 (stores + persist): `e0278c6`
- Sub-fase 4A (editor base): `acda2a4`
- Sub-fase 4B (editor avanzado): `9a9bc4a`
- Sub-fase 4C (import/export): `eb9969a`
- Sub-fase 5A (viewer scope): `7161958`
- Sub-fase 5B (viewer filtros): `6fafc9b`
- Sub-fase 5C (compare side-by-side): `b4eefea`
- Sub-fase 5D (export PNG + atajos): `f9374b9`
- Sub-fase 6A (trainer shell): `e9e9bca`
- Sub-fase 6B (classic trainer): `13ed254`
- Sub-fase 6C (drawing trainer): `e15ab9b`
- Sub-fase 6D (trainer filters): `e6a6bbb`
- Sub-fase 7A (toast system): `1359878`
- Sub-fase 7B (a11y modals/menus): `2f1d368`
- Sub-fase 7C (error boundary + 404 + meta): `caa190b`

## Estado: Sub-fase 4B COMPLETA (9a9bc4a)

### Commits 4B
- `f8b60e0` shortcuts 1-5 (swap de acción)
- `c33aeff` util pura `upsertActionInCell` (pesos mixtos)
- `ecc2652` WeightSlider + pintado acumulativo + fix visual de gradients parciales (transparent + CATEGORY_BG siempre)
- `c5b5f1b` infra undo/redo en store (past/future, cap 50, no persisted)
- `530d566` checkpoints en `useRangePainter` (onSessionStart en mousedown/contextmenu/keydown)
- `bb91c5b` HistoryToolbar + atajos Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y
- `c392d7b` menú ⋯ por rango con Duplicate y Delete undoable
- `37e30b9` rename inline (Enter/Escape/blur, double-click en el nombre)
- `9a9bc4a` group inline + render agrupado (ungrouped primero, grupos alfabéticos con header; datalist para sugerencias)

### Decisiones de diseño clave
- History = `{ ranges, activeRangeId }[]`; NO persistido; snapshot por sesión de drag (no por celda).
- `pushHistory()` lo llama el UI antes de cada mutación imperativa (create/duplicate/delete/rename/group).
- WeightSlider global en toolbar (step 5). weight=100 → reemplaza celda; weight<100 → acumula hasta sum≤100 (trunca al hueco disponible, no reduce otras acciones).
- RangeCell siempre aplica CATEGORY_BG; `buildBackground` usa weights como % absolutos y mete `transparent` trailing si sum<100.
- Keyboard listener a nivel window en EditorPage ignora input/textarea/contenteditable (permite undo nativo en inputs).

## Histórico 4A (bugs resueltos)

1. Loop infinito en RangeManager (`70b95b8`). Causa: `useRangeSummaries` con `useShallow` sobre `.map(r => ({...}))` — el shim de useSyncExternalStoreWithSelector invalida su memo por identidad del selector. Fix: subscribir a `s.ranges` (ref estable) + `useMemo`.
2. Celdas transparentes con una sola acción (`acda2a4`). Causa: `buildBackground` devolvía color sólido en `backgroundImage` (CSS inválido). Fix en `ecc2652`: siempre gradient.
3. `react-hooks/set-state-in-effect` en RangeManager (`acda2a4`). Fix: levantar `isFormOpen` a EditorPage, fully-controlled.

## Sub-fase 4C COMPLETA (eb9969a)

### Commits 4C
- `d042a65` parser tolerante (AA,KK,AKs+,98s-65s con pesos `[w%]…[/w%]`)
- `0ceb924` `serializeWeightedHands` (colapsa pares y kickers, runs `X-Y` / `Y+`)
- `955a139` Import modal con preview de hands/errores
- `3210498` chore: untrack `.claude/` local settings
- `1951b3c` Export menu: Copy notation + Download JSON (rango activo / todos)
- `008294e` Export PNG (html-to-image) con wrapper ref sobre el grid
- `eb9969a` docs RECOVERY

## Fase 5 COMPLETA (f9374b9) — Visualizador mejorado

### Subdivisión
- **5A** Selector de rango + scope independiente del editor ✅
- **5B** SituationSelector (Position · Situation · Villain) ✅
- **5C** Modo comparación side-by-side ✅
- **5D** Export PNG + atajos ←/→ ✅

### Commits 5
- `7161958` **5A** viewerRangeId en uiStore (nullable, default null, sin bump de versión). `useViewerRange`. ViewerPage 3-col con ViewerRangeList (search + groups). Auto-selección del primer rango si el id persistido es stale.
- `6fafc9b` **5B** SituationSelector con selects para Position/Situation/Villain + Clear. Villain deshabilitado cuando situation=RFI. Filtros LOCALES (no persistidos). Hint cuando la selección cae fuera del filtro. `matchesFilters` / `hasAnyFilter` exportados.
- `b4eefea` **5C** `RangePanel` (header + grid + stats/legend) y `CompareToolbar` (toggle + select B + Exit). ViewerPage swap a 2-col en compare; B autoselect al primer rango distinto de A; effect que nulea ids stale.
- `f9374b9` **5D** Export PNG en Viewer reutilizando `exportNodeToPng` sobre un `captureRef` que envuelve grid (single) o dual-panel (compare); filename `nameA-vs-nameB.png` en compare. Atajos ←/→ recorren la lista filtrada (single mode, sin modificadores, ignora inputs/grid focus).

### Decisiones de diseño 5
- `ViewerRangeList` acepta `summaries` por prop (lift a `ViewerPage`) para separar filtro vs. búsqueda interna.
- Filtros del viewer NO persistidos a propósito — abrir app debe arrancar sin sesgo.
- Compare state (toggle + B id) NO persistido por la misma razón.
- Schema `zPersistedUiState.viewerRangeId` agregado con `.nullable().default(null)`; persisted state viejo hidrata limpio sin migración.
- En compare mode el sidebar derecho desaparece; cada `RangePanel` lleva sus propias stats/legend.

## Fase 6 COMPLETA (e6a6bbb) — Trainer

### Subdivisión
- **6A** Shell + selector de rango + mode toggle ✅
- **6B** Modo clásico (sampling ponderado + feedback) ✅
- **6C** Modo dibujo + diff por combos ✅
- **6D** Filtros situation reusados ✅

### Commits 6
- `e9e9bca` **6A** `trainerRangeId` en uiStore (mismo patrón que viewer). `useTrainerRange`. TrainerPage 2-col reutilizando `ViewerRangeList`. Mode toggle Classic/Drawing.
- `13ed254` **6B** `sampleTrainerHand`: muestrea por `combosOf(hand)` (P uniforme por combo en 52 cartas), luego acción esperada por pesos del cell con FOLD residual. ClassicTrainer con score (accuracy, streak, best), feedback panel con breakdown de mixed cells. Atajos 1-5 / Enter/Space/N / S.
- `e15ab9b` **6C** DrawingTrainer pinta con CALL@100 sobre RangeGrid editable; al revelar muestra DiffGrid (read-only 13×13) con match/fp/fn. `computeRangeDiff` binario in/out por combos (Jaccard). Reset limpia.
- `e6a6bbb` **6D** `SituationSelector` reusado en TrainerPage para filtrar la lista. Filtros locales (no persistidos). Sin auto-jump si la selección actual cae fuera del filtro.

### Decisiones de diseño 6
- Sampling: P(hand) ∝ combos del hand, no ∝ peso de la celda. Esto reproduce la frecuencia natural de reparto en una mesa real.
- Acción esperada por draw: muestreada de la celda. Para celda 60% RAISE / 40% 3BET, el 60% de los draws espera RAISE y 40% espera 3BET. Feedback binario, breakdown educativo después.
- Hands fuera del rango: implícito FOLD, expected = FOLD.
- Drawing trainer: comparación binaria. Cualquier acción presente en la celda truth la cuenta como "in", sin importar pesos. Simplifica el ejercicio "play vs fold".
- Score de session NO persistido. Switching range → reset score. Switching hand dentro de la misma range → score continúa.
- DiffGrid es un componente nuevo independiente del RangeGrid para no contaminarlo con estados ajenos a las acciones.
- Filtros viewer/trainer NO persistidos por la misma razón que en Viewer (sesión limpia al abrir).

## Fase 7 EN CURSO (7A/7B/7C completas, 7D pendiente)

### Subdivisión
- **7A** Toast system + integración ✅
- **7B** A11y modal/menus polish ✅
- **7C** ErrorBoundary + 404 + meta ✅
- **7D** Deploy (GitHub Pages) ⏳ — pausado: falta crear repo y remote

### Commits 7
- `1359878` **7A** `toastStore` (zustand, NOT persisted, cap 4). `Toaster` con `aria-live` polite/assertive split (errores en assertive). Montado en `AppLayout`. ExportMenu sustituye su `setTimeout`/`useState` por toasts; EditorPage emite toast post-import; ViewerPage idem PNG; RangeManager toast info post-delete (recordando undo).
- `2f1d368` **7B** ImportModal: focus trap (Tab/Shift+Tab loop sobre `FOCUSABLE_SELECTOR`), restore focus en unmount, `aria-describedby` en textarea (apunta al panel de resultados). ExportMenu y RangeManager menu: ArrowUp/Down/Home/End/Tab nav, focus al primer item al abrir, restore focus al trigger en Escape. NavLink ya provee `aria-current="page"` (no se tocó Sidebar).
- `caa190b` **7C** `ErrorBoundary` (class component con override modifiers, fallback con botón Reload, log en DEV) envolviendo `<RouterProvider>` en `main.tsx`. `*` route ahora renderiza `NotFoundPage` (antes era redirect silencioso a /viewer). `index.html`: `theme-color` + `og:title|description|image|type` + `twitter:card`.

### Decisiones de diseño 7
- Toasts NO persistidos. Cap 4 (slice por la cola). Errores en region `aria-live="assertive"` separada para que SR los anuncie sin esperar al éxito previo.
- Toast hover/focus cancela el auto-dismiss (sin reanudación al salir — el usuario debe cerrar manualmente). Simple y suficiente para la app.
- ImportModal: aria-describedby apunta al panel de resultados que ya tenía info de hands/errores. Doble efecto: SR lee resumen al recibir foco el textarea.
- Menu nav inline en cada componente (no se extrajo hook): sólo 2 menús, refactor sería prematuro.
- `closeMenuAndRestoreFocus(false)` en RangeManager se usa cuando el toggle vuelve a cerrar (el botón ya tiene foco). Restore=true sólo en Escape.
- ErrorBoundary log a `console.error` SOLO en DEV (no spamea producción).

## Pendientes fase 7

- **7D**: Deploy a GitHub Pages — bloqueado hasta crear repo en GitHub y configurar remote. Después: `vite.config.ts` con `base` condicional, `.github/workflows/deploy.yml`, `basename` en router, README.
