# Mutation testing: Issue #154 -- Attach receipts to transactions (stored on this device)

**PR(s):** #175  **Tool:** StrykerJS 10.0.0 (command runner; see [Setup notes](#setup-notes))  **Config:** [`packages/loot-core/stryker.issue-154.config.json`](../../../packages/loot-core/stryker.issue-154.config.json) and [`vitest.stryker.issue-154.config.mts`](../../../packages/loot-core/vitest.stryker.issue-154.config.mts), based on Bennett Matuszewski's setup from #163  **Command:** `cd packages/loot-core && npx stryker run stryker.issue-154.config.json`
**Reports:** [before](reports/154-jamesleonard3rd-before.json) · [after](reports/154-jamesleonard3rd-after.json)
**Mutation score:** before 83.48% → after 92.41%

|        | Mutants | Killed | Timed out | Survived | Score  |
| ------ | ------- | ------ | --------- | -------- | ------ |
| Before | 224     | 187    | 0         | 37       | 83.48% |
| After  | 224     | 207    | 0         | 17       | 92.41% |

**What was mutated.** `packages/loot-core/src/server/attachments/app.ts`, the attachment handlers (`attachment-add`, `-remove`, `-restore`, `-list`, `-read`). It is the source file in PR #175 with the most tests: `app.test.ts` has 38 of them, twice as many as any other test file in the PR. The tests run against each mutant are every test file that imports `app.ts`: `app.test.ts`, `archive.test.ts` (export and import) and `cleanup.test.ts`.

`app.ts` has changed since PR #175: issue #155 (soft remove and restore, merges, cleanup) added about 130 lines to it. Stryker mutated the whole file as it is on `master`, so the score covers both. The table marks each survivor's line as from #175 or #155 (from `git blame`), and the analysis starts with the #175 lines.

## Setup notes

- **Command runner, as in #163.** The Vitest runner (`@stryker-mutator/vitest-runner` 10.0.0) runs no tests for any mutant with Vitest 5, so every mutant "survives". Bennett documented this in [125-bennettmatuszewski.md](125-bennettmatuszewski.md). I used his workaround: Stryker's command runner starts Vitest once per mutant (`--bail 1 --maxWorkers 1`).
- **Vitest config.** `vitest.stryker.issue-154.config.mts` reuses loot-core's own `vitest.config.ts` (setup file, resolve conditions) and only narrows `include` to the three test files above. I included `archive.test.ts` and `cleanup.test.ts` as well as `app.test.ts` because they call `app.ts`'s handlers too; leaving them out could have reported mutants they kill as survivors.
- **Same config for both runs.** The before run used the tests on `master`; the after run is the same command after adding the tests below. `app.ts` itself did not change between the runs. Neither run had timeouts (`concurrency: 3`).

## Surviving mutants

"Gap" = a test was missing; "Equivalent" = no test can tell the mutant from the original. "Gap (not fixed)" = a real difference that I chose not to test, with the reason. Line numbers are in `packages/loot-core/src/server/attachments/app.ts`. "Killed by" names a test in `app.test.ts` added after the before run.

**Lines from PR #175 (30 survivors)**

| Location (file:line) | Mutation | Equivalent or test gap? | Why |
| --- | --- | --- | --- |
| app.ts:173 | `if (budgetId == null)` → `false`, and its body → `{}` (×2) | Gap | `attachment-remove` had no test with no budget open. `attachment-add` and `attachment-restore` both had one. With the mutant, removing with no budget open still marks the row as removed and returns `{}`. Killed by `attachment-remove › needs an open budget, and leaves the attachment in place`. |
| app.ts:174 | `{ error: { reason: 'no-budget' } }` → `{}`, `{ error: {} }`, `reason: ''` (×3) | Gap | Same gap: nothing checked the error that branch returns. Same killing test. |
| app.ts:259 | `if (budgetId == null)` → `false`, and its body → `{}` (×2) | Gap | Same gap in `attachment-read`. The plan for #154 lists `no-budget` as one of its errors, but no test asked for it. With the mutant the read goes on with a `null` budget id and returns `read-failed` instead. Killed by `attachment-read › needs an open budget`. |
| app.ts:260 | `{ error: { reason: 'no-budget' } }` → `{}`, `{ error: {} }`, `reason: ''` (×3) | Gap | Same gap. Same killing test. |
| app.ts:286 | `catch` body → `{}` | Gap | No test made reading the file throw. `read-failed` was only tested for a file of the wrong type (line 283), not for a read error. With the mutant `attachment-read` returns `undefined`. Killed by `attachment-read › reports a file that cannot be read as read-failed`, which makes `readAttachmentFile` reject. |
| app.ts:288 | `{ error: { reason: 'read-failed' } }` → `{}`, `{ error: {} }`, `reason: ''` (×3) | Gap | Same gap. Same killing test. |
| app.ts:355 | `parent == null` → `false` | Gap | The tests had a split child whose parent is deleted (`orphan-child`), but none whose `parent_id` points to no row. With the mutant, `parent.tombstone` throws on `null`, so `attachment-add` rejects instead of returning `transaction-not-found`. Killed by `attachment-add › rejects a transaction that is lost-child and stores nothing` (a new `lost-child` fixture row). |
| app.ts:384 | `reportError` body → `{}` | Gap | `reportError` (log the error, send it to error reporting) had no test at all: the write and save failure tests only checked the returned error. Killed by the read-failed test above, which checks that the error is logged and passed to `captureException`. |
| app.ts:385 | `logger.error(message, error)` removed | Gap | Same gap. Same killing test. |
| app.ts:386 | `error instanceof Error` → `false`, and its body → `{}` | Gap | Same gap: `captureException` was never checked. Same killing test. |
| app.ts:387 | `captureException(error)` removed | Gap | Same gap. Same killing test. |
| app.ts:386 | `error instanceof Error` → `true` | Gap (not fixed) | Only differs when something other than an `Error` is thrown: the mutant would pass it to `captureException`, which expects an `Error`. Every failure these handlers catch comes from `fs` or SQLite, which throw `Error`s, so I didn't add a test that throws a string. |
| app.ts:130, 150, 155, 282, 287 | log message → `''` (×5) | Gap (not fixed) | The log text changes. No requirement covers the wording, and pinning log strings in tests would break on any rewording. The new read-failed test checks that an error *is* logged (`expect.any(String)`), not the text, so these still survive. |
| app.ts:154 | `catch (removeError)` body → `{}` | Gap (not fixed) | Only the warning when cleanup of an unsaved file also fails is lost; the error is still swallowed and `save-failed` still returned. Testing it needs both the row insert and the file removal to fail, for a log line. |
| app.ts:350 | `transaction.parent_id == null` → `false`, and its body → `{}` (×2) | Equivalent | A child with no `parent_id` then looks up its parent with `WHERE id = NULL`. In SQL that matches no row (checked with `better-sqlite3`, including against a row whose `id` is `NULL`), so `parent == null` on line 355 returns `null` anyway. |
| app.ts:373 | `row.tombstone === 1` → `false` | Equivalent | `fromDbRow` is only called on rows read with `tombstone = 0` (`getAttachmentRow`, `attachment-list`), so `tombstone` is always `false` either way. |

**Lines from issue #155 (7 survivors)**

| Location (file:line) | Mutation | Equivalent or test gap? | Why |
| --- | --- | --- | --- |
| app.ts:237 | `if (ownerId == null)` → `false`, and its body → `{}` (×2) | Equivalent | `attachment-list` then runs its query with `transaction_id = NULL`, which matches no row, so it returns `[]` either way (same `better-sqlite3` check). |
| app.ts:306 | `ownerId == null` → `false` | Gap (not fixed, #155) | `moveAttachments` (merging transactions) has no test where the kept transaction is missing or deleted. With the mutant the attachments are moved to `transaction_id = NULL`, so they vanish. This is #155's code, so I left it for #155's tests. |
| app.ts:306 | `ownerId === fromTransactionId` → `false` | Gap (not fixed, #155) | No test merges a transaction into itself. With the mutant the update changes nothing but still counts the rows, so the UI gets an extra refresh event. Same reason. |
| app.ts:306 | whole condition → `false`, `\|\|` → `&&`, and its body → `{}` (×3) | Gap (not fixed, #155) | The two gaps above together. |

**Totals:** 37 survivors = 20 gaps killed + 12 gaps left open (5 log texts, 1 log on a double failure, 1 non-`Error` throw, 5 in #155's merge guard) + 5 equivalent. The after report's 17 survivors are the 12 open gaps and 5 equivalent mutants; all 20 targeted mutants show as Killed.

## New or strengthened test

Commit: COMMIT · Test: `app.test.ts › attachment-remove › needs an open budget, and leaves the attachment in place` · Kills: `app.ts:173` (`budgetId == null` → `false`), shown as Killed in the after report.

All tests added or strengthened from this analysis (all in `packages/loot-core/src/server/attachments/app.test.ts`):

| Test | Kills |
| --- | --- |
| `attachment-remove › needs an open budget, and leaves the attachment in place` | app.ts:173 (×2), 174 (×3) |
| `attachment-read › needs an open budget` | app.ts:259 (×2), 260 (×3) |
| `attachment-read › reports a file that cannot be read as read-failed` | app.ts:286, 288 (×3), 384, 385, 386 (×2), 387 |
| `attachment-add › rejects a transaction that is %s and stores nothing` (strengthened: new `lost-child` case) | app.ts:355 |

## Questions

**1. What did the surviving mutants reveal about your tests?**

The happy paths and the validation errors were well covered: every mutant in `attachment-add`'s validation, the split-child handling and the list ordering was killed. The survivors were in the error paths, and they showed that I tested each error on some handlers but not all of them. `attachment-add` and `attachment-restore` had a "needs an open budget" test, but `attachment-remove` and `attachment-read` didn't, although the plan lists `no-budget` for both. `read-failed` was tested for a file of the wrong type but never for a read that throws, so the `catch` block and the whole `reportError` helper (log it and send it to error reporting) ran in no test. The tests for the earlier write and save failures only checked the returned error, never that the failure was reported. The split-child fixtures also had a hole: there was a child whose parent is deleted, but none whose parent row doesn't exist at all, which is the case where `parent == null` matters. Last, three "equivalent" survivors (lines 237, 350, 373) are guards that the database already makes redundant: comparing to `NULL` in SQL matches nothing, and `fromDbRow` only ever sees live rows. They're harmless, but they're code no test can reach.

**2. Did any surviving mutant point to an assertion whose expected value was not based on the requirements? Explain.**

No. The survivors pointed at missing tests, not at wrong expected values: every existing assertion near a survivor checked an error reason that the #154 plan names (`no-budget`, `read-failed`, `transaction-not-found`). The closest case is the error-reporting check I added. Sending failures to `captureException` isn't in the issue's requirements; it's how `reportError` in this PR handles unexpected errors. I still tested it, because otherwise nothing showed that a failed read is reported anywhere. But I only checked that an error is logged and passed to `captureException`, not the log text, because no requirement covers the wording. That's why the five log-message mutants still survive.

**3. If you used AI to configure the tool, analyze survivors, or write tests, say what it produced and what you verified or corrected.**

I used Claude Code (Claude Opus 5.5) for all three; the log is in `ai-logs/sprint3/jamesleonard3rd/`. It wrote the Stryker and Vitest configs (adapted from Bennett's #163 setup), ran both passes, sorted the survivors by whether `git blame` puts their line in #175 or #155, drafted the classifications and wrote the four tests. Its first attempt mutated all 13 files the PR changed, across both packages. It needed Stryker's in-place mode for one web test, and when I cancelled that run, Stryker had left instrumented code in every loot-core file. It restored them from git, and I narrowed the run to `app.ts`, the file with the most tests. The equivalent-mutant claims about `NULL` were checked by running the queries against `better-sqlite3`, not assumed. The new tests were checked by running them on the unchanged code (all 75 pass), and then by the after report, which shows each targeted mutant as Killed.
