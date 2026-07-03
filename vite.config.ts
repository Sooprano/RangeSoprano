import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Content-Security-Policy para el SPA estático (sin backend ni scripts remotos).
// Se inyecta SOLO en el build (`apply: 'build'`) para no romper el HMR del dev
// server, que necesita 'unsafe-eval' + websocket. 'unsafe-inline' es necesario
// por el script de tema inline y los estilos inline de React/Tailwind; data:/blob:
// por el QR y la exportación a PNG (html-to-image). El postbuild (prerender.mjs)
// lee este index.html ya con la CSP y la propaga a cada ruta + 404.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' data: blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

function cspMeta(): Plugin {
  return {
    name: 'inject-csp-meta',
    apply: 'build',
    transformIndexHtml(html) {
      const tag = `<meta http-equiv="Content-Security-Policy" content="${CSP}" />`;
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    ${tag}`,
      );
    },
  };
}

export default defineConfig(() => ({
  base: '/',
  plugins: [react(), cspMeta()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
}));
