import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
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
              outputFile: './test-results/junit.xml',
              suiteName: 'sync-integration-tests',
            },
          ],
        ]
      : ['default'],
  },
});
