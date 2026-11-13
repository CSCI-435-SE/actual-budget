// Vitest config for mutation testing the "(modified)" label (issue #125) with
// StrykerJS. stryker.config.json runs it once per mutant.
//
// A standalone config rather than the full vite.config.mts: that config
// copies public assets every time it loads, which fails when Stryker's
// parallel workers load it at the same time. These unit tests only need
// module resolution and the test-mode clock.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    conditions: ['electron-renderer', 'module', 'browser', 'default'],
    tsconfigPaths: true,
  },
  test: {
    include: [
      'src/components/reports/widgetModified.test.ts',
      'src/components/reports/reports/*WidgetSettings.test.ts',
    ],
    environment: 'node',
    globals: true,
    setupFiles: ['./vitest.stryker.setup.ts'],
  },
});
