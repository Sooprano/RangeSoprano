import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Tests only. Kept apart from vite.config.ts so the production build config
// stays untouched.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    // Slow suites run with `npm run test:slow` (vitest.slow.config.ts).
    exclude: ['**/node_modules/**', 'src/**/*.slow.test.ts'],
    environment: 'node',
  },
});
