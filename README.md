# Range Soprano

**Web app gratuita para el estudio de rangos de poker preflop.** Visualizá, creá y entrená rangos de poker (6-max y Heads-Up) directamente en el navegador, sin cuenta, sin servidor y sin tracking.

🔗 **Live:** https://rangesoprano.com/

## Qué hace

Range Soprano es una herramienta para **aprender, memorizar y comparar rangos preflop de poker**. Pensada como alternativa libre y gratis a soluciones como FreeBetRange / Range Trainer pagos, con foco en simplicidad y portabilidad de los datos (export/import `.json`).

Tres módulos:

- **Viewer** — visualizador de rangos preflop. Leé rangos guardados, filtrá por posición / situación / villano / acción, compará dos rangos en paralelo, exportá a PNG o imprimí varios a PDF.
- **Trainer** — entrenador de rangos de poker. Practicá manos en mesa 6-max o Heads-Up. Modo Clásico (responder acción), Speed (contrarreloj con leaderboard local) o Drawing (pintar el rango de memoria y compararlo con la verdad).
- **Editor** — creación de rangos de poker con paleta de acciones por rango, pesos mixtos, notas, undo/redo, carpetas e import/export JSON.

## Características

- **Gratis y open source** — sin cuenta, sin login, sin suscripciones.
- **Tus datos viven en tu navegador** (`localStorage`). Nada se sube a un servidor.
- **6-max y Heads-Up** — el Trainer pinta la mesa según el formato del rango.
- **Pesos mixtos** — frecuencias de acción por celda (raise / 3bet / call / fold) con suma ≤100.
- **Portabilidad** — export/import del perfil completo en `.json` para mover rangos entre dispositivos.
- **Print PDF** — imprimí tus rangos en hojas con leyenda y etiquetas de stack/sizing.
- **Atajos de teclado** y accesibilidad (focus trap en modales, navegación con flechas en menús).

## Stack

React 19 + TypeScript estricto · Vite · Tailwind 3 · Zustand 5 · React Router 7 · Zod · Lucide React.

## Desarrollo

```bash
npm install
npm run dev        # localhost:5173
npm run typecheck
npm run build
```

## Deploy

Push a `main` → GitHub Actions buildea y publica a GitHub Pages con custom domain `rangesoprano.com` (workflow en [.github/workflows/deploy.yml](.github/workflows/deploy.yml)).

## Donaciones

Si la herramienta te resultó útil, podés invitarme un café:

BTC: `bc1qyz4fd8msnedgjj9sv68qlu4theh7mdh57rea8w`

---

**Keywords:** rangos de poker, rangos preflop, estudio de rangos de poker, creación de rangos de poker, herramientas para aprender rangos de poker, rangos gratis de poker, entrenador de rangos de poker, editor de rangos preflop, visualizador de rangos preflop, alternativa a FreeBetRange, poker range trainer, app de poker gratis, 6-max preflop, Heads-Up preflop.
