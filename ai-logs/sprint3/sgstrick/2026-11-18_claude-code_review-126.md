Review of Issue #126: "(modified)" label on five more report widgets (Claude Code)

Created: 11/16/2026
Updated: 11/18/2026
Exported: 11/18/2026
Tool: Claude Code (VS Code extension), model Claude Opus 5.5
Note: tool calls are listed by name and description; tool outputs are omitted. Exact message times were not recorded, so only the date is given.

User:

11/16/2026

Does the current codebase fufill this issue?

### Summary

Use the helper and label from #125 on the five remaining widget reports: Formula, Sankey, Budget Analysis, Balance Forecast and Monte Carlo. The last four are experimental and only appear when their feature flag is on in **Settings → Experimental features**.

### User Story

As a user building Formula widgets or trying the experimental reports, I want to see a "(modified)" label when my changes aren't saved so that I don't lose settings that took effort to set up, such as formulas or simulation inputs.

### User Scenario

A user turns on the Monte Carlo experimental feature and opens a Monte Carlo widget. They change the simulation inputs, and "(modified)" appears next to the widget name. They press **Save widget**, and the label disappears.

### Acceptance Criteria

1. **Given** any of the five reports opened from a widget, **when** the user changes a setting that **Save widget** would save, **then** "(modified)" appears next to the widget name. Saving successfully, or changing the setting back, removes it.
2. **Given** a Formula widget, **when** the user edits the formula text without saving, **then** the label appears.
3. **Given** Balance Forecast or Monte Carlo, which write to the saved widget from more than one place in their code, **when** one of those other saves happens, **then** the label reflects the newly saved settings and is not stuck on "(modified)". A unit test covers this.
4. **Given** a report whose feature flag is off, **then** nothing about the app's behavior changes.

### Out of Scope

- The reports covered by #125.
- Taking any report out of experimental status.
- Any dialog or prompt when leaving the page.

### Open Questions

- Monte Carlo computes results that may be stored with the widget. Should computed values be left out of the comparison, so only the user's inputs count as changes? (Proposed: yes.)

### Scope

Medium: only five reports and the pattern already exists from #125, but Formula, Balance Forecast and Monte Carlo store more complicated settings than the reports in #125, and each experimental report needs its feature flag turned on to test.

### Source

Split out of #96.

### Design

_Owner: record at least one non-trivial decision, with at least two alternatives, the rationale and the consequences. For example, how to keep the label correct when a report saves to its widget from more than one place._

Assistant:

11/16/2026

> Tool: Bash — Show the branch commits and changed files

> Tool: Bash — Show the report component diffs (BalanceForecast, BudgetAnalysis, Formula, MonteCarlo, SankeyCard, settings modules)

> Tool: Bash — Find widget save sites and test cases

> Tool: Bash — Read the Balance Forecast tests

> Tool: Bash — Run the new widget-settings tests

The new tests are failing when run, so I'm checking whether that's an actual bug or a setup problem.

> Tool: Bash — Show test failure summary for reports folder

> Tool: Bash — Show the first error details for one test file

> Tool: Bash — Check the web package test script and vitest versions

> Tool: Bash — Run tests via the package's test script

The failures look environment-wide (existing Goal tests fail too, with `toBeInTheDocument` missing), so I'm checking the test setup.

> Tool: Bash — Inspect vitest config and installed version

> Tool: Bash — Check test setup file and jest-dom install

> Tool: Bash — Look for duplicate vitest installs

> Tool: Bash — Compare lockfile with installed @vitest/expect

> Tool: Bash — Run the existing #125 helper test as a baseline

Even the already-merged #125 test fails the same way, so the problem is the local install, not this branch. I'll run `yarn install` to sync `node_modules` with the lockfile and test again.

> Tool: Bash — Sync dependencies with the lockfile

> Tool: Bash — Rerun the widget tests after install

> Tool: Bash — Get full stack trace of the setup failure

Running vitest from inside the package works. The earlier failures came from launching it from the repo root on Windows, not from the code. Now the full set:

> Tool: Bash — Run all widget-modified tests from package dir

> Tool: Bash — Run each widget test file individually

> Tool: PowerShell — Run widget tests from PowerShell with C: drive casing

> Tool: Bash — Confirm clean tree and list Formula tests

Yes, the code on this branch meets all four acceptance criteria. The one gap is the issue's **Design** section, which asks for a written record rather than code. The work is in commit `9b8c54474` on `feat/issue-126-modified-label-more-reports`.

**Acceptance criteria**

1. **Label on all five reports.** Formula, Sankey, Budget Analysis, Balance Forecast and Monte Carlo now show `ReportWidgetTitle` with `isModified`, using the `isWidgetModified` helper from #125. Each report has a new `*WidgetSettings.ts` module. It builds what **Save widget** writes and reads the saved widget with the same defaults the report opens with, so saving or changing a setting back clears the label.
2. **Formula text.** `formula` is part of the settings being compared (`Formula.tsx:168`). The test "is modified while the formula text is being edited" covers it.
3. **Saves from more than one place.**
   - **Balance Forecast** used to call the backend directly, which would have left the label stuck after saving. It now saves through `useUpdateDashboardWidgetMutation`, which refreshes the saved widget the label compares against.
   - **Monte Carlo** already saved that way from both places.
   - Both reports have unit tests under "when more than one place writes the widget", for renaming and for **Save widget**. `BalanceForecast.test.tsx` also checks in the UI that the label clears after saving.
4. **Feature flags.** No flag was changed; the edits are inside the report pages only.

**Open question:** it follows the proposed "yes". For Monte Carlo pots linked to an account, the starting balance (the account's live balance) is left out of the comparison, and a test checks that moving that balance doesn't set off the label.

**Gap:** the issue asks the owner to write up a design decision with alternatives, rationale and consequences. The commit message and code comments cover the "save through the mutation" decision, but nothing records the alternatives. That still needs to go in the issue or the PR.

**Tests:** all 95 tests in the 7 relevant files pass. Run them from PowerShell inside `C:\Users\sarag\actual-budget\packages\desktop-client`. When I ran them from Git Bash, which uses a lowercase `c:/` path, the same files failed with errors like "Cannot read properties of undefined (reading 'config')". The tests from #125, already on master, failed the same way, so the cause is the Windows setup, not this branch. I also ran `yarn install`, which only changed `node_modules`; the working tree is still clean. I didn't run `yarn typecheck`, `yarn lint`, or the app in a browser.

User:

11/18/2026

I manually confirmed these features:

- No label on open — the header should show just the widget name, no "(modified)"
- Label appears on change — tweak any setting (date range, grouping, etc.) and confirm "(modified)" appears next to the name
- Label clears on revert — change the setting back to its saved value and confirm the label disappears without saving
- Label clears on save — make a change, click "Save widget", confirm the label disappears and stays gone when you close and reopen the widget

Please fill out this review form.

| Criterion | Score (1–10) | Notes |
|---|---|---|
| Correctness — does the change do what the issue asked? | | |
| Test coverage — are tests present and meaningful? | | |
| Code quality — consistent style, clear naming, no unnecessary duplication | | |
| Documentation — inline comments and PR description are clear | | |
| AI transparency — if AI was used, is there evidence of human verification? | | |
| Overall — would you merge this as-is? | | |

Assistant:

11/18/2026

> Tool: Bash — Find the PR and release note for this branch

Written for: whoever reads this review on the PR or the course issue tracker.

| Criterion | Score (1–10) | Notes |
|---|---|---|
| Correctness: does the change do what the issue asked? | 9 | All five reports (Formula, Sankey, Budget Analysis, Balance Forecast, Monte Carlo) show "(modified)" when a setting that **Save widget** writes changes. The label clears when the setting is changed back or saved, and editing formula text counts as a change. Balance Forecast now saves through `useUpdateDashboardWidgetMutation`, so the label no longer stays stuck after saving. Monte Carlo leaves the live balances of account-linked pots out of the comparison, as the open question proposed. No feature flags were changed. A reviewer manually confirmed four behaviors: no label on open, the label appears on a change, it clears when the change is undone, and it clears on save and stays gone after reopening. One point off because the issue's Design section isn't filled in. |
| Test coverage: are tests present and meaningful? | 9 | There are 95 passing tests across 7 files. Each report has a settings test file that covers no change, a change, changing back, missing saved fields (which should match the defaults the report opens with), and saves from more than one place (criterion 3). `BalanceForecast.test.tsx` checks in the UI that the label clears after saving and reappears after a later change. Formula, Sankey, Budget Analysis and Monte Carlo have no UI-level tests, so their wiring was only checked by hand. Note: the tests fail with errors like "reading 'config'" when run from Git Bash with a lowercase `c:/` path. They pass when run from PowerShell inside `C:\…\packages\desktop-client`. The #125 tests already on master fail the same way, so this is a local Windows setup problem, not a defect in this change. |
| Code quality: consistent style, clear naming, no unnecessary duplication | 8 | It follows the #125 pattern consistently: a `build…WidgetSettings` function and a `toComparable…Settings` function per report, with `isWidgetModified` and `ReportWidgetTitle` reused. Removing the copied save code (`...currentSettings`) cuts duplication, and moving `getDefaultLayerRange` into `sankeyWidgetSettings.ts` is a sensible cleanup. `isReady` is handled properly where the saved settings load after the page opens (Budget Analysis's date range, Monte Carlo's selections). Minor points: `isReady: true` is hard-coded with a repeated comment in two reports, and `yarn typecheck` and `yarn lint` weren't run during this review. |
| Documentation: inline comments and PR description are clear | 7 | The commit message is clear and explains why every save has to go through the mutation and why linked-pot balances are left out. Inline comments explain the non-obvious choices, such as matching the defaults the report opens with and why `queriesVersion` matters in Formula. A release note is included. Gaps: the Design section the issue asks for, with at least two alternatives, the rationale and the consequences, isn't written anywhere visible. I couldn't check the PR description from here because `gh` isn't installed. |
| AI transparency: if AI was used, is there evidence of human verification? | 9 | The commit and PR titles have the `[AI]` prefix and Co-Authored-By lines. The AI session logs are committed (`1e40e6b70`). Human checks: the four behaviors above were confirmed by hand, and the unit tests were rerun and pass. To be complete, the PR should say which reports were checked by hand, including that the experimental flags were turned on for Sankey, Budget Analysis, Balance Forecast and Monte Carlo. |
| Overall: would you merge this as-is? | 8 | Yes, once the Design section is filled in, for example the choice between sending every save through the cached-widget mutation and comparing against a separately tracked "last saved" state, with the trade-offs. Also confirm `yarn typecheck` and `yarn lint` pass. The code itself is ready. |

User:

11/18/2026

Export this session into the path C:\Users\sarag\actual-budget\ai-logs\sprint3\sgstrick with the title 2026-11-18_claude-code_review-126.md

Assistant:

11/18/2026

> Tool: Bash — Check existing log format and target file

> Tool: Bash — View an existing claude-code review log format

> Tool: Bash — View how assistant turns and tool calls are formatted

> Tool: Write — ai-logs/sprint3/sgstrick/2026-11-18_claude-code_review-126.md

Exported the session to `ai-logs/sprint3/sgstrick/2026-11-18_claude-code_review-126.md`.
