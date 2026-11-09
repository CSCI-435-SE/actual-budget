// Integration tests for .github/workflows/update-vrt.yml (issue #153).
// Run with: yarn vitest run --root .github/scripts
//
// Each test takes a step's real `run:` script out of the workflow and runs it
// with the shell GitHub would use, against a fake PR (a stub `gh`), a
// throwaway git repository and, for pushes, a local bare repository standing
// in for GitHub. Nothing here talks to the network.

import { execFileSync, spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const workflow = parse(
  readFileSync(new URL('../workflows/update-vrt.yml', import.meta.url), 'utf8'),
);
const REPO = 'CSCI-435-SE/actual-budget';
const BRANCH = 'feat/issue-1-example';
const SNAPSHOTS = 'packages/desktop-client/e2e/budget.test.ts-snapshots';

// How GitHub runs a `run:` script for each `shell` value. With no shell set,
// container jobs use sh and other jobs use bash without pipefail.
const SHELL_COMMANDS = {
  bash: ['bash', '--noprofile', '--norc', '-eo', 'pipefail'],
  sh: ['sh', '-e'],
  unset: ['bash', '-e'],
};

function getStep(jobId, stepId) {
  const job = workflow.jobs[jobId];
  const step = job.steps.find(s => s.id === stepId);
  const shell =
    step.shell ??
    job.defaults?.run?.shell ??
    workflow.defaults?.run?.shell ??
    (job.container ? 'sh' : 'unset');
  return { script: step.run, shell };
}

function runStep({ script, shell }, { cwd, env = {} }) {
  const temp = mkdtempSync(join(tmpdir(), 'update-vrt-step-'));
  const scriptFile = join(temp, 'step.sh');
  const outputFile = join(temp, 'output');
  const summaryFile = join(temp, 'summary');
  writeFileSync(scriptFile, script);
  writeFileSync(outputFile, '');
  writeFileSync(summaryFile, '');

  const [command, ...args] = SHELL_COMMANDS[shell];
  const result = spawnSync(command, [...args, scriptFile], {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      GITHUB_OUTPUT: outputFile,
      GITHUB_STEP_SUMMARY: summaryFile,
      GITHUB_REPOSITORY: REPO,
      GITHUB_SERVER_URL: 'https://github.com',
      GITHUB_RUN_ID: '1',
      RUNNER_TEMP: temp,
      SNAPSHOT_PATH: workflow.env.SNAPSHOT_PATH,
      ...env,
    },
  });

  const outputs = {};
  for (const line of readFileSync(outputFile, 'utf8').split('\n')) {
    const index = line.indexOf('=');
    if (index > 0) {
      outputs[line.slice(0, index)] = line.slice(index + 1);
    }
  }
  return {
    exitCode: result.status,
    log: result.stdout + result.stderr,
    outputs,
    summary: readFileSync(summaryFile, 'utf8'),
    runnerTemp: temp,
  };
}

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

// A repository with two committed screenshots and a test file
function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'update-vrt-repo-'));
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'user.name', 'Test');
  git(dir, 'config', 'user.email', 'test@example.com');
  mkdirSync(join(dir, SNAPSHOTS), { recursive: true });
  writeFileSync(join(dir, SNAPSHOTS, 'a-chromium-linux.png'), 'old a');
  writeFileSync(join(dir, SNAPSHOTS, 'b-chromium-linux.png'), 'old b');
  writeFileSync(join(dir, 'packages/desktop-client/e2e/budget.test.ts'), '');
  writeFileSync(join(dir, '.gitignore'), 'test-results/\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-qm', 'Initial commit');
  return dir;
}

function listFiles(dir) {
  return execFileSync('find', [dir, '-type', 'f', '-printf', '%P\n'], {
    encoding: 'utf8',
  })
    .trim()
    .split('\n')
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

describe('update-vrt.yml: Check the PR', () => {
  const step = getStep('get-pr', 'pr');
  const fakeBin = mkdtempSync(join(tmpdir(), 'update-vrt-bin-'));
  writeFileSync(
    join(fakeBin, 'gh'),
    '#!/bin/sh\nif [ "$FAKE_PR" = "missing" ]; then echo "HTTP 404" >&2; exit 1; fi\nprintf "%s" "$FAKE_PR"\n',
  );
  chmodSync(join(fakeBin, 'gh'), 0o755);

  function checkPr({ state = 'open', repo = REPO, testFiles = '' } = {}) {
    const pr =
      state === 'missing'
        ? 'missing'
        : JSON.stringify({
            state,
            head: {
              ref: BRANCH,
              sha: 'abc123',
              repo: repo === null ? null : { full_name: repo },
            },
          });
    return runStep(step, {
      cwd: tmpdir(),
      env: {
        PATH: `${fakeBin}:${process.env.PATH}`,
        FAKE_PR: pr,
        PR_NUMBER: '42',
        TEST_FILES: testFiles,
      },
    });
  }

  it('accepts an open PR from this repository and runs all VRT tests in 3 shards', () => {
    const result = checkPr();
    expect(result.exitCode).toBe(0);
    expect(result.outputs).toEqual({
      shards: '[1, 2, 3]',
      test_files: '',
      head_sha: 'abc123',
      head_ref: BRANCH,
    });
    expect(result.summary).toContain('#42');
  });

  it('runs only the given test files, in one shard, as e2e/<file> paths', () => {
    const result = checkPr({
      testFiles:
        'budget.test.ts  e2e/settings.mobile.test.ts packages/desktop-client/e2e/reports/net-worth.test.ts',
    });
    expect(result.exitCode).toBe(0);
    expect(result.outputs.shards).toBe('[1]');
    expect(result.outputs.test_files).toBe(
      'e2e/budget.test.ts e2e/settings.mobile.test.ts e2e/reports/net-worth.test.ts',
    );
  });

  it.each([
    [{ state: 'closed' }, 'PR #42 is closed'],
    [{ repo: 'someone/actual-budget' }, 'is in someone/actual-budget'],
    [{ repo: null }, 'is in a deleted repository'],
    [{ state: 'missing' }, "Couldn't find PR #42"],
  ])('refuses %o with a clear error', (pr, message) => {
    const result = checkPr(pr);
    expect(result.exitCode).not.toBe(0);
    expect(result.log).toContain(message);
    expect(result.outputs.head_ref).toBeUndefined();
  });

  it.each([
    'e2e/../../etc/passwd.test.ts',
    'budget.ts',
    '$(touch /tmp/pwned).test.ts',
    'e2e/budget.test.ts;rm',
    '--update-snapshots=all',
  ])('refuses the test file %s', testFile => {
    const result = checkPr({ testFiles: testFile });
    expect(result.exitCode).not.toBe(0);
    expect(result.log).toContain("isn't an e2e test file");
  });
});

describe('update-vrt.yml: Check that only screenshots changed', () => {
  const step = getStep('generate', 'changes');

  it('runs with bash, not the container default sh', () => {
    // Regression: under sh the step stopped at `set -o pipefail`
    expect(step.shell).toBe('bash');
  });

  it('reports no changes when the run changed nothing', () => {
    const result = runStep(step, { cwd: makeRepo() });
    expect(result.exitCode).toBe(0);
    expect(result.outputs.has_changes).toBe('false');
  });

  it('collects changed and new screenshots, ignoring gitignored files', () => {
    const repo = makeRepo();
    writeFileSync(join(repo, SNAPSHOTS, 'a-chromium-linux.png'), 'new a');
    const newSnapshots = 'packages/desktop-client/e2e/new.test.ts-snapshots';
    mkdirSync(join(repo, newSnapshots));
    writeFileSync(join(repo, newSnapshots, 'n-chromium-linux.png'), 'new n');
    mkdirSync(join(repo, 'test-results'));
    writeFileSync(join(repo, 'test-results', 'junit.xml'), '');

    const result = runStep(step, { cwd: repo });
    expect(result.exitCode).toBe(0);
    expect(result.outputs.has_changes).toBe('true');
    expect(listFiles(join(result.runnerTemp, 'vrt-shard'))).toEqual([
      `${SNAPSHOTS}/a-chromium-linux.png`,
      `${newSnapshots}/n-chromium-linux.png`,
    ]);
  });

  it.each([
    [
      'a changed source file',
      repo =>
        writeFileSync(
          join(repo, 'packages/desktop-client/e2e/budget.test.ts'),
          'changed',
        ),
    ],
    [
      'a non-PNG file in a snapshots folder',
      repo => writeFileSync(join(repo, SNAPSHOTS, 'notes.txt'), ''),
    ],
    [
      'a PNG outside a snapshots folder',
      repo =>
        writeFileSync(join(repo, 'packages/desktop-client/e2e/stray.png'), ''),
    ],
    [
      'a deleted screenshot',
      repo => rmSync(join(repo, SNAPSHOTS, 'b-chromium-linux.png')),
    ],
  ])('fails and collects nothing when the run left %s', (_, change) => {
    const repo = makeRepo();
    writeFileSync(join(repo, SNAPSHOTS, 'a-chromium-linux.png'), 'new a');
    change(repo);

    const result = runStep(step, { cwd: repo });
    expect(result.exitCode).not.toBe(0);
    expect(result.log).toContain("aren't PNG screenshots");
    expect(result.outputs.has_changes).toBeUndefined();
  });
});

describe('update-vrt.yml: Commit and push', () => {
  const step = getStep('commit', 'push');

  // A checkout of the PR branch, a bare "GitHub" repository the push goes to
  // (via git's url.insteadOf), and the downloaded shard artifacts
  function setUp(artifactFiles, { teammatePushesFirst = false } = {}) {
    const origin = mkdtempSync(join(tmpdir(), 'update-vrt-origin-'));
    git(origin, 'init', '-q', '--bare');
    const repo = makeRepo();
    git(repo, 'push', '-q', origin, `HEAD:refs/heads/${BRANCH}`);

    if (teammatePushesFirst) {
      // Someone pushes to the PR branch while the workflow is running
      const other = mkdtempSync(join(tmpdir(), 'update-vrt-other-'));
      git(other, 'clone', '-q', '-b', BRANCH, origin, '.');
      git(other, 'config', 'user.name', 'Teammate');
      git(other, 'config', 'user.email', 'teammate@example.com');
      git(other, 'commit', '-q', '--allow-empty', '-m', 'Teammate commit');
      git(other, 'push', '-q');
    }

    const gitConfig = join(mkdtempSync(join(tmpdir(), 'update-vrt-gc-')), 'c');
    writeFileSync(
      gitConfig,
      `[url "${origin}"]\n\tinsteadOf = https://x-access-token:fake-token@github.com/${REPO}.git\n`,
    );

    const result = runStep(
      {
        ...step,
        // Write the artifacts where the step looks for them
        script: `mkdir -p "$RUNNER_TEMP/vrt-shards" && cp -a "$ARTIFACTS/." "$RUNNER_TEMP/vrt-shards/"\n${step.script}`,
      },
      {
        cwd: repo,
        env: {
          ARTIFACTS: makeArtifacts(artifactFiles),
          GH_TOKEN: 'fake-token',
          HEAD_REF: BRANCH,
          PR_NUMBER: '42',
          RUN_URL: 'https://github.com/run/1',
          GIT_CONFIG_GLOBAL: gitConfig,
        },
      },
    );
    const branchLog = git(origin, 'log', '--format=%s', BRANCH).split('\n');
    const lastCommitFiles = git(
      origin,
      'show',
      '--name-only',
      '--format=',
      BRANCH,
    )
      .split('\n')
      .sort((a, b) => a.localeCompare(b));
    return { result, branchLog, lastCommitFiles, origin };
  }

  function makeArtifacts(files) {
    const dir = mkdtempSync(join(tmpdir(), 'update-vrt-artifacts-'));
    for (const [path, content] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      if (content === null) {
        symlinkSync('/etc/passwd', join(dir, path));
      } else {
        writeFileSync(join(dir, path), content);
      }
    }
    return dir;
  }

  it('pushes one commit that changes only the screenshots', () => {
    const newSnapshot =
      'packages/desktop-client/e2e/new.test.ts-snapshots/n-chromium-linux.png';
    const { result, branchLog, lastCommitFiles } = setUp({
      [`${SNAPSHOTS}/a-chromium-linux.png`]: 'new a',
      [newSnapshot]: 'new n',
    });

    expect(result.exitCode).toBe(0);
    expect(result.outputs.pushed).toBe('true');
    expect(branchLog).toEqual(['Update VRT screenshots', 'Initial commit']);
    expect(lastCommitFiles).toEqual([
      `${SNAPSHOTS}/a-chromium-linux.png`,
      newSnapshot,
    ]);
    expect(result.summary).toContain('Pushed 2 updated screenshots');
  });

  it("pushes nothing when the screenshots match the branch's", () => {
    const { result, branchLog } = setUp({
      [`${SNAPSHOTS}/a-chromium-linux.png`]: 'old a',
    });
    expect(result.exitCode).toBe(0);
    expect(result.outputs.pushed).toBe('false');
    expect(branchLog).toEqual(['Initial commit']);
  });

  it.each([
    ['a non-PNG file', { 'package.json': '{}' }],
    ['a workflow file', { '.github/workflows/evil.yml': '' }],
    ['a symlink named like a screenshot', { [`${SNAPSHOTS}/c.png`]: null }],
  ])('refuses artifacts containing %s and pushes nothing', (_, extraFiles) => {
    const { result, branchLog } = setUp({
      [`${SNAPSHOTS}/a-chromium-linux.png`]: 'new a',
      ...extraFiles,
    });
    expect(result.exitCode).not.toBe(0);
    expect(result.log).toContain("aren't PNG screenshots");
    expect(branchLog).toEqual(['Initial commit']);
  });
  it("doesn't overwrite a branch that moved during the run", () => {
    const { result, branchLog } = setUp(
      { [`${SNAPSHOTS}/a-chromium-linux.png`]: 'new a' },
      { teammatePushesFirst: true },
    );
    expect(result.exitCode).not.toBe(0);
    expect(result.log).toContain(`Couldn't push to ${BRANCH}`);
    expect(branchLog).toEqual(['Teammate commit', 'Initial commit']);
  });
});
