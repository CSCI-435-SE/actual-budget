import { peggyLoader } from '@actual-app/vite-plugin-peggy';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['./src/mocks/setup.ts'],
    exclude: [
      ...configDefaults.exclude,
      'src/platform/server/sqlite/index.test.ts',
      'src/platform/server/fs/index.test.ts',
      // Stryker mutation-testing sandboxes contain copies of every test file
      '.stryker-tmp/**',
    ],
    onConsoleLog(log: string, type: 'stdout' | 'stderr'): boolean | void {
      // print only console.error
      return type === 'stderr';
    },
    maxWorkers: 2,
    reporters: process.env.CI
      ? [
          'default',
          [
            'junit',
            {
              outputFile: './test-results/junit-node.xml',
              suiteName: 'loot-core (node)',
            },
          ],
        ]
      : ['default'],
  },
  ssr: {
    resolve: { conditions: ['electron', 'module', 'node', 'development'] },
  },
  resolve: {
    conditions: ['electron', 'module', 'browser', 'development'],
  },
  plugins: [peggyLoader()],
});
