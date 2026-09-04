# Range Soprano — Poker Range Study App

App de estudio de rangos preflop de poker. Módulos: Visualizador, Entrenador, Editor (rangos) + Calculadoras, Análisis, Ejercicios (matemática de poker). GTO y MDA están FUERA de alcance.

## Stack

React 19 + TypeScript estricto (noUncheckedIndexedAccess, exactOptionalPropertyTypes) · Vite · Tailwind 3 · Zustand 5 · React Router 7 · Zod · Lucide React · Inter (@fontsource).

## Estado de fases

Fases 1-52 completadas ✅. Detalle completo de cada fase, hashes de rollback y decisiones de diseño no obvias → `RECOVERY.md`.

1. Setup y fundamentos
2. RangeGrid completo (base · stats · a11y)
3. Zustand stores + persistencia
4. Editor (base · pesos mixtos + undo/redo · import/export)
5. Visualizador (scope · filtros · compare · export PNG + atajos)
6. Entrenador (shell · clásico · dibujo · filtros)
7. Pulido final (toasts · a11y modals/menus · error boundary + 404 · deploy GitHub Pages)
8. Editor avanzado (Ctrl+RightClick hand+ · notas · Save/Discard/Clear · DnD carpetas · acciones custom)
9. Home + onboarding (import perfil JSON · donación BTC)
10. Villain + tableFormat HU/6max
11. Palette reuse · folder rename · meta edit-in-place
12. vs Limp · refactor SITUATION_LABELS · badges HU/villain
13. Trainer Speed mode (Classic/Drawing) + leaderboard local + Drawing scoring
14. Home FAQ + Overview perf (React.memo) · Print PDF · demo set
15. SEO técnico (sitemap, og-image, per-route titles, FAQPage JSON-LD, pre-render rutas) · Import GTOWizard combo-por-combo · ImportModal multi-acción · export/import perfil preserva groupMeta
16. Pulido UX trainer (ActionGrid rectangular, card compacta) · Branding en export PNG del Viewer
16a. Pot Odds Study trainer (pestaña Odds, range-independent, 4 tipos de pregunta MC)
16b. Pot Odds Speed mode + leaderboard
16c. Pulido Pot Odds Study (MiniPot · auto-avance · streak bonus)
16d. Freestyle input numérico (modo experto) en Pot Odds Study
16e. Export/Import JSON del leaderboard de Pot Odds Speed
17. Traducción completa UI a español (voseo) — términos poker preservados en inglés
17b. Traducciones pendientes home + menús editor
17c. QR de donación BTC en home (qrcode.react, single source of truth)
18a. Push/Fold scaffold (Nash HU, src/data/nashTable.ts, store)
18b. Push/Fold Estudio: Tabla + Quiz
18c. Push/Fold Velocidad + leaderboard persistente
18d. Push/Fold cartas visuales + stack chip + auto-avance (HandCards.tsx, CountdownBar.tsx)
18e. Pot Odds prompt rediseñado (OddsPrompt.tsx) + auto-avance default ON
19. Fix SEO indexación GSC (trailing slash sitemap + canonical per-route via useDocumentTitle)
20. Randomizador en /viewer Resumen (presets, sets, randomizerStore + portabilidad JSON)
21. Cronómetro de sesión en /viewer Resumen
22. Pop out combinado cronómetro + randomizador (Document Picture-in-Picture)
23. UX carpetas en /editor (rename/mover doble click) + barra de donaciones (src/data/donations.ts)
24. Sección Calculadoras (/calculadoras, src/utils/ev.ts) — 5 sub-tabs EV iniciales
25. All-in EV calc + tabla de sensibilidad (breakeven F% analítico)
26. Multi-way Call EV + EV de bluff + Check vs Bet (1ª calc dual)
27. Call vs Raise EV (2ª calc dual)
28. Raise sizing & pot odds (3 calcs "vs Raise flop" en una tab)
29. Doble barrel turn + river
30. Value / Bluff combos máx
31. Fold equity requerida con equity
32. Pulido de claridad calcs (captions EV + raise% en Check vs Bet + PME/breakeven)
33. EV de checkear compuesto + EV del raise bluff + EV multi-calle (17 sub-tabs · selector pedagógico CALC_GROUPS)
34. Módulo "Análisis de manos" /analisis — Worksheet desde .txt (handHistory.ts + spotCalc.ts) · 4 salas (iPoker/GG/Stars/Winamax)
35. Módulo "Ejercicios" /ejercicios — drill "¿Qué calculadora?" (reusa spotCalc.ts)
36. Drill "Conteo de combos" (bloqueadores, comboMath.ts)
37. Drill "Value / Bluff" (reusa valueBluffCombos) · refactor shell drillScore.ts/drillUi.tsx
38. Drill "Fold equity" (reusa bluffEv)
39. Drill "SPR / compromiso" (reusa allInEv+callRiverBetEv) · 39b CalcReveal "ver el cálculo"
40. Reorganización dos bloques Rangos/Matemáticas + Pot Odds/Push-Fold migrados a /ejercicios
41. Drill "Runouts" (runoutMath.ts + makesStraight)
42. Drill "Floating" (reusa floatEv)
43. Drill "¿Qué calculadora?" cobertura 17/17 (banco quizSpots.ts) + fixes spotCalc.ts (check river position-aware)
44. Drill "Auto-profit raise" (reusa raiseBluffEv)
45. Drill "River: call o shove" (reusa callRiverBetEv+allInEv)
46. Drill "River: check o bet" (reusa checkRiverEv+betRiverEv)
47. Drill grupo "Rangos": "% y combos" + "Composición + tipo/morfología" (reusa parseHandRange+combosOf/1326)
50. Mesa del Entrenador: marca de agua "Range Soprano" en el paño + stack del héroe (fichas + "12bb", dato ya existente vía `printLabels.stack`/nombre del rango) · 7 colores de ficha y toggles logo/stack en el modal Mesa
49. Apariencia de la mesa del Entrenador: cartas volteadas del villano + mesa personalizable (9 preajustes · capas felt/borde/marco/fondo · riel interior · forma estadio/oval largo · caja del jugador · reverso de cartas) en un modal, sin ruta nueva · Home: sección **Herramientas** (Sesión + Importar perfil) + FAQ reagrupada en 4 temas
52. **Frecuencias mixtas**: toda rama con frecuencia > 0 es correcta; el feedback separa la línea principal de una rama minoritaria y los botones muestran la mezcla
51. Entrenar una **carpeta entera** en el Entrenador (`TrainerSource` rango|carpeta) + la mesa cuenta el spot: acción del villano en fichas, ciegas vivas, pastilla del spot, botones filtrados al rango de la mano · situación `vs_OS` (Open Shove)
48. Rework "Rangos": banco real (29 3bet lineal por % + 15 3bet GTO Wizard con peso + 5 open RFI + 5 call BB + 5 cold-call BTN/SB = 59 spots, familias `linear-3bet`/`gto-3bet`/`open`/`call`/`cold-call`) · `RangeSpot.family` + scopes por drill · split en 3 tabs ("% y combos" · "Composición" mini-charts · "Tipo de rango" con las 4 formas: open lineal + gto-3bet mergeado(posicional)/polarizado(BB) + call/cold-call condensado) · `MiniRangeChart` (peso = relleno horizontal como el grid grande) · morfología reforzada (mergeado SUBE / condensado PAGA; 3bet: BB polar, resto merged) · **filtros `ChipFilter`** minimalistas por drill (familia "Rangos a estudiar"; "% y combos" además "Tipos de pregunta" %/Combos, misma línea que Pot Odds) · **demo por defecto reemplazado** (`sampleRanges.ts`): 30 rangos GTO reales en carpeta `Rangos GTO cash` + 4 subcarpetas (OR/3bet/BBDefend/Call cold), reusando las notaciones de los raw files via `parseHandRange`.

## Convenciones

- Conventional Commits: `feat(phase-Xa):`, `fix(phase-Xa):`, `docs:`, `chore:`
- Commit al terminar cada sub-fase
- Typecheck + build verdes antes de commitear
- Probar en navegador antes de aprobar fase

## Dominio

Grid 13×13 row-major. Orden: A K Q J T 9 8 7 6 5 4 3 2. Diagonal = pares. Arriba = suited. Abajo = offsuit. Cells con múltiples acciones ponderadas (weight 0-100, suma ≤100).

Acciones: cada `Range` define su propia paleta (`range.actions: ActionDef[]` con `id` opaco, `label`, `color` hex, `order`). Los IDs legacy `RAISE · 3BET · ALL_IN · CALL · FOLD` siguen siendo válidos y se siembran como defaults al hidratar rangos viejos (ver `DEFAULT_ACTION_DEFS` en `src/utils/actionMeta.ts`). Rangos nuevos arrancan con `NEW_RANGE_ACTION_DEFS` (Call + Raise). El **Entrenador** siempre ofrece un botón **Fold directo** para las manos fuera del rango: `trainerAnswerActions(range.actions)` = paleta + Fold sintético cuando la paleta no tiene `id:'FOLD'` propio (NO detectar fold por etiqueta — "OR to Fold" = abrir y foldear a un 3bet ≠ fold directo; ver [[reference-range-action-semantics]]).

## Arquitectura clave

- `src/components/RangeGrid/` — grid reutilizable, modo lectura y `editable` opt-in (props: `editable`, `onCellPaint`, `onCellErase`). Delega eventos por `data-hand` sin tocar la memoización de RangeCell. Borrar: clic derecho **o doble toque/doble clic** (`useRangePainter.onDoubleClick`, para móvil sin clic derecho). El pop-up de stats del hover (`RangeCell`) se ancla a una **esquina** para no tapar la celda de arriba ni la de al lado al dibujar: `tooltipSide` (vertical: fila 0 baja) × `tooltipAlign` (horizontal: `col>=7` voltea a la izquierda para no salirse por el borde derecho), ambas fijadas por `RangeGrid` con clases estáticas (no toca el `React.memo`).
- `src/components/TruncatedLabel.tsx` — label de 1 línea con ellipsis + tooltip estilizado (border/bg-surface/sombra, sale a la derecha) que aparece **solo si el texto está cortado** (`scrollWidth>clientWidth`, remedido en cada hover). Usado para el nombre del rango en las listas RANGES (`ViewerRangeList`, `RangeManager`).
- **Apariencia de la mesa (Entrenador):** `src/store/tableThemeStore.ts` (persistido `range-soprano/table-theme`) + catálogo en `src/data/tableThemes.ts` (single source of truth: presets, swatches por capa, reversos). Modelo de capas de afuera hacia adentro: `background` → `outerBorder` → `frame` → `innerRail` → `felt`. **Los colores van a `style` inline → el schema los cierra a `/^#[0-9a-fA-F]{6}$/`** (un blob corrupto no puede inyectar CSS); por eso NO hay color picker libre, solo swatches curados (todos los fieltros pasan un chequeo de luminancia contra el texto blanco de los badges). El fieltro guarda **un** hex y los 3 stops del gradiente se derivan con `brighten`/`shade` de `src/utils/color.ts` (`brighten` es multiplicativo: mezclar hacia el blanco desatura el verde-azulado). El preset `clasico` es **pixel-idéntico** a la mesa pre-tema: el marco se dibuja `FRAME_OUTSET=5px` hacia afuera de la caja vieja del fieltro y su `padding` lo devuelve, así el borde exterior cae donde caía el anillo `0 0 0 5px` y la superficie del fieltro no se mueve. La capa `background` **NO se pinta en `PokerTable`** sino en `src/modules/trainer/TableSurface.tsx` (el panel entero: mesa + acciones + feedback + botones), porque limitarla a la mesa dejaba dos rectángulos redondeados anidados; el toggle Auto-avance queda fuera del panel a propósito. El héroe conserva `bg-accent` en las 3 cajas de jugador — "este sos vos" no depende de un ajuste cosmético. `CardBack`/`CardBackPair` viven en `HandCards.tsx` junto a `CardFace` (que NO se toca); las cartas del villano se abanican y van **arriba** del badge en los asientos de abajo y **abajo** en los de arriba (`slot.y > 50`) para no salirse del contenedor. **Fase 50**: el logo del paño y el stack del héroe (fichas + "12bb") tienen toggles propios; los colores de ficha viven en `CHIP_STYLES` con 3 hex cada uno (`base`+`edge`+`text`) para que número y pila combinen. El stack se ancla a la **fila de cartas** y con `bottom-1/2` — la columna del héroe sigue por debajo del paño (combos + badge desbordan, es lo que compensa `heroSpace`), así que centrarlo sobre la columna dejaba las fichas encima del riel. El número **NO usa `font-mono`**: el stack por defecto de Tailwind resuelve a Consolas en Windows y su cero con barra vuelve ilegible "20bb"; va en Inter con la unidad separada. El dato sale de `stackLabelOf` (`src/utils/rangeStack.ts`), que reusa el `deriveStack` del PDF — **su fallback al nombre del rango** es lo que hace que `BBvsBU 12bb` funcione sin llenar el campo del Editor.
- **Entrenar una carpeta (fase 51):** `src/utils/trainerSource.ts` es la pieza central — `TrainerSource = {kind:'range'} | {kind:'folder', path, label, ranges}` y `ClassicTrainer`/`SpeedTrainer` reciben **`source`, no `range`**, así que hay UN solo componente por modo. En `kind:'range'` todo delega en lo de siempre (comportamiento bit-idéntico). En carpeta: sorteo de rango **uniforme** (todos pesan 1326 combos → uniforme por rango == uniforme por combo) y **paleta fusionada por etiqueta normalizada** (`normalizeActionLabel` en `actionMeta.ts`, del que ahora depende `normalizeHotkeyLabel`) — las acciones custom llevan `crypto.randomUUID()` por rango, así que sin fusionar salen 6 botones "Call". El `id` del def fusionado ES la clave de etiqueta → `ActionGrid`/`useActionHotkeys` no se enteran. **`useActionHotkeys` recibe SIEMPRE la paleta fusionada completa** (su fallback 1-9 es posicional: con la lista filtrada el mismo "All in" sería 2 en una mano y 3 en la siguiente) y lo que se RENDERIZA es `answerActionsFor(...)`, esa misma lista filtrada a lo que el rango de la mano ofrece → los botones desaparecen, nunca saltan de columna; el keydown ignora teclas de acciones no visibles. Estado en `uiStore.trainerFolderPath` (excluyente con `trainerRangeId`); ranges vía `useRangesInGroup` (recursivo, `isInGroup`/`normalizeGroupPath`/`relativeGroupPath` en `groupUtils.ts`); leaderboard con clave `folder:<path>` (el `byRangeId` es `z.record(z.string(),…)`, sin cambio de schema). Dibujo queda fuera (pintar un grid es pintar un rango) y se deshabilita **derivando** el modo, no sincronizando estado en un effect.
- **La mesa cuenta el spot (fase 51):** la referencia de "contra qué estoy jugando" sale del paño, no de una etiqueta. `VILLAIN_ACTION_LABELS` (`src/data/positions.ts`, exhaustivo sobre `Situation`) → fichas + etiqueta delante del villano (`Limp 1bb` · `Raise` · `All in` · `3-Bet`…; `RFI = null`, un asiento vacío ES "te llega sin acción"). **NO se usan `printLabels.sizing1/2` para el monto**: son campos libres del Editor y pueden ser el sizing del héroe. `BLIND_LABELS` pinta SB/BB solo si **actúan después del héroe** (`POSITIONS` está en orden de acción preflop → comparación de índices; defendiendo la BB el SB ya foldeó y queda apagado), con rol de asiento `live` (cartas boca abajo + caja sin apagar, pero sin el acento del villano) y tono de fichas apagado (`shade(-0.4)` sobre el color del tema, 2 fichas) — la acción del villano es lo único a color pleno. La acción **reemplaza** a la ciega en ese asiento (un limp ES la ciega completada). Todo absoluto respecto de la columna del asiento para no mover los `VISUAL_SLOTS`. El label reusa la tipografía del `StackChip` (número bold + unidad chica, Inter con `tabular-nums`, **nunca `font-mono`**) vía `splitBetLabel`, que exige el número **al final** para no romper "3-Bet". Pastilla del spot = `spotLabelOf` (nombre SIN el stack: leerlo en las fichas es medio ejercicio) y va `self-start` — el asiento superior está centrado y **desborda por arriba** del contenedor, una pastilla centrada le queda debajo. Toggles `showVillainAction`/`showSpotName`/`showBlinds` en el modal Mesa, con **`.default(true)` en el schema en vez de bump de versión** (`.strict()` rechaza claves desconocidas, no faltantes).
- **Frecuencias mixtas (fase 52):** el Entrenador **no puntúa contra una rama sorteada**. `sampleTrainerHand` solo devuelve `{hand, cell}` y `strategyOf` (`trainerSource.ts`) traduce la celda entera al espacio de respuestas del source (`AnswerStrategy`: `byKey` + `bestKey` + `mixed`), sumando los pesos cuando dos ids locales caen en la misma clave. **Correcto = frecuencia > 0** (`isCorrectAnswer`), y `isMainLine` (con epsilon, así un 50/50 es principal por los dos lados) distingue la línea dominante de una rama minoritaria — tres veredictos: verde principal · **ámbar minoritaria** · rojo 0%. La masa sin asignar de una celda (`100 − Σ`) y las manos fuera del rango siguen siendo Fold, ahora como rama respondible. Al responder, el badge de la tecla de cada botón muestra su frecuencia (`formatFrequency`, `<1%` para ramas ínfimas) → se eliminó la línea "Cell strategy" del feedback por redundante. El contador **"Línea principal x/y"** cuelga del tile Precisión y **solo cuenta manos que tenían mezcla** (en una celda pura no hubo elección); es de sesión, NO se persiste en el leaderboard (`zSpeedClassicEntry` es `.strict()`). En Velocidad el flash sigue binario y solo el botón apretado muestra su %.
- **Hotkeys del Entrenador:** teclas personalizables por acción en Clásico + Velocidad. `src/store/hotkeyStore.ts` (persistido `range-soprano/hotkeys`) mapea **label normalizado → tecla** (global por nombre, sirve entre rangos de la misma familia). `src/hooks/useActionHotkeys.ts` resuelve en 1 pasada (tecla custom gana; número 1-9 de fallback), da `effectiveKey`/`actionForKey` y maneja la captura (clic derecho en el botón → tecla; Esc cancela, ⌫ borra) con listener en fase de captura + `stopPropagation`. NO tocar el fallback numérico ni el keydown de avanzar/omitir (Enter/Space/N/S).
- **Herramientas (sidebar):** la sección "Herramientas" del `Sidebar` son **acciones, no rutas**. La ventana flotante (cronómetro + randomizador) es **app-level**: `src/store/floatingToolsStore.ts` (una sola ventana PiP, `open()` desde un gesto de clic / `close()`) + `src/components/Layout/FloatingToolsHost.tsx` (montado en `AppLayout`, portalea `FloatingContent`) → persiste al navegar. `FloatingTools` (Visualizador › Resumen) solo lee del store. Importar perfil `.json` vive en `src/hooks/useImportProfile.ts` (single source, lo usan el botón del Home y el del sidebar).
- `src/store/rangeStore.ts` — CRUD + persist con Zod al hidratar, cap 100KB, IDs con `crypto.randomUUID()`.
- `src/store/selectors.ts` — `useActiveRange`, `useRangeSummaries` (useShallow), `useRangesByGroup` (useMemo).
- `src/modules/{home,viewer,editor,trainer}/` — una carpeta por módulo, página raíz + componentes locales. `/` monta `home/HomePage.tsx` con onboarding + `ImportProfileButton` (consume `importRanges` del store).
- `src/utils/handUtils.ts` — `ALL_HANDS`, `categoryOf`, `combosOf`.
- `src/utils/rangeStats.ts` — `computeRangeStats` (%total, combos, presentActions).
- `src/components/CopyRangeMenu/CopyRangeMenu.tsx` — dropdown "Copiar" compartido (editor + viewer): copia el rango al portapapeles en **formato Flopzilla** (`[NN]…[/NN]`), Todo o por color/acción. Reusa `serializeWeightedHands(entries, { weightTag: 'flopzilla' })` + `rangeToFlopzilla`/`rangeActionToFlopzilla` (`exportRange.ts`).
- `src/modules/workbook/ChipColumn.tsx` — "MiniPot" compartido por los drills de `/ejercicios`: stack de fichas **escalado al bote** (`(amount/refAmount)*4`, cap 12) + eyebrow + monto (`format`) + sub. Tonos `muted/accent/rose/amber`. Lo usan SPR, Floating, Value/Bluff, River call/shove, River check/bet y AutoProfit. **Convención visual de drills** (ver [[feedback-drills-ux]]): lo tuyo=accent, villano=rose, bote=muted, sizing/variable=ámbar; pregunta en `text-base font-semibold` arriba de las opciones.
- **Home (`HomePage.tsx`)**: `MODULES` = grilla de `<Link>` con chip de **ruta**; las **Herramientas** (Sesión, Importar perfil) son **acciones** y van en su propia sección con `ToolCardView` (`<button>`, chip `herramienta`) — misma división que el `Sidebar`, no mezclar. El array `FAQS` es **plano** con un campo `group`: el agrupado en 4 temas es solo de render porque el JSON-LD de `FAQPage` se deriva del array → **nunca anidar `FAQS`** o se pierden preguntas del rich result. Al sumar una feature: card del módulo + paso de "Cómo estudiar" + FAQ (con `aPlain` si la respuesta lleva JSX) y, si hay un conteo en el texto, actualizar JSX **y** `aPlain`.
- **`/analisis` (worksheet)**: el pot de cada decisión lo lleva el motor de `handHistory.ts` — **un raise siempre trae el TOTAL de la calle**, explícito en el `raises X to Y` de GG/Stars/Winamax e implícito en el `Raise (NF) €40.00` de iPoker (el SB ya está adentro; por eso la BB después "paga" solo €20) → al pot entra `total − comprometido en la calle`. Los seeds de `spotCalc.ts` usan una convención única: **`pot`/`currentPot` = bote CON la apuesta del villano y SIN tu call**, que es lo que piden `callRiverBetEv` e `impliedOdds` (pot odds = `call/(pot+call)`, implied = `call/eq − call − pot`). Un `fold` del héroe **es** analizable (la pregunta es si el bote daba precio) → `call-vs-raise` con `amountToCall()`, que resta lo que vos ya pusiste en la calle; `stackContext()` siembra el **stack efectivo** (el más corto de los dos, tope real de las implied odds) y el shove topeado a lo que el villano puede pagar. Unidades: `MoneyUnitContext` en `CalcShared.tsx` con default `'$'` → **`/calculadoras` queda intacta**; el worksheet lo provee con la moneda real de la mano o con `BB`, dentro de las calcs se formatea con `useMoney()` (no `formatCurrency`) y **un `prefix="$"` en un `NumberField` significa "este campo es dinero"** (el símbolo sale del contexto). El `key` del `InlineCalc` incluye la unidad porque los montos se siembran **solo al montar**.
- **SEO pre-render**: `scripts/prerender.mjs` (hook `postbuild` en package.json) escribe `dist/<ruta>/index.html` con title/description/canonical/OG estático **por ruta** + `dist/404.html`. El array `ROUTES` del script es la fuente del meta estático → **mantener en sync con cada `useDocumentTitle(...)`**. Al agregar ruta nueva: sitemap (trailing slash) + `ROUTES` + `useDocumentTitle({ canonical })`.

## Reglas importantes

- TypeScript estricto, sin `any`
- `React.memo` en RangeCell NO se toca — todo cambio pasa por props estables
- Persistencia en localStorage keys `range-soprano/ranges` y `range-soprano/ui`
- Todo color que termine en un `style` inline se valida con regex hex en el schema Zod antes de persistirse
- IDs vía `crypto.randomUUID()`
- Parser de import tolerante a errores de formato
- NO implementar GTO ni MDA

## Notas para Claude Code

- Antes de modificar código: `git status`, revisar commits recientes
- Si el usuario reporta bug: diagnosticar causa raíz antes de proponer fix
- Presentar plan, esperar confirmación, luego codificar
