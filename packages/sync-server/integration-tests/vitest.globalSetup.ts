import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';

import type { TestProject } from 'vitest/node';

import { assertApiBundleBuilt } from './src/apiBundle';

export async function setup(project: TestProject) {
  // `yarn test` rebuilds or restores the API bundle first; running these
  // tests directly doesn't. Check once here so a stale bundle stops the run
  // up front (createDevice checks again for each device).
  await assertApiBundleBuilt();

  const dirs = [project.tmpDir, Reflect.get(project.vitest, '_tmpDir')];
  return async function teardown() {
    await removeVitestTmpDirs(dirs);
  };
}

/**
 * Vitest (5.0) copies transformed modules into folders directly under the
 * OS temp directory for its worker processes. It never removes its core
 * folder and only tries once to remove the project's, so on Windows every
 * run leaves at least one folder behind (this happens in every package in
 * the repo, not just this one). Remove this run's folders ourselves, so
 * the integration tests leave no temporary files.
 *
 * `_tmpDir` is internal to Vitest: only paths that are direct children of
 * the temp directory are removed, so if Vitest changes how it stores them
 * this does nothing rather than deleting the wrong thing.
 */
async function removeVitestTmpDirs(dirs: unknown[]) {
  const tempRoot = resolve(tmpdir());
  for (const dir of dirs) {
    if (typeof dir === 'string' && dirname(resolve(dir)) === tempRoot) {
      await rm(dir, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 100,
      });
    }
  }
}
