// Tests for vrt-failed-files.mjs (issue #153).
// Run with: yarn vitest run --root .github/scripts
//
// fixtures/vrt-junit.xml is a real report from Playwright 1.61.1's JUnit
// reporter (the version CI uses): `passing.test.ts` has a passing and a
// skipped test, and `reports/failing.mobile.test.ts` has a test that failed
// on both tries (retries: 1, as in playwright.config.ts).

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { failedVrtFiles } from './vrt-failed-files.mjs';

const fixture = readFileSync(
  new URL('./fixtures/vrt-junit.xml', import.meta.url),
  'utf8',
);
const script = fileURLToPath(
  new URL('./vrt-failed-files.mjs', import.meta.url),
);

function suite(name, { failures = 0, errors = 0 } = {}) {
  return `<testsuite name="${name}" tests="1" failures="${failures}" errors="${errors}"></testsuite>`;
}

describe('failedVrtFiles', () => {
  it('lists only the file with a failed test in a real Playwright report', () => {
    expect(failedVrtFiles([fixture])).toEqual([
      'e2e/reports/failing.mobile.test.ts',
    ]);
  });

  it('ignores the <testsuites> wrapper, which also counts failures', () => {
    const xml = `<testsuites failures="1">${suite('a.test.ts')}</testsuites>`;
    expect(failedVrtFiles([xml])).toEqual([]);
  });

  it('lists files with errors as well as failures', () => {
    const xml = suite('errored.test.ts', { errors: 1 });
    expect(failedVrtFiles([xml])).toEqual(['e2e/errored.test.ts']);
  });

  it('merges the reports from all shards, sorted and without duplicates', () => {
    const shard1 = suite('settings.test.ts', { failures: 1 });
    const shard2 =
      suite('budget.test.ts', { failures: 2 }) + suite('ok.test.ts');
    const shard3 = suite('settings.test.ts', { failures: 1 });
    expect(failedVrtFiles([shard1, shard2, shard3])).toEqual([
      'e2e/budget.test.ts',
      'e2e/settings.test.ts',
    ]);
  });

  it('returns an empty list when nothing failed', () => {
    expect(failedVrtFiles([suite('a.test.ts'), ''])).toEqual([]);
  });

  it('drops names that are not e2e test files', () => {
    const xml = [
      suite('../../etc/passwd.test.ts', { failures: 1 }),
      suite('a/../b.test.ts', { failures: 1 }),
      suite('evil`$(whoami)`.test.ts', { failures: 1 }),
      suite('with space.test.ts', { failures: 1 }),
      suite('/absolute.test.ts', { failures: 1 }),
      suite('notes.md', { failures: 1 }),
      suite('[link](https://example.com).test.ts', { failures: 1 }),
    ].join('');
    expect(failedVrtFiles([xml])).toEqual([]);
  });
});

describe('vrt-failed-files.mjs CLI', () => {
  it('reads every .xml file under the folder and prints one line', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vrt-junit-'));
    mkdirSync(join(dir, 'vrt-junit-1'));
    mkdirSync(join(dir, 'vrt-junit-2'));
    writeFileSync(join(dir, 'vrt-junit-1', 'junit.xml'), fixture);
    writeFileSync(
      join(dir, 'vrt-junit-2', 'junit.xml'),
      suite('budget.test.ts', { failures: 1 }),
    );
    writeFileSync(
      join(dir, 'vrt-junit-2', 'notes.txt'),
      suite('ignored.test.ts', { failures: 1 }),
    );

    const output = execFileSync('node', [script, dir], { encoding: 'utf8' });
    expect(output).toBe(
      'e2e/budget.test.ts e2e/reports/failing.mobile.test.ts\n',
    );
  });
});
