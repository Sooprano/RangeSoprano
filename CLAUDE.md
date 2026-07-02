# Range Soprano — Poker Range Study App

App de estudio de rangos preflop inspirada en FreeBetRange. Módulos: Visualizador, Entrenador, Editor (rangos) + Calculadoras, Análisis, Ejercicios (matemática de poker). GTO y MDA están FUERA de alcance.

## Stack

React 19 + TypeScript estricto (noUncheckedIndexedAccess, exactOptionalPropertyTypes) · Vite · Tailwind 3 · Zustand 5 · React Router 7 · Zod · Lucide React · Inter (@fontsource).

## Estado de fases

Fases 1-48 completadas ✅. Detalle completo de cada fase, hashes de rollback y decisiones de diseño no obvias → `RECOVERY.md`.

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
48. Rework "Rangos": banco real (29 3bet lineal por % + 15 3bet GTO Wizard con peso, todos los opener→3bettor) · `RangeSpot.family` + scopes por drill · split en 3 tabs ("% y combos" · "Composición" mini-charts · "Tipo de rango" gated) · `MiniRangeChart` (opacidad=peso) · morfología reforzada. PENDIENTE: OR/calls GTO → activan "Tipo" + reemplazan el demo por defecto.

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
- `src/modules/{home,viewer,editor,trainer}/` — una carpeta por módulo, página raíz + componentes locales. `/` monta `home/HomePage.tsx` con onboarding + `ImportProfileButton` (consume `importRanges` del store).
- `src/utils/handUtils.ts` — `ALL_HANDS`, `categoryOf`, `combosOf`.
- `src/utils/rangeStats.ts` — `computeRangeStats` (%total, combos, presentActions).
- `src/components/CopyRangeMenu/CopyRangeMenu.tsx` — dropdown "Copiar" compartido (editor + viewer): copia el rango al portapapeles en **formato Flopzilla** (`[NN]…[/NN]`), Todo o por color/acción. Reusa `serializeWeightedHands(entries, { weightTag: 'flopzilla' })` + `rangeToFlopzilla`/`rangeActionToFlopzilla` (`exportRange.ts`).
- `src/modules/workbook/ChipColumn.tsx` — "MiniPot" compartido por los drills de `/ejercicios`: stack de fichas **escalado al bote** (`(amount/refAmount)*4`, cap 12) + eyebrow + monto (`format`) + sub. Tonos `muted/accent/rose/amber`. Lo usan SPR, Floating, Value/Bluff, River call/shove, River check/bet y AutoProfit. **Convención visual de drills** (ver [[feedback-drills-ux]]): lo tuyo=accent, villano=rose, bote=muted, sizing/variable=ámbar; pregunta en `text-base font-semibold` arriba de las opciones.
- **SEO pre-render**: `scripts/prerender.mjs` (hook `postbuild` en package.json) escribe `dist/<ruta>/index.html` con title/description/canonical/OG estático **por ruta** + `dist/404.html`. El array `ROUTES` del script es la fuente del meta estático → **mantener en sync con cada `useDocumentTitle(...)`**. Al agregar ruta nueva: sitemap (trailing slash) + `ROUTES` + `useDocumentTitle({ canonical })`.

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
