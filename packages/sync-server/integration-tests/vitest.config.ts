import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

// Run by sync-server's `test` script after its unit tests, with
// `--config integration-tests/vitest.config.ts`. sync-server's own
// vitest.config.ts excludes this folder.
export default defineConfig({
  test: {
    root: fileURLToPath(new URL('.', import.meta.url)),
    include: ['src/**/*.test.ts'],
    environment: 'node',
    // Removes the temp folders Vitest itself leaves behind on Windows
    globalSetup: ['./vitest.globalSetup.ts'],
    // sync-server reads its config once at import, so each test file needs
    // its own module graph (and therefore its own server). Keep isolation on.
    isolate: true,
    // A cold import of the full sync-server app (every bank integration
    // included) plus migrations takes several seconds, and devices each load
    // all of loot-core. Setup often runs in `beforeAll`, so hooks get the
    // same budget as tests.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // Each file runs a server plus device worker threads. With every file
    // running at once (the default), setup took over 10s under `yarn test`;
    // two at a time keeps it well inside the timeouts
    maxWorkers: 2,
    reporters: process.env.CI
      ? [
          'default',
          [
            'junit',
            {
              // Next to sync-server's unit test results, where CI collects them
              outputFile: '../test-results/junit-integration.xml',
              suiteName: 'sync-server-integration',
            },
          ],
        ]
      : ['default'],
  },
});
