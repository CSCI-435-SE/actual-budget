# Mutation testing: Issue #159 -- Add ability to duplicate rules

**PR(s):** [#181](https://github.com/CSCI-435-SE/actual-budget/pull/181)  **Tool:** StrykerJS 10.0.0 (command runner)  **Config:** [`packages/desktop-client/stryker.issue-159.config.json`](../../../packages/desktop-client/stryker.issue-159.config.json) and [`vitest.stryker.issue-159.config.mts`](../../../packages/desktop-client/vitest.stryker.issue-159.config.mts), based on Bennett Matuszewski's setup from #163  **Command:** `cd packages/desktop-client && npx stryker run stryker.issue-159.config.json`
**Reports:** [before](reports/159-RaccoonSwarm-before.json)
**Mutation score:** before 100.00% → after N/A

|        | Mutants | Killed | Timed out | Survived | Score   |
| ------ | ------- | ------ | --------- | -------- | ------- |
| Before | 17      | 17     | 0         | 0        | 100.00% |
| After  | N/A     | N/A    | N/A       | N/A      | N/A     |

Mutated: `src/util/rule.ts` lines 163-181 (`duplicateRule`, the function PR #181 added). Not mutated: the rest of `rule.ts` (code the PR did not change) and `ManageRules.tsx` (only the Playwright e2e tests cover it, and Stryker cannot run them).

## Surviving mutants
N/A. 
| Location (file:line) | Mutation | Equivalent or test gap? | Why |
|---|---|---|---|
| — | — | — | |

## New or strengthened test
N/A. There were no surviving mutants because this issue is relatively small and the tests covered all of the necessary cases.

Commit: [link] · Test: [file › test name] · Kills: [mutant location]

## Questions

1. What did the surviving mutants reveal about your tests?
    There were no surviving mutants. This issue is relatively small and the tests covered all of the necessary cases, so all the mutants were killed.
2. Did any surviving mutant point to an assertion whose expected value was not based on the requirements? Explain.
    No. There were no surviving mutants in these tests.
3. If you used AI to configure the tool, analyze survivors, or write tests, what did it produce and what did you verify or correct? If AI was not used, write "N/A."
    I used AI to help configure the tool and it helped review my teammate's setups as examples. It produced the configuration file and I verified it by reading it then making sure everything ran smoothly and as intended once I ran Stryker. 
