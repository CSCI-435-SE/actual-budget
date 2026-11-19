Sprint 3 PR Reviews

Created: 11/16/2026 17:55:13
Updated: 11/16/2026 22:22:24
Exported: 11/18/2026 22:31:47
Link: https://claude.ai/chat/201daf79-7dec-44ea-a5f6-669ed8a89c34

User:

11/16/2026 17:55:13

<!-- Thank you for submitting a pull request! Make sure to follow the instructions to write release notes for your PR — it should only take a minute or two: https://actualbudget.org/docs/contributing/#writing-good-release-notes. Try running yarn generate:release-notes *before* pushing your PR for an interactive experience. -->

## Description

<!-- What does this PR do? Why is it needed? Please give context on the "why?": why do we need this change? What problem is it solving for you?-->
This PR adds a Transactions column to the Manage Tags page that shows how many transactions use each tag, allowing users to find unused tags at a glance and clean up their tag list.

<!-- If AI tools wrote a significant part of this change, please disclose it here and name the tool you used. See https://actualbudget.org/docs/contributing/ai-usage-policy -->

🤖 Generated with [Claude Code](https://claude.com/claude-code)
## Related issue(s)

Closes #148 

## Design Decision: Matching "View Transactions" counts

Each count must equal what View Transactions (the `hasTags` filter) lists.

**Alternative 1: Run the `hasTags` query once per tag.** Matches by
construction, but it's one full scan per tag. Also, `$count` on grouped
transactions counts split children separately instead of once per split.

**Alternative 2: One scan with a tokenizer.** Fastest, but it's a second copy
of the matching rules that could silently drift from `hasTags`.

**Chosen: One scan with a shared pattern.** I moved the regex into
`tagMatchPattern()`, used by both `hasTags` and the new counts handler. One
query fetches tagged notes, grouped by split. Each tag's pattern is then tested
in memory, which is fine for the expected ≤100 tags. This keeps a single source
of matching rules at the cost of one query. A test compares every count with the
real View Transactions query.

## Test Evidence

| Acceptance criterion | Test(s) | Level | Source of expected value |
|---|---|---|---|
| AC1: Transactions column between Description and the button | `ManageTags.test.tsx`: "shows a Transactions column after Description" | Component | Issue spec (column order) |
| AC2: Counts non-deleted transactions | `tags/app.test.ts`: "counts every transaction that uses a tag", "does not count deleted transactions", "does not count deleted tags" | Integration (real SQLite) | Hand-counted from test fixtures |
| AC3: Same matching as View Transactions (`hasTags`) | `tags/app.test.ts`: "matches the number of rows the 'View Transactions' filter lists", "does not count a tag that is a prefix of another tag", "counts a split transaction once", "does not count children of a deleted split parent", "matches tags case sensitively and ignores escaped tags"; `shared/tags.test.ts`: 7 `tagMatchPattern` tests | Integration + unit | Cross-check test: the real View Transactions query (grouped `hasTags`) on the same data. Others: hand-derived from the `hasTags` rules |
| AC4: Unused tag shows a muted `0` | `ManageTags.test.tsx`: "shows how many transactions use each tag" (checks `0` appears; style not asserted) | Component | Issue spec |
| AC9: Placeholder while loading | `ManageTags.test.tsx`: "shows a placeholder until the counts have loaded" | Component | Issue spec |
| AC10: Unit tests cover the counting logic; existing tests pass | `tags/app.test.ts` (10 new tests); the 5 existing `ManageTags.test.tsx` tests still pass | Integration + component | Issue spec |

**Not tested automatically, and why:**
- **AC4 muted styling, AC5 right alignment and tabular numerals, AC6 hidden-tag dimming:** these are visual styles. jsdom doesn't reliably compute the CSS-in-JS styles, and the Tags page has no visual regression tests. Checked manually in the app.
- **AC7 refresh after editing notes, AC8 count after rename:** these depend on navigating between pages and on cache refreshing, which the component tests don't model. Checked manually.
- **AC3 end to end in the UI:** checked manually by comparing counts with the View Transactions results.

**AI-written tests:** All new tests were written by AI (Claude Code): the 7 `tagMatchPattern` tests in `shared/tags.test.ts`, the 10 `tags-get-counts` tests in `tags/app.test.ts`, and the 3 new `ManageTags.test.tsx` tests, plus the counts stub and render helper added to that file. Expected values were derived by hand from small fixtures against the acceptance criteria. The AC3 cross-check test doesn't use hand-written values at all: it compares each count with the actual View Transactions query, so it would catch a wrong expectation. The counts were also confirmed manually in the app against View Transactions.

## Tech Debt

**Introduced:**
- **Split and deleted-row logic is copied, not shared.** The counts query copies the grouped transaction list's rules: it reads `v_transactions_internal_alive` and groups split children under their parent with `IFNULL(parent_id, id)`. It doesn't call that code directly. A test compares every count with the real View Transactions query, so the two can't drift apart unnoticed.
- **Counting work grows with the number of tags.** Each tag's pattern is checked against every tagged note in JS, roughly tags × tagged notes regex checks. That's fine for the expected ≤100 tags; budgets with many more tags would need a single-pass approach instead.
- **Counts reload every time the Tags page opens** (`staleTime: 0`). That's simpler than refreshing them precisely after each transaction edit, but it costs one extra query per visit.
- **An invisible copy of the View Transactions button sits in the header.** The button column is sized to its content, so the hidden copy keeps the new column aligned at any translated button width, instead of giving the button a fixed width.

**Encountered:**
- **`hasTags` and `hasAnyTag` each had their own copy of the regex escaping.**
  I merged them into a shared `tagMatchPattern()`, which now also drives the counts.
- **The rules engine (`condition.ts`) has a third, lowercased copy of the tag
  regex.** Its case-insensitive matching is intentionally different, so I left it alone (out of scope).
- **The Tags table header didn't account for the list's scrollbar width.**
  This only showed once a right-aligned column existed. I fixed it with `Table`'s existing `saveScrollWidth` callback.
- **`main.test.ts > budget is successfully loaded` times out locally** (~6 s against a 5 s limit). It fails the same way on the code before this branch, so I left it unchanged.
- **Checking only changed files is awkward.** `tsc-strict` rejects file arguments with the current TypeScript (TS5112), and desktop-client's typecheck reads loot-core's built `@types`, which go stale until rebuilt with `tsgo -b`. I worked around both by checking whole packages.

## Checklist

- [X] Release notes added (see link above)
- [X] No obvious regressions in affected areas
- [X] Self-review has been performed - I have read every line of this diff and can explain what each change does and why it is needed

<!--- actual-bot-sections --->
<hr />

<!--- bundlestats-action-comment key:combined start --->
### Bundle Stats

Bundle | Files count | Total bundle size | % Changed
------ | ----------- | ----------------- | ---------
desktop-client | 45 | 15.42 MB → 15.42 MB (+2.07 kB) | +0.01%
loot-core | 1 | 4.67 MB → 4.67 MB (+619 B) | +0.01%
api | 2 | 3.88 MB → 3.88 MB (+608 B) | +0.01%
cli | 1 | 8.02 MB | 0%
crdt | 1 | 11.16 kB | 0%

<details>
<summary>View detailed bundle stats</summary>

#### desktop-client

**Total**
Files count | Total bundle size | % Changed
----------- | ----------------- | ---------
45 | 15.42 MB → 15.42 MB (+2.07 kB) | +0.01%

<details>
<summary>Changeset</summary>

File | Δ | Size
---- | - | ----
`src/components/tags/TagViewTransactionsButton.tsx` | 🆕 +1.45 kB | 0 B → 1.45 kB
`src/tags/queries.ts` | 📈 +225 B (+79.79%) | 282 B → 507 B
`src/components/tags/TagsList.tsx` | 📈 +187 B (+21.59%) | 866 B → 1.03 kB
`src/components/tags/ManageTags.tsx` | 📈 +482 B (+13.65%) | 3.45 kB → 3.92 kB
`src/hooks/useTags.ts` | 📈 +224 B (+10.59%) | 2.07 kB → 2.28 kB
`src/components/tags/TagRow.tsx` | 📉 -234 B (-2.31%) | 9.88 kB → 9.65 kB
`src/components/tags/TagsHeader.tsx` | 📉 -254 B (-16.78%) | 1.48 kB → 1.23 kB
</details>

<details>
<summary>View detailed bundle breakdown</summary>
<div>

**Added**
No assets were added

**Removed**
No assets were removed

**Bigger**
Asset | File Size | % Changed
----- | --------- | ---------
static/js/index.js | 2.58 MB → 2.58 MB (+1.63 kB) | +0.06%
static/js/Value.js | 1.8 MB → 1.8 MB (+449 B) | +0.02%

**Smaller**
No assets were smaller

**Unchanged**
Asset | File Size | % Changed
----- | --------- | ---------
static/js/BackgroundImage.js | 121.09 kB | 0%
static/js/DateSelect.js | 2.38 MB | 0%
static/js/FormulaEditor.js | 767.27 kB | 0%
static/js/NotesTagFormatter.js | 25.94 kB | 0%
static/js/PayeeRuleCountLabel.js | 12.81 kB | 0%
static/js/ReportRouter.js | 1.58 MB | 0%
static/js/TourHost.js | 169.22 kB | 0%
static/js/TransactionEdit.js | 221.13 kB | 0%
static/js/TransactionList.js | 172.88 kB | 0%
static/js/bootstrapHyperFormula.js | 302 B | 0%
static/js/build-shims.js | 140 B | 0%
static/js/ca.js | 161.65 kB | 0%
static/js/columns.js | 673.3 kB | 0%
static/js/de.js | 179.68 kB | 0%
static/js/en-GB.js | 13.59 kB | 0%
static/js/en.js | 292.34 kB | 0%
static/js/es.js | 181.74 kB | 0%
static/js/fr.js | 174.48 kB | 0%
static/js/html2canvas.js | 319.9 kB | 0%
static/js/index.es.js | 310.54 kB | 0%
static/js/indexeddb-main-thread-worker-e59fee74.js | 13.46 kB | 0%
static/js/it.js | 147.08 kB | 0%
static/js/jspdf.es.min.js | 589.55 kB | 0%
static/js/jspdf.plugin.autotable.js | 57.62 kB | 0%
static/js/months.js | 580.45 kB | 0%
static/js/narrow.js | 291.59 kB | 0%
static/js/nb-NO.js | 130.04 kB | 0%
static/js/nl.js | 142.79 kB | 0%
static/js/pl.js | 140.63 kB | 0%
static/js/preload-helper.js | 2.09 kB | 0%
static/js/pt-BR.js | 169.06 kB | 0%
static/js/purify.es.js | 63.78 kB | 0%
static/js/rolldown-runtime.js | 2 kB | 0%
static/js/ru.js | 197.41 kB | 0%
static/js/sv.js | 127.95 kB | 0%
static/js/theme.js | 29.74 kB | 0%
static/js/typeof.js | 404 B | 0%
static/js/uk.js | 237.17 kB | 0%
static/js/useLocalPref.js | 97.2 kB | 0%
static/js/useReducedMotion.js | 594 B | 0%
static/js/wide.js | 287.37 kB | 0%
static/js/workbox-window.prod.es5.js | 7.21 kB | 0%
static/js/zh-Hant.js | 127.78 kB | 0%
</div>
</details>

---

#### loot-core

**Total**
Files count | Total bundle size | % Changed
----------- | ----------------- | ---------
1 | 4.67 MB → 4.67 MB (+619 B) | +0.01%

<details>
<summary>Changeset</summary>

File | Δ | Size
---- | - | ----
`home/runner/work/actual-budget/actual-budget/packages/loot-core/src/shared/tags.ts` | 📈 +135 B (+20.55%) | 657 B → 792 B
`home/runner/work/actual-budget/actual-budget/packages/loot-core/src/server/tags/app.ts` | 📈 +448 B (+13.26%) | 3.3 kB → 3.74 kB
`home/runner/work/actual-budget/actual-budget/packages/loot-core/src/server/db/index.ts` | 📈 +260 B (+1.05%) | 24.22 kB → 24.47 kB
`home/runner/work/actual-budget/actual-budget/packages/loot-core/src/server/transactions/transaction-rules.ts` | 📉 -224 B (-0.93%) | 23.62 kB → 23.4 kB
</details>

<details>
<summary>View detailed bundle breakdown</summary>
<div>

**Added**
Asset | File Size | % Changed
----- | --------- | ---------
kcab.worker.Ba-ljZdF.js | 0 B → 4.67 MB (+4.67 MB) | -

**Removed**
Asset | File Size | % Changed
----- | --------- | ---------
kcab.worker.7oKMBz5-.js | 4.67 MB → 0 B (-4.67 MB) | -100%

**Bigger**
No assets were bigger

**Smaller**
No assets were smaller

**Unchanged**
No assets were unchanged
</div>
</details>

---

#### api

**Total**
Files count | Total bundle size | % Changed
----------- | ----------------- | ---------
2 | 3.88 MB → 3.88 MB (+608 B) | +0.01%

<details>
<summary>Changeset</summary>

File | Δ | Size
---- | - | ----
`home/runner/work/actual-budget/actual-budget/packages/loot-core/src/shared/tags.ts` | 📈 +132 B (+20.66%) | 639 B → 771 B
`home/runner/work/actual-budget/actual-budget/packages/loot-core/src/server/tags/app.ts` | 📈 +438 B (+13.36%) | 3.2 kB → 3.63 kB
`home/runner/work/actual-budget/actual-budget/packages/loot-core/src/server/db/index.ts` | 📈 +256 B (+1.01%) | 24.84 kB → 25.09 kB
`home/runner/work/actual-budget/actual-budget/packages/loot-core/src/server/transactions/transaction-rules.ts` | 📉 -218 B (-0.90%) | 23.67 kB → 23.46 kB
</details>

<details>
<summary>View detailed bundle breakdown</summary>
<div>

**Added**
No assets were added

**Removed**
No assets were removed

**Bigger**
Asset | File Size | % Changed
----- | --------- | ---------
index.js | 3.88 MB → 3.88 MB (+608 B) | +0.01%

**Smaller**
No assets were smaller

**Unchanged**
Asset | File Size | % Changed
----- | --------- | ---------
models.js | 0 B | 0%
</div>
</details>

---

#### cli

**Total**
Files count | Total bundle size | % Changed
----------- | ----------------- | ---------
1 | 8.02 MB | 0%

<details>
<summary>View detailed bundle breakdown</summary>
<div>

**Added**
No assets were added

**Removed**
No assets were removed

**Bigger**
No assets were bigger

**Smaller**
No assets were smaller

**Unchanged**
Asset | File Size | % Changed
----- | --------- | ---------
cli.js | 8.02 MB | 0%
</div>
</details>

---

#### crdt

**Total**
Files count | Total bundle size | % Changed
----------- | ----------------- | ---------
1 | 11.16 kB | 0%

<details>
<summary>View detailed bundle breakdown</summary>
<div>

**Added**
No assets were added

**Removed**
No assets were removed

**Bigger**
No assets were bigger

**Smaller**
No assets were smaller

**Unchanged**
Asset | File Size | % Changed
----- | --------- | ---------
index.js | 11.16 kB | 0%
</div>
</details>
</details>

<!--- bundlestats-action-comment key:combined end --->

How would I test this PR?

Assistant:

11/16/2026 17:55:24

Based on the PR description, here's how to test it:

Automated tests (run these first)

# Unit tests for the tag pattern matching
yarn test packages/loot-core/src/shared/tags.test.ts

# Integration tests for the counting logic
yarn test packages/loot-core/src/server/tags/app.test.ts

# Component tests for the UI
yarn test src/components/tags/ManageTags.test.tsx

Manual testing in the app

The PR itself notes several things that can't be tested automatically:

Visual styling — open the Manage Tags page and confirm the new Transactions column appears between Description and the action button, counts are right-aligned with tabular numerals, and unused tags show a muted 0.

Count accuracy — for a few tags, compare the number shown in the column against what you get if you click "View Transactions" for that tag. They should match exactly.

Refresh behavior — edit a transaction's notes to add or remove a tag, then navigate away and back to the Manage Tags page. The count should update on return (since staleTime: 0 forces a reload each visit).

Rename a tag — rename a tag that has transactions and confirm the count updates correctly afterward.

Hidden/deleted tags — if you have any, confirm they appear dimmed and their counts still look right.

Edge cases worth checking manually

A tag that is a prefix of another (e.g., #food and #foodie) — counts should not bleed into each other

Split transactions — should count once per split, not once per child

A tag with zero transactions — should show 0

The PR notes that main.test.ts > budget is successfully loaded times out locally at ~6s against a 5s limit, but that's a pre-existing issue unrelated to this change.

User:

11/16/2026 21:55:02

Adds the "(modified)" label from #125 to the five remaining widget reports: Formula, Sankey, Budget Analysis, Balance Forecast and Monte Carlo. The label appears next to the widget name when the report's current settings differ from the saved widget. It disappears when the settings are changed back or after "Save widget" succeeds. The last four reports are experimental and only reachable with their feature flag on.

Each report gets a settings module (formulaWidgetSettings.ts, sankeyWidgetSettings.ts, budgetAnalysisWidgetSettings.ts, balanceForecastWidgetSettings.ts, monte-carlo/monteCarloWidgetSettings.ts). The settings "Save widget" writes and the settings that get compared come from the same place, using the defaults each page applies when it opens.

Balance Forecast: "Save widget" called the backend directly, so the cached widget never refreshed and the label would have stayed on "(modified)" after saving. It now saves through useUpdateDashboardWidgetMutation, like the other reports. The header now shows the widget name with inline rename, instead of a fixed "Balance Forecast" title, so the label sits next to the widget name.

Monte Carlo: the starting balances of pots linked to an account are left out of the comparison. They are the account's live balance, not a user input (the issue's open question, proposed answer).

Sankey: the layer helpers moved from Sankey.tsx into sankeyWidgetSettings.ts so the page, the card and the comparison share them.

Formula: renaming still saves every setting along with the name, as before. The label reflects that.

AI tools (Claude Code) wrote a significant part of this change.

Related issue(s)

Closes #126

Testing

New unit tests for each of the five settings modules (76 tests). Each one checks that the label stays off right after opening (including widgets with no saved settings), that changing each saved setting shows it, that changing it back clears it, and that it handles a rename and a "Save widget" in either order.

New page test BalanceForecast.test.tsx: change → label, change back → no label, save → label cleared and saved meta checked, no widget → no label. With the save temporarily switched back to the old direct send(), this test fails because the label stays stuck.

Ran locally:
vitest --run src/components/reports src/components/formula: 51 files, 800 tests passed.

yarn typecheck passes. oxfmt/oxlint pass on every changed file (warnings only). yarn knip reports nothing new.

Manual run in the browser (demo budget, all five feature flags on): for each report opened from its widget, there is no label on open, the label appears after a change, and it is cleared after "Save widget" and stays cleared when the widget is reopened.

Manual testing by me: TODO: confirm

Test Evidence

Acceptance criterion
Test(s)
Level
AC1: Changing a saved setting shows "(modified)" on all five reports; saving or changing it back removes it
is modified when %s changes and is not modified after changing a setting back in each *WidgetSettings.test.ts · BalanceForecast.test.tsx › shows "(modified)" only while the settings differ from the saved widget · manual browser run for all five
unit + component + manual
AC2: Editing the Formula text without saving shows the label
formulaWidgetSettings.test.ts › is modified while the formula text is being edited · manual browser run (typed into the formula editor)
unit + manual
AC3: Balance Forecast and Monte Carlo follow the newly saved settings when another save happens
when more than one place writes the widget blocks in balanceForecastWidgetSettings.test.ts and monteCarloWidgetSettings.test.ts · BalanceForecast.test.tsx (label clears after save through the refreshed cache)
unit + component
AC4: Nothing changes when a report's feature flag is off
The label only renders inside the report pages; the Sankey, Budget Analysis, Balance Forecast and Monte Carlo routes are only registered when their flag is on (ReportRouter.tsx), so no flag-off behavior changed
by construction
Open question: Monte Carlo computed values excluded
monteCarloWidgetSettings.test.ts › ignores the balance of a pot linked to an account, stays clear when the linked account balance moves after saving
unit

Not tested automatically, and why:

Page tests for Formula, Sankey, Budget Analysis and Monte Carlo: their pages need large mocks (the formula editor, Sankey graph, simulation). Their comparison logic is unit-tested and the page wiring is the same pattern tested on Balance Forecast and #125's Net Worth and Goal. All five were checked in the browser.

Linked-account Monte Carlo pot and renaming in the browser: covered by unit tests only.

AI-written tests: Claude Code wrote all new tests. The expected true/false values come from the acceptance criteria and from what each page's onSaveWidget writes, not from running the code.

Design decisions

What the label compares against when a report saves from more than one place

Chosen: the saved widget from the query cache, with every write going through useUpdateDashboardWidgetMutation. The mutation refreshes the cache after any successful save, so Save widget, rename, or a future write site all keep the label correct without extra bookkeeping. This matches #125.

Alternative 1: a local "last saved" snapshot updated in each save handler. Every write site would have to remember to update it; missing one leaves the label stuck. It also duplicates state the cache already holds.

Alternative 2: write the new settings into the cache directly (optimistic update) at each save site. Same "every site must remember" problem, plus rollback logic for failed saves.

Consequences: Balance Forecast's save had to move onto the mutation. Any future write site must use it too. The label clears when the refreshed widget arrives, a moment after the save succeeds.

Leaving computed values out of the Monte Carlo comparison

Chosen: compare user inputs only. Both sides are read through monteCarloConfigFromMeta, and startingBalance is dropped for pots linked to an account.

Alternative 1: compare everything. The label would appear whenever a linked account's balance changes.

Alternative 2: stop saving linked balances. Out of scope, and the dashboard card uses them as a fallback while live balances load.

Notes for reviewers

The Balance Forecast VRT snapshots will likely need regenerating: the header is now the editable widget title, and the "switches to daily granularity" screenshot now includes "(modified)".

Checklist

Release notes added (see link above)

No obvious regressions in affected areas

Self-review has been performed - I have read every line of this diff and can explain what each change does and why it is needed

Bundle Stats

Bundle
Files count
Total bundle size
% Changed
desktop-client
45
15.39 MB → 15.42 MB (+37.91 kB)
+0.24%
loot-core
1
4.67 MB
0%
api
2
3.88 MB
0%
cli
1
8.02 MB
0%
crdt
1
11.16 kB
0%
View detailed bundle stats

desktop-client

Total

Files count
Total bundle size
% Changed
45
15.39 MB → 15.42 MB (+37.91 kB)
+0.24%
Changeset

File
Δ
Size
src/components/reports/reports/sankeyWidgetSettings.ts
🆕 +2.75 kB
0 B → 2.75 kB
src/components/reports/reports/balanceForecastWidgetSettings.ts
🆕 +1.22 kB
0 B → 1.22 kB
src/components/reports/reports/formulaWidgetSettings.ts
🆕 +866 B
0 B → 866 B
src/components/reports/reports/budgetAnalysisWidgetSettings.ts
🆕 +788 B
0 B → 788 B
src/components/reports/reports/monte-carlo/monteCarloWidgetSettings.ts
🆕 +387 B
0 B → 387 B
locale/uk.json
📈 +30.69 kB (+14.86%)
206.48 kB → 237.17 kB
src/components/reports/reports/BalanceForecast.tsx
📈 +646 B (+3.69%)
17.11 kB → 17.74 kB
src/components/reports/reports/BudgetAnalysis.tsx
📈 +808 B (+3.09%)
25.56 kB → 26.35 kB
src/components/reports/reports/Formula.tsx
📈 +249 B (+2.06%)
11.82 kB → 12.07 kB
src/components/reports/reports/monte-carlo/MonteCarlo.tsx
📈 +725 B (+1.84%)
38.5 kB → 39.21 kB
locale/nl.json
📈 +129 B (+0.09%)
142.67 kB → 142.79 kB
src/components/reports/reports/Sankey.tsx
📉 -1.22 kB (-3.77%)
32.51 kB → 31.28 kB

View detailed bundle breakdown

Added
No assets were added

Removed
No assets were removed

Bigger

Asset
File Size
% Changed
static/js/uk.js
206.48 kB → 237.17 kB (+30.69 kB)
+14.86%
static/js/ReportRouter.js
1.58 MB → 1.59 MB (+7.1 kB)
+0.44%
static/js/nl.js
142.67 kB → 142.79 kB (+129 B)
+0.09%

Smaller
No assets were smaller

Unchanged

Asset
File Size
% Changed
static/js/index.js
2.58 MB
0%
static/js/BackgroundImage.js
121.09 kB
0%
static/js/DateSelect.js
2.38 MB
0%
static/js/FormulaEditor.js
767.27 kB
0%
static/js/NotesTagFormatter.js
25.94 kB
0%
static/js/PayeeRuleCountLabel.js
12.81 kB
0%
static/js/TourHost.js
169.22 kB
0%
static/js/TransactionEdit.js
221.13 kB
0%
static/js/TransactionList.js
172.88 kB
0%
static/js/Value.js
1.8 MB
0%
static/js/bootstrapHyperFormula.js
302 B
0%
static/js/build-shims.js
140 B
0%
static/js/ca.js
161.65 kB
0%
static/js/columns.js
673.3 kB
0%
static/js/de.js
179.68 kB
0%
static/js/en-GB.js
13.59 kB
0%
static/js/en.js
292.34 kB
0%
static/js/es.js
181.74 kB
0%
static/js/fr.js
174.48 kB
0%
static/js/html2canvas.js
319.9 kB
0%
static/js/index.es.js
310.54 kB
0%
static/js/indexeddb-main-thread-worker-e59fee74.js
13.46 kB
0%
static/js/it.js
147.08 kB
0%
static/js/jspdf.es.min.js
589.55 kB
0%
static/js/jspdf.plugin.autotable.js
57.62 kB
0%
static/js/months.js
580.45 kB
0%
static/js/narrow.js
291.59 kB
0%
static/js/nb-NO.js
130.04 kB
0%
static/js/pl.js
140.63 kB
0%
static/js/preload-helper.js
2.09 kB
0%
static/js/pt-BR.js
169.06 kB
0%
static/js/purify.es.js
63.78 kB
0%
static/js/rolldown-runtime.js
2 kB
0%
static/js/ru.js
197.41 kB
0%
static/js/sv.js
127.95 kB
0%
static/js/theme.js
29.74 kB
0%
static/js/typeof.js
404 B
0%
static/js/useLocalPref.js
97.2 kB
0%
static/js/useReducedMotion.js
594 B
0%
static/js/wide.js
287.37 kB
0%
static/js/workbox-window.prod.es5.js
7.21 kB
0%
static/js/zh-Hant.js
127.78 kB
0%

loot-core

Total

Files count
Total bundle size
% Changed
1
4.67 MB
0%
View detailed bundle breakdown

Added
No assets were added

Removed
No assets were removed

Bigger
No assets were bigger

Smaller
No assets were smaller

Unchanged

Asset
File Size
% Changed
kcab.worker.7oKMBz5-.js
4.67 MB
0%

api

Total

Files count
Total bundle size
% Changed
2
3.88 MB
0%
View detailed bundle breakdown

Added
No assets were added

Removed
No assets were removed

Bigger
No assets were bigger

Smaller
No assets were smaller

Unchanged

Asset
File Size
% Changed
index.js
3.88 MB
0%
models.js
0 B
0%

cli

Total

Files count
Total bundle size
% Changed
1
8.02 MB
0%
View detailed bundle breakdown

Added
No assets were added

Removed
No assets were removed

Bigger
No assets were bigger

Smaller
No assets were smaller

Unchanged

Asset
File Size
% Changed
cli.js
8.02 MB
0%

crdt

Total

Files count
Total bundle size
% Changed
1
11.16 kB
0%
View detailed bundle breakdown

Added
No assets were added

Removed
No assets were removed

Bigger
No assets were bigger

Smaller
No assets were smaller

Unchanged

Asset
File Size
% Changed
index.js
11.16 kB
0%

How would I test this PR?

Assistant:

11/16/2026 21:55:16

Automated tests

# All five settings modules + BalanceForecast page test
vitest --run src/components/reports src/components/formula

# Typecheck
yarn typecheck

Prerequisites for manual testing

The four experimental reports (Sankey, Budget Analysis, Balance Forecast, Monte Carlo) are behind feature flags. Turn them all on before testing. Formula is always available.

For each of the five reports, open it from its dashboard widget and check:

No label on open — the header should show just the widget name, no "(modified)"

Label appears on change — tweak any setting (date range, grouping, etc.) and confirm "(modified)" appears next to the name

Label clears on revert — change the setting back to its saved value and confirm the label disappears without saving

Label clears on save — make a change, click "Save widget", confirm the label disappears and stays gone when you close and reopen the widget

Report-specific things to check

Formula: type in the formula editor without saving — the label should appear immediately while editing, not only after a confirmed change

Balance Forecast: the header should now show an editable widget name (inline rename) rather than a fixed "Balance Forecast" title. Rename it, then save — both the new name and the cleared label should persist on reopen. The VRT snapshots will likely need regenerating since the header changed

Monte Carlo: if you have a pot linked to an account, changing that account's live balance should not trigger the label — only user inputs should

Sankey: the layer settings that moved from Sankey.tsx into sankeyWidgetSettings.ts should still work normally in the UI

Edge cases worth checking

Open a widget that has no saved settings yet — no label should appear

Rename a widget, then change a setting — both the rename and the "(modified)" label should coexist correctly

Save while the label is showing — confirm the label is gone after the save completes (there may be a brief moment while the cache refreshes)

For Balance Forecast specifically, the old code saved directly via send() which left the label stuck after saving. Confirm this is fixed: save should clear the label reliably

User:

11/16/2026 21:57:54

vitest : The term 'vitest' is not recognized as the name of a cmdlet, function, script file, or operable program.
Check the spelling of the name, or if a path was included, verify that the path is correct and try again.
At line:1 char:1

vitest --run src/components/reports src/components/formula

+ CategoryInfo          : ObjectNotFound: (vitest:String) [], CommandNotFoundException
  + FullyQualifiedErrorId : CommandNotFoundException

Assistant:

11/16/2026 21:57:58

That's a Windows PowerShell error — vitest isn't on your PATH directly. Try one of these:

# Most likely to work — runs via your package manager
yarn vitest --run src/components/reports src/components/formula

# Or with npm
npx vitest --run src/components/reports src/components/formula

If the project has a test script defined in package.json, that's often the safest route:

yarn test

And for the typecheck:

yarn typecheck

If none of those work, check what test scripts are available:

yarn run --list
# or
npm run

User:

11/16/2026 22:22:18

How can I access these?

The four experimental reports (Sankey, Budget Analysis, Balance Forecast, Monte Carlo) are behind feature flags. Turn them all on before testing. Formula is always available.

Assistant:

11/16/2026 22:22:24

The PR description doesn't say exactly where the feature flags are configured in this app, so I can't tell you precisely. Common places to look would be:

A "Settings" or "Advanced" section within the app itself

A developer/debug menu (sometimes accessible via a keyboard shortcut or URL)

A local config file or environment variable

Your best bet is to search the codebase for one of the flag names, which should lead you to both where they're defined and how they're toggled:

# Search for one of the report names near flag-related terms
grep -r "sankey" src --include="*.ts" --include="*.tsx" -l
grep -r "featureFlag\|feature_flag\|showExperimental" src --include="*.ts" --include="*.tsx" -l

That should turn up the flag names and where they're read, which will give you a clue about where to set them. If you find a flag name, feel free to share it and I can help figure out where to toggle it.

Powered by Claude Exporter (https://www.ai-chat-exporter.net)