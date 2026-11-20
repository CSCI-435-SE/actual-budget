# Sprint 3 Report

## Team

- **Team name:** The Budgeters
- **Project:** Actual Budget
- **Repository:** [github.com/CSCI-435-SE/actual-budget](https://github.com/CSCI-435-SE/actual-budget)

| Member              | GitHub username    |
| :------------------ | :----------------- |
| Liam McLemore       | TigerK9            |
| Isabella Sasso      | icsasso            |
| Bennett Matuszewski | bennettmatuszewski |
| Sara Strick         | sgstrick           |
| Reese Bryan         | RaccoonSwarm       |
| James Leonard       | jamesleonard3rd    |

## Deliverables Summary

| Deliverable                     | Where to find it                                                                                                                                                                       |
| :------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1 – Sprint backlog             | [Sprint 3 milestone](https://github.com/CSCI-435-SE/actual-budget/milestone/3) and [Sprint Backlog](#sprint-backlog)                                                                   |
| D2 – Requirements specification | Issue bodies, linked in the [Sprint Backlog](#sprint-backlog) table                                                                                                                    |
| D3 – Design decisions           | Design section of each issue or PR; summarized in [Requirements & Design](#requirements--design)                                                                                       |
| D4 – Pull requests              | [Completed Issues](#completed-issues)                                                                                                                                                  |
| D5 – AI logs                    | [`ai-logs/sprint3/`](https://github.com/CSCI-435-SE/actual-budget/tree/master/ai-logs/sprint3); summarized in [AI Tool Usage](#ai-tool-usage)                                          |
| D6 – Mutation testing           | [`docs/sprint3/mutation/`](https://github.com/CSCI-435-SE/actual-budget/tree/master/docs/sprint3/mutation); per-member links in [Mutation Testing and Check-ins](#mutation-testing-and-mid-sprint-check-ins) |
| D7 – Mid-sprint check-in        | [`docs/sprint3/checkin/`](https://github.com/CSCI-435-SE/actual-budget/tree/master/docs/sprint3/checkin); per-member links in [Mutation Testing and Check-ins](#mutation-testing-and-mid-sprint-check-ins) |
| D8 – Sprint report              | This file, including [Suite Health](#suite-health) and [Hardening Issues](#hardening-issues)                                                                                          |
| D9 – Sprint release             | [`v26.9.0-csci435-s3`](https://github.com/CSCI-435-SE/actual-budget/releases/tag/v26.9.0-csci435-s3)                                                                                                                     |

## Sprint Overview

Sprint 3's focus was test quality. At the start of the sprint, every member picked at least two medium issues, carryovers from Sprint 2 first: the color picker ([#67](https://github.com/CSCI-435-SE/actual-budget/issues/67)), the PDF export polish ([#97](https://github.com/CSCI-435-SE/actual-budget/issues/97)) and the "(modified)" label for report widgets ([#125](https://github.com/CSCI-435-SE/actual-budget/issues/125), [#126](https://github.com/CSCI-435-SE/actual-budget/issues/126)). The rest of the backlog leaned toward testing: a real sync-server test setup ([#160](https://github.com/CSCI-435-SE/actual-budget/issues/160), split into [#161](https://github.com/CSCI-435-SE/actual-budget/issues/161) and [#162](https://github.com/CSCI-435-SE/actual-budget/issues/162)), E2E and VRT coverage for the Manage Tags page ([#157](https://github.com/CSCI-435-SE/actual-budget/issues/157)), and a permanent workflow for updating VRT screenshots ([#153](https://github.com/CSCI-435-SE/actual-budget/issues/153)), which is also our hardening issue.

We also started the team feature, receipts and attachments on transactions ([#150](https://github.com/CSCI-435-SE/actual-budget/issues/150)). It was split into sub-issues: attaching on desktop ([#154](https://github.com/CSCI-435-SE/actual-budget/issues/154)), mobile, deletes and cleanup ([#155](https://github.com/CSCI-435-SE/actual-budget/issues/155)), find and export ([#156](https://github.com/CSCI-435-SE/actual-budget/issues/156)), and server storage and sync ([#180](https://github.com/CSCI-435-SE/actual-budget/issues/180)).

**What was delivered:** all 13 issues in the backlog were completed and their PRs merged, including the Sprint 2 carryover (#67).

- **New features:** "(modified)" labels on all 13 report widgets, duplicating rules, a transaction count on the Manage Tags page, attaching receipts to transactions on desktop and mobile (stored on the device for now), and a cleaner budget PDF export.
- **Testing:** a real sync-server test setup that runs two or more real clients against the real server, E2E and VRT tests for the Manage Tags page, and mutation testing (StrykerJS) on each member's PR.
- **Infrastructure:** a reusable "Update VRT screenshots" workflow, so we no longer add and remove a temporary workflow on each PR.

**Scope changes:**

- **#154 and #155 were rescoped to device-only storage** (#154 on Nov 13). Uploading attachments to the sync server and syncing them across devices was too much for one sprint, so it moved to [#180](https://github.com/CSCI-435-SE/actual-budget/issues/180) for Sprint 4.
- **#162's offline catch-up scenario uses 150 accounts instead of the 500 in the spec**, and the case that goes over the server's upload limit is skipped because it found a real bug ([#186](https://github.com/CSCI-435-SE/actual-budget/issues/186)).

## Sprint 2 Carryovers & What Changed

### Sprint 2 carryovers

| Sprint 2 item                                                                                                       | What happened in Sprint 3                                                                                                                                                                                                                                                                                         |
| :------------------------------------------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Custom color wheel ([#67](https://github.com/CSCI-435-SE/actual-budget/issues/67)), changes requested on PR #144    | **Carried over and merged.** icsasso addressed the review and [PR #144](https://github.com/CSCI-435-SE/actual-budget/pull/144) merged on Nov 8.                                                                                                                                                                  |
| PDF export polish ([#97](https://github.com/CSCI-435-SE/actual-budget/issues/97))                                   | **Done.** Merged in [PR #176](https://github.com/CSCI-435-SE/actual-budget/pull/176).                                                                                                                                                                                                                            |
| "(modified)" label on report widgets ([#125](https://github.com/CSCI-435-SE/actual-budget/issues/125), [#126](https://github.com/CSCI-435-SE/actual-budget/issues/126)) | **Done.** Merged in [PR #163](https://github.com/CSCI-435-SE/actual-budget/pull/163) (8 reports) and [PR #173](https://github.com/CSCI-435-SE/actual-budget/pull/173) (the other 5).                                                                              |
| Reliable way to update VRT screenshots                                                                              | **Done.** Written up as [#153](https://github.com/CSCI-435-SE/actual-budget/issues/153) and merged in [PR #164](https://github.com/CSCI-435-SE/actual-budget/pull/164). Teammates used it on their own PRs this sprint.                                                                                           |
| Screenshot tests for new UI that didn't have them                                                                   | **Partly done.** [#157](https://github.com/CSCI-435-SE/actual-budget/issues/157) added E2E and VRT tests for the Manage Tags page, covering the Sprint 2 hex field (#66) and color picker (#67).                                                                                                                 |
| Narrow-viewport layout bug ([#139](https://github.com/CSCI-435-SE/actual-budget/issues/139))                        | **Not done; carries over to Sprint 4.** Still open. Our attention went to the Sprint 2 carryovers, the team feature and testing work. |
| Issues to bring our UI changes in line with the "impeccable" design guidelines                                      | **Not done.** We put finishing the receipts feature and the hardening issues ahead of it, so it is not in the Sprint 4 plan. |

### What changed from Sprint 2

- **Mutation testing.** Each member ran StrykerJS on the source files changed by one of their PRs, analyzed every survivor and added tests to kill the real gaps (see [Mutation Testing](#mutation-testing-and-mid-sprint-check-ins)). Bennett set up the shared Stryker config in [PR #163](https://github.com/CSCI-435-SE/actual-budget/pull/163).
- **Test Evidence in every PR.** PR descriptions now map each acceptance criterion to the test or manual check that covers it.
- **Updating screenshots is one click.** The temporary workflow from Sprint 2 was replaced by a permanent "Update VRT screenshots" workflow ([PR #164](https://github.com/CSCI-435-SE/actual-budget/pull/164)).
- **Large issues are split into sub-issues.** The team feature (#150) and the sync tests (#160) were each broken into medium sub-issues with their own owner and spec.
- **Reviews still caught real problems.** Reviewers requested changes on PRs [#144](https://github.com/CSCI-435-SE/actual-budget/pull/144), [#166](https://github.com/CSCI-435-SE/actual-budget/pull/166), [#171](https://github.com/CSCI-435-SE/actual-budget/pull/171), [#175](https://github.com/CSCI-435-SE/actual-budget/pull/175), [#181](https://github.com/CSCI-435-SE/actual-budget/pull/181), [#182](https://github.com/CSCI-435-SE/actual-budget/pull/182) and [#189](https://github.com/CSCI-435-SE/actual-budget/pull/189) before approving.

## Sprint Backlog

**Milestone:** [Sprint 3 milestone](https://github.com/CSCI-435-SE/actual-budget/milestone/3)

**How we read the columns.** _Owner_ is the person who created the issue and wrote its scope, requirements and estimate. _Assigned to_ is the person who implemented it. If the spec was missing details, the assignee added them before coding.

**Story points.** We use a 1–10 scale: 1–2 is small, 3–7 is medium and 8–10 is large. As in Sprint 2, each issue's owner estimated it on their own, and a few issues were scoped by the whole team.

**Backlog rationale.**

- **Sprint 2 carryovers first.** #67, #97, #125 and #126 went into the backlog before any new work.
- **Scope minimum.** Each member then took at least 2 medium issues.
- **Team feature.** The receipts feature (#150) is large, so it was split into medium sub-issues. James took the first two (#154, #155) this sprint. Find and export (#156) and server storage and sync (#180) are planned for Sprint 4.
- **Hardening.** #153 replaces the manual screenshot process from Sprint 2 (see [Hardening Issues](#hardening-issues)).

| Issue                                                                                                                              | Owner              | Assigned to        | Points | Scope  | PR                                                            | Status          |
| :--------------------------------------------------------------------------------------------------------------------------------- | :----------------- | :----------------- | :----- | :----- | :------------------------------------------------------------ | :-------------- |
| Add custom color wheel to color picker ([#67](https://github.com/CSCI-435-SE/actual-budget/issues/67)) – _Sprint 2 carryover_     | bennettmatuszewski | icsasso            | 5      | Medium | [#144](https://github.com/CSCI-435-SE/actual-budget/pull/144) | Merged          |
| Improve PDF export formatting/data view ([#97](https://github.com/CSCI-435-SE/actual-budget/issues/97))                            | jamesleonard3rd    | TigerK9            | 4      | Medium | [#176](https://github.com/CSCI-435-SE/actual-budget/pull/176) | Merged          |
| Add a reusable workflow to regenerate VRT screenshots for a PR ([#153](https://github.com/CSCI-435-SE/actual-budget/issues/153)) – _hardening_ | icsasso | TigerK9            | 5      | Medium | [#164](https://github.com/CSCI-435-SE/actual-budget/pull/164) | Merged          |
| Show a "(modified)" label on the standard report widgets ([#125](https://github.com/CSCI-435-SE/actual-budget/issues/125))         | TigerK9            | bennettmatuszewski | 6      | Medium | [#163](https://github.com/CSCI-435-SE/actual-budget/pull/163) | Merged          |
| Show a "(modified)" label on the Formula and experimental report widgets ([#126](https://github.com/CSCI-435-SE/actual-budget/issues/126)) | TigerK9    | bennettmatuszewski | 4      | Medium | [#173](https://github.com/CSCI-435-SE/actual-budget/pull/173) | Merged          |
| Add "Tag Usage Count" column to Tags Page ([#148](https://github.com/CSCI-435-SE/actual-budget/issues/148))                        | bennettmatuszewski | icsasso            | 6      | Medium | [#178](https://github.com/CSCI-435-SE/actual-budget/pull/178) | Merged          |
| Show transaction count and last-used date on the Payees page ([#149](https://github.com/CSCI-435-SE/actual-budget/issues/149))     | bennettmatuszewski | icsasso            | 6      | Medium | [#189](https://github.com/CSCI-435-SE/actual-budget/pull/189) | Merged          |
| Add e2e and VRT coverage for the Manage Tags page ([#157](https://github.com/CSCI-435-SE/actual-budget/issues/157))                | icsasso            | RaccoonSwarm       | 6      | Medium | [#166](https://github.com/CSCI-435-SE/actual-budget/pull/166) | Merged          |
| Add ability to duplicate rules ([#159](https://github.com/CSCI-435-SE/actual-budget/issues/159))                                   | sgstrick           | RaccoonSwarm       | 4      | Medium | [#181](https://github.com/CSCI-435-SE/actual-budget/pull/181) | Merged          |
| Build the test setup for sync server testing ([#161](https://github.com/CSCI-435-SE/actual-budget/issues/161)) – _sub-issue of [#160](https://github.com/CSCI-435-SE/actual-budget/issues/160)_ | RaccoonSwarm | sgstrick | 5      | Medium | [#171](https://github.com/CSCI-435-SE/actual-budget/pull/171) | Merged |
| Add testing scenarios for real sync testing ([#162](https://github.com/CSCI-435-SE/actual-budget/issues/162)) – _sub-issue of #160_ | RaccoonSwarm      | sgstrick           | 5      | Medium | [#187](https://github.com/CSCI-435-SE/actual-budget/pull/187) | Merged          |
| Attach and view receipts on a transaction (desktop) ([#154](https://github.com/CSCI-435-SE/actual-budget/issues/154)) – _sub-issue of [#150](https://github.com/CSCI-435-SE/actual-budget/issues/150)_ | jamesleonard3rd | jamesleonard3rd | 6      | Medium | [#175](https://github.com/CSCI-435-SE/actual-budget/pull/175) | Merged |
| Mobile support, deletes and cleanup for attachments ([#155](https://github.com/CSCI-435-SE/actual-budget/issues/155)) – _sub-issue of #150_ | jamesleonard3rd | jamesleonard3rd | 4      | Medium | [#182](https://github.com/CSCI-435-SE/actual-budget/pull/182) | Merged |

**Issues per member:**

| Member             | Issues implemented                                             |
| :----------------- | :------------------------------------------------------------- |
| TigerK9            | #97, #153 (medium)                                             |
| icsasso            | #67 (Sprint 2 carryover), #148, #149 (medium)                  |
| bennettmatuszewski | #125, #126 (medium)                                            |
| sgstrick           | #161, #162 (medium)                                            |
| RaccoonSwarm       | #157, #159 (medium)                                            |
| jamesleonard3rd    | #154, #155 (medium)                                            |

## Requirements & Design

**Were specs complete before coding?** For most issues, yes. Each had a user story, acceptance criteria, out-of-scope list and rough scope before work began, and each got a spec-review comment. The exceptions were the team feature, whose parent issue (#150) started with open questions that had to be answered in the sub-issues, and #157 and #159, whose design questions were left open in the issue.

**Surprises:**

- **Receipts were bigger than one sprint.** Storing files on the sync server and syncing them between devices needed new server endpoints, upload handling and access checks. #154 and #155 were rescoped to device-only storage, and the server work became [#180](https://github.com/CSCI-435-SE/actual-budget/issues/180).
- **Stryker's Vitest runner didn't work with our version of Vitest.** It reported every mutant as surviving. Bennett switched to Stryker's command runner in [PR #163](https://github.com/CSCI-435-SE/actual-budget/pull/163), and the rest of the team reused that config.
- **New tests found real bugs.** The offline catch-up scenario in #162 found that a device with too many offline changes can never catch up, because its upload goes over the server's 20 MB limit ([#186](https://github.com/CSCI-435-SE/actual-budget/issues/186)). The Manage Tags E2E tests found that pressing Enter in a new tag's description drops it ([#183](https://github.com/CSCI-435-SE/actual-budget/issues/183)). Testing the VRT workflow surfaced a flaky budget-page E2E test ([#165](https://github.com/CSCI-435-SE/actual-budget/issues/165)).
- **Reports compare against relative date ranges.** Comparing the dates a range resolves to would make every report show "(modified)" as soon as a new month starts, so #125 compares the range setting instead.

**Key design decisions.** Full details, including consequences, are in each linked issue or PR.

| Issue / PR | Decision | Alternatives considered | Why |
| :--------- | :------- | :---------------------- | :-- |
| [#67](https://github.com/CSCI-435-SE/actual-budget/issues/67) / [PR 144](https://github.com/CSCI-435-SE/actual-budget/pull/144) (icsasso) | Preview colors live, but save only when a change settles. | Debounce saves to about 150 ms; add an Apply/Cancel button. | Exactly one save per change. Debouncing still records in-between colors, and a button adds an extra click. |
| [#97](https://github.com/CSCI-435-SE/actual-budget/issues/97) / [PR 176](https://github.com/CSCI-435-SE/actual-budget/pull/176) (TigerK9) | Replace characters the PDF font can't draw before they reach the PDF library, and merge the group and category columns into one. | Embed a Unicode font; write a PDF-only number formatter; keep a blank group column or merge cells with `rowSpan`. | A font adds about 150–300 KB to the bundle, and a second formatter could drift from the app's. One column removes the repeated group names without table tricks. |
| [#153](https://github.com/CSCI-435-SE/actual-budget/issues/153) / [PR 164](https://github.com/CSCI-435-SE/actual-budget/pull/164) (TigerK9) | A new manually started workflow that regenerates screenshots for a PR, starts E2E on the new commit itself, and keeps pushing in a separate job. | Adapt upstream's `/update-vrt` bot; keep a temporary workflow per PR; use a personal access token to trigger CI. | Upstream's bot needs edits to upstream files and can only be tested on `master`. A temporary workflow could be merged by accident. No secret or manual step is needed. |
| [#125](https://github.com/CSCI-435-SE/actual-budget/issues/125) / [PR 163](https://github.com/CSCI-435-SE/actual-budget/pull/163) (bennettmatuszewski) | Compare the report's current settings with the saved widget, built by the same function "Save widget" uses, and compare date-range settings rather than the dates they resolve to. | A "touched" flag; a prompt when leaving the page; comparing resolved dates or the stored time frame. | A flag stays on after the user changes a setting back. A prompt needs router changes. Resolved dates would show "(modified)" every new month. |
| [#126](https://github.com/CSCI-435-SE/actual-budget/issues/126) / [PR 173](https://github.com/CSCI-435-SE/actual-budget/pull/173) (bennettmatuszewski) | Compare against the saved widget in the query cache, and make every save go through the same cache update. Monte Carlo compares only what the user entered. | Keep a local "last saved" copy; write to the cache optimistically; compare every Monte Carlo value. | With the other options, every place that saves has to remember to update the copy. Monte Carlo's computed values change on their own. |
| [#148](https://github.com/CSCI-435-SE/actual-budget/issues/148) / [PR 178](https://github.com/CSCI-435-SE/actual-budget/pull/178) (icsasso) | Count tag usage in one pass, using a shared tag-matching pattern so counts match "View Transactions". | One query per tag; a separate tag tokenizer. | One query per tag is slow and counts split transactions differently. A tokenizer would be a second copy of the matching rules that could drift. |
| [#149](https://github.com/CSCI-435-SE/actual-budget/issues/149) / [PR 189](https://github.com/CSCI-435-SE/actual-budget/pull/189) (icsasso) | Two queries over the same data that always reload together. | One combined server call; work out "unused" on the client; count from a different query. | Keeps the existing unused-payees query unchanged. The two can briefly disagree, which is recorded as tech debt. |
| [#161](https://github.com/CSCI-435-SE/actual-budget/issues/161) / [PR 171](https://github.com/CSCI-435-SE/actual-budget/pull/171) (sgstrick) | Run each test device in its own worker thread, using the bundled `@actual-app/api`, with the tests in `sync-server/integration-tests`. | Reset modules between devices; a child process per device; a new workspace for the tests. | Workers are isolated by design and start quickly. A new workspace changes `yarn.lock`, which triggers a check that can't run in our fork. |
| [#162](https://github.com/CSCI-435-SE/actual-budget/issues/162) / [PR 187](https://github.com/CSCI-435-SE/actual-budget/pull/187) (sgstrick) | Use 150 accounts for the offline catch-up scenario, and skip the over-the-limit case until #186 is fixed. | 500 accounts, as in the spec; about 23,500 accounts to reach the upload limit. | 150 accounts tests catching up without making the suite slow. The over-limit case fails because of a real bug, now tracked in #186. |
| [#154](https://github.com/CSCI-435-SE/actual-budget/issues/154) / [PR 175](https://github.com/CSCI-435-SE/actual-budget/pull/175) (jamesleonard3rd) | Store attachments on this device only, and attach them to the parent of a split transaction. | Sync the attachment rows but not the files; upload files to the server now; allow attachments on split children. | Uploading was too much for one sprint, and syncing rows without files would show attachments that can't be opened. Attachments on the parent survive splitting and unsplitting. |
| [#155](https://github.com/CSCI-435-SE/actual-budget/issues/155) / [PR 182](https://github.com/CSCI-435-SE/actual-budget/pull/182) (jamesleonard3rd) | Undo a removed attachment from the notification, and remove unused files 30 days after their transaction is deleted, when the budget opens. | Put removals on the app's undo stack; work out delete times from sync messages; run cleanup on a timer. | The undo stack would need sync messages, which attachments don't have yet. A grace period keeps files that a slow sync might still need. |

## Completed Issues

| Issue | Owner | PR | Author | Reviewer(s) | Status | Description |
| :---- | :---- | :- | :----- | :---------- | :----- | :---------- |
| Add custom color wheel to color picker ([#67](https://github.com/CSCI-435-SE/actual-budget/issues/67)) | bennettmatuszewski | [#144](https://github.com/CSCI-435-SE/actual-budget/pull/144) | icsasso | sgstrick | Closed and Merged | Sprint 2 carryover. Clicking the color preview opens a saturation/brightness area and a hue slider, kept in sync with the swatches and hex field, so users can pick any tag color by eye. |
| Improve PDF export formatting/data view ([#97](https://github.com/CSCI-435-SE/actual-budget/issues/97)) | jamesleonard3rd | [#176](https://github.com/CSCI-435-SE/actual-budget/pull/176) | TigerK9 | bennettmatuszewski | Closed and Merged | Fixes stray `*` and `,` characters in amounts, repeated group names and cut-off totals in the budget PDF. Adds a 4-column layout, a header on every page and a "Page N of M" footer. |
| Add a reusable workflow to regenerate VRT screenshots for a PR ([#153](https://github.com/CSCI-435-SE/actual-budget/issues/153)) | icsasso | [#164](https://github.com/CSCI-435-SE/actual-budget/pull/164) | TigerK9 | bennettmatuszewski | Closed and Merged | Adds an "Update VRT screenshots" workflow that is started with a PR number. It regenerates screenshots in CI's own container, pushes only the changed images, and starts E2E on the new commit. This replaces upstream's `/update-vrt` bot, which can't run in our fork. |
| Show a "(modified)" label on the standard report widgets ([#125](https://github.com/CSCI-435-SE/actual-budget/issues/125)) | TigerK9 | [#163](https://github.com/CSCI-435-SE/actual-budget/pull/163) | bennettmatuszewski | TigerK9 | Closed and Merged | Adds a shared way for a report to tell whether its settings differ from the saved widget, and a "(modified)" label matching the one Custom Reports use. Wired into eight reports: Net Worth, Cash Flow, Spending, Summary, Crossover, Age of Money, Calendar and Goal. |
| Show a "(modified)" label on the Formula and experimental report widgets ([#126](https://github.com/CSCI-435-SE/actual-budget/issues/126)) | TigerK9 | [#173](https://github.com/CSCI-435-SE/actual-budget/pull/173) | bennettmatuszewski | sgstrick | Closed and Merged | Uses the helper and label from #125 on the five remaining reports: Formula, Sankey, Budget Analysis, Balance Forecast and Monte Carlo. The last four are experimental and only appear when their feature flag is on. |
| Add "Tag Usage Count" column to Tags Page ([#148](https://github.com/CSCI-435-SE/actual-budget/issues/148)) | bennettmatuszewski | [#178](https://github.com/CSCI-435-SE/actual-budget/pull/178) | icsasso | sgstrick | Closed and Merged | Adds a Transactions column to the Manage Tags page, so unused tags are easy to spot. Counts match what "View Transactions" shows for the tag. |
| Show transaction count and last-used date on the Payees page ([#149](https://github.com/CSCI-435-SE/actual-budget/issues/149)) | bennettmatuszewski | [#189](https://github.com/CSCI-435-SE/actual-budget/pull/189) | icsasso | jamesleonard3rd | Closed and Merged | Adds Transactions and Last Used columns to the Payees page. The counts reload together with the unused-payees list, which also fixes cases where that list didn't refresh after undo or merge. |
| Add e2e and VRT coverage for the Manage Tags page ([#157](https://github.com/CSCI-435-SE/actual-budget/issues/157)) | icsasso | [#166](https://github.com/CSCI-435-SE/actual-budget/pull/166) | RaccoonSwarm | icsasso | Closed and Merged | Adds 8 E2E tests and 6 screenshots for the Manage Tags page, covering creating a tag and editing its color, including the hex field (#66) and color picker (#67). Regressions in these flows are now caught in CI. |
| Add ability to duplicate rules ([#159](https://github.com/CSCI-435-SE/actual-budget/issues/159)) | sgstrick | [#181](https://github.com/CSCI-435-SE/actual-budget/pull/181) | RaccoonSwarm | TigerK9 | Closed and Merged | Adds a Duplicate button to the Rules page when one rule is selected. It opens the rule editor filled in with a copy of the rule, which saves as a new rule and leaves the original unchanged. |
| Build the test setup for sync server testing ([#161](https://github.com/CSCI-435-SE/actual-budget/issues/161)) | RaccoonSwarm | [#171](https://github.com/CSCI-435-SE/actual-budget/pull/171) | sgstrick | TigerK9 | Closed and Merged | Adds a test setup that runs the real sync server and two or more real clients ("devices") in one test, with helpers to change, sync and compare devices. Before this, no test ran a real client against a real server. |
| Add testing scenarios for real sync testing ([#162](https://github.com/CSCI-435-SE/actual-budget/issues/162)) | RaccoonSwarm | [#187](https://github.com/CSCI-435-SE/actual-budget/pull/187) | sgstrick | jamesleonard3rd | Closed and Merged | Adds six multi-device scenarios on the #161 setup: basic sync, a same-field conflict, edits to different records, offline catch-up, a sync reset, and an encrypted budget (including a wrong password). Each ends by checking the devices match. |
| Attach and view receipts on a transaction (desktop) ([#154](https://github.com/CSCI-435-SE/actual-budget/issues/154)) | jamesleonard3rd | [#175](https://github.com/CSCI-435-SE/actual-budget/pull/175) | jamesleonard3rd | RaccoonSwarm | Closed and Merged | Users can attach images or PDFs (up to 10 MB) to a transaction, see a paperclip in the transaction list, and view or remove the files. Files are stored on this device only for now. |
| Mobile support, deletes and cleanup for attachments ([#155](https://github.com/CSCI-435-SE/actual-budget/issues/155)) | jamesleonard3rd | [#182](https://github.com/CSCI-435-SE/actual-budget/pull/182) | jamesleonard3rd | RaccoonSwarm | Closed and Merged | Adds attachments to the mobile layout, including a camera button. A removed attachment can be undone from the notification, attachments move with merged transactions, and unused files are removed 30 days after their transaction is deleted. |

## Test Strategy

Sprint 3 was about test quality, so most PRs added more than one kind of test, and each PR's **Test Evidence** section maps every acceptance criterion to the test or manual check that covers it. Over the sprint the unit and integration suites grew from 3,909 to 4,385 passing tests, and the browser E2E suite from 163 to 183 (see [Suite Health](#suite-health)).

**Kinds of tests written:**

- **Unit and component tests (Vitest)** were still the most common.
  - [PR #163](https://github.com/CSCI-435-SE/actual-budget/pull/163) adds `widgetModified.test.ts` and a settings test for each of the 8 reports, plus component tests for Net Worth and Goal. [PR #173](https://github.com/CSCI-435-SE/actual-budget/pull/173) adds 76 unit tests for the other 5 reports and a `BalanceForecast` component test.
  - [PR #176](https://github.com/CSCI-435-SE/actual-budget/pull/176) adds `pdfText.test.ts` and rewrites the PDF tests to check the generated PDF's content: 73 export tests in total.
  - [PR #178](https://github.com/CSCI-435-SE/actual-budget/pull/178) adds 7 tag-matching tests, 10 tests against a real SQLite database (including a cross-check against the real "View Transactions" query), and 3 component tests.
  - [PR #189](https://github.com/CSCI-435-SE/actual-budget/pull/189) adds 17 server and helper tests for the payee counts.
  - [PR #175](https://github.com/CSCI-435-SE/actual-budget/pull/175) and [PR #182](https://github.com/CSCI-435-SE/actual-budget/pull/182) test attachment storage, validation, cleanup (19 tests), merging and both attachment windows, on desktop and mobile.
  - [PR #181](https://github.com/CSCI-435-SE/actual-budget/pull/181) adds 4 unit tests for copying a rule.
  - [PR #164](https://github.com/CSCI-435-SE/actual-budget/pull/164) adds 37 tests for the VRT workflow's scripts, including integration tests that read the workflow file itself.
- **Integration tests against a real sync server.** [PR #171](https://github.com/CSCI-435-SE/actual-budget/pull/171) built a setup that starts the real sync server and two or more real clients, each in its own worker thread (13 tests). [PR #187](https://github.com/CSCI-435-SE/actual-budget/pull/187) adds the scenarios on top of it: basic sync, a same-field conflict, edits to different records, offline catch-up, a sync reset and an encrypted budget (31 passing, 1 skipped for [#186](https://github.com/CSCI-435-SE/actual-budget/issues/186)). Before this, client sync tests only ran against a mocked server.
- **End-to-end tests (Playwright).** [PR #166](https://github.com/CSCI-435-SE/actual-budget/pull/166) adds 8 tests for the Manage Tags page and a reusable page model. [PR #181](https://github.com/CSCI-435-SE/actual-budget/pull/181) adds 2 for duplicating rules, [PR #176](https://github.com/CSCI-435-SE/actual-budget/pull/176) 1 for the PDF export, and [PR #175](https://github.com/CSCI-435-SE/actual-budget/pull/175) / [PR #182](https://github.com/CSCI-435-SE/actual-budget/pull/182) desktop and mobile attachment tests.
- **Visual regression tests (VRT).** [PR #166](https://github.com/CSCI-435-SE/actual-budget/pull/166) adds 6 screenshots of the Manage Tags page (2 states × 3 themes). PRs that changed the UI regenerated their screenshots with the new workflow from [PR #164](https://github.com/CSCI-435-SE/actual-budget/pull/164).
- **Mutation testing (StrykerJS).** Each member ran Stryker on the source files changed by one of their PRs, sorted every survivor into "equivalent" or "test gap", and added tests to kill the gaps (see [Mutation Testing](#mutation-testing-and-mid-sprint-check-ins)). For example, #125 went from 88.62% to 100% and #97 from 75.15% to 90.53%. Several members also checked their AI-written tests by breaking the code on purpose and confirming the tests failed.

**What we couldn't test automatically, and why:**

- **GitHub workflows ([PR #164](https://github.com/CSCI-435-SE/actual-budget/pull/164)).** Starting a workflow, pushing a commit and triggering CI only happen on GitHub, so they were tested with real runs on a fork before merging.
- **How things look.** Whether the PDF export looks right ([PR #176](https://github.com/CSCI-435-SE/actual-budget/pull/176)) needs a person; a pixel comparison would need an extra PDF-rendering library. Styling checks on the Tags page ([PR #178](https://github.com/CSCI-435-SE/actual-budget/pull/178)) can't run in jsdom, which doesn't calculate styles.
- **Full report pages.** Page-level tests for most reports in [PR #163](https://github.com/CSCI-435-SE/actual-budget/pull/163) and [PR #173](https://github.com/CSCI-435-SE/actual-budget/pull/173) would need large mocks of the charts and spreadsheet queries, so those reports were checked by hand in the browser.
- **Real phones and Electron ([PR #175](https://github.com/CSCI-435-SE/actual-budget/pull/175), [PR #182](https://github.com/CSCI-435-SE/actual-budget/pull/182)).** The camera, iOS Safari, HEIC photos and Electron's file dialogs can't run in CI. Headless Chromium has no PDF viewer, so the E2E test compares the downloaded file instead.
- **The over-the-limit sync case ([PR #187](https://github.com/CSCI-435-SE/actual-budget/pull/187)).** It fails because of a real bug ([#186](https://github.com/CSCI-435-SE/actual-budget/issues/186)), and reaching the limit takes about 16 minutes, so it is skipped with a linked issue.

**Every PR was also tested by hand** in the running app, and reviewers repeated those checks. Reviewers requested changes on 7 PRs before approving.

## Suite Health

**How we ran it.** We checked out the Sprint 2 tag ([`v26.9.0-csci435-s2`](https://github.com/CSCI-435-SE/actual-budget/releases/tag/v26.9.0-csci435-s2), commit `5207c14b5`) in a separate worktree, ran `yarn install --immutable`, and ran every Vitest package in the repo, since this sprint's PRs touched most of them (`loot-core`, `desktop-client`, `sync-server`, `api` and CI scripts). We ran the suite twice: once through lage like CI (`CI=true yarn test:debug --concurrency 4`), and once one package at a time (`CI=true yarn workspace <package> run test`). At the end of the sprint we ran the same per-package commands at the release tag ([`v26.9.0-csci435-s3`](https://github.com/CSCI-435-SE/actual-budget/releases/tag/v26.9.0-csci435-s3), commit `6d7898f92`), after `yarn build:api`, because the new sync-server integration tests run against the built API bundle. E2E and VRT need CI's Playwright container, so we used CI results for those.

### Baseline table

| Suite | Command / CI workflow | At `v26.9.0-csci435-s2` | End of Sprint 3 |
| :---- | :-------------------- | :---------------------- | :-------------- |
| `@actual-app/core` (loot-core) | `yarn workspace @actual-app/core run test` | 1292 passed, 0 failed, 2 skipped (two Vitest projects: 11 + 1281 passed) | 1433 passed, 0 failed, 2 skipped (two Vitest projects: 14 + 1419 passed) |
| `@actual-app/web` (desktop-client) | `yarn workspace @actual-app/web run test` | 1545 passed, 0 failed, 1 skipped | 1842 passed, 0 failed, 1 skipped |
| `@actual-app/sync-server` | `yarn workspace @actual-app/sync-server run test` | 606 passed, 0 failed, 0 skipped | 637 passed, 0 failed, 1 skipped (606 unit + 31 integration; the skip is linked to #186) |
| `@actual-app/api` | `yarn workspace @actual-app/api run test` | 29 passed, 0 failed, 0 skipped | 29 passed, 0 failed, 0 skipped |
| `@actual-app/components` | `yarn workspace @actual-app/components run test` | 25 passed, 0 failed, 0 skipped | 32 passed, 0 failed, 0 skipped |
| `@actual-app/crdt` | `yarn workspace @actual-app/crdt run test` | 20 passed, 0 failed, 0 skipped | 20 passed, 0 failed, 0 skipped |
| `@actual-app/cli` | `yarn workspace @actual-app/cli run test` | 186 passed, 0 failed, 0 skipped | 186 passed, 0 failed, 0 skipped |
| `@actual-app/ci-actions` | `yarn workspace @actual-app/ci-actions run test` | 31 passed, 0 failed, 0 skipped | 31 passed, 0 failed, 0 skipped |
| `eslint-plugin-actual` | `yarn workspace eslint-plugin-actual run test` | 175 passed, 0 failed, 0 skipped | 175 passed, 0 failed, 0 skipped |
| All unit tests (CI) | `Test` workflow, `test` job (`yarn test`) | Passed ([run 40991097998](https://github.com/CSCI-435-SE/actual-budget/actions/runs/40991097998)) | Passed ([run 44625614051](https://github.com/CSCI-435-SE/actual-budget/actions/runs/44625614051)) |
| Functional E2E (CI) | `E2E Tests` workflow, Functional (3 shards): `yarn e2e --shard=N/3` | 163 passed, 0 failed, 0 skipped (58 + 64 + 41; [run on PR #140](https://github.com/CSCI-435-SE/actual-budget/actions/runs/40930568172), the last code PR in the tag) | 183 passed, 0 failed, 0 skipped, **1 flaky** (63 + 67 + 53; [run on PR #192](https://github.com/CSCI-435-SE/actual-budget/actions/runs/44623514376), the release commit) |
| Visual regression (CI) | `E2E Tests` workflow, Visual regression (3 shards): `yarn vrt --shard=N/3` | 162 passed, 0 failed, 0 skipped, **1 flaky** (58 + 63 + 41; [same run](https://github.com/CSCI-435-SE/actual-budget/actions/runs/40930568172)) | 184 passed, 0 failed, 0 skipped (63 + 67 + 54; [same run](https://github.com/CSCI-435-SE/actual-budget/actions/runs/44623514376)) |
| Desktop app E2E (CI) | `E2E Tests` workflow, Functional Desktop App | 4 passed, 0 failed, 0 skipped ([same run](https://github.com/CSCI-435-SE/actual-budget/actions/runs/40930568172)) | 3 passed, 0 failed, 0 skipped, **1 flaky** ([same run](https://github.com/CSCI-435-SE/actual-budget/actions/runs/44623514376)) |

### Failures grouped by cause

| Cause | Affected tests | Issue |
| :---- | :------------- | :---- |
| **Flaky, already present at the Sprint 2 tag.** The test failed on its first try and passed on Playwright's automatic retry, so CI still passed. After resizing the window below the small breakpoint, the budget page sometimes stays in the desktop layout. | `e2e/budget.test.ts:466` › "Budget responsive layout › switches to the mobile layout below the small breakpoint" (Visual regression shard 2/3 at the Sprint 2 tag; it passed in the Sprint 3 run) | [#165](https://github.com/CSCI-435-SE/actual-budget/issues/165) |
| **Flaky, introduced by our team this sprint.** The test was added in [PR #166](https://github.com/CSCI-435-SE/actual-budget/pull/166). It failed on its first try and passed on retry. PR #166's tech debt already notes that the hue-slider test is fragile: it finds the picker by what it contains and does not check an exact color. | `e2e/tags.test.ts:120` › "Tags › recolors a tag with the hue slider and keeps it after a reload" (Functional shard 3/3) | [#194](https://github.com/CSCI-435-SE/actual-budget/issues/194) |
| **Flaky, upstream test, cause not yet known.** It passed at the Sprint 2 tag. None of our Sprint 3 PRs changed onboarding, so it is most likely an unstable screenshot check in Electron, but we have not confirmed that with repeated runs. | `e2e/onboarding.test.ts:14` › "Onboarding › checks the page visuals" (Desktop App) | [#195](https://github.com/CSCI-435-SE/actual-budget/issues/195) |

Apart from that flaky test, **no test failed at the Sprint 2 tag**, either in CI or when each package ran on its own. In the parallel lage run, 3 tests in `api`, `web` and `core` timed out, because 4 packages were sharing a dev container with about 7 GB of RAM. All three passed when their package ran alone. That was a limit of the machine, not of the tests, so we didn't file an issue for it.

**At the end of the sprint, no test failed outright.** One test our team added (`tags.test.ts:120`) is flaky. It passes on retry, so CI is green, but it is a problem we introduced. We did not fix it before the sprint ended, so it is tracked in [#194](https://github.com/CSCI-435-SE/actual-budget/issues/194) as the first hardening item for Sprint 4. The unit and integration suites grew from 3,909 to 4,385 passing tests (+476): `desktop-client` +297, `loot-core` +141, the new sync-server integration tests +31 and `components` +7.

### Skipped tests and disabled CI checks

- **Skipped at the Sprint 2 tag (all from upstream, not our team):** `sync.property.test.ts` › "should always sync clients into the same state" and "should run a counterexample that needs to be fixed", and `TransactionsTable.test.tsx` › "dropdown invalid value resets correctly".
- **Added this sprint:** one. [PR #187](https://github.com/CSCI-435-SE/actual-budget/pull/187) skips the over-the-limit case in `offlineCatchUp.test.ts`, because it fails on a real bug: a device with more than 20 MB of offline changes can never catch up. The code comment links [#186](https://github.com/CSCI-435-SE/actual-budget/issues/186), explains why it fails, and explains why it is skipped rather than marked as failing (reaching the limit takes about 16 minutes).
- **Exemptions added to CI checks:** knip, which runs in CI, fails on files that nothing imports. Each member's Stryker config is only run by hand for mutation testing, so knip flagged them as unused. Instead of turning knip off, each config was listed as an entry in [`knip.json`](https://github.com/CSCI-435-SE/actual-budget/blob/master/knip.json): `desktop-client` configs for #125 ([PR #163](https://github.com/CSCI-435-SE/actual-budget/pull/163)), #97 ([PR #176](https://github.com/CSCI-435-SE/actual-budget/pull/176)) and #149 ([PR #189](https://github.com/CSCI-435-SE/actual-budget/pull/189)), and the `loot-core` config for #154 ([PR #192](https://github.com/CSCI-435-SE/actual-budget/pull/192), commit [`dded805be`](https://github.com/CSCI-435-SE/actual-budget/commit/dded805be), "Fix CI tests"). knip still checks everything else. These course-only files are tech debt: they should be removed, or moved into one shared config, before any upstream contribution.
- **Disabled CI checks:** none this sprint. [PR #171](https://github.com/CSCI-435-SE/actual-budget/pull/171) kept the tests out of a new workspace so that Dependency Review, which can't run in our fork, would not be triggered, rather than disabling it.

## Hardening Issues

| Issue | Where it came from | Evidence |
| :---- | :----------------- | :------- |
| **Done this sprint:** Add a reusable workflow to regenerate VRT screenshots for a PR ([#153](https://github.com/CSCI-435-SE/actual-budget/issues/153), [PR #164](https://github.com/CSCI-435-SE/actual-budget/pull/164)) | Sprint 2 tech debt. Upstream's `/update-vrt` bot is skipped in our fork, so in Sprint 2 we regenerated screenshots by adding and removing a temporary workflow on each PR ([#120](https://github.com/CSCI-435-SE/actual-budget/issues/120), [PR #116](https://github.com/CSCI-435-SE/actual-budget/pull/116)). Sprint 2's report planned a permanent fix. | **Broken CI path, runs before and after.** Before: `/update-vrt` runs skipped on our repo ([1](https://github.com/CSCI-435-SE/actual-budget/actions/runs/40995490314), [2](https://github.com/CSCI-435-SE/actual-budget/actions/runs/40995947533), [3](https://github.com/CSCI-435-SE/actual-budget/actions/runs/42389549446)). After, tested on a fork before merging: [VRT failing](https://github.com/TigerK9/actual-budget/actions/runs/42709845331) → [Update VRT run](https://github.com/TigerK9/actual-budget/actions/runs/42712996451) → [bot commit](https://github.com/TigerK9/actual-budget/commit/fe41fcec5) → [VRT passing](https://github.com/TigerK9/actual-budget/actions/runs/42713789212), plus refusals for a [closed PR](https://github.com/TigerK9/actual-budget/actions/runs/42719754705) and a [non-PNG change](https://github.com/TigerK9/actual-budget/actions/runs/42721010128). Since merging, it has run on our own repo (for example [this run](https://github.com/CSCI-435-SE/actual-budget/actions/runs/44454687433) on Nov 19). |
| **Found this sprint:** Flaky budget-page E2E test ([#165](https://github.com/CSCI-435-SE/actual-budget/issues/165)) | Found while testing #153; listed in PR #164's tech debt. It was already flaky at the Sprint 2 tag (see [Suite Health](#suite-health)). | Planned for Sprint 4: root cause, and 10 repeated runs before and after the fix. |
| **Found this sprint:** Flaky tags hue-slider E2E test ([#194](https://github.com/CSCI-435-SE/actual-budget/issues/194)) | End-of-sprint suite-health run. The test was added by our team in PR #166. | Planned for Sprint 4, first priority: root cause, and 10 repeated runs before and after the fix. |
| **Found this sprint:** Flaky Desktop onboarding screenshot test ([#195](https://github.com/CSCI-435-SE/actual-budget/issues/195)) | End-of-sprint suite-health run. Upstream test; passed at the Sprint 2 tag. | Planned for Sprint 4: measure how often it fails, then fix the cause. |
| **Found this sprint:** Large offline uploads can't sync ([#186](https://github.com/CSCI-435-SE/actual-budget/issues/186)) and Enter drops a new tag's description ([#183](https://github.com/CSCI-435-SE/actual-budget/issues/183)) | Real bugs found by the new tests in PR #187 and PR #166. Each has a skipped test or a workaround in the test code that points to the issue. | Planned for Sprint 4: unskip or remove the workaround once fixed, so the existing test shows the fix (fails before, passes after). |

## AI Tool Usage

AI log folder: [`ai-logs/sprint3/`](https://github.com/CSCI-435-SE/actual-budget/tree/master/ai-logs/sprint3)

- **Liam:** This sprint I used AI very similarly to how I've used it in the past few sprints. I had two sessions for creating PRs and three for reviewing three different PRs. When I would create PRs, I would read through the specs/requirements myself, then have a Claude agent begin coding and would watch each output. I was very interested in how it handled the PR that added a VRT github workflow, which I tested by making my own fork of the repo (couldn't fully test until the PR was merged with main, but didn't want to merge code that hadn't been fully tested). For reviewing PRs, I would test each new feature manually, and would run the tests as well, then I would have the agent read through all code implemented and run its own tests. This is the same way I utilized AI in the previous sprint and it seems to be working well. I've been more conscious about ensuring I understand what the AI is outputting at each step. Sessions logged: 6 [AI Logs](https://github.com/CSCI-435-SE/actual-budget/tree/master/ai-logs/sprint3/tigerk9)
- **Isabella:** In this sprint I used AI more similarly to how I did last sprint, just not the previous sprints, because I am continuing to now use AI to help me review code, as well as make changes with my own PRs post-review. I like to use Claude code to create implementation plans for issues, and I also like to use it to gain more clarity on the kinds of important design decisions I will need to make in order to properly implement an issue. Claude has been helpful to me in pointing out decisions that I need to make about the way the code will be implemented, and also suggesting which option it prefers, along with alternatives, all with their own pros and cons. I think I will continue to use this workflow for the next sprint, seeing as it worked well for this one. Tool used: Claude Code. Sessions logged: 5 [AI Logs](https://github.com/CSCI-435-SE/actual-budget/tree/master/ai-logs/sprint3/icsasso)
- **Bennett:** In this sprint I continued to use AI like how I have used it in previous sprints. Before starting on implementations I used Claude code to understand the codebase and create a plan. Then I had AI implement the changes and reviewed each step manually. It was very helpful in running all the mutation tests as well which would have taken a while to do by hand, and fixing the actual gaps or surviving mutants that the mutation tests revealed. I also used AI to help review PRs which was very helpful and gave good insights I could not normally find. Sessions logged: 4 [AI Logs](https://github.com/CSCI-435-SE/actual-budget/tree/master/ai-logs/sprint3/bennettmatuszewski)
- **Reese:** In this sprint, I continued to use AI as I have in previous sprints. I used Claude Code to help address my issues and to create tests once the changes were implemented. I reviewed each step as I went and looked over the generated tests to make sure they covered everything I wanted them to. What I found most useful was using claude to review teammate's PRs. I first did a manual review and noted issues I noticed, but I also had Claude review them. Claude noticed issues I had not found which helped ensure I was not approving a merge that would cause issues. Sessions logged: 5 [AI Logs](https://github.com/CSCI-435-SE/actual-budget/tree/master/ai-logs/sprint3/RaccoonSwarm)
- **James:** I used AI similarly in this sprint as I had in past sprints, but I broke my issues into more AI sessions to prevent context window bloat, and I used designated plan files outside of git repo to maintain current implementation state, having AI update and edit the plan after a step was implemented. I feel that this improved implementation quality, but decreased the speed due to repeatedly performing tests and linting after each implementation session and commit. I also used AI to help review PRs, and used the same workflow for it as I had in previous sprints. Sessions logged: 13 [AI Logs](https://github.com/CSCI-435-SE/actual-budget/tree/master/ai-logs/sprint3/jamesleonard3rd)
- **Sara:** This Sprint I feel like I have made proper and efficient use of AI tools. I would use the Claude browser application to understand the issue before starting and to help me curate prompts for the VSCode Agentic Agent. I would then trade back and forth, ensuring that I understood the prompts and results, as well as making sure the results fulfilled the issue. I also used AI to help review PRs. This was very helpful, as I normally have a very hard time understanding what I'm looking for when reading someone else's issues and their code. Sessions logged: 6 [AI Logs](https://github.com/CSCI-435-SE/actual-budget/tree/master/ai-logs/sprint3/sgstrick)

## Release

**Tag:** `v26.9.0-csci435-s3` – [Sprint 3 release](https://github.com/CSCI-435-SE/actual-budget/releases/tag/v26.9.0-csci435-s3)

We kept the same base version as Sprints 0–2 (`v26.9.0`), following the tagging convention. The release was created after the last Sprint 3 merge ([PR #192](https://github.com/CSCI-435-SE/actual-budget/pull/192), commit `6d7898f92`), so it matches the final `master`. Its description summarizes the sprint's features, fixes, testing and hardening work, and lists the 13 code PRs.

## Mutation Testing and Mid-Sprint Check-ins

Mutation testing folder: [`docs/sprint3/mutation/`](https://github.com/CSCI-435-SE/actual-budget/tree/master/docs/sprint3/mutation) · Check-in folder: [`docs/sprint3/checkin/`](https://github.com/CSCI-435-SE/actual-budget/tree/master/docs/sprint3/checkin)

| Member                       | D6: Mutation testing                                                                                                                      | D7: Mid-sprint check-in                                                                                            |
| :--------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------- |
| Liam (TigerK9)               | Issue #97: [97-tigerk9.md](https://github.com/CSCI-435-SE/actual-budget/blob/master/docs/sprint3/mutation/97-tigerk9.md)                  | [tigerk9.md](https://github.com/CSCI-435-SE/actual-budget/blob/master/docs/sprint3/checkin/tigerk9.md)             |
| Isabella (icsasso)           | Issue #149: [149-icsasso.md](https://github.com/CSCI-435-SE/actual-budget/blob/master/docs/sprint3/mutation/149-icsasso.md) | [icsasso.md](https://github.com/CSCI-435-SE/actual-budget/blob/master/docs/sprint3/checkin/icsasso.md) |
| Bennett (bennettmatuszewski) | Issue #125: [125-bennettmatuszewski.md](https://github.com/CSCI-435-SE/actual-budget/blob/master/docs/sprint3/mutation/125-bennettmatuszewski.md) | [bamatuszewski.md](https://github.com/CSCI-435-SE/actual-budget/blob/master/docs/sprint3/checkin/bamatuszewski.md) |
| Reese (RaccoonSwarm)         | Issue #159: [159-RaccoonSwarm.md](https://github.com/CSCI-435-SE/actual-budget/blob/master/docs/sprint3/mutation/159-RaccoonSwarm.md)     | [RaccoonSwarm.txt](https://github.com/CSCI-435-SE/actual-budget/blob/master/docs/sprint3/checkin/RaccoonSwarm.txt) |
| James (jamesleonard3rd)      | Issue #154: [154-jamesleonard3rd.md](https://github.com/CSCI-435-SE/actual-budget/blob/master/docs/sprint3/mutation/154-jamesleonard3rd.md) | [jamesleonard3rd.md](https://github.com/CSCI-435-SE/actual-budget/blob/master/docs/sprint3/checkin/jamesleonard3rd.md) |
| Sara (sgstrick)              | Not submitted                                                                                                                                      | [sgstrick.md](https://github.com/CSCI-435-SE/actual-budget/blob/master/docs/sprint3/checkin/sgstrick.md)           |

## Risks & Retrospective

### What went well

- **All 13 issues merged**, including the Sprint 2 carryover (#67), and every member got their PRs merged.
- **The new tests found real bugs.** The sync scenarios found that a device with too many offline changes can never catch up ([#186](https://github.com/CSCI-435-SE/actual-budget/issues/186)). The Manage Tags E2E tests found that Enter drops a new tag's description ([#183](https://github.com/CSCI-435-SE/actual-budget/issues/183)). Testing the VRT workflow surfaced a flaky test ([#165](https://github.com/CSCI-435-SE/actual-budget/issues/165)).
- **Mutation testing made our tests stronger.** It found assertions that weren't really checking anything. For example, #125 went from 88.62% to 100% and #97 from 75.15% to 90.53%.
- **Updating screenshots is no longer manual.** Teammates used the new workflow from [PR #164](https://github.com/CSCI-435-SE/actual-budget/pull/164) on their own PRs instead of adding a temporary workflow.
- **Reviews still caught real problems.** Seven PRs had changes requested before they were approved.

### What slowed us down

- **Another last-minute rush.** The check-in rule got PRs opened earlier, but 9 of the 13 code PRs still merged in the last three days of the sprint (Nov 17–19).
- **The receipts feature was bigger than one sprint.** Server storage and syncing attachments needed new endpoints and access checks, so #154 and #155 were rescoped to device-only storage partway through, and the server work moved to [#180](https://github.com/CSCI-435-SE/actual-budget/issues/180).
- **Setting up mutation testing took time.** Stryker's Vitest runner didn't work with our Vitest version, so we had to switch to the command runner. Each member's config also had to be listed in `knip.json` before CI would pass.
- **Slow and flaky CI.** E2E runs take several minutes per shard, and flaky tests sometimes needed a retry.

### What we would do differently in Sprint 4

- Get PRs reviewed and merged by the middle of the sprint, not just opened, so the last days are for fixes.
- Split large features and answer their open questions before the sprint starts, so sub-issues don't have to be rescoped partway through.
- Share one mutation-testing config instead of adding a new config per member.
- Check in on individual deliverables at the mid-sprint point. Everyone except Sara submitted mutation testing, and two check-ins came in after the Nov 12 deadline.

### Risks going forward

- **Flaky tests.** [#165](https://github.com/CSCI-435-SE/actual-budget/issues/165), [#194](https://github.com/CSCI-435-SE/actual-budget/issues/194) and [#195](https://github.com/CSCI-435-SE/actual-budget/issues/195) make CI less reliable, and a retry that passes can hide a real failure. #194 is a test we added.
- **Receipts are stored on one device only.** Until [#180](https://github.com/CSCI-435-SE/actual-budget/issues/180) is done, attachments don't sync and can be lost if the budget is downloaded again on another device. #180 is also the hardest part of the feature, because it touches the sync server and its access checks.
- **Drift from upstream.** We haven't synced since upstream v26.10.0, and course-only files (Stryker configs, `knip.json` entries, workflow changes) add to the conflicts at the next sync.
- **Known open bugs:** the narrow-viewport layout bug ([#139](https://github.com/CSCI-435-SE/actual-budget/issues/139)) and the oversized-upload sync bug ([#186](https://github.com/CSCI-435-SE/actual-budget/issues/186)).

## Sprint 4 Plan

- **Fix the flaky test we introduced first** ([#194](https://github.com/CSCI-435-SE/actual-budget/issues/194)).
- **Finish the receipts feature:** server storage and syncing attachments across devices ([#180](https://github.com/CSCI-435-SE/actual-budget/issues/180)), then finding and exporting attachments ([#156](https://github.com/CSCI-435-SE/actual-budget/issues/156)).
- **Hardening:** fix the other flaky tests ([#165](https://github.com/CSCI-435-SE/actual-budget/issues/165), [#195](https://github.com/CSCI-435-SE/actual-budget/issues/195)) with repeated runs before and after, and the bugs our new tests found ([#183](https://github.com/CSCI-435-SE/actual-budget/issues/183), [#186](https://github.com/CSCI-435-SE/actual-budget/issues/186)), unskipping the test that tracks #186.
- **Sprint 2 carryover:** fix the narrow-viewport layout bug ([#139](https://github.com/CSCI-435-SE/actual-budget/issues/139)).
