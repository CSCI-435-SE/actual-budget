import { defineConfig, mergeConfig } from 'vitest/config';

import baseConfig from './vitest.config';

// Stryker always runs Vitest in the `threads` pool. On Windows the full
// loot-core suite crashes there (native SQLite in worker threads), so only run
// the tests for the code Stryker mutates (see `mutate` in stryker.config.json).
export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: ['src/server/budget/**/*.test.ts'],
    },
  }),
);
