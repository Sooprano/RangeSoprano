# CLAUDE.md — Poker Range Study App

## 🎯 Descripción del Proyecto

Aplicación web completa para estudiar y entrenar rangos preflop de poker, inspirada en FreeBetRange. El proyecto incluye **tres módulos principales**: Visualizador, Entrenador y Editor. Los módulos GTO y MDA están **excluidos del alcance**.

---

## 🏗️ Stack Tecnológico

- **Frontend**: React 18 + TypeScript
- **Estilos**: Tailwind CSS + tema oscuro/claro
- **Estado global**: Zustand
- **Enrutamiento**: React Router v6
- **Persistencia**: localStorage (rangos del usuario)
- **Build tool**: Vite
- **Testing**: Vitest + Testing Library

---

## 📁 Estructura de Directorios

src/
├── components/
│   ├── ui/               # Componentes base reutilizables
│   ├── RangeGrid/        # Grid 13x13 de manos de poker
│   ├── RangeCell/        # Celda individual del grid
│   ├── HandSelector/     # Selector de posición y situación
│   └── Layout/           # Navbar, Sidebar, Footer
├── modules/
│   ├── viewer/           # Módulo Visualizador
│   ├── trainer/          # Módulo Entrenador
│   └── editor/           # Módulo Editor
├── store/
│   ├── rangeStore.ts     # Rangos del usuario
│   └── uiStore.ts        # Tema, preferencias UI
├── types/
│   └── poker.ts          # Tipos TypeScript de poker
├── utils/
│   ├── rangeParser.ts    # Parseo/exportación de rangos
│   ├── handUtils.ts      # Utilidades de manos
│   └── notation.ts       # Notación estándar poker
└── data/
└── positions.ts      # Posiciones y situaciones preflop

---

## ♠️ Conceptos Clave de Dominio

### Grid de Rangos (13x13)
- El tablero de rangos es una matriz 13×13 con las 169 manos iniciales posibles
- **Diagonal principal**: pares (AA, KK, QQ... 22)
- **Arriba de la diagonal**: manos suited (AKs, AQs...)
- **Abajo de la diagonal**: manos offsuit (AKo, AQo...)
- El orden de filas/columnas es: A, K, Q, J, T, 9, 8, 7, 6, 5, 4, 3, 2

### Acciones / Colores de Celdas
Cada celda puede tener una o más acciones con pesos (frecuencias):
- `RAISE` → color verde (#22c55e)
- `CALL` → color azul (#3b82f6)
- `FOLD` → color rojo/gris (#6b7280)
- `3BET` → color morado (#a855f7)
- `ALL_IN` → color amarillo (#eab308)
- Rangos mixtos: mostrar colores proporcionales en la celda (barras o gradiente)

### Tipo de datos de una celda
```typescript
type HandAction = {
  action: 'RAISE' | 'CALL' | 'FOLD' | '3BET' | 'ALL_IN';
  weight: number; // 0 a 100 (porcentaje de frecuencia)
  color: string;
};

type RangeCell = {
  hand: string;       // ej: "AKs", "72o", "JJ"
  actions: HandAction[];
  isSelected: boolean;
};
```

### Posiciones en la mesa
```typescript
type Position = 'UTG' | 'UTG+1' | 'UTG+2' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB';
```

### Situaciones preflop
- RFI (Raise First In)
- vs RFI: Call, 3Bet, Fold
- vs 3Bet: Call, 4Bet, Fold
- vs 4Bet: Call, 5Bet, Fold
- Squeeze
- Defend BB

---

## 📦 Módulo 1: Visualizador

**Ruta**: `/viewer`

### Funcionalidades
1. Selección de situación mediante dropdowns encadenados:
   - Formato (Cash / MTT / Spins)
   - Número de jugadores en mesa (2-9)
   - Posición del héroe
   - Situación (RFI, vs RFI, etc.)
   - Posición del villano (cuando aplica)

2. Visualización del grid 13×13 con colores por acción

3. Panel lateral con:
   - Leyenda de colores/acciones
   - Porcentaje total del rango
   - Número de combinaciones

4. Modo multi-rango: ver hasta 2 rangos superpuestos con transparencia

5. Hover sobre celda: mostrar detalle de acciones y pesos

6. Modo oscuro/claro con toggle

### Componentes a crear
- `<RangeGrid />` — grid 13×13
- `<RangeCell />` — celda individual con colores
- `<SituationSelector />` — dropdowns de selección
- `<RangeStats />` — estadísticas del rango
- `<ActionLegend />` — leyenda de colores

---

## 📦 Módulo 2: Entrenador

**Ruta**: `/trainer`

### Modo Clásico (`/trainer/classic`)
1. Se "reparten" 2 cartas aleatorias basadas en el rango activo
2. El usuario elige una acción (botones: Fold / Call / Raise / 3Bet)
3. Se muestra si la decisión fue correcta según el rango
4. Estadísticas en tiempo real: % aciertos, manos jugadas, racha

**Lógica de reparto**: La mano se selecciona aleatoriamente con probabilidad proporcional al porcentaje de cada combo en el rango. Las cartas se muestran visualmente (imagen o SVG de cartas).

### Modo Dibujo de Rangos (`/trainer/drawing`)
1. Se muestra la situación (ej: "BTN RFI")
2. El usuario pinta celdas en un grid vacío intentando replicar el rango correcto
3. Al confirmar, se superpone el rango correcto y se calcula la precisión:
   - Celdas correctas (verde)
   - Falsas inclusiones (amarillo)
   - Omisiones (rojo)
4. Puntuación del 0 al 100%

### Configuración del entrenamiento
- Seleccionar qué rangos incluir (por posición, situación, grupo)
- Número de manos por sesión
- Tiempo límite opcional por decisión

### Componentes a crear
- `<TrainerSetup />` — configuración de sesión
- `<ClassicTrainer />` — modo clásico
- `<DrawingTrainer />` — modo dibujo
- `<CardDisplay />` — muestra las 2 cartas repartidas
- `<ActionButtons />` — botones de decisión
- `<SessionStats />` — estadísticas de sesión

---

## 📦 Módulo 3: Editor

**Ruta**: `/editor`

### Funcionalidades
1. **Grid editable**: clic en celda para asignar acción, clic derecho para borrar
2. **Modo pintura**: mantener clic y arrastrar para pintar múltiples celdas
3. **Selector de acción activa**: toolbar con las acciones disponibles
4. **Pesos mixtos**: asignar frecuencias (ej: 50% Raise, 50% Call)
5. **Gestión de rangos**:
   - Crear nuevo rango
   - Guardar rango (nombre, posición, situación)
   - Duplicar / Eliminar rango
   - Organizar en carpetas/grupos
6. **Importación**:
   - Desde texto en notación estándar (ej: `AA,KK,QQ,AKs,AKo`)
   - Formato Equilab / Flopzilla / PioSolver
7. **Exportación**:
   - Copiar al portapapeles en notación texto
   - Exportar como imagen PNG del grid
8. **Undo/Redo**: historial de cambios (Ctrl+Z / Ctrl+Y)

### Notación de importación/exportación

// Ejemplos de notación aceptada:
AA,KK,QQ,JJ,TT           // pares
AKs,AQs,AJs              // suited
AKo,AQo                  // offsuit
ATs+                     // ATs, AJs, AQs, AKs
98s-65s                  // 98s, 87s, 76s, 65s

### Componentes a crear
- `<EditorGrid />` — grid interactivo con eventos de arrastre
- `<ActionToolbar />` — selector de acción activa
- `<WeightSlider />` — slider para frecuencias mixtas
- `<RangeManager />` — lista y gestión de rangos guardados
- `<ImportModal />` — modal de importación
- `<ExportModal />` — modal de exportación

---

## 🗂️ Gestión de Rangos (Store)

Los rangos se guardan en localStorage bajo la clave `poker_ranges`.

```typescript
type Range = {
  id: string;
  name: string;
  position: Position;
  situation: string;
  villainPosition?: Position;
  cells: Record<string, RangeCell>; // key = hand notation (ej: "AKs")
  createdAt: string;
  updatedAt: string;
  group?: string;
};

type RangeStore = {
  ranges: Range[];
  activeRangeId: string | null;
  addRange: (range: Omit<Range, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateRange: (id: string, updates: Partial<Range>) => void;
  deleteRange: (id: string) => void;
  setActiveRange: (id: string) => void;
};
```

---

## 🎨 Diseño UI

### Tema Oscuro (default)
- Background: `#0f0f0f` / `#1a1a1a`
- Surface: `#242424` / `#2d2d2d`
- Border: `#3a3a3a`
- Text: `#e5e5e5`
- Accent: `#3b82f6` (azul)

### Tema Claro
- Background: `#f5f5f5`
- Surface: `#ffffff`
- Border: `#e0e0e0`
- Text: `#1a1a1a`

### Grid Visual
- Cada celda: mínimo 36×36px, responsive
- Fondo de celda = color de acción dominante
- Texto de celda: notación de mano (ej: "AK", "JTs")
- Celdas de par: borde especial o texto en negrita

---

## 🚀 Orden de Implementación Recomendado

1. **Setup inicial**: Vite + React + TypeScript + Tailwind + Router
2. **Tipos y utilidades**: `poker.ts`, `handUtils.ts`, `notation.ts`
3. **Componente RangeGrid**: el núcleo visual de toda la app
4. **Store**: Zustand para rangos y UI
5. **Editor**: el módulo más complejo, base para los otros
6. **Visualizador**: usa el grid en modo solo lectura
7. **Entrenador Clásico**: lógica de reparto y evaluación
8. **Entrenador Dibujo**: extensión del grid en modo edición con comparación
9. **Importación/Exportación**: parsers de texto
10. **Pulido UI**: animaciones, responsividad, tema oscuro/claro

---

## ⚙️ Comandos de Desarrollo

```bash
npm create vite@latest poker-range-app -- --template react-ts
cd poker-range-app
npm install
npm install -D tailwindcss postcss autoprefixer
npm install zustand react-router-dom
npx tailwindcss init -p
npm run dev
```

---

## ✅ Notas para Claude Code

- **Prioriza el componente RangeGrid**, es la pieza central de toda la app.
- Usa **TypeScript estricto** en todo momento.
- El grid debe ser **completamente accesible** (keyboard navigation en el editor).
- La lógica de reparto de manos en el entrenador debe respetar **los pesos de frecuencia** de cada acción.
- En el modo dibujo, el algoritmo de comparación debe calcular precisión por **combinaciones**, no solo por celdas.
- Los rangos guardados deben **persistir entre sesiones** vía localStorage.
- Usa `crypto.randomUUID()` para generar IDs de rangos.
- El parser de notación debe ser **tolerante a errores** de formato.
- No implementar GTO ni MDA.
