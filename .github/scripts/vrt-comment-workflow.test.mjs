// Integration tests for the "Write the comment" step of
// .github/workflows/e2e-vrt-comment.yml (issue #153).
// Run with: yarn vitest run --root .github/scripts
//
// Runs the step's real script the way GitHub does (bash -e, from the repo
// root) and checks the comment it writes. The step reads the JUnit reports
// from /tmp/vrt-junit and writes /tmp/vrt-comment.md, so these tests use
// those paths and clean them up.

import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { readWorkflow } from './read-workflow.mjs';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const workflow = readWorkflow(
  new URL('../workflows/e2e-vrt-comment.yml', import.meta.url),
);
const script = workflow.jobs.comment.steps.find(
  step => step.name === 'Write the comment',
).run;
const fixture = fileURLToPath(
  new URL('./fixtures/vrt-junit.xml', import.meta.url),
);
const REPORTS_DIR = '/tmp/vrt-junit';
const COMMENT_FILE = '/tmp/vrt-comment.md';
const WORKFLOW_URL =
  'https://github.com/CSCI-435-SE/actual-budget/actions/workflows/update-vrt.yml';

function writeComment() {
  const scriptFile = join(mkdtempSync(join(tmpdir(), 'vrt-comment-')), 's.sh');
  writeFileSync(scriptFile, script);
  const result = spawnSync('bash', ['-e', scriptFile], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      ARTIFACT_URL: 'https://github.com/example/artifacts/1',
      DEFAULT_BRANCH: 'master',
      PR_NUMBER: '160',
      WORKFLOW_URL,
    },
  });
  expect(result.status, result.stderr).toBe(0);
  return readFileSync(COMMENT_FILE, 'utf8');
}

afterEach(() => {
  rmSync(REPORTS_DIR, { recursive: true, force: true });
  rmSync(COMMENT_FILE, { force: true });
});

describe('e2e-vrt-comment.yml: Write the comment', () => {
  it('points to the Update VRT screenshots workflow instead of /update-vrt', () => {
    const comment = writeComment();
    expect(comment).toContain(
      `[Actions → Update VRT screenshots](${WORKFLOW_URL})`,
    );
    // Upstream's wording; the link above contains ".../update-vrt.yml"
    expect(comment).not.toContain('comment `/update-vrt`');
  });

  it('keeps the sticky-comment marker and the report link', () => {
    const comment = writeComment();
    expect(comment.startsWith('<!-- vrt-comment -->\n')).toBe(true);
    expect(comment).toContain(
      '[View the test report](https://github.com/example/artifacts/1)',
    );
  });

  it('fills in the PR number and the default branch', () => {
    const comment = writeComment();
    expect(comment).toContain(
      'Leave **Use workflow from** on `master` and enter `160` as the **PR number**',
    );
  });

  it('lists the failed test files, ready to paste, when reports exist', () => {
    mkdirSync(join(REPORTS_DIR, 'vrt-junit-2'), { recursive: true });
    copyFileSync(fixture, join(REPORTS_DIR, 'vrt-junit-2', 'junit.xml'));

    const comment = writeComment();
    expect(comment).toContain(
      '3. For **Test files**, paste the files that failed, so only they are run:\n' +
        '   ```\n' +
        '   e2e/reports/failing.mobile.test.ts\n' +
        '   ```\n',
    );
  });

  it('says to leave Test files blank when there are no reports', () => {
    const comment = writeComment();
    expect(comment).toContain(
      '3. Leave **Test files** blank to update every screenshot.',
    );
    expect(comment).not.toContain('paste the files that failed');
  });

  it('tells people to approve held checks and to pull the bot commit', () => {
    const comment = writeComment();
    expect(comment).toContain('click **Approve and run workflows**');
    expect(comment).toContain('Run `git pull` before you push again');
  });
});
