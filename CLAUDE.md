# Range Soprano — Poker Range Study App

App de estudio de rangos preflop inspirada en FreeBetRange. Tres módulos: Visualizador, Entrenador, Editor. GTO y MDA están FUERA de alcance.

## Stack

React 19 + TypeScript estricto (noUncheckedIndexedAccess, exactOptionalPropertyTypes) · Vite · Tailwind 3 · Zustand 5 · React Router 7 · Zod · Lucide React · Inter (@fontsource).

## Estado de fases

1. ✅ Setup y fundamentos
2. ✅ RangeGrid completo (2A base, 2B stats, 2C a11y)
3. ✅ Zustand stores + persistencia
4. ✅ Editor (4A base · 4B pesos mixtos + undo/redo · 4C import/export)
5. ✅ Visualizador mejorado (5A scope · 5B filtros · 5C compare · 5D export PNG + atajos)
6. ✅ Entrenador (6A shell · 6B clásico · 6C dibujo · 6D filtros)
7. 🔄 Pulido final (7A toasts ✅ · 7B a11y modals/menus ✅ · 7C error boundary + 404 + meta ✅ · 7D deploy ⏳)
8. ✅ Editor avanzado (8A Ctrl+RightClick hand+ · 8B notas · 8C Save/Discard/Clear · 8D DnD carpetas/rangos · 8E acciones custom por rango)

## Convenciones

- Conventional Commits: `feat(phase-Xa):`, `fix(phase-Xa):`, `docs:`, `chore:`
- Commit al terminar cada sub-fase
- Typecheck + build verdes antes de commitear
- Probar en navegador antes de aprobar fase

## Dominio

Grid 13×13 row-major. Orden: A K Q J T 9 8 7 6 5 4 3 2. Diagonal = pares. Arriba = suited. Abajo = offsuit. Cells con múltiples acciones ponderadas (weight 0-100, suma ≤100).

Acciones: cada `Range` define su propia paleta (`range.actions: ActionDef[]` con `id` opaco, `label`, `color` hex, `order`). Los IDs legacy `RAISE · 3BET · ALL_IN · CALL · FOLD` siguen siendo válidos y se siembran como defaults al hidratar rangos viejos (ver `DEFAULT_ACTION_DEFS` en `src/utils/actionMeta.ts`). Rangos nuevos arrancan con `NEW_RANGE_ACTION_DEFS` (Call + Raise).

## Arquitectura clave

- `src/components/RangeGrid/` — grid reutilizable, modo lectura y `editable` opt-in (props: `editable`, `onCellPaint`, `onCellErase`). Delega eventos por `data-hand` sin tocar la memoización de RangeCell.
- `src/store/rangeStore.ts` — CRUD + persist con Zod al hidratar, cap 100KB, IDs con `crypto.randomUUID()`.
- `src/store/selectors.ts` — `useActiveRange`, `useRangeSummaries` (useShallow), `useRangesByGroup` (useMemo).
- `src/modules/{viewer,editor,trainer}/` — una carpeta por módulo, página raíz + componentes locales.
- `src/utils/handUtils.ts` — `ALL_HANDS`, `categoryOf`, `combosOf`.
- `src/utils/rangeStats.ts` — `computeRangeStats` (%total, combos, presentActions).

## Reglas importantes

- TypeScript estricto, sin `any`
- `React.memo` en RangeCell NO se toca — todo cambio pasa por props estables
- Persistencia en localStorage keys `range-soprano/ranges` y `range-soprano/ui`
- IDs vía `crypto.randomUUID()`
- Parser de import tolerante a errores de formato
- NO implementar GTO ni MDA

## Notas para Claude Code

- Antes de modificar código: `git status`, revisar commits recientes
- Si el usuario reporta bug: diagnosticar causa raíz antes de proponer fix
- Presentar plan, esperar confirmación, luego codificar
- Al terminar: `npm run typecheck && npm run build`, luego commit