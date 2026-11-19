# Mutation testing: Issue #149 -- Transactions and Last Used columns on the Payees page

**PR(s):** (https://github.com/CSCI-435-SE/actual-budget/pull/189)  **Tool:** StrykerJS 10.0.0 (command runner; see [Setup notes](#setup-notes))  **Config:** [`packages/loot-core/stryker.issue-149.config.json`](../../../packages/loot-core/stryker.issue-149.config.json) (server), [`packages/desktop-client/stryker.issue-149.config.json`](../../../packages/desktop-client/stryker.issue-149.config.json) and [`vitest.stryker.issue-149.config.mts`](../../../packages/desktop-client/vitest.stryker.issue-149.config.mts) (client), based on Bennett Matuszewski's setup from #163 and the #97 setup  **Command:** `cd packages/loot-core && npx stryker run stryker.issue-149.config.json`, then `cd packages/desktop-client && npx stryker run stryker.issue-149.config.json`, then `node docs/sprint3/mutation/scripts/merge-stryker-reports.mjs <out.json> packages/loot-core=<core report> packages/desktop-client=<client report>` from the repo root
**Reports:** [before](reports/149-icsasso-before.json) · [after](reports/149-icsasso-after.json)
**Mutation score:** before 96.00% → after 100.00%

|        | Mutants | Killed | Timed out | Survived | Score   |
| ------ | ------- | ------ | --------- | -------- | ------- |
| Before | 25      | 24     | 0         | 1        | 96.00%  |
| After  | 25      | 25     | 0         | 0        | 100.00% |

| File                                     | Before          | After            |
| ---------------------------------------- | --------------- | ---------------- |
| `loot-core/.../db/index.ts` (815–828)    | 100.00% (2/2)   | 100.00% (2/2)    |
| `loot-core/.../payees/app.ts` (41, 95–114) | 100.00% (4/4) | 100.00% (4/4)    |
| `desktop-client/.../payeeUsageDisplay.ts` | 94.74% (18/19) | 100.00% (19/19)  |

**What was mutated.** The source code the PR adds that has unit tests:

- `packages/loot-core/src/server/db/index.ts`, lines 815–828: `getPayeeUsageStats()`, the SQL query that counts each payee's transactions and finds the latest date.
- `packages/loot-core/src/server/payees/app.ts`, line 41 (registering the `payees-get-usage-stats` handler) and lines 95–114 (the handler, which turns the query rows into `{ count, lastUsed }` per payee).
- `packages/desktop-client/src/components/payees/payeeUsageDisplay.ts`, the whole file: `getPayeeUsageDisplay()`, which decides what the Transactions and Last Used cells show (loading placeholder, `0` / `Never`, or the count and formatted date).

The rest of `db/index.ts` (1,259 lines) and `app.ts` is unrelated to #149, so the configs mutate only these line ranges. The PR's React component changes (`PayeeTableRow.tsx`, `PayeeTable.tsx`, `ManagePayees.tsx`, `ManagePayeesWithData.tsx`) are left out: no unit test renders them, so every mutant there would survive as untested code. #97 left out its one-line component change for the same reason. I checked those changes by hand in the running app instead (see Q1).

The tests run are `packages/loot-core/src/server/payees/app.test.ts` (12 usage-stats tests plus the existing rule-count test) and `packages/desktop-client/src/components/payees/payeeUsageDisplay.test.ts` (5 tests).

## Setup notes

- **Command runner, as in #163 and #97.** The Vitest runner (`@stryker-mutator/vitest-runner` 10.0.0) runs no tests for any mutant with the repo's Vitest 5, so every mutant "survives" ([125-bennettmatuszewski.md](125-bennettmatuszewski.md) documents this). I used the same workaround: Stryker's command runner starts Vitest once per mutant (`--bail 1 --maxWorkers 1`). Every mutant in both reports has `testsCompleted: 1`, so none of the results comes from the broken runner.
- **Two packages, one report.** The PR's server code is in loot-core and its display helper is in desktop-client, which have separate Vitest setups, so there is one Stryker config per package. [`scripts/merge-stryker-reports.mjs`](scripts/merge-stryker-reports.mjs) merges the two JSON reports into one: it prefixes each file path with its package folder, makes mutant and test ids unique, and prints the score per file and in total with Stryker's formula. On the client report alone it gives the same 94.74% Stryker printed.
- **Line ranges.** The server config uses Stryker's `file:start-end` syntax. Without it, Stryker would mutate all of `db/index.ts`, and each server mutant takes about 75 seconds (mostly loot-core's test setup).
- **Server tests use loot-core's own config.** `ENV=node npx vitest --run src/server/payees/app.test.ts` uses loot-core's normal `vitest.config.ts`, which already excludes `.stryker-tmp`. The client uses a standalone `vitest.stryker.issue-149.config.mts` like #97's, because the full `vite.config.mts` fails when Stryker's workers load it at the same time.
- **Checked before running.** Both test commands passed on unchanged code before each Stryker run (13 server tests, 5 client tests).
- **No timeouts.** Both packages ran at `concurrency: 2`, one package after the other, so the machine was never running more than two test processes. No mutant timed out in either run.
- **Same mutants before and after.** The source files did not change between the runs; only the test did. I compared the two reports mutant by mutant: both have the same 25 mutants (same file, position, mutator and replacement), and the only status change is `payeeUsageDisplay.ts:6`, Survived → Killed.
- **Commits.** [`fd98273fe`](https://github.com/CSCI-435-SE/actual-budget/commit/fd98273fe) is the code and tests the before run saw. [`88dff722a`](https://github.com/CSCI-435-SE/actual-budget/commit/88dff722a) adds the configs, the merge script and the before report. [`aff6ef516`](https://github.com/CSCI-435-SE/actual-budget/commit/aff6ef516) is the strengthened test, and [`cb42279ac`](https://github.com/CSCI-435-SE/actual-budget/commit/cb42279ac) adds the after report.

## Surviving mutants

The before run had one survivor, in a line this PR added. "Gap" = a test was missing or too weak; "Equivalent" = no test can tell the mutant from the original.

| Location (file:line) | Mutation | Equivalent or test gap? | Why |
| --- | --- | --- | --- |
| payeeUsageDisplay.ts:6 | `USAGE_LOADING_PLACEHOLDER = '…'` → `""` | Gap | The loading test compared the result to the exported `USAGE_LOADING_PLACEHOLDER` constant instead of a literal. When the mutant empties the constant, the expected value is emptied too, so the test can't fail. The behavior does change: while the counts load, the Transactions and Last Used cells would be blank instead of showing `…`. AC11 asks for a placeholder until the data is ready, so the mutant is not equivalent. Killed by `payeeUsageDisplay.test.ts › getPayeeUsageDisplay › shows a placeholder in both cells while loading`, which now expects `'…'`. |

**Totals:** 1 survivor = 1 gap, killed. The after report has no survivors.

For context, the 24 mutants killed in the before run:

- **Server (6):** emptying `getPayeeUsageStats()` (db/index.ts:815), replacing the SQL with an empty string (820), renaming the handler to `""` (app.ts:41), and emptying the handler (104), its loop (107) or each `{ count, lastUsed }` entry (108). Every usage-stats test kills these.
- **Client (18):** flipping `if (isLoading)` and `if (!stats)`, emptying `'0'` and the returned objects, flipping each `isLoading` / `isUnused` flag, and so on. The tests compare the whole returned object with `toEqual`, so any changed field fails them.

## New or strengthened test

Commit: [`aff6ef516`](https://github.com/CSCI-435-SE/actual-budget/commit/aff6ef516) · Test: `packages/desktop-client/src/components/payees/payeeUsageDisplay.test.ts › getPayeeUsageDisplay › shows a placeholder in both cells while loading` (strengthened: expects the literal `'…'` instead of the exported constant, with a comment saying why) · Kills: `payeeUsageDisplay.ts:6` (`'…'` → `""`), shown as Killed in the after report.

The source code was not changed for this; only the test's expected value.

## Questions

**1. What did the surviving mutants reveal about your tests?**

The one survivor showed a test that couldn't fail: the loading test took its expected value from the code under test (the exported placeholder constant), so whatever the constant held, the test agreed with it. The fix was to write down the value the requirement asks for.

The 100% server score shows more about the tool than about the tests. The logic that matters for #149 is in the SQL: counting a split once per payee (`COUNT(DISTINCT COALESCE(parent_id, id))`), taking the latest date, and leaving out deleted and merged-away transactions through the `v_transactions_internal_alive` view. To Stryker the whole query is one string, so its only mutation there was emptying it, which any test kills. To check that the tests guard the SQL itself, I changed `COUNT(DISTINCT …)` to `COUNT(*)` and exactly the two split tests failed, then I restored the line. That manual check isn't part of the D6 score (since it wasn't with a tool), but it is why I trust the server tests more than the 6 server mutants alone would justify.

The mutation score also says nothing about the React wiring: refetching after a merge, an undo or a sync, and the columns lining up. No unit test renders those components, so I checked them in the running app with the demo budget: merging two payees updated the target's count and last-used date without a reload, and Ctrl+Z restored both payees' numbers.


**2. Did any survivor expose an assertion whose expected value wasn't based on the requirements?**

Yes. The loading test's expected value was `USAGE_LOADING_PLACEHOLDER`, the implementation's own constant, not something from the requirements. AC11 asks for a placeholder until the data is ready, and the `…` was chosen during implementation to match the Tags page's count column. The fixed test expects `'…'`.

The other expected values come from the acceptance criteria or from the open-question decisions made before implementation: a split counts once for each payee on it, and Last Used shows a future date if that is the latest transaction. For example, the split tests expect `count: 1` because of the agreed split rule, not because that is what the query happened to return.

**3. AI use, and what was verified or corrected.**
Claude Code drafted the implementation plan and suggested answers to the open questions; the decisions (split counting, future dates, no clickable count, refetching both lists together, keeping the counting in SQL) were made by me. Claude also wrote the Stryker configs (based on the #97 / #163 setup), the merge script, and ran both passes.
- What was checked rather than taken on trust: both test commands passed before each Stryker run; every mutant has `testsCompleted: 1` (not the broken-runner "survivors"); the merge script reproduces Stryker's own 94.74%; the before and after reports have the same 25 mutants, with only the one status change; the manual `COUNT(*)` check; the browser check of alignment, merge and undo.
../../../ai-logs/sprint3/icsasso/2026-11-18_claude-code_manage-payees-page.md

