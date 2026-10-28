// Fork-only CI guard for CSCI-435-SE/actual-budget (see issue #101).
//
// Upstream (actualbudget/actual) runs its workflows on paid Depot runners
// (`runs-on: depot-ubuntu-latest`, ...). Our fork has no Depot account, so any
// job asking for a `depot-*` label sits in the queue until GitHub cancels it.
//
// This script finds every `depot-*` label in a job that can run on our fork.
// It checks the two places a job's runner label comes from: the job's
// `runs-on:` value and its `strategy:` block (matrix values used as
// `runs-on: ${{ matrix.runner }}`), in any YAML form or quoting. Steps,
// including `run:` scripts, are never checked or changed. Labels that come
// from repo variables (`vars.*`), inputs or other jobs' outputs can't be seen
// here.
//
// A job is treated as "upstream-only" (and skipped) when its job-level `if:`
// is `github.repository == 'actualbudget/actual'` (or
// `github.repository_owner == 'actualbudget'`) joined to the rest of the
// condition with `&&`, optionally inside parentheses.
//
// Our fork runs CI on Linux only, so `--fix` only swaps Linux labels. macOS
// and Windows labels are reported for a person to guard or remove.
//
// Usage:
//   node .github/scripts/fork-ci-runners.mjs          # report, exit 1 if any
//   node .github/scripts/fork-ci-runners.mjs --fix    # swap Linux labels
//   node .github/scripts/fork-ci-runners.mjs --dir <workflows-dir> [--fix]

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const UPSTREAM_GUARD =
  /^(?:github\.repository\s*==\s*'actualbudget\/actual'|github\.repository_owner\s*==\s*'actualbudget')$/;

// depot-<github linux label>[-<core count>] -> <github linux label>
const DEPOT_LINUX_LABEL =
  /\bdepot-(ubuntu-latest|ubuntu-\d\d\.\d\d(?:-arm)?)(?:-\d+)?\b/g;
const DEPOT_NON_LINUX_LABEL = /^depot-(?:macos|windows)/;
const ANY_DEPOT_LABEL = /\bdepot-[\w.-]+/g;
// Job ids and job-level keys, optionally quoted
const JOB_KEY = /^ {2}(['"]?)([\w-]+)\1:\s*(#.*)?$/;
const JOB_IF_KEY = /^ {4}(['"]?)if\1:/;
const JOB_RUNNER_KEY = /^ {4}(['"]?)(?:runs-on|strategy)\1:/;

const args = process.argv.slice(2);
const shouldFix = args.includes('--fix');
const dirIndex = args.indexOf('--dir');
const workflowsDir =
  dirIndex === -1
    ? fileURLToPath(new URL('../workflows', import.meta.url))
    : args[dirIndex + 1];

function indentOf(line) {
  return line.length - line.trimStart().length;
}

// Splits a line into [code, comment], where a YAML comment is a `#` that is
// outside quotes and at the start of the line or after whitespace
function splitComment(line) {
  let quote = null;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quote) {
      if (char === quote) {
        quote = null;
      }
    } else if (char === "'" || char === '"') {
      quote = char;
    } else if (char === '#' && (i === 0 || /\s/.test(line[i - 1]))) {
      return [line.slice(0, i), line.slice(i)];
    }
  }
  return [line, ''];
}

// Splits an expression on `&&` / `||` outside of parentheses and quotes
function splitTopLevel(expr) {
  const parts = [];
  let hasOr = false;
  let depth = 0;
  let inQuote = false;
  let current = '';
  for (let i = 0; i < expr.length; i++) {
    const char = expr[i];
    const pair = expr.slice(i, i + 2);
    if (char === "'") {
      inQuote = !inQuote;
    } else if (!inQuote && char === '(') {
      depth++;
    } else if (!inQuote && char === ')') {
      depth--;
    } else if (!inQuote && depth === 0 && (pair === '&&' || pair === '||')) {
      hasOr ||= pair === '||';
      parts.push(current.trim());
      current = '';
      i++;
      continue;
    }
    current += char;
  }
  parts.push(current.trim());
  return { parts, hasOr };
}

// Removes parentheses that wrap the whole expression: `((a && b))` -> `a && b`
function unwrapParens(expr) {
  let result = expr.trim();
  while (result.startsWith('(') && result.endsWith(')')) {
    let depth = 0;
    let inQuote = false;
    let closesAtEnd = true;
    for (let i = 0; i < result.length - 1; i++) {
      const char = result[i];
      if (char === "'") {
        inQuote = !inQuote;
      } else if (!inQuote && char === '(') {
        depth++;
      } else if (!inQuote && char === ')') {
        depth--;
      }
      if (depth === 0) {
        closesAtEnd = false;
        break;
      }
    }
    if (!closesAtEnd) {
      break;
    }
    result = result.slice(1, -1).trim();
  }
  return result;
}

// True if the expression can only be true when the guard is true
function requiresGuard(expr) {
  const { parts, hasOr } = splitTopLevel(unwrapParens(expr));
  if (hasOr) {
    return false;
  }
  return parts.some(
    part =>
      UPSTREAM_GUARD.test(part) || (parts.length > 1 && requiresGuard(part)),
  );
}

function isGuarded(ifText) {
  let expr = ifText
    .replace(/^\s*(['"]?)if\1:\s*([>|][-+]?)?/, '')
    .replace(/\s+/g, ' ')
    .trim();
  // Unwrap a YAML-quoted value: "..." or '...' (with '' as an escaped quote)
  if (/^".*"$/.test(expr)) {
    expr = expr.slice(1, -1);
  } else if (/^'.*'$/.test(expr)) {
    expr = expr.slice(1, -1).replaceAll("''", "'");
  }
  expr = expr.replace(/^\$\{\{(.*)\}\}$/, '$1').trim();
  return requiresGuard(expr);
}

// Lines of a job-level key: the key line plus lines indented deeper than it
function keyBlock(lines, keyLine, end) {
  const block = [keyLine];
  for (let i = keyLine + 1; i < end; i++) {
    if (lines[i].trim() !== '' && indentOf(lines[i]) <= 4) {
      break;
    }
    block.push(i);
  }
  return block;
}

// Splits a workflow into its jobs: [{ name, start, end, ifText, runnerLines }]
function findJobs(lines) {
  const jobsLine = lines.findIndex(line => /^jobs:\s*(#.*)?$/.test(line));
  if (jobsLine === -1) {
    return [];
  }

  const jobs = [];
  for (let i = jobsLine + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '' || line.trimStart().startsWith('#')) {
      continue;
    }
    if (indentOf(line) === 0) {
      break;
    }
    const jobKey = line.match(JOB_KEY);
    if (jobKey) {
      if (jobs.length > 0) {
        jobs[jobs.length - 1].end = i;
      }
      jobs.push({
        name: jobKey[2],
        start: i,
        end: lines.length,
        ifText: '',
        runnerLines: [],
      });
    }
  }

  for (const job of jobs) {
    for (let i = job.start + 1; i < job.end; i++) {
      if (JOB_IF_KEY.test(lines[i]) && job.ifText === '') {
        job.ifText = keyBlock(lines, i, job.end)
          .map(index => lines[index])
          .join('\n');
      } else if (JOB_RUNNER_KEY.test(lines[i])) {
        job.runnerLines.push(...keyBlock(lines, i, job.end));
      }
    }
  }

  return jobs;
}

function describe(label) {
  const replacement = label.replace(DEPOT_LINUX_LABEL, '$1');
  if (replacement !== label) {
    return { canFix: true, hint: `use ${replacement}` };
  }
  if (DEPOT_NON_LINUX_LABEL.test(label)) {
    return {
      canFix: false,
      hint: 'our fork runs Linux only: guard the job or remove this matrix entry',
    };
  }
  return { canFix: false, hint: 'no known GitHub equivalent' };
}

const problems = [];
let fixedCount = 0;

const files = readdirSync(workflowsDir)
  .filter(file => /\.ya?ml$/.test(file))
  .sort();

for (const file of files) {
  const path = join(workflowsDir, file);
  const lines = readFileSync(path, 'utf8').split('\n');
  let changed = false;

  for (const job of findJobs(lines)) {
    if (isGuarded(job.ifText)) {
      continue;
    }
    for (const i of job.runnerLines) {
      const [code, comment] = splitComment(lines[i]);
      for (const [label] of code.matchAll(ANY_DEPOT_LABEL)) {
        const { canFix, hint } = describe(label);
        if (shouldFix && canFix) {
          continue;
        }
        problems.push(
          `${file}:${i + 1} job "${job.name}" uses ${label} (${hint})`,
        );
      }
      if (shouldFix) {
        const fixed = code.replace(DEPOT_LINUX_LABEL, '$1');
        if (fixed !== code) {
          lines[i] = fixed + comment;
          changed = true;
          fixedCount++;
        }
      }
    }
  }

  if (changed) {
    writeFileSync(path, lines.join('\n'));
  }
}

if (shouldFix) {
  console.log(
    `Swapped ${fixedCount} Depot runner label(s) to GitHub-hosted Linux runners.`,
  );
}

if (problems.length > 0) {
  console.error(
    'These jobs request Depot runners, which our fork does not have, so they\n' +
      'will wait in the queue until GitHub cancels them:\n',
  );
  for (const problem of problems) {
    console.error(`  ${problem}`);
  }
  console.error(
    '\nFix: run `node .github/scripts/fork-ci-runners.mjs --fix` to swap Linux\n' +
      'labels to GitHub-hosted runners. For macOS/Windows jobs, or jobs that are\n' +
      'upstream-only (publishing, releases, ...), add\n' +
      "`if: github.repository == 'actualbudget/actual'` to the job instead.\n" +
      'See "CI in our fork" in STUDENTS.md.',
  );
  process.exit(1);
}

console.log('No unguarded Depot runner labels found.');
