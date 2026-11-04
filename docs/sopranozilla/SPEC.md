# Especificación: Sopranozilla — Analizador de Mano (filtrado de rango + EV) para RangesSoprano

> Documento para Claude Code.
> Contiene todas las decisiones ya tomadas. No las re-discutas ni re-diseñes: impleméntalas. Si algo es ambiguo o choca con el código existente o con `CLAUDE.md`, pregunta antes de inventar.

---

## 0. Cómo arrancar (mensaje para pegar en Claude Code)

El archivo se deja en la raíz del proyecto (junto a `CLAUDE.md`) como `SOPRANOZILLA_SPEC.md`. El primer paso de Claude Code es moverlo a su lugar definitivo.

```
Lee SOPRANOZILLA_SPEC.md (está en la raíz del proyecto) completo.
1. Crea la rama feature/sopranozilla y cámbiate a ella.
2. Mueve el archivo a docs/sopranozilla/SPEC.md con git mv (crea las carpetas) y haz commit.
3. Empieza por la Fase 0 (reconocimiento del repo). Respeta las convenciones de CLAUDE.md.
No escribas código de la feature hasta que yo apruebe el plan de la Fase 0.
Trabaja por fases; al terminar cada una, corre typecheck + lint + tests, haz commit en la rama
feature/sopranozilla (sin push) y detente a reportarme.
```

---

## 1. Objetivo

**Sopranozilla** es un analizador de manos dentro de RangesSoprano. Usa ese nombre en la UI, en la ruta (`/sopranozilla`) y en el código (`src/features/sopranozilla/`). Combina:

1. **Filtrado de rango por categorías, más preciso que las herramientas de escritorio habituales.** Hay pesos 0–100 por categoría, modificadores y filtros personalizados (ej. "Top 3 BDFD").
2. **Calculadora de equity exacta** por enumeración, tan fiable como las calculadoras de equity de referencia.
3. **Calculadora EV por acción:** cada acción tiene su propio rango de continuación (un rango por acción).
4. **Ahorro de tiempo:**
   - la mano ya capturada en la web alimenta todo;
   - el rango preflop se precarga desde la biblioteca;
   - cada calle arranca con un **preset** según la acción registrada;
   - el usuario solo afina.

**Diferenciadores frente a otras herramientas:** presets automáticos desde la mano registrada, filtros más finos (modificadores y filtros personalizados) y EV por fila.

## 2. Restricciones de esta etapa (obligatorias)

- **Solo local.** No se publica en GitHub Pages.
  - Trabajar en la rama `feature/sopranozilla`. **Nunca hacer push** ni merge a `main`.
  - La ruta del analizador (`/sopranozilla`) y su link en la navegación se registran **solo si `import.meta.env.DEV`**, para que aunque el código llegue a `main` no aparezca en el build de producción.
  - No modificar `.github/` (workflows de deploy), `CNAME`, `dist/`, sitemap, meta tags ni configuración de Cloudflare.
- **`CLAUDE.md`** del repo manda en convenciones de código. Si contradice algo de este documento, pregunta.
- **No romper nada existente.** Las features actuales (rangos, editor, captura de manos) deben seguir funcionando igual.
- **Reutilizar, no duplicar.** Antes de crear un componente o tipo, busca si ya existe: grid 13×13, parser y formato de rangos, componentes de cartas, modelo de la mano capturada, stores de Zustand, schemas Zod. Si existe, reutilízalo o extiéndelo sin romper a sus consumidores. Si hay que refactorizar código compartido, pregúntame primero.
- **Dependencias nuevas:** pide permiso antes de agregar cualquiera, salvo Vitest y Testing Library si el repo no tiene tests.
- **Zustand:** todo selector que devuelva objetos o arrays usa `useShallow`. Ya tuvimos un loop infinito en `/editor` por `useActiveRange` sin `useShallow`; no repetirlo.
- **Motor puro.** Toda la lógica de póker vive en TypeScript puro, sin React, testeable sin UI.

## 3. Arquitectura propuesta (ajústala a las convenciones reales del repo tras la Fase 0)

```
src/features/sopranozilla/
  engine/                 # TS puro, sin React
    cards.ts              # Card, parse/format, deck, ids 0..51, máscaras
    combos.ts             # expansión de clases (AKs→4 combos), pesos por combo, bloqueadores
    evaluator.ts          # evaluador 5–7 cartas (algoritmo probado, ver §4.1)
    equity.ts             # enumeración exacta, equity por combo
    classify.ts           # categorías + atributos por combo (ver §5)
    modifiers.ts          # predicados de modificadores (ver §6.1)
    filterExpr.ts         # evaluación del árbol AND/OR/NOT/PALOS del constructor (ver §6.2)
    weights.ts            # resolución de peso final por combo (ver §7)
    chain.ts              # encadenado entre calles
    ev.ts                 # fórmulas EV (ver §9)
    presets.ts            # carga + matching de presets
  worker/
    equity.worker.ts      # cálculo pesado fuera del hilo principal
  schemas/                # Zod: Preset, CustomFilter, AnalyzerState, adaptador de la mano
  store/
    analyzerStore.ts      # Zustand (ver §8)
  presets/
    default-presets.json
  ui/                     # componentes (ver §10)
  adapters/
    fromHandRecord.ts     # mano capturada existente → input del analizador
docs/sopranozilla/
  SPEC.md                 # este documento
  RECON.md                # salida de la Fase 0
  DECISIONS.md            # decisiones nuevas que se tomen durante la implementación
```

## 4. Motor de equity

### 4.1 Evaluador

- Usar un **algoritmo probado**: un evaluador clásico de primos y bits o uno de tablas de búsqueda, como port en TS o una librería.
  - Si es librería: verifica la licencia y pídeme aprobación.
  - Si es port propio: debe pasar las pruebas diferenciales de §11.
- No escribir un evaluador "ingenuo" a mano sin validación diferencial.

### 4.2 Equity

- **Enumeración exacta, nunca Monte Carlo.**
  - Flop: todos los pares turn+river compatibles.
  - Turn: todos los rivers.
  - River: comparación directa.
- **Empates** cuentan 0.5.
- **Bloqueadores:** se excluyen los combos del villano que comparten cartas con Hero o con el board, y los runouts que comparten cartas con Hero, el board o el combo evaluado.
- **Clave de rendimiento:**
  - Calcular y cachear la **equity de Hero contra cada combo** (`eqCombo[comboId]`) una vez por calle (board + mano de Hero). No depende de los pesos.
  - Así, `equityVsRango = Σ(w·eqCombo) / Σ(w)`. Es exacto porque todos los combos válidos tienen el mismo número de runouts.
  - Cualquier cambio de peso recalcula al instante sin re-enumerar.
- Correr el cálculo por combo en un **Web Worker**, con indicador de progreso.
- Presupuesto: flop contra unos 400 combos en menos de 1 s en un equipo normal.

## 5. Clasificación (definiciones PROPIAS, no copiar las de otras herramientas)

No buscamos coincidir con otras herramientas en las definiciones; buscamos definiciones claras y más precisas. Cada categoría tendrá un tooltip con su definición en la UI.

**Convenciones:**
- "Rangos del board" = rangos distintos ordenados de mayor a menor (top, 2nd, 3rd…).
- Las categorías hechas son **exclusivas**: cada combo cae en la primera que cumple.
- Los proyectos y los combo draws **no son exclusivos**: un combo aparece en todas las filas que cumple. Los conteos por fila pueden sumar más que el total del rango, y la UI muestra el total aparte.
- **Principio general:** se clasifica por la **contribución de las cartas de Hero**. Si las cartas propias no mejoran lo que ya da el board, el combo es "Sin hecho".

### 5.1 Manos hechas (exclusivas, en este orden)

1. **Escalera de color / póker**
2. **Full house**
3. **Color.** Atributo: nut-rank de la carta propia más alta del palo.
4. **Escalera.** Atributo: usa 1 o 2 cartas propias.
5. **Set:** pocket pair + una carta del board de ese rango.
6. **Trío:** una carta propia + board pareado de ese rango.
7. **Doble pareja:** ambas cartas propias emparejan rangos distintos del board. Atributo: top two / top+bottom / bottom two.
8. **Overpair:** pocket pair > top.
9. **Top pair:** carta propia empareja el top. Atributo: kicker.
10. **PP < top card:** pocket pair entre el top y el 2nd.
11. **Middle pair:** carta propia empareja el 2nd. Atributo: kicker.
12. **PP < 2nd card:** pocket pair por debajo del 2nd y por encima del rango más bajo del board.
13. **Weak pair:** carta propia empareja el 3rd o cualquier rango menor. Atributo: kicker.
14. **PP < board:** pocket pair por debajo del rango más bajo del board.
15. **Sin hecho**, exclusivo por carta alta (corregido, ver D33):
    - **A-high:** contiene un As.
    - **K-high:** contiene un K y no un As.
    - **Nada.**

    Las overcards ya no son sub-filas de "Sin hecho": pasan a Proyectos (§5.2).

**Board pareado:** cuando una carta propia empareja un rango no pareado del board, el par se clasifica por la posición de ese rango (top / middle / weak) aunque técnicamente sea doble pareja. Un pocket pair en board pareado se clasifica por su posición (overpair, PP < …). Documentarlo en el tooltip.

### 5.2 Proyectos (no exclusivos; solo flop y turn)

- No se marcan proyectos de color si ya hay color, ni de escalera si ya hay escalera.
- **FD 2 cartas:** ambas propias del mismo palo + 2 del board de ese palo.
- **FD 1 carta:** 1 propia + 3 del board del palo (board monocolor o turn).
- **OESD 2 cartas / 1 carta:**
  - hay al menos 2 rangos de outs que completan escalera;
  - existe una secuencia de 4 rangos consecutivos abierta por ambos lados que incluye al menos una carta propia;
  - es de "2 cartas" si toda escalera completada necesita ambas cartas propias; si alguna se completa con una sola, es de "1 carta".
- **Double gutshot:** al menos 2 rangos de outs **sin** secuencia abierta de 4 consecutivos. Fila propia, separada de OESD.
- **Gutshot 2 cartas / 1 carta:** exactamente 1 rango de out.
- Cuentan las escaleras con el As bajo (A2345).
- Solo cuentan outs que completan una escalera que usa cartas propias, no una escalera solo del board.
- **BDFD 2 cartas** (solo flop): ambas propias del mismo palo + 1 carta del board de ese palo.
- **BDFD 1 carta** (solo flop): 1 propia + 2 del board de ese palo.
- **Dos overcards / Una overcard** (corregido, ver D33): ambas / exactamente una carta propia por encima del rango más alto del board. No exclusivas, como los demás proyectos; se calculan en todas las calles. Los pocket pairs no cuentan (son overpair).
- **BDSD (backdoor straight draw, solo flop):**
  - existen dos cartas (turn + river) que completan una escalera que usa al menos una carta propia;
  - el combo **no** tiene ya OESD, double gutshot ni gutshot.
  - Atributo `cardsUsed`: 1 o 2.
  - **No se muestra como fila propia**, solo combinada con BDFD (§5.3). Sí está disponible como elemento en el constructor de filtros (§6.2).
- **Atributos de todo proyecto de color:**
  - `suit`;
  - `highHoleRankInSuit`;
  - `nutRank`: posición de la carta propia más alta del palo entre los rangos de ese palo que **no** están en el board (1 = nut).

### 5.3 Combo draws (no exclusivos)

FD + OESD, FD + gutshot, FD + par (cualquier par hecho), OESD + par, gutshot + par, FD + overcards.

**BDSD + BDFD** (solo flop): el combo tiene **a la vez** backdoor de escalera y backdoor de color (BDFD de 1 o 2 cartas). Es una fila propia porque son candidatos típicos a check-raise de farol OOP en el flop.
- Atributos: `cardsUsed` de cada backdoor y `nutRank` del BDFD, para filtrarlos con modificadores.

**Gutshot + BDFD** (solo flop, agregado, ver D34): gutshot (1 o 2 cartas) más BDFD de 1 o 2 cartas. Atributos `cardsUsed` de cada parte y `nutRank` del BDFD. También es fila clave para check-raise de farol OOP. Ejemplo en A♥ J♦ 2♣: Q♥T♥ entra; Q♠T♠ no.

### 5.4 Atributos expuestos por combo

`classify(combo, board)` devuelve un objeto con:
- `made`: la categoría exclusiva;
- `draws[]` y `comboDraws[]`;
- atributos numéricos: `kicker`, `highCard`, `cardsUsed`, `nutRank`, `overcards`, `suit`.

Los modificadores (§6) filtran sobre esos atributos.

## 6. Modificadores y filtros personalizados (lo que supera a las herramientas habituales)

- Un **filtro personalizado** es una expresión construida con el constructor (§6.2), con nombre propio. Se muestra como fila en el grupo "Personalizados", con peso, ✓ y ✗, igual que cualquier categoría.
- Se guarda y se reutiliza (localStorage, validado con Zod), y se puede exportar o importar en JSON.

### 6.1 Modificadores (predicados sobre los atributos)

| Modificador | Definición |
|---|---|
| `topN` | La carta relevante está entre los N rangos más altos **que no están en el board**. Carta relevante: en proyectos de color, la propia más alta del palo; en pares, el kicker; en sin hecho, la carta más alta. |
| `rankRange` | La carta relevante está entre [min, max]. |
| `nutRankMax` | Proyectos o color con `nutRank` ≤ k. |
| `cardsUsed` | 1 o 2. |
| `includeMade` | En proyectos: si se incluyen combos que además tienen par o algo mejor. Default `false` en filtros personalizados de proyectos. |
| `kickerMin` | En pares. |

**Caso de aceptación obligatorio: "Top 3 BDFD"**
- Configuración: base `BDFD 2 cartas`, `topN = 3`, `includeMade = false`.
- Flop: A♥ J♦ 2♣ (rainbow). Rangos más altos fuera del board: K, Q, T.
- Debe **incluir:** K♥Q♥, K♦T♦, Q♣T♣, T♥9♥, K♥3♥.
- Debe **excluir:**
  - K♠Q♠ (no hay picas en el board);
  - K♥J♥ y K♦2♦ (tienen par; entrarían solo con `includeMade = true`);
  - 9♥8♥ (la carta alta no está en el top 3);
  - J♥T♥ (tiene par).

### 6.2 Constructor de filtros combinados

Las herramientas habituales permiten combinar estadísticas, pero se quedan cortas:
- tiene slots limitados;
- solo permite un nivel de AND / OR / NOT;
- no tiene modificadores, ni vista previa, ni pesos.

Sopranozilla lo amplía:

**Elementos (hojas de la expresión):**
- Cualquier categoría de §5: manos hechas, proyectos (incluido BDSD) y combo draws.
- Elementos negados útiles: "sin flush draw", "sin par".
- Otro filtro personalizado ya guardado, para reutilizarlo.
- Cada elemento puede llevar modificadores de §6.1. Ejemplo: `BDFD 2 cartas [topN = 3]`.

**Operadores:**

| Operador | Uso |
|---|---|
| **AND** | El combo cumple todos los elementos del grupo |
| **OR** | El combo cumple al menos uno |
| **NOT** | Excluye los combos que cumplen el elemento o grupo |
| **PALOS** | Restringe por palo: suited / offsuit, un palo concreto, o "palo presente en el board" / "palo con 2 en el board" |

**Mejoras sobre las herramientas habituales (obligatorias):**
- **Grupos anidados con paréntesis**, sin límite de niveles. Ejemplo: `(Top pair [kicker ≥ Q] OR Overpair) AND NOT (FD)`.
- **Sin límite de slots.**
- **Vista previa en vivo:** combos que cumplen, % del rango y su resaltado en el grid mientras se construye.
- **Expresión legible:** se muestra como texto ("Top pair con kicker ≥ Q o overpair, sin flush draw").
- **Validación:** avisar si la expresión no matchea ningún combo en el board actual, sin bloquear el guardado (en otro board puede matchear).
- Guardar con nombre; editar, duplicar y borrar; exportar e importar en JSON.
- **Independiente del board:** la expresión se evalúa sobre los atributos de §5.4, así que el mismo filtro sirve en cualquier flop, turn o river.

**Modelo (Zod):**
```ts
type FilterExpr =
  | { type: 'leaf'; category: CategoryId | CustomFilterId; modifiers?: Modifier[] }
  | { type: 'and' | 'or'; children: FilterExpr[] }
  | { type: 'not'; child: FilterExpr }
  | { type: 'suits'; rule: SuitRule; child?: FilterExpr }
type CustomFilter = { id: string; name: string; expr: FilterExpr; createdAt: string }
```

- Detectar y rechazar referencias circulares entre filtros guardados.

## 7. Resolución del peso final por combo (calle actual, fila de EV seleccionada)

Orden de precedencia, de mayor a menor:

1. **Override a nivel combo:** selector de palos 4×4.
2. **Override a nivel clase:** pincel sobre la celda del grid 13×13.
3. **Filtros personalizados** que matchean el combo: si alguno está marcado ✓, se usa el mayor peso entre ellos; si solo hay ✗, el peso es 0.
4. **Filas de combo draw** que matchean: misma regla que el punto 3.
5. **Filas genéricas** (la hecha + los proyectos): el **mayor** peso entre las filas ✓ que matchean.
   - Si ninguna fila ✓ matchea, el peso es 0.
   - Una fila ✗ equivale a peso 0, pero **no anula** otra fila ✓ que también matchee. Ejemplo: "Nada ✗" + "BDFD ✓ 40" → el combo sigue con 40.

**Peso efectivo** = peso preflop × Π (peso de la fila "jugada" en cada calle anterior) × peso de la calle actual.

Mostrar esta regla en la UI (tooltip o ayuda del panel).

## 8. Estado (Zustand)

```ts
type RowState = { s: 'follow' | 'exclude' | null; w: number }   // w 0..100
type ActionRowState = {
  cats: Record<CategoryId, RowState>
  custom: Record<CustomFilterId, RowState>
  classOverrides: Record<HandClass, number>     // "AKs" → 0..100
  comboOverrides: Record<ComboId, number>
  edited: boolean                               // difiere del preset
}
type StreetState = {
  actionRows: { id: string; label: string; kind: 'check'|'bet'|'call'|'raise'; size?: number }[]
  rows: Record<string /*actionRowId*/, ActionRowState>
  selectedRow: string
  playedRow: string | null                      // encadena a la siguiente calle
}
type AnalyzerState = {
  hand: AnalyzerHandInput                       // del adaptador
  villainPreflop: Record<ComboId, number>       // 0..1
  streets: Record<'flop'|'turn'|'river', StreetState>
  activeStreet: 'flop'|'turn'|'river'
  selectedCategory: CategoryId | CustomFilterId | null
  brush: number
  paintMode: boolean
}
```

- Las cachés de `eqCombo` van fuera del store reactivo (Map en el módulo o en el worker), con clave por hero + board.
- Los valores derivados (pesos finales, conteos por fila, equity) se calculan con selectores memoizados.

## 9. Calculadora EV

**Modo "Hero decide"** (primera implementación):
- Filas: Check + tamaños de apuesta. Por defecto: flop 33% / 75%, turn 50% / 75%, river 33% / 66% / 125%. Botón "+ Tamaño".
- **Cada fila tiene su propio rango de continuación**, que es el `ActionRowState`. Al seleccionar una fila, la tabla de categorías edita ese rango.
- Variables: P = bote, B = apuesta, total = Σ pesos del rango al inicio de la calle, cont = Σ pesos que siguen.
- **Check:** EV = eqVsRangoCompleto × P. Supuesto: sin apuestas posteriores; equity al river.
- **Bet B:**
  - f = 1 − cont / total
  - eqC = equity de Hero contra el rango que sigue
  - EV = f·P + (1 − f)·(eqC·(P + 2B) − B)
- Mostrar el umbral de bluff puro: B / (P + B).
- Columnas: Acción | % sigue | Fold eq. | Tu eq. | EV (en bb, con alternativa en % del bote). Marcar "jugada" y "mejor EV".
- Dejar visible el supuesto: "equity sin apuestas posteriores; no modela realización de equity".

**Modo "Villano apuesta"** (fase posterior):
- Filas Fold / Call / Raise X.
- Raise requiere un segundo rango, "paga el raise", editable igual que los demás.
- Fórmulas equivalentes; mostrar la equity necesaria por pot odds.

## 10. UI

**Layout** (desktop primero; debe funcionar en pantallas angostas apilando columnas):

1. **Barra superior:**
   - tarjetas Hero / Villano con su equity contra el rango al iniciar la calle;
   - pestañas Flop / Turn / River;
   - cartas del board (la nueva resaltada);
   - línea de acción, bote y stack;
   - mini tabla "Equity por calle".
2. **Banda del preset:**
   - "Fila «Bet 33%» → preset «Call vs 33%» detectado en la mano";
   - badge "editado";
   - botones **Restablecer preset**, **Todo ✓ 100** y **Vaciar (manual)**. "Vaciar" deja el filtrado manual puro.
3. **Columna izquierda, grid 13×13** (reutilizar el existente si se puede):
   - relleno ámbar proporcional al peso que **sigue**, gris para lo que está en rango pero no sigue, oscuro para lo que no está en rango;
   - al seleccionar una fila, se resaltan sus manos y se atenúa el resto;
   - borde azul en las celdas pintadas a mano;
   - slider de peso (0–100, paso 5) con chips 0 / 25 / 50 / 75 / 100: edita la fila seleccionada, o el pincel si está en modo pincel;
   - selector de palos 4×4 al hacer clic en una clase, con combos individuales y bloqueados marcados (tooltip "K♠8♣ · bloqueado").
4. **Columna central, tabla de categorías:**
   - grupos: Manos hechas, Proyectos, Combo draws, Personalizados;
   - por fila: nombre (botón que la selecciona), barra, combos (2 decimales), % del rango, **Tu eq.** (equity de Hero contra esa fila), peso, ✓ y ✗;
   - pie: "Rango: X combos (Y% de manos vivas) · Siguen: Z (W%)";
   - botón "+ Filtro personalizado" que abre el constructor de §6.2: panel de elementos a la izquierda, área de expresión con operadores y grupos al centro, vista previa a la derecha. Se usa arrastrando elementos o con clic.
5. **Columna derecha:** calculadora EV (§9).

**Atajos de teclado** (no deben interferir con inputs):

| Tecla | Acción |
|---|---|
| ↑ / ↓ | Moverse entre filas |
| 1–9, 0 | Peso de 10 a 90, y 100 |
| F | ✓ |
| X | ✗ |
| P | Modo pincel |
| [ / ] | Cambiar de calle |

Otros requisitos:
- Tooltip con la definición en cada categoría.
- Accesibilidad: botones reales, `aria-pressed` en ✓ y ✗, foco visible, contraste AA.

## 11. Tests y validación (Vitest)

1. **Evaluador, pruebas diferenciales:** al menos 1 millón de manos aleatorias de 7 cartas, comparadas contra un evaluador de referencia independiente (por ejemplo, una implementación de fuerza bruta sobre las 21 combinaciones de 5 cartas). Diferencias permitidas: **0**.
2. **Clasificador:** tests unitarios por categoría con boards seco, conectado, pareado, monocolor, de turn y de river. Los valores esperados salen de las definiciones de §5, que son nuestras, así que puedes escribirlos.
   - Incluir el caso "Top 3 BDFD" (§6.1).
   - Incluir ruedas, double gutshot, FD de 1 carta, board pareado, K-high y BDSD + BDFD. Ejemplo en A♥ J♦ 2♣:
     - Q♥T♥ entra en BDSD + BDFD;
     - Q♠T♠ no entra, porque no hay picas en el board.
3. **Constructor de filtros:** tests de AND, OR, NOT, PALOS, grupos anidados, filtros que referencian otros filtros y rechazo de referencias circulares.
4. **Equity, golden tests:** crea la estructura `tests/fixtures/equity/*.json` con el formato `{hero, board, villainRange, expectedEquity}`. **No inventes valores esperados:** déjalos como TODO; yo los llenaré con una calculadora de equity de referencia. Tolerancia: ±0.01%.
5. **Invariantes:**
   - eqHero + eqVillano = 100%;
   - ningún combo comparte cartas con Hero o el board;
   - la suma de las categorías hechas = total del rango;
   - pesos siempre dentro de [0, 1].
6. **Resolución de pesos (§7):** un test por cada nivel de precedencia y para el caso "✗ no anula ✓".
7. **Rendimiento:** benchmark del flop contra unos 400 combos en el worker; reportar el tiempo.

## 12. Presets

- Archivo JSON validado con Zod.
- **Matching:** calle + tipo de acción del villano (call / raise / check) + rango de sizing de la apuesta de Hero en % del bote. Se elige el preset con el rango de sizing que contenga la apuesta real.
- Un preset es **el estado inicial de las filas**: `follow` con un peso, `exclude`, o neutral. No es un sistema aparte.
- **Auto-detección:** el adaptador lee la acción registrada en la mano, crea las filas de EV (incluida la jugada) y aplica el preset correspondiente. Si no hay match: "Todo ✓ 100" y aviso "sin preset para esta acción".
- **Valores iniciales (heurísticos, los afinaré yo).** `-` = descartar (✗). Las filas no listadas quedan neutrales.

| Categoría | Flop call vs 25–45% | Flop call vs 55–100% | Turn call vs 40–60% | Turn call vs 60–100% | River call vs 25–45% | River call vs 50–80% | River call vs 100%+ |
|---|---|---|---|---|---|---|---|
| Color / full / póker | 100 | 100 | 100 | 100 | 100 | 100 | 100 |
| Escalera | 60 | 70 | 70 | 75 | 100 | 100 | 100 |
| Set / trío / doble pareja | 60 | 70 | 75 | 80 | 100 | 100 | 100 |
| Overpair | 100 | 100 | 100 | 100 | 100 | 100 | 95 |
| Top pair | 100 | 100 | 100 | 95 | 100 | 100 | 85 |
| PP < top card | 100 | 85 | 70 | 50 | 85 | 60 | 30 |
| Middle pair | 100 | 80 | 70 | 45 | 85 | 60 | 30 |
| PP < 2nd card | 95 | 60 | 40 | 20 | 65 | 35 | 15 |
| Weak pair | 90 | 40 | 25 | 10 | 50 | 20 | 5 |
| PP < board | 70 | 20 | 10 | - | 40 | 10 | - |
| A-high | 50 | 15 | 10 | - | 25 | 8 | - |
| K-high | 30 | 5 | - | - | 10 | - | - |
| Nada | - | - | - | - | 5 | - | - |
| FD 2c / FD 1c | 85 / 70 | 90 / 75 | 100 / 85 | 95 / 75 | — | — | — |
| OESD 2c / 1c | 100 / 80 | 100 / 60 | 100 / 70 | 95 / 50 | — | — | — |
| Double gutshot | 100 | 80 | 90 | 70 | — | — | — |
| Gutshot 2c / 1c | 85 / 50 | 50 / 15 | 60 / 25 | 35 / 10 | — | — | — |
| BDFD 2c / 1c | 40 / 20 | 10 / 0 | — | — | — | — | — |
| BDSD + BDFD | 50 | 15 | — | — | — | — | — |
| Gutshot + BDFD | 60 | 20 | — | — | — | — | — |
| Dos overcards (proyecto) | 60 | 20 | 10 | - | 25 | 8 | - |
| Una overcard (proyecto) | 40 | 10 | - | - | 15 | 5 | - |
| Combo draws (el resto) | 100 | 95 | 100 | 95 | — | — | — |

- El preset de **Check** es el rango completo (todo ✓ 100).
- Los presets de **raise** (check-raise del villano) se definen en la Fase 6 con valores bajos en manos medias; propón una tabla y espera mi aprobación.
  - En el check-raise de flop OOP, **BDSD + BDFD** y **Gutshot + BDFD** son filas clave como farol: deben tener peso alto en esos presets.
- Las overcards son proyectos (D33) y conservan sus valores, también los de river. Como el peso final es el **mayor** entre las filas ✓ que matchean (§7), un combo con par y overcard toma el más alto de los dos.

## 13. Fases (detente y reporta al final de cada una)

| Fase | Contenido | Criterio de aceptación |
|---|---|---|
| **0. Reconocimiento** | Mapear en `docs/sopranozilla/RECON.md`: modelo de la mano capturada, formato de rangos y su parser, grid 13×13 existente, componentes de cartas, stores, router, setup de tests, scripts. Proponer la ruta dev-only y qué se reutiliza o extiende. **Sin código de la feature.** | Plan aprobado por mí |
| **1. Motor base** | cards, combos (pesos y bloqueadores), evaluador, equity exacta + worker + caché por combo | Tests §11.1, §11.4 y benchmark §11.6 pasan; estructura de fixtures creada |
| **2. Clasificador + modificadores + expresiones** | §5, §6.1 y el motor de §6.2 (`filterExpr.ts`, sin UI) | Tests §11.2 y §11.3 pasan, incluidos "Top 3 BDFD" y BDSD + BDFD |
| **3. Pesos y encadenado** | §7, chain.ts y el store §8 | Tests §11.5 pasan |
| **4. UI de una calle** | Ruta dev-only `/sopranozilla` con mano de prueba fija: grid, tabla, slider, pincel | Filtro manual por categorías funcionando; la equity se actualiza al instante |
| **5. Calles + EV** | Pestañas Flop/Turn/River, filas de EV con rango propio, fila jugada encadenada, fórmulas §9 | Cambiar el flop recalcula turn y river |
| **6. Presets + mano real** | Adaptador desde la mano capturada, preset por acción, banda del preset, botones | Abrir una mano registrada carga rango y presets sin captura manual |
| **7. Precisión y usabilidad** | Selector de palos 4×4, UI del constructor de filtros (§6.2), atajos, tooltips | Puedo crear desde la UI "Top 3 BDFD" y `(Top pair [kicker ≥ Q] OR Overpair) AND NOT (FD)`, guardarlos y usarlos como filas |
| **8. (Opcional) Villano apuesta** | Modo Fold/Call/Raise con rango "paga el raise" | Lo defino al llegar |

## 14. Reglas de trabajo para Claude Code

- Un commit por fase, con un mensaje claro, en `feature/sopranozilla`. **Sin push.**
- Antes de cerrar cada fase: `tsc --noEmit`, lint y tests en verde.
- Cualquier decisión nueva o desviación de este documento se anota en `docs/sopranozilla/DECISIONS.md` con su razón.
- No dejar `console.log` de depuración ni código muerto.
- Cuando algo de este documento sea imposible o choque con el código existente, detente y pregunta; no lo resuelvas por tu cuenta.
