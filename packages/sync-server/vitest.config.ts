export default {
  test: {
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      // Run separately with their own config (see the `test` script)
      'integration-tests/**',
    ],
    globalSetup: ['./vitest.globalSetup.js'],
    globals: true,
    coverage: {
      enabled: false,
    },
    maxWorkers: 2,
    // All test files share account.sqlite. Running files in parallel races on
    // the auth table's PRIMARY KEY (e.g. UNIQUE constraint failed: auth.method).
    fileParallelism: false,
    reporters: process.env.CI
      ? [
          'default',
          [
            'junit',
            {
              outputFile: './test-results/junit.xml',
              suiteName: 'sync-server',
            },
          ],
        ]
      : ['default'],
  },
};
