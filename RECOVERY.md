# 🆘 Plan de contingencia si Claude Code falla o se acaban los tokens

## Si Claude Code se detiene a mitad de una fase

1. NO cierres VS Code
2. Abre terminal y ejecuta:
   - `git status`
   - `git add .`
   - `git commit -m "wip: phase X partial progress"`
3. Espera a que vuelvan los tokens

## Cuando vuelvan los tokens, pega en Claude Code

Se interrumpió la fase anterior. Para retomar:

1. Lee CLAUDE.md en la raíz
2. Lee prompts.md
3. Ejecuta `git log --oneline -10` y `git status`
4. Revisa el estado del código actual
5. Preséntame un plan para completar la fase desde donde quedó
6. Espera mi confirmación antes de codificar

## Si todo falla, revertir al último commit estable

- `git log --oneline` → Ver commits
- `git reset --hard <hash>` → Volver a ese commit

## Commits importantes del proyecto

- `edb1728` → Setup inicial (CLAUDE.md, prompts.md, .gitignore)
- `02f65ff` → Fase 1 completa (project setup, design tokens, routing, layout)
- `a6059f8` → RECOVERY.md añadido
- `544cc87` → RECOVERY.md actualizado
- `8f66180` → Sub-fase 2A: RangeGrid base structure
- `7360d03` → Sub-fase 2B: RangeCell visual states
- `5f5396c` → Fix: neutralize empty cell backgrounds
- `12df1b9` → Fix: increase dark cell contrast and restore pair dot
- `2234f69` → Recovery log actualizado con commits Fase 2
- `6a3cf0e` → Sub-fase 2C: keyboard navigation, ARIA, visual polish — FASE 2 COMPLETA
- `e0278c6` → Fase 3: Zustand stores con rangos persistidos y preferencias UI — FASE 3 COMPLETA
- [Próximo: Fase 4 - Editor interactivo]

## Buenas prácticas durante el desarrollo

- Hacer commits frecuentes, idealmente al terminar cada sub-fase
- No agregar features nuevas en medio de una fase, anotarlas en TODO.md
- Siempre probar en navegador antes de aprobar la siguiente fase
- Verificar consola sin errores antes de avanzar

---

## Fase 2 — RangeGrid (COMPLETA)

Resumen ejecutivo del componente más importante del proyecto:

- **2A** (`8f66180`): Grid 13×13 base con `ALL_HANDS` en row-major, pares diferenciados (borde/peso tipográfico), categorías suited/offsuit/pair con fondos distintos.
- **2B** (`7360d03` + fixes `5f5396c`, `12df1b9`): franjas de acción ponderadas por `linear-gradient`, tooltip CSS con detalle de acciones/pesos, `ActionLegend` y `RangeStats` con breakdown por combos, puntito adaptativo en pares y contraste reforzado en celdas vacías.
- **2C** (`6a3cf0e`): roving tabindex + navegación completa por teclado (flechas, Home/End, PageUp/PageDown), focus-visible con ring morado, ARIA `grid`/`gridcell` con `aria-label` rico, tooltip accesible vía `focus-within`.
- **Pulido transversal**: micro-animaciones con `motion-safe`/`motion-reduce`, grid responsive (`max-w-[min(640px,92vw)]`), `React.memo` preservado en cada celda con callback refs estables.
- **Resultado**: `RangeGrid` + `RangeCell` listos para reutilizarse en modo lectura (Viewer) y en edición (Editor, Fase 4) sin rehacer accesibilidad; typecheck + build verdes, consola limpia.

---

## Fase 3 — Zustand Stores y Persistencia (COMPLETA)

Sistema de estado global y persistencia local como columna vertebral del Editor (Fase 4).

- **Stores**: `useRangeStore` (`ranges[]` + `activeRangeId`, CRUD completo: create/update/delete/duplicate, edición granular de celdas `upsertCell`/`clearCell`/`clearAllCells`, `importRanges` con cap de 100 KB, `resetStore`); `useUiStore` (`theme` dark/light/system + flags `showActionLegend`, `gridTooltipEnabled`).
- **Schemas Zod** (`src/store/schemas.ts`): `.strict()` en todos los objetos, regex de hand notation, suma de pesos ≤100, sanitización de strings (strip control chars + trim), caps duros (500 rangos, 169 cells, 5 actions/cell, 80 chars name, 40 chars group).
- **Persistencia**: middleware `persist` con `createSafeJSONStorage()` tolerante (SSR / quota / disabled → fallback in-memory); `merge` corre `safeParse` con recuperación por-rango (descarta el inválido, conserva el resto); `migrate` con `CURRENT_RANGE_STORE_VERSION = 1`; keys `range-soprano/ranges` y `range-soprano/ui`.
- **Selectores memoizados** (`src/store/selectors.ts`): `useActiveRange`, `useRangeById`, `useRangeSummaries` con `useShallow`, `useRangesByGroup` con `useMemo`.
- **Theme sync**: hook `useApplyTheme` aplica `data-theme` a `<html>` y escucha cambios de `matchMedia` cuando `theme === 'system'`; script inline en `index.html` resuelve el tema antes del primer paint (anti-flash, try/catch silencioso).
- **Viewer vacío**: `EmptyState` con CTA "Load demo range" (sembrado desde `SAMPLE_BTN_RFI` vía `createRange` + `setActiveRange`) y link al Editor. No autocargo: el usuario decide.
- **Seguridad**: `MAX_IMPORT_BYTES = 100 * 1024` validado con `TextEncoder`; IDs regenerados ante colisión; exceso sobre cap a `rejected[]`.
- **Resultado**: `npm run typecheck` y `npm run build` verdes; stores listos para ser consumidos por el Editor en Fase 4 sin tocar la lógica de persistencia.

---

## Fase 3 — Stores y Persistencia (COMPLETA)

- **Stores Zustand**: useRangeStore con CRUD completo (create/update/delete/duplicate, edición de celdas, importRanges con cap 100 KB) y useUiStore con theme + flags UI. Ambos persistidos vía middleware persist.
- **Validación Zod al hidratar**: schemas .strict(), regex de hand notation, caps (500 rangos, 169 cells, 5 actions/cell), sanitización de strings; recuperación por-rango si el state raíz falla (descarta los inválidos, conserva los buenos).
- **Storage resiliente**: createSafeJSONStorage() con fallback in-memory ante SSR / quota / localStorage deshabilitado; migrate() versionado en CURRENT_RANGE_STORE_VERSION = 1.
- **Theme anti-flash**: script inline en index.html aplica data-theme antes del primer paint; hook useApplyTheme() lo mantiene sincronizado y escucha matchMedia en modo system.
- **Viewer con estado vacío**: `<EmptyState />` con CTA "Load demo range" (siembra desde SAMPLE_BTN_RFI con UUID fresco) y link al Editor. No autocarga — el usuario decide.