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

## Siguiente: Sub-fase 4C

Parser import tolerante (AA,KK,AKs+,98s-65s), Import modal con preview, Export a clipboard/JSON/PNG (html-to-image).

## Pendientes fases 5-7

- **5**: Visualizador mejorado (SituationSelector, multi-range).
- **6**: Trainer clásico (reparto ponderado) + dibujo (comparación por combinaciones).
- **7**: Pulido, toasts, a11y, deploy.
