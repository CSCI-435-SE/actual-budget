// Test helper for the .github/scripts tests (issue #153): reads the parts of
// one of our workflow files that the tests run, without a YAML library.
//
// It understands only the layout our workflows use (2-space indents): top-level
// `env:` and `defaults:`, and under `jobs:` each job's `container:`,
// `defaults: run: shell:` and `steps:` (`- id/name/shell/run`). `run: |`
// blocks are returned like YAML's literal blocks: indentation removed, one
// trailing newline. Anything it doesn't understand is skipped, so a step it
// can't read comes back without a `run` and the tests that use it fail.
//
// Returns { env, defaults, jobs: { <id>: { container, defaults, steps } } }.

import { readFileSync } from 'node:fs';

const KEY_VALUE = /^(\s*)(- )?([\w-]+):(?:\s+(.*))?$/;

function indentOf(line) {
  return line.length - line.trimStart().length;
}

// Plain, 'single-quoted' or "double-quoted" scalar (no escapes in ours
// except '' in single quotes)
function scalar(text) {
  const value = text.replace(/\s+#.*$/, '').trim();
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replaceAll("''", "'");
  }
  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }
  return value;
}

// Reads the `|` block that starts after line `start`, for a key at `keyIndent`
function readBlock(lines, start, keyIndent) {
  const block = [];
  let i = start + 1;
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() !== '' && indentOf(line) <= keyIndent) {
      break;
    }
    block.push(line);
  }
  while (block.length > 0 && block.at(-1).trim() === '') {
    block.pop();
  }
  const blockIndent = Math.min(
    ...block.filter(line => line.trim() !== '').map(indentOf),
  );
  const text = block.map(line => line.slice(blockIndent)).join('\n');
  return { text: `${text}\n`, next: i };
}

export function readWorkflow(url) {
  const lines = readFileSync(url, 'utf8').split('\n');
  const workflow = { env: {}, defaults: {}, jobs: {} };
  let section = null; // top-level key we're in
  let job = null;
  let jobKey = null; // job-level key we're in (defaults, steps, ...)
  let step = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '' || line.trimStart().startsWith('#')) {
      continue;
    }
    const match = line.match(KEY_VALUE);
    if (!match) {
      continue;
    }
    const [, spaces, dash, key, value = ''] = match;
    const indent = spaces.length;

    if (indent === 0) {
      section = key;
      continue;
    }

    if (section === 'env' && indent === 2) {
      workflow.env[key] = scalar(value);
    } else if (section === 'defaults' && key === 'shell') {
      workflow.defaults.run = { shell: scalar(value) };
    } else if (section === 'jobs' && indent === 2) {
      job = { container: undefined, defaults: {}, steps: [] };
      workflow.jobs[key] = job;
      jobKey = null;
    } else if (section === 'jobs' && job && indent === 4) {
      jobKey = key;
      if (key === 'container') {
        job.container = value === '' ? {} : scalar(value);
      }
    } else if (jobKey === 'defaults' && key === 'shell') {
      job.defaults.run = { shell: scalar(value) };
    } else if (jobKey === 'steps' && indent === 6 && dash) {
      step = {};
      job.steps.push(step);
      setStepKey(step, key, value, lines, i, indent + 2);
    } else if (jobKey === 'steps' && step && indent === 8 && !dash) {
      const next = setStepKey(step, key, value, lines, i, indent);
      if (next !== undefined) {
        i = next - 1;
      }
    }
  }
  return workflow;
}

// Sets one of a step's keys; returns the next line to read after a `|` block
function setStepKey(step, key, value, lines, index, keyIndent) {
  if (!['id', 'name', 'shell', 'run'].includes(key)) {
    return undefined;
  }
  if (key === 'run' && value.trim() === '|') {
    const { text, next } = readBlock(lines, index, keyIndent);
    step.run = text;
    return next;
  }
  step[key] = scalar(value);
  return undefined;
}
