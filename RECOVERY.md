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
- Fase 7D (deploy): pendiente
- Fase 9 (Home + onboarding + import perfil JSON + donación BTC): `70e7e43`

## Estado actual

Fase 9 ✅ (Home + onboarding). Fase 7 en curso: 7A/7B/7C ✅, 7D ⏳ pausado (falta crear repo en GitHub y configurar remote; luego `vite.config.ts` con `base` condicional, `.github/workflows/deploy.yml`, `basename` en router, README).

Visual polish reciente: trainer con mesa 6-max estilo "stadium" (rectángulo con extremos semicirculares), slots redistribuidos con simetría bilateral, cartas pegadas al héroe.

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

## Convenciones de implementación

- TypeScript estricto (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), sin `any`.
- IDs vía `crypto.randomUUID()`.
- Persistencia en localStorage keys `range-soprano/ranges` y `range-soprano/ui`, hidratación validada con Zod, cap 100KB.
- Parser de import tolerante a errores de formato.
- `React.memo` en RangeCell NO se toca — todo cambio pasa por props estables.
- Conventional Commits: `feat(phase-Xa):`, `fix(phase-Xa):`, `docs:`, `chore:`.
- Antes de commitear: `npm run typecheck && npm run build` verdes + verificación en navegador.
