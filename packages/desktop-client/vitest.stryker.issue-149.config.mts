// Vitest config for mutation testing the Payees usage display (issue #149)
// with StrykerJS. stryker.issue-149.config.json runs it once per mutant.
//
// Based on Bennett Matuszewski's vitest.stryker.config.mts from #163: a
// standalone config rather than the full vite.config.mts, which copies
// public assets every time it loads and fails when Stryker's parallel
// workers load it at the same time. The helper's tests only need module
// resolution: no JSX, no i18n, no DOM.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    conditions: ['electron-renderer', 'module', 'browser', 'default'],
    tsconfigPaths: true,
  },
  test: {
    include: ['src/components/payees/payeeUsageDisplay.test.ts'],
    environment: 'node',
    globals: true,
  },
});
