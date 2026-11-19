// Merges StrykerJS JSON reports from several workspace packages into one
// report, so a PR that changes code in more than one package can submit a
// single before/after report for D6.
//
// Usage (from the repo root):
//   node docs/sprint3/mutation/scripts/merge-stryker-reports.mjs <out.json> \
//     <packageDir>=<report.json> [<packageDir>=<report.json> ...]
//
// Each file path is prefixed with its package folder, and mutant and test
// ids are prefixed with the package's folder name so they stay unique. The
// merged report still follows the mutation-testing-report schema, so the
// Stryker HTML viewer can open it. The script also prints the mutation
// score per file and in total, using Stryker's formula:
//   detected (killed + timeout) / valid (detected + survived + no coverage)
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

const [outPath, ...inputs] = process.argv.slice(2);
if (!outPath || inputs.length === 0) {
  console.error(
    'Usage: merge-stryker-reports.mjs <out.json> <packageDir>=<report.json> ...',
  );
  process.exit(1);
}

const merged = {
  schemaVersion: '1.0',
  thresholds: undefined,
  projectRoot: process.cwd(),
  files: {},
  testFiles: {},
  config: {},
  framework: undefined,
};

for (const input of inputs) {
  const [packageDir, reportPath] = input.split('=');
  const report = JSON.parse(readFileSync(resolve(reportPath), 'utf8'));
  const prefix = basename(packageDir);
  const prefixId = id => `${prefix}-${id}`;

  merged.thresholds ??= report.thresholds;
  merged.framework ??= report.framework;
  merged.config[packageDir] = report.config;

  for (const [path, file] of Object.entries(report.files)) {
    merged.files[`${packageDir}/${path}`] = {
      ...file,
      mutants: file.mutants.map(mutant => ({
        ...mutant,
        id: prefixId(mutant.id),
        ...(mutant.killedBy && { killedBy: mutant.killedBy.map(prefixId) }),
        ...(mutant.coveredBy && { coveredBy: mutant.coveredBy.map(prefixId) }),
      })),
    };
  }

  for (const [path, testFile] of Object.entries(report.testFiles ?? {})) {
    merged.testFiles[path ? `${packageDir}/${path}` : packageDir] = {
      ...testFile,
      tests: testFile.tests.map(test => ({ ...test, id: prefixId(test.id) })),
    };
  }
}

writeFileSync(resolve(outPath), JSON.stringify(merged, null, 2) + '\n');

function score(mutants) {
  const count = status => mutants.filter(m => m.status === status).length;
  const killed = count('Killed');
  const timeout = count('Timeout');
  const survived = count('Survived');
  const noCoverage = count('NoCoverage');
  const detected = killed + timeout;
  const valid = detected + survived + noCoverage;
  return {
    mutants: mutants.length,
    killed,
    timeout,
    survived,
    noCoverage,
    score: valid ? ((detected / valid) * 100).toFixed(2) + '%' : 'n/a',
  };
}

const rows = Object.entries(merged.files).map(([path, file]) => ({
  file: path,
  ...score(file.mutants),
}));
rows.push({
  file: 'All files',
  ...score(Object.values(merged.files).flatMap(file => file.mutants)),
});
console.table(rows);
console.log(`Wrote ${outPath}`);
