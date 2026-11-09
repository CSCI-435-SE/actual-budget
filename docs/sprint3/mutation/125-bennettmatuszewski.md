# Mutation testing: Issue #125 -- Show a "(modified)" label on the standard report widgets

**PR(s):** #163  **Tool:** StrykerJS 10.0.0 (command runner; see [Setup notes](#setup-notes))  **Config:** [`packages/desktop-client/stryker.config.json`](https://github.com/CSCI-435-SE/actual-budget/blob/87dc81a369ee959b8ac3c8825f97319fad854e67/packages/desktop-client/stryker.config.json) and [`vitest.stryker.config.mts`](https://github.com/CSCI-435-SE/actual-budget/blob/87dc81a369ee959b8ac3c8825f97319fad854e67/packages/desktop-client/vitest.stryker.config.mts), based on my loot-core setup from #91  **Command:** `cd packages/desktop-client && npx stryker run`
**Reports:** [before](reports/125-bennettmatuszewski-before.json) · [after](reports/125-bennettmatuszewski-after.json)
**Mutation score:** before 88.62% → after 100.00%

| | Mutants | Killed | Timed out | Survived | Score |
|---|---|---|---|---|---|
| Before | 246 | 210 | 8 | 28 | 88.62% |
| After | 237 | 237 | 0 | 0 | 100.00% |

Stryker counts timed-out mutants as detected, so the before score is (210 + 8) / 246. The after run has 9 fewer mutants because I deleted code that three of the survivors showed had no effect (see the Spending and Crossover rows below).

**What was mutated.** The PR's change-detection logic: `widgetModified.ts` (shared helper) and the eight `*WidgetSettings.ts` modules, one per report. The PR's edits to the report pages (`NetWorth.tsx`, `CashFlow.tsx`, ...) only wire those modules into the pages. Mutating whole page files would mutate thousands of lines the PR didn't touch, so I left them out.

## Setup notes

- **Vitest runner.** The required Vitest runner (`@stryker-mutator/vitest-runner` 10.0.0) does not work with the Vitest 5.0.0 the repo moved to in the 2026-10-16 upstream merge. Its initial test run passes (118 tests), but no tests run for any mutant, so every mutant is reported as surviving (14% on my files). I checked this was not my config:
  - I ran my loot-core setup from #91 on `sort-categories.ts`, and the `asc`/`desc` mutants "survived" even though `sort-categories.test.ts` tests both directions.
  - When I switched a mutant on by hand (`__STRYKER_ACTIVE_MUTANT__=239`), the tests killed it.
- **Command runner instead.** I used Stryker's command runner, which starts Vitest once per mutant. It is still StrykerJS, but it is not the Vitest runner, so this deviation needs the TA's OK.
- **Standalone Vitest config.** `vitest.stryker.config.mts` runs only the 9 unit test files for these modules. The full `vite.config.mts` copies `public/` assets on every load, which fails with EPERM when Stryker's parallel workers load it at once.
- **Before report.** I deleted the report from my first run during clean-up. So `-before.json` is a second run of that same state: I temporarily undid the 3 code simplifications and removed the tests added after the first run. Its survivors match the first run's, plus three Crossover mutants at line 43 that the first run did not list as surviving.
- **Timeouts.** The before run's 8 timeouts (`widgetModified.ts` lines 37–45) were the machine being overloaded: four Vitest processes, each with several workers. One of them, 39:7 `&&`→`||`, survived in my first run. For the after run I added `--maxWorkers 1` to the Vitest command, and all mutants were killed without timeouts.

## Surviving mutants

All 28 survivors are in lines the PR added. "Gap" = a test was missing; "Equivalent" = no test can tell the mutant from the original.

| Location (file:line) | Mutation | Equivalent or test gap? | Why |
|---|---|---|---|
| crossoverWidgetSettings.ts:14 | `defaultTimeFrame` → `{}` | Gap | The only test of a widget with no saved range resolved both sides through the same default, so changing the default changed both. Nothing checked that such a widget opens on "all time". |
| crossoverWidgetSettings.ts:17 | `mode: 'full'` → `''` | Gap | Same gap as line 14. |
| crossoverWidgetSettings.ts:34 | `isAfter(month, latestMonth)` → `false` | Gap | No test used a month after the last month with data, so clamping it was never checked. |
| crossoverWidgetSettings.ts:43 | `mode === 'full'` → `false` | Gap | No test called `adjustCrossoverRange` with "all time", which should span every month with data. |
| crossoverWidgetSettings.ts:43 | `'full'` → `''` | Gap | Same gap as the row above. |
| crossoverWidgetSettings.ts:43 | `full` branch body → `{}` | Gap | Same gap as the row above. |
| crossoverWidgetSettings.ts:50 | `isBefore(end, start)` → `false` | Gap | No test had an end month before the start month. |
| crossoverWidgetSettings.ts:50 | fix-up body → `{}` | Gap | Same gap as the row above. |
| crossoverWidgetSettings.ts:154 | `meta.expenseCategoryIds?.includes` → `.includes` | Equivalent | This sits inside `meta?.expenseCategoryIds !== undefined ? ...`, so the `?.` can never short-circuit. I removed it by reading the list into a local variable first. |
| crossoverWidgetSettings.ts:160 | remove `.sort()` on expense category ids | Equivalent | Both sides are built with `categories.filter(...)`, so they are already in category-list order. I removed the sort. |
| crossoverWidgetSettings.ts:161 | remove `.sort()` on income account ids | Gap | No test saved the same accounts in a different order, which the account selector can produce. |
| crossoverWidgetSettings.ts:171 | `meta?.timeFrame` → `meta.timeFrame` | Gap | No test compared a widget with no saved settings (`meta` null) before the months with data had loaded. That crashes with this mutant. |
| spendingWidgetSettings.ts:68 | condition → `false` (always keep `compareTo`) | Equivalent | `calculateSpendingReportTimeRange` already sets `compareTo` to `compare` for live budget/average comparisons, on both sides, so dropping it did nothing. I removed the branch. |
| spendingWidgetSettings.ts:68 | `isLive && mode !== ...` → `isLive \|\| mode !== ...` | Gap | This mutant also ignores the second month of a *live single-month* comparison, and no test changed that month while live. My first pass wrongly called all five line-68 mutants equivalent; this row and the next three are the correction. |
| spendingWidgetSettings.ts:68 | `mode !== 'single-month'` → `true` | Gap | Same gap as the row above. |
| spendingWidgetSettings.ts:68 | `!==` → `===` | Gap | Same gap as the row above. |
| spendingWidgetSettings.ts:68 | `'single-month'` → `''` | Gap | Same gap as the row above. |
| summaryWidgetSettings.ts:28 | `if (!content)` → `false` | Gap | Missing content then goes through `JSON.parse(undefined)`, which throws, so the catch still returns a sum but logs an error. No test checked that a widget with no saved content doesn't log one. |
| summaryWidgetSettings.ts:28 | early-return body → `{}` | Gap | Same gap as the row above. |
| summaryWidgetSettings.ts:33 | `catch` body → `{}` | Gap | Invalid saved JSON was never tested. With this mutant the function returns `undefined` and the caller crashes. |
| summaryWidgetSettings.ts:34 | log message → `''` | Gap | No test checked what is logged for invalid JSON. |
| summaryWidgetSettings.ts:65 | `parsed.type !== 'percentage'` → `false` | Gap | No test had divisor filters on a non-percentage total. The report resets those filters when it opens, so they must be ignored. |
| summaryWidgetSettings.ts:65 | if-body → `{}` | Gap | Same gap as the row above. |
| summaryWidgetSettings.ts:68 | non-percentage result → `{}` | Gap | No test switched between two non-percentage types, for example sum → average per month. |
| summaryWidgetSettings.ts:68 | `parsed.type ?? 'sum'` → `&&` | Gap | Content saved without a `type` was never tested; the page shows it as a sum. |
| summaryWidgetSettings.ts:68 | `'sum'` → `''` | Gap | Same gap as the row above. |
| summaryWidgetSettings.ts:79 | `divisorAllTimeDateRange ?? false` → `?? true` | Gap | A percentage saved without the "All time divisor" setting was never compared with one where it is off. |
| widgetModified.ts:77 | `value === undefined` → `false` | Gap | No test passed `undefined` to `isWidgetModified`. `JSON.parse(undefined)` throws. |

Timed out in the before run (counted as detected, listed for completeness): `widgetModified.ts` 37:34, 39:7 ×3, 41:7, 42:14, 44:16, 45:16. All eight are killed in the after run. 39:7 `&&`→`||` survived in my first run, a real gap: no test had a sliding window with one day-shaped and one month-shaped bound.

## New or strengthened test

Commit: [74854f42c](https://github.com/CSCI-435-SE/actual-budget/commit/74854f42c84e9a4a97e62236ff148b5f278179ce) (the PR's commit, which includes the tests added after the first run) and [87dc81a36](https://github.com/CSCI-435-SE/actual-budget/commit/87dc81a369ee959b8ac3c8825f97319fad854e67) (Spending test and config) · Test: `summaryWidgetSettings.test.ts › Summary widget settings › ignores divisor filters when the total is not a percentage` · Kills: `summaryWidgetSettings.ts:65` (`parsed.type !== 'percentage'` → `false`), shown as Killed in the after report.

All tests added from this analysis, and the gaps they close:

| Test | Kills |
|---|---|
| `widgetModified.test.ts › toComparableTimeFrame › treats a window with only one day-shaped bound as month-shaped` | widgetModified.ts:39 |
| `widgetModified.test.ts › isWidgetModified › compares settings that are entirely missing` | widgetModified.ts:77 |
| `summaryWidgetSettings.test.ts › Summary widget settings › notices a switch between two kinds of totals` | summary:68 (`{}`) |
| `… › ignores divisor filters when the total is not a percentage` | summary:65 |
| `… › treats content without a type as a sum` | summary:68 (`&&`, `''`) |
| `… › treats a missing "All time divisor" setting as off` | summary:79 |
| `… › parseSummaryContent › falls back to a sum, without logging, when nothing is saved` | summary:28 |
| `… › parseSummaryContent › falls back to a sum and logs the error when the saved JSON is invalid` | summary:33, summary:34 |
| `crossoverWidgetSettings.test.ts › … more cases › ignores the order of the selected income accounts` | crossover:161 |
| `… › opens a widget without a saved range on all time` | crossover:14, crossover:17 |
| `… › can compare before the months with data have loaded` | crossover:171 |
| `… › adjustCrossoverRange › spans every month with data for all time` | crossover:43 |
| `… › adjustCrossoverRange › clamps a fixed range to the months with data` | crossover:34 |
| `… › adjustCrossoverRange › never ends a range before it starts` | crossover:50 |
| `spendingWidgetSettings.test.ts › … › notices a change to the second month of a live single-month comparison` | the line-68 gap (code since removed; I checked by putting the `\|\|` mutant back by hand: this test fails and the rest pass) |

## Questions

1. **What did the surviving mutants reveal about your tests?**
   - **Main paths tested; defaults, fallbacks and edges not.** Each report's tests checked that changing every saved setting shows the label. They mostly missed what happens around those settings: values filled in when something isn't saved, fallbacks for bad data, and edge cases in range handling.
   - **Crossover** had the most survivors (12). Its range adjustment (`adjustCrossoverRange`) was only tested indirectly, through cases where both sides went through the same code. When the code under test runs on both sides of a comparison, a bug there cancels out, so the comparison tests could not see it.
   - **Summary** had no test for missing or invalid saved content. It also had none for "Show as" types other than percentage, which the report treats differently.
   - **Dead code.** Three survivors showed code that did nothing (a redundant branch, a redundant sort, an unreachable `?.`). I deleted that code instead of testing it.

2. **Did any surviving mutant point to an assertion whose expected value was not based on the requirements? Explain.**
   - **Yes, two of the new tests.** Issue #125's requirements are about when the "(modified)" label shows. They say nothing about logging. The two `parseSummaryContent` tests check that a widget with no saved content logs nothing, and that invalid JSON logs `'Failed to parse widget meta content:'`. Those expected values come from the existing page code's behaviour (the log message was copied from `Summary.tsx`), not from the requirements. I kept them because they pin down the fallback, but they would break on a harmless change to the log wording.
   - **One more is borderline.** `compares settings that are entirely missing` (widgetModified.ts:77) tests robustness: in the app, `isWidgetModified` always gets objects.
   - **Everything else is requirement-based.** The other expected values come from the requirement that the label shows exactly when a setting "Save widget" would save differs from the saved widget.

3. **If you used AI to configure the tool, analyze survivors, or write tests, what did it produce and what did you verify or correct?**
   - **What it produced.** I used Claude Code (Claude Opus 5.5). It:
     - wrote the Stryker and Vitest configs;
     - diagnosed the Vitest-runner problem;
     - did the first classification of survivors;
     - wrote the new tests and this draft.
   - **What was verified or corrected:**
     - **Fake 14% score.** The first run with the Vitest runner scored 14%. Instead of treating that as real, it inspected the JSON and found `testsCompleted: 0` on every "survived" mutant. It then reproduced the problem on my loot-core setup and confirmed that switching a mutant on by hand killed it.
     - **Wrong "equivalent" call.** Its first analysis called all five Spending line-68 mutants equivalent. While writing this table it found that four of them were real gaps (a live single-month comparison's second month was never tested), added a test, and checked by hand that the test fails against that mutant.
     - **Timeouts.** It noticed that timeouts in the before run were hiding the `widgetModified.ts:39` survivor, and changed the after run so that mutant shows as Killed rather than Timeout.
     - **Before report.** It told me the original first-run report had been deleted, and the before report was regenerated from that same code instead.
     - **Still for me to check before submitting:** that the mutants in the tables show the stated status in both JSON reports, that the scores match the reports, and that I agree with each Equivalent/Gap verdict.
