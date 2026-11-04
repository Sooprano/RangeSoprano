# Sopranozilla — Fase 0: reconocimiento del repo

Estado de partida: `main` @ `40b32af` (fase 53). Rama `feature/sopranozilla`.

## 1. Lo que hay

### 1.1 Stack y scripts

| Script | Comando | Estado en `main` |
|---|---|---|
| `typecheck` | `tsc -b --noEmit` | ✅ verde |
| `lint` | `eslint .` | ❌ **32 errores + 3 warnings preexistentes** (ver §3.6) |
| `build` | `tsc -b && vite build` + `postbuild` (`scripts/prerender.mjs`) | — |
| tests | **no existen** (ni Vitest, ni Testing Library, ni `test` script) | — |

- TS estricto: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `erasableSyntaxOnly` (→ nada de `enum` ni parameter properties), `verbatimModuleSyntax`.
- `tsconfig.app.json` incluye solo `src/`. Alias `@/* → src/*`.
- ESLint 9 flat: `typescript-eslint` recommended + `react-hooks` v7 (reglas nuevas tipo "set-state-in-effect") + `react-refresh` + `consistent-type-imports` obligatorio.
- Node 24 en la máquina.
- CSP (`vite.config.ts`) se inyecta **solo en build**: no afecta al dev server. Igual queda compatible con un worker same-origin (`script-src 'self'`).

### 1.2 Estructura

```
src/
  components/   RangeGrid, RangeCell (memo), Layout/{AppLayout,Sidebar}, ui/PageHeader…
  modules/      <módulo>/ = página + componentes locales (home, viewer, editor, trainer,
                calculators, analysis, workbook)
  utils/        lógica pura (handUtils, handRangeParser, handHistory, comboMath, runoutMath, ev…)
  store/        Zustand (rangeStore, uiStore, …) + schemas.ts (Zod) + persist.ts (keys)
  types/poker.ts
  data/
```

No existe `src/features/`. La convención es "módulo de UI en `src/modules/`, lógica pura en `src/utils/`".

### 1.3 "Mano capturada" — modelo real

**No hay un registro persistido de manos.** Lo que existe es el parser del módulo `/analisis`:

- `src/utils/handHistory.ts` → `parseHandHistory(raw: string): { hand: ParsedHand | null; errors }`. Puro, tolerante, 4 formatos de sala.
- `ParsedHand`: `players[] {name, seat, stack, isDealer}`, `hero`, `heroCards: Card[]`, `board: Card[]` (hasta 5), `streets[] {street, board, decisions[], potStart}`, `bigBlind`, `currency`, `shows`, `winners`.
- `Decision`: `{street, actor, isHero, type: post|check|call|bet|raise|fold|allin, amount, potBefore}`. Un raise trae el **total de la calle**; el motor de pot ya lo resuelve.
- `Card = { rank: string; suit: '♠'|'♥'|'♦'|'♣' }` (también exportado `parseCardToken`, `cardToString`).
- `AnalysisPage.tsx` guarda el texto en `useState` del componente → la mano **vive solo mientras estás en `/analisis`**.
- **Falta información para el preset preflop:** `ParsedHand` **no tiene posición** de cada jugador (solo `seat` + `isDealer`), ni qué `Situation` fue preflop. Para elegir el rango del villano en la biblioteca hay que derivar posiciones (a partir del botón y el orden de asientos) o pedírselo al usuario.

`src/utils/spotCalc.ts` ya tiene helpers sobre `ParsedHand` reutilizables por el adaptador: `villainCheckedBeforeHero`, `heroAggressionOnStreet`, `villainBetFaced`/`amountToCall` (privados), `stackContext`.

### 1.4 Rangos: formato y parser

- `Range` (`types/poker.ts`): `cells: Record<HandNotation, {hand, actions: {action, weight 0..100}[]}>` disperso (ausente = fold), `position`, `situation` (`RFI | vs_LIMP | vs_RFI | vs_OS | vs_3BET | vs_4BET | SQUEEZE | DEFEND_BB`), `villainPosition?`, `group` (carpeta), `actions: ActionDef[]` (paleta por rango, ids opacos).
- Notación de clase: `"AA" | "AKs" | "72o"` (`HandNotation`), 169 clases, `ALL_HANDS` en orden row-major del grid.
- `handUtils.ts`: `ALL_HANDS`, `isPair/isSuited/isOffsuit`, `categoryOf`, `combosOf`, `handToGridCoords`, `gridCoordsToHand`.
- `handRangeParser.ts`: `parseHandRange(text) → {hands: {hand, weight}[], errors}` (texto tipo `AKs, 22+, [50]…[/50]`, y el formato combo-por-combo de un solver comercial). `handRangeSerializer.ts` serializa (incl. tags `[NN]`).
- `exportRange.ts`: exportación del rango en el formato de texto `[NN]…[/NN]`.
- **Nada trabaja a nivel combo con palos** (los pesos son por clase). `comboMath.ts` solo cuenta combos vivos con bloqueadores; `runoutMath.ts` tiene `makesStraight` y helpers de runouts sobre `Card`. No hay evaluador de manos ni cálculo de equity en el repo.

### 1.5 Grid 13×13

- `components/RangeGrid/RangeGrid.tsx` + `RangeCell.tsx` (**`React.memo`, intocable por CLAUDE.md**) + `useRangePainter.ts`.
- API: `cells`, `actionsMap`, `editable`, `onCellPaint/Erase/PaintPlus`, `onSessionStart`, `variant`. Pinta cada celda como **gradiente horizontal por acción** según `ActionDef.color`. Navegación con flechas, roving tabindex, tooltip de stats anclado a esquina.
- **No soporta** lo que pide §10.3: atenuar/resaltar según la fila seleccionada, borde azul de "pintada a mano", tres estados (sigue / en rango no sigue / fuera de rango), clic que abre un selector 4×4.

### 1.6 Componentes de cartas

- `modules/trainer/HandCards.tsx`: `CardFace({rank, suit})` (4 colores), `CardBack`, `HandCards`.
- `modules/analysis/BoardCards.tsx`: `BoardCards({cards: Card[]})` (usa `CardFace`).

### 1.7 Stores (Zustand 5)

- Todos con `persist` + `createSafeJSONStorage` (`store/persist.ts`) + validación Zod al hidratar (`store/schemas.ts`); keys centralizadas `range-soprano/<x>`.
- `selectors.ts`: `useActiveRange` etc. (devuelven referencias del store, no objetos nuevos → no necesitan `useShallow`); `useRangeSummaries` usa `useShallow`; `useRangesInGroup` usa `useMemo`.
- Para la biblioteca: `useRangeStore(s => s.ranges)` + `isInGroup` / `normalizeGroupPath` (`groupUtils.ts`).

### 1.8 Router y navegación

- `src/router.tsx`: `createBrowserRouter`, páginas con `lazy()` + `Suspense`, todas hijas de `AppLayout`.
- `components/Layout/Sidebar.tsx`: `NAV_SECTIONS` (Inicio · Rangos · Matemáticas · Herramientas).
- SEO: `scripts/prerender.mjs` (`ROUTES`), `public/sitemap.xml`, `useDocumentTitle`. **Nada de esto se toca.**

## 2. Propuesta

### 2.1 Ruta dev-only

```tsx
// router.tsx
const SopranozillaPage = import.meta.env.DEV
  ? lazy(() => import('@/features/sopranozilla/ui/SopranozillaPage'))
  : null;
...
...(SopranozillaPage ? [{ path: 'sopranozilla', element: <Suspense …><SopranozillaPage /></Suspense> }] : []),
```

- Vite reemplaza `import.meta.env.DEV` por `false` en build → la rama y el `import()` dinámico se eliminan; el chunk **no se emite**. Se verifica en la fase 4 con `vite build` + grep de "sopranozilla" en `dist/` (y luego se borra `dist/` local o se deja como estaba; no se commitea).
- Sidebar: ítem `{ to: '/sopranozilla', label: 'Sopranozilla' }` agregado a la sección "Matemáticas" con el mismo `import.meta.env.DEV ? [...] : []`.
- `useDocumentTitle('Sopranozilla · Range Soprano', { noindex: true })`, sin `canonical`. Sin cambios en `prerender.mjs`, sitemap ni `.github/`.

### 2.2 Ubicación del código

Mantener **`src/features/sopranozilla/`** como dice el spec (en lugar de `src/modules/` + `src/utils/`): al ser dev-only y experimental, que quede autocontenido hace trivial auditar que nada se filtra al build y revertir. El alias `@/` lo cubre sin tocar tsconfig. (Ver pregunta Q1.)

```
src/features/sopranozilla/
  engine/   cards · combos · evaluator · equity · classify · modifiers · filterExpr · weights · chain · ev · presets
  engine/__tests__/*.test.ts
  worker/equity.worker.ts
  schemas/  store/  presets/default-presets.json  ui/  adapters/fromParsedHand.ts
tests/fixtures/equity/*.json        ← como pide §11.4
```

### 2.3 Reutilizar / extender / crear

| Pieza | Decisión |
|---|---|
| `HandNotation`, `ALL_HANDS`, `handToGridCoords`, `RANKS` | **Reusar** tal cual. |
| `Card`, `Suit`, `parseCardToken`, `cardToString` (`handHistory.ts`) | **Reusar como tipo de frontera** (UI y adaptador). El motor usa internamente ids `0..51` (`rank*4+suit`) y máscaras de bits; `cards.ts` convierte `Card ↔ id`. |
| `makesStraight` / helpers de `runoutMath.ts` | **No** se usan en el motor (trabajan sobre `Card` con strings; demasiado lentos para enumeración). El clasificador tendrá su propia detección por máscara de rangos. |
| `parseHandRange` | **Reusar** para el input manual del rango del villano en la página de prueba. |
| `Range.cells` → pesos por combo | **Nuevo** en `combos.ts`: `villainPreflopFromRange(range, actionIds)` expande clase → combos y aplica `weight/100` (suma de las acciones elegidas, ej. "call"). Lectura pura, no cambia `Range`. |
| `ParsedHand` | **Reusar** como input del adaptador (`fromParsedHand.ts`). Ver Q3 sobre posiciones. |
| `CardFace` / `BoardCards` | **Reusar** en la barra superior. |
| `RangeGrid` / `RangeCell` | **No extender.** Grid propio `SzGrid` en la feature, reusando `ALL_HANDS`, `handToGridCoords`, tokens de Tailwind (`bg-cell-empty-*`) y el patrón de delegación por `data-hand`. Motivo: necesita 3 estados + atenuado por fila + borde de override + clic → 4×4, y meterlo en `RangeCell` obliga a tocar el componente memoizado que usa toda la app. (Ver Q2.) |
| `WeightSlider` (editor) | Revisar en la fase 4 si encaja (0–100 paso 5 + chips); si no, uno propio. |
| `persist.ts` (`createSafeJSONStorage`, keys) | **Reusar** para los filtros personalizados: key nueva `range-soprano/sopranozilla-filters`, validada con Zod. |
| `PageHeader`, `cn`, `toastStore` | Reusar. |

### 2.4 Evaluador (§4.1)

Propuesta: **port propio en TS de un evaluador clásico de primos y bits** (primos por rango + bits de palo/rango) con las tablas `flushes`/`unique5` **generadas al cargar el módulo** (no se copian tablas de terceros; ~7 462 clases), y búsqueda de productos con hash perfecto o tabla ordenada + búsqueda binaria. 7 cartas = mejor de las 21 combinaciones de 5.

- Sin dependencias nuevas, sin licencias que revisar.
- Referencia independiente para la prueba diferencial: evaluador de **fuerza bruta por categorías** (contar rangos/palos, decidir categoría y kickers) sobre las 21 combinaciones, escrito aparte y sin compartir código con el anterior.
- Si el benchmark del worker no llega a < 1 s en el flop contra ~400 combos, la optimización prevista es evaluar cada runout una sola vez por mano (hero precalculado por runout) antes que cambiar de algoritmo.

### 2.5 Tests

- Agregar **Vitest** (permitido por el spec). Testing Library solo cuando haga falta en la UI (fase 4+).
- Config `test` dentro de `vite.config.ts` (o `vitest.config.ts` aparte para no tocar el de producción — prefiero aparte) y script `"test": "vitest run"`.
- Tests junto al código (`src/features/sopranozilla/**/__tests__`), así `tsc -b` los typechequea con el tsconfig existente. Imports explícitos de `vitest` (sin globals).
- La prueba diferencial de 1 M manos puede tardar decenas de segundos; queda en `npm test` pero con semilla fija (PRNG determinista) para que sea reproducible.
- Fixtures de equity en `tests/fixtures/equity/*.json` con `expectedEquity: null` + `"TODO"`; el test los saltea mientras sean null.

### 2.6 Estado

- `analyzerStore` **no persistido** (la sesión de análisis se arma desde la mano; persistirla complica el schema sin pedido explícito). Filtros personalizados **sí** persistidos.
- Selectores que devuelvan objetos/arrays → `useShallow` (regla del spec). Derivados pesados (pesos finales, conteos, equity) en funciones puras memoizadas fuera del store; caché `eqCombo` en un `Map` de módulo con clave `hero|board`.

### 2.7 Convenciones de trabajo

- Commits: `feat(sopranozilla-1): …`, `test(sopranozilla-1): …`, `docs(sopranozilla): …`. Un commit por fase, sin push.
- UI en español neutro con tuteo (preferencia guardada del usuario), términos de póker en inglés como el resto de la app.
- Decisiones nuevas → `docs/sopranozilla/DECISIONS.md`.

## 3. Preguntas antes de la Fase 1

- **Q1. Carpeta.** ¿`src/features/sopranozilla/` (spec, autocontenido) o `src/modules/sopranozilla/` + motor en `src/utils/` (convención del repo)? Recomiendo la primera.
- **Q2. Grid.** ¿OK con un grid propio en la feature en vez de extender `RangeGrid`/`RangeCell`? Recomiendo grid propio (no toca el `React.memo` compartido).
- **Q3. Mano capturada.** No hay manos persistidas; existe solo `ParsedHand` en memoria dentro de `/analisis`. Para la fase 6 propongo: (a) botón dev-only "Abrir en Sopranozilla" en `HandWorksheet` que pasa la mano por un store en memoria (o pegar el `.txt` directo en `/sopranozilla`), y (b) derivar posiciones desde `isDealer` + orden de asientos para elegir el rango del villano en la biblioteca, con selector manual de rango como respaldo. ¿Va así? Tocar `HandWorksheet` sería el único cambio a un archivo existente fuera de `router`/`Sidebar`.
- **Q4. Lint.** `main` ya tiene 32 errores de lint (reglas nuevas de `react-hooks` v7 y `react-refresh` en trainer/editor/viewer). Arreglarlos implica tocar features existentes. Propuesta: el criterio de cada fase es **0 errores en los archivos de Sopranozilla** (`eslint src/features/sopranozilla`) y **no subir el total global** (32). ¿O prefieres que los arregle en un commit aparte?
- **Q5. Vitest.** ¿`vitest.config.ts` separado (recomendado, no toca el config de producción) o bloque `test` en `vite.config.ts`?
- **Q6. Repo público.** El spec nombra herramientas de terceros como referencia de diseño. En código, UI, commits, RECON y DECISIONS las voy a describir de forma genérica sin excepciones (el usuario pidió el 2026-11-02 quitar todo nombre de terceros, también del `SPEC.md`).
