# RECOVERY — Range Soprano

## Retomar sesión

> Lee CLAUDE.md + RECOVERY.md. Ejecuta `git log --oneline -5` y `git status`. Preséntame estado + plan. Espera confirmación antes de codificar.

## Plan B

`git reset --hard <hash>` al último commit estable de la fase deseada.

## Últimos commits estables por fase

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
- Fase 9 (Home + onboarding + import perfil JSON + donación BTC): `70e7e43`
- Fase 10 (villain + tableFormat HU/6max en NewRangeForm + PokerTable HU): `0d9bd8f`

## Estado actual

Fase 7D ✅ · Fase 9 ✅ · Fase 10 ✅ · Fase 11 ✅ · Fase 12 ✅ (vs Limp · refactor SITUATION_LABELS · badges HU/villain en RangeManager · home tips).

Live en https://sooprano.github.io/RangeSoprano/ (después de que el primer workflow termine y se habilite Pages — ver "Pasos manuales pendientes" abajo).

Visual polish reciente: trainer con mesa 6-max estilo "stadium" (rectángulo con extremos semicirculares), slots redistribuidos con simetría bilateral, cartas pegadas al héroe. HU mode muestra solo BTN y BB (slots 0 y 3), los demás desaparecen.

## Últimos commits estables por fase (cont.)

- Fase 11 (palette reuse · folder rename · meta edit-in-place): `e3f7c36`
- Fase 12 (vs Limp · refactor labels · badges HU/villain · home tips): `e5fd2b5`
- Fase 7D (deploy GitHub Pages): `477cd1e`

## Pasos manuales pendientes (deploy)

1. **Habilitar GitHub Pages** en el repo:
   - https://github.com/Sooprano/RangeSoprano/settings/pages
   - "Build and deployment" → Source: **GitHub Actions**.
2. **Verificar el primer workflow**:
   - https://github.com/Sooprano/RangeSoprano/actions — el run "Deploy to GitHub Pages" del commit `477cd1e` debe quedar en verde.
3. **Probar la live URL**: https://sooprano.github.io/RangeSoprano/ — esperar 1-2 min después del deploy. Probar refresh en `/editor` y `/trainer` (la copia `index.html → 404.html` del workflow garantiza que el SPA refresh funcione).

## Pendientes para próxima sesión

(ver "Pasos manuales pendientes" arriba para los toques finales del deploy)

### P1 ~~Edit-in-place de metadatos~~ ✅ completado en fase 11
Hoy NO existe UI para editar `position`, `situation`, `villainPosition` ni `tableFormat` en rangos **ya creados**. Solo el formulario de creación los expone.

**Qué hay que construir:**
- Sección de "propiedades del rango" en el panel lateral del Editor (o un modal inline en RangeManager al hacer hover/click en el nombre).
- Campos: Position, Situation, Villain (con la misma lógica de deshabilitado que NewRangeForm), Mesa (HU / 6max).
- Llamar `updateRange(id, patch)` — ya existe en el store y acepta `Partial<Omit<Range,'id'|'createdAt'>>`.
- Considerar: al cambiar `tableFormat` a HU con una posición no válida (ej. CO), auto-corregir a BTN.

**Archivos a tocar:**
- `src/modules/editor/RangeManager.tsx` — donde está la lista de rangos; probablemente exponer un panel de detalle al seleccionar.
- `src/modules/editor/EditorPage.tsx` — si el panel va en el sidebar.
- Posiblemente un nuevo componente `RangeMetaForm.tsx` reutilizando lógica de `NewRangeForm`.

### P2 ~~Fase 7D: Deploy a GitHub Pages~~ ✅ completado en commit `477cd1e`
Repo: https://github.com/Sooprano/RangeSoprano · Pages URL: https://sooprano.github.io/RangeSoprano/

### P3 ~~Filtro Villain en Home page~~ ✅ completado en fase 12 (Viewer y Trainer cards mencionan filtros y modo HU)

### P4 ~~Badges villainPosition/tableFormat en RangeManager~~ ✅ completado en fase 12 (subtítulo ahora muestra `· vs <pos>` y `· HU`)

## Decisiones de diseño clave (referencia futura)

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
- **HomePage**: 4 secciones — módulos (3 cards Viewer/Trainer/Editor con icono Lucide grande, descripción y comando), atajos de teclado (kbd + descripción), guardar/portabilidad (3 Steps con sub-listas ordenadas) y donación BTC.
- **`ImportProfileButton`** (`src/modules/home/ImportProfileButton.tsx`): file picker oculto + botón visible. Lee con `file.text()`, valida `file.size ≤ MAX_IMPORT_BYTES` (100 KB) ANTES de leer, llama `useRangeStore.getState().importRanges(text, { replace: false })`. Modo "añadir" único — sin opción de reemplazar para evitar pérdida accidental. Reset `input.value = ''` al final para permitir reimportar el mismo archivo. Toasts de éxito/error.
- **`importRanges()` reusado tal cual** desde `src/store/rangeStore.ts:440` — ya hacía Zod + cap + recovery parcial. NO se modificó.
- **Donación BTC**: `bc1qyz4fd8msnedgjj9sv68qlu4theh7mdh57rea8w`. Bloque `<code>` con `select-all` + botón Copy que reusa `copyToClipboard()` de `src/utils/exportRange.ts`. Estado local `copied` con timeout 1.8 s para feedback visual (Check icon).
- **Sin imágenes externas ni QR** — solo iconos Lucide para mantener cero dependencias nuevas y cero requests de red.
- **`exactOptionalPropertyTypes`**: `NavLink end={end ?? false}` — pasar `undefined` al prop `end` rompe el typecheck.

### A11y / UX (fase 7)
- **Toasts NO persistidos**, cap 4 (slice por la cola). Errores en `aria-live="assertive"` separada del polite. Hover/focus cancela auto-dismiss (sin reanudación).
- **ImportModal**: focus trap (Tab/Shift+Tab loop), restore focus en unmount, `aria-describedby` apunta al panel de resultados.
- **Menus** (Export, RangeManager): ArrowUp/Down/Home/End/Tab nav, focus al primer item al abrir, restore al trigger en Escape.
- **ErrorBoundary**: class component envolviendo `<RouterProvider>`, fallback con botón Reload, log a console.error SOLO en DEV.

### PokerTable (trainer visual)
- **Forma**: stadium (`rounded-full` sobre felt 2.66:1) con `paddingBottom: '42%'` en container y `inset-y-[8%]` en felt → bordes rectos largos arriba/abajo + semicírculos en los extremos.
- **Slots con simetría bilateral**: hero abajo-centro (slot 0), uno directamente enfrente arriba-centro (slot 3); slots 2&4 a la misma altura (esquinas superiores), slots 1&5 a la misma altura (esquinas inferiores). Con hero=BB: BTN/HJ misma altura, SB/UTG misma altura, CO directamente enfrente.
- **Hero overflow**: el stack hero (cartas + combos + badge ≈110px) excede el container; se compensa con `mb-12` en el wrapper para que la action grid no se solape con el badge.
- **HU mode** (fase 10): cuando `range.tableFormat === 'HU'`, `getTableLayout` devuelve solo slots 0 (hero) y 3 (villano enfrente); el resto desaparece. Mismo felt, mismo container, sin cambios visuales para el hero. Hero seat se snapea a BTN/BB (si llegara CO/HJ por dato corrupto, cae a BTN). Villano se calcula con `huVillainOf()` (BTN↔BB) ignorando el `villainPosition` persistido.

### Deploy GitHub Pages (fase 7D)
- **Repo**: https://github.com/Sooprano/RangeSoprano (case sensitive en la subruta de Pages — la URL final es `/RangeSoprano/`, NO `/rangesoprano/`).
- **`vite.config.ts`**: `base: mode === 'production' ? '/RangeSoprano/' : '/'` con la firma functional `defineConfig(({ mode }) => ({...}))`. Mode se pasa automático según el comando (`vite build` → production).
- **`src/router.tsx`**: `basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'`. Vite reemplaza `BASE_URL` en build a `/RangeSoprano/`; el strip del trailing slash es porque `createBrowserRouter` con `basename: '/'` funciona pero `'/RangeSoprano/'` (con barra final) genera URLs duplicadas.
- **Workflow**: dos jobs (build + deploy) usando `actions/upload-pages-artifact` y `actions/deploy-pages` v4 (la integración oficial de GH Pages, no `peaceiris/actions-gh-pages`). Trigger en push a `main` y `workflow_dispatch`.
- **SPA fallback**: el job copia `dist/index.html` a `dist/404.html` antes de upload. GH Pages sirve `404.html` para rutas desconocidas, lo que evita el 404 real en refresh sobre `/editor`, `/trainer`.
- **Local branch**: renombrada `master` → `main` para alinear con el workflow trigger.

### Refactor labels + UX badges (fase 12)
- **Single source of truth** de `SITUATION_LABELS` y `TABLE_FORMAT_LABELS` en `src/data/positions.ts`. Eliminados 8 duplicados locales (Editor/Viewer/Trainer y sus list/panel components). `editorFormConstants.ts` re-exporta para que el editor module no importe directo de `data/`.
- **`vs_LIMP`** añadido al enum `SITUATIONS` (entre `RFI` y `vs_RFI`). `villainDisabledFor` sigue siendo solo `s === 'RFI'` — en vs Limp el villano es el limper, así que el dropdown de villain debe estar habilitado.
- **`RangeSummary.tableFormat`** expuesto en el selector para que `RangeManager` pueda renderizar el badge `· HU`.
- **Subtítulo de rango**: `{position} · {situation}{villain ? ' · vs ' + villain : ''}{HU ? ' · HU' : ''}`. En HU se omite el `vs <villain>` porque es implícito (BTN faces BB y viceversa).

### Villain + tableFormat (fase 10)
- **Tipo `Range.tableFormat: '6max' | 'HU'`** (no boolean — enum para escalar a 9-max sin migración). Schema Zod: `z.enum(TABLE_FORMATS).default('6max')` para que rangos viejos hidraten a `'6max'` automáticamente. Sin bump de `CURRENT_RANGE_STORE_VERSION`.
- **`HU_POSITIONS` y `huVillainOf()`** en `src/types/poker.ts`: HU solo permite BTN/BB. `huVillainOf('BTN') === 'BB'` y viceversa. Reusado por PokerTable y NewRangeForm.
- **NewRangeForm**: 4 campos (Name, Mesa, Position+Situation grid, Villain). En HU: `positionOptions` se restringe a `HU_POSITIONS`, Villain dropdown deshabilitado y muestra el seat implícito (`BTN faces BB` etc.). En no-HU+RFI: Villain deshabilitado con texto "Not applicable to RFI" (consistente con `villainDisabled` del filtro Viewer). Submit solo manda `villainPosition` cuando hay valor (spread condicional para `exactOptionalPropertyTypes`).
- **`createRange`**: `tableFormat: input.tableFormat ?? '6max'` para que callers existentes (sample range, import) sigan funcionando sin tocar nada.
- **NO se editó RangeManager para edit-in-place** de `position`/`situation`/`villainPosition`/`tableFormat`: alcance limitado al formulario de creación. Editar campos de un rango existente requiere UI nueva (deferred).
- **Filtro Villain del Viewer**: ahora SÍ funciona porque rangos creados desde el form pueden tener `villainPosition` real. Rangos pre-fase-10 siguen con `villainPosition: undefined` y por tanto invisibles bajo cualquier filtro de villain (comportamiento esperado).

## Convenciones de implementación

- TypeScript estricto (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), sin `any`.
- IDs vía `crypto.randomUUID()`.
- Persistencia en localStorage keys `range-soprano/ranges` y `range-soprano/ui`, hidratación validada con Zod, cap 100KB.
- Parser de import tolerante a errores de formato.
- `React.memo` en RangeCell NO se toca — todo cambio pasa por props estables.
- Conventional Commits: `feat(phase-Xa):`, `fix(phase-Xa):`, `docs:`, `chore:`.
- Antes de commitear: `npm run typecheck && npm run build` verdes + verificación en navegador.
