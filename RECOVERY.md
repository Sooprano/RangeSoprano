# RECOVERY — Range Soprano

Plan de contingencia y log de estado por fase.

## Si se interrumpe una sesión

1. NO cerrar VS Code
2. Terminal: `git status` → si hay cambios útiles, commitear como `wip: <descripción>`
3. Al retomar, pegar a Claude Code:

> Retomamos Range Soprano. Lee CLAUDE.md + RECOVERY.md. Ejecuta `git log --oneline -5` y `git status`. Preséntame el estado actual y un plan para continuar. Espera mi confirmación antes de codificar.

## Plan B si todo falla

`git reset --hard <hash>` al último commit estable. Hashes clave abajo.

## Último commit estable por fase

- Fase 1 (setup): `02f65ff`
- Fase 2 (RangeGrid completo): `6a3cf0e`
- Fase 3 (stores + persist): `e0278c6`
- Sub-fase 4A (editor base): `38628da` base · `6d9da97` fix parcial · fix definitivo del loop en `useRangeSummaries`

## Fase 2 — RangeGrid (COMPLETA)

Grid 13×13 reutilizable. Commits 2A (`8f66180`), 2B (`7360d03` + fixes), 2C (`6a3cf0e`). Franjas ponderadas con linear-gradient, tooltip CSS, keyboard navigation (roving tabindex + flechas + Home/End + PageUp/Down), ARIA grid/gridcell, focus-visible con ring morado, motion-safe/reduce, responsive. React.memo preservado en cada celda.

## Fase 3 — Stores y Persistencia (COMPLETA)

Commit: `e0278c6`.

- `useRangeStore`: CRUD (create/update/delete/duplicate), edición granular (upsertCell/clearCell/clearAllCells), `importRanges` con cap 100KB
- `useUiStore`: theme (dark/light/system) + flags UI
- Validación Zod `.strict()` al hidratar: regex de hand notation, caps (500 rangos · 169 cells · 5 actions/cell · 80 chars name), sanitización de strings
- Storage resiliente: `createSafeJSONStorage()` con fallback in-memory; `migrate()` versionado en `CURRENT_RANGE_STORE_VERSION = 1`
- Tema anti-flash: script inline en index.html + hook `useApplyTheme` + listener matchMedia
- Viewer con `<EmptyState />`: CTA "Load demo range" (sembra SAMPLE_BTN_RFI con UUID fresco)
- Selectores en `src/store/selectors.ts`: `useActiveRange`, `useRangeById`, `useRangeSummaries` (useShallow), `useRangesByGroup` (useMemo)

## Sub-fase 4A — Editor base (COMPLETA)

Commits: `38628da` (base) + `6d9da97` (mejora de `openFormSignal`) + fix definitivo del loop.

### Lo construido
- `useRangePainter` hook (drag-to-paint por delegación, visitedRef anti-duplicados, mouseup/blur globales, atajos Space/Enter/Delete/Backspace)
- `RangeGrid` con props `editable`, `onCellPaint`, `onCellErase` (RangeCell no se tocó)
- `ActionToolbar` (selector de acción con swatches, aria-pressed)
- `NewRangeForm` (name/position/situation con sanitización)
- `RangeManager` (lista CRUD con useRangeSummaries, delete con confirm)
- `EmptyEditorState` (CTA "New range")
- `EditorPage` (layout 3 columnas, callbacks memoizados, signal para abrir form desde empty state)

### Bug histórico: loop infinito en /editor (RESUELTO)

**Síntomas (pre-fix)**: `Maximum update depth exceeded` en `<RangeManager>` al activar rango; `/viewer` quedaba con grid vacío tras el crash.

**Causa raíz**: `useRangeSummaries` combinaba `useShallow` con `.map(r => ({...}))`. Cada render creaba objetos summary nuevos (referencias distintas), lo que hacía fallar la comparación shallow por índice. Combinado con la identidad nueva del wrapper de `useShallow` en cada render (que invalida el `useMemo` interno del shim de `useSyncExternalStoreWithSelector`), el selector devolvía una array ref nueva cada render sin cambio de store → React detectaba "snapshot cambiado" → loop.

El grid vacío en `/viewer` era síntoma colateral de React roto tras el crash — no corrupción del store ni de `localStorage`.

**Fix**: suscribirse a `s.ranges` (ref estable por Object.is de zustand) y derivar summaries con `useMemo([ranges])` en el hook. Mismo patrón que ya usaba `useRangesByGroup` en el fichero.

Hipótesis previas refutadas:
- `useActiveRange` **no** era el problema: `find()` devuelve la misma ref del objeto existente.
- La dep `activeRange` vs `activeRange.cells` en `presentActions` era irrelevante.
- No hay cascada entre selectores ni corrupción de store.

## Siguientes sub-fases (pendientes)

- **4B**: WeightSlider (pesos mixtos), duplicate/rename/group ranges, Undo/Redo 50 pasos, atajos 1-5 para acciones, Delete para borrar
- **4C**: Parser import tolerante (AA,KK,AKs+,98s-65s), Import modal con preview, Export a clipboard/JSON/PNG (html-to-image)
- **5**: Visualizador mejorado (SituationSelector, multi-range)
- **6**: Trainer clásico (reparto ponderado) + dibujo (comparación por combinaciones)
- **7**: Pulido, toasts, a11y, deploy
