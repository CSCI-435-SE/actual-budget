import { readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';

import type { TestProject } from 'vitest/node';

export async function setup(project: TestProject) {
  await assertApiBundleBuilt();

  const dirs = [project.tmpDir, Reflect.get(project.vitest, '_tmpDir')];
  return async function teardown() {
    await removeVitestTmpDirs(dirs);
  };
}

/**
 * Devices run on the bundled `@actual-app/api` build, which inlines
 * loot-core. `yarn typecheck` overwrites that bundle with a plain compile
 * of `packages/api/index.ts` that imports loot-core's TypeScript source,
 * which a device can't load. `yarn test` rebuilds or restores the bundle
 * first; running this package's tests directly doesn't, so check here and
 * fail with the fix instead of a "Cannot find module" error in every test.
 */
async function assertApiBundleBuilt() {
  const entry = createRequire(import.meta.url).resolve('@actual-app/api');
  const code = await readFile(entry, 'utf8').catch(() => null);
  if (code === null || code.includes('@actual-app/core/')) {
    throw new Error(
      `${entry} is ${code === null ? 'missing' : 'not the bundled build'}. ` +
        'Run `yarn build:api` from the repo root, then run the tests again. ' +
        '(`yarn typecheck` overwrites the bundle; `yarn test` rebuilds it automatically.)',
    );
  }
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
