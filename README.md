# Range Soprano

App de estudio de rangos preflop. Tres módulos:

- **Viewer** — leer rangos guardados, filtrar por posición/situación/villano/acción, comparar dos rangos en paralelo, exportar a PNG.
- **Trainer** — entrenar manos en mesa 6-max o Heads-Up. Modo clásico (responder acción) o dibujo (pintar de memoria).
- **Editor** — crear y editar rangos: paleta de acciones por rango, pesos mixtos, notas, undo/redo.

Todo corre en el navegador. Persistencia en `localStorage`. Sin cuenta, sin servidor.

## Live

https://sooprano.github.io/RangeSoprano/

## Stack

React 19 + TypeScript estricto · Vite · Tailwind 3 · Zustand 5 · React Router 7 · Zod.

## Desarrollo

```bash
npm install
npm run dev        # localhost:5173
npm run typecheck
npm run build
```

## Deploy

Push a `main` → GitHub Actions buildea y publica a GitHub Pages (workflow en [.github/workflows/deploy.yml](.github/workflows/deploy.yml)).

## Donaciones

BTC: `bc1qyz4fd8msnedgjj9sv68qlu4theh7mdh57rea8w`
