// Vitest config for mutation testing the PDF export fixes (issue #97) with
// StrykerJS. stryker.issue-97.config.json runs it once per mutant.
//
// Based on Bennett Matuszewski's vitest.stryker.config.mts from #163: a
// standalone config rather than the full vite.config.mts, which copies
// public assets every time it loads and fails when Stryker's parallel
// workers load it at the same time. These unit tests only need module
// resolution.
//
// One addition: the shared row walk (budgetMonthRows.ts) imports
// MonthsContext.tsx, so JSX has to be compiled. The repo's tsconfig sets
// `jsx: preserve`, and without the React plugin nothing else compiles it.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: {
    conditions: ['electron-renderer', 'module', 'browser', 'default'],
    tsconfigPaths: true,
  },
  test: {
    include: [
      'src/components/budget/export/pdfText.test.ts',
      'src/components/budget/export/budgetMonthPdfRows.test.ts',
      'src/components/budget/export/budgetMonthPdf.test.ts',
      // Guards AC8: the PDF changes must not change the CSV export.
      'src/components/budget/export/budgetMonthCsv.test.ts',
    ],
    environment: 'node',
    globals: true,
    setupFiles: ['./vitest.stryker.issue-97.setup.ts'],
  },
});
