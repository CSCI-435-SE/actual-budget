// Fork-only helper for CSCI-435-SE/actual-budget (issue #153).
//
// Reads the Playwright JUnit reports that the `vrt` job in e2e-test.yml
// uploads (`vrt-junit-*` artifacts) and prints the VRT test files that had a
// failing test, as one space-separated line of `e2e/<file>` paths. The VRT
// Comment bot puts that line in its comment so people can paste it into the
// "Update VRT screenshots" workflow's "test files" input.
//
// Playwright writes one `<testsuite>` per test file, with the file's path
// (relative to `e2e/`) as its `name` and `failures`/`errors` counts.
//
// The reports come from a PR's CI run, so they are untrusted: only names that
// look like e2e test files are printed, and anything else is dropped.
//
// Usage:
//   node .github/scripts/vrt-failed-files.mjs <reports-dir>

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TESTSUITE_TAG = /<testsuite\b([^>]*)>/g;
const ATTRIBUTE = /([\w:-]+)\s*=\s*"([^"]*)"/g;
// e.g. budget.test.ts, budget.mobile.test.ts, reports/net-worth.test.ts
const TEST_FILE = /^[\w.-]+(?:\/[\w.-]+)*\.test\.tsx?$/;

function parseAttributes(text) {
  const attributes = {};
  for (const [, key, value] of text.matchAll(ATTRIBUTE)) {
    attributes[key] = value;
  }
  return attributes;
}

function isSafeTestFile(name) {
  return TEST_FILE.test(name) && !name.split('/').includes('..');
}

// Returns the sorted, de-duplicated `e2e/<file>` paths of every test suite in
// the given JUnit XML documents that has at least one failure or error
export function failedVrtFiles(xmlDocuments) {
  const files = new Set();
  for (const xml of xmlDocuments) {
    for (const [, attributeText] of xml.matchAll(TESTSUITE_TAG)) {
      const { name, failures, errors } = parseAttributes(attributeText);
      const hasFailed = Number(failures) > 0 || Number(errors) > 0;
      if (hasFailed && name && isSafeTestFile(name)) {
        files.add(`e2e/${name}`);
      }
    }
  }
  return [...files].sort((a, b) => a.localeCompare(b));
}

function readXmlFiles(dir) {
  const documents = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      documents.push(...readXmlFiles(path));
    } else if (entry.isFile() && entry.name.endsWith('.xml')) {
      documents.push(readFileSync(path, 'utf8'));
    }
  }
  return documents;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2];
  if (!dir) {
    console.error('Usage: node vrt-failed-files.mjs <reports-dir>');
    process.exit(2);
  }
  console.log(failedVrtFiles(readXmlFiles(dir)).join(' '));
}
