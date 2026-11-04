import { defineConfig } from 'vitest/config';
import base from './vitest.config';

// Slow suites only (`*.slow.test.ts`): exhaustive and million-hand checks.
// Built by hand instead of mergeConfig, which would concatenate (not replace)
// the base include/exclude lists.
export default defineConfig({
  resolve: base.resolve ?? {},
  test: {
    include: ['src/**/*.slow.test.ts'],
    environment: 'node',
  },
});
