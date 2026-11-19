// Vitest config for mutation testing src/server/attachments/app.ts (issue
// #154, PR #175) with StrykerJS. stryker.issue-154.config.json runs it once
// per mutant.
//
// It reuses loot-core's vitest.config.ts (setup file, resolve conditions,
// peggy plugin) and only narrows `include` to the test files that import
// app.ts, so each mutant runs just those tests. archive.test.ts and
// cleanup.test.ts are included because they call app.ts's handlers too;
// leaving them out could report mutants they kill as survivors.
import { mergeConfig } from 'vitest/config';

import baseConfig from './vitest.config';

export default mergeConfig(baseConfig, {
  test: {
    include: [
      'src/server/attachments/app.test.ts',
      'src/server/attachments/archive.test.ts',
      'src/server/attachments/cleanup.test.ts',
    ],
  },
});
