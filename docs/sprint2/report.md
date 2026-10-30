# Sprint 2 Report

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

| Deliverable                          | Where to find it                                                                                                                                                         |
| :----------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1 – Sprint backlog                  | [Sprint 2 milestone](https://github.com/CSCI-435-SE/actual-budget/milestone/2) and [Sprint Backlog](#sprint-backlog)                                                     |
| D2 – Requirements specification      | Issue bodies, linked in the [Sprint Backlog](#sprint-backlog) table                                                                                                      |
| D3 – Design decisions                | Design section of each issue or PR; summarized in [Requirements & Design](#requirements--design)                                                                         |
| D4 – Pull requests                   | [Completed Issues](#completed-issues)                                                                                                                                    |
| D5 – AI logs                         | [`ai-logs/sprint2/`](https://github.com/CSCI-435-SE/actual-budget/tree/master/ai-logs/sprint2); summarized in [AI Tool Usage](#ai-tool-usage)                            |
| D6 – UML diagrams and Q&A            | [`docs/sprint2/diagrams/`](https://github.com/CSCI-435-SE/actual-budget/tree/master/docs/sprint2/diagrams); per-member links in [UML Diagrams and Check-ins](#uml-diagrams-and-mid-sprint-check-ins) |
| D7 – Mid-sprint check-in             | [`docs/sprint2/checkin/`](https://github.com/CSCI-435-SE/actual-budget/tree/master/docs/sprint2/checkin); per-member links in [UML Diagrams and Check-ins](#uml-diagrams-and-mid-sprint-check-ins) |
| D8 – Sprint report                   | This file                                                                                                                                                                |
| D9 – Sprint release                  | [`v26.9.0-csci435-s2`](https://github.com/CSCI-435-SE/actual-budget/releases/tag/v26.9.0-csci435-s2)                                                                    |

## Sprint Overview

At the start of the sprint, the team met to plan how we would handle the new Sprint 2 requirements: the UML diagrams, the mid-sprint check-in, the Tech Debt section in every PR, and alternatives in every design decision. Everyone self-assigned existing backlog issues, and together we wrote 4 new medium issues so that every member had at least 2 medium issues (12 issues for 6 members).

The sprint grew to **16 issues**. Early on we found that CI had never actually run on our PRs, that our fork was behind upstream, and that several tests failed on master or on Windows machines. We added issues to fix CI, sync with upstream Actual v26.10.0, fix the failing tests, and add VRT screenshots to our PRs, because every feature PR depended on that work.

**What was delivered:** 15 of the 16 issues were completed and their PRs merged. The one exception is [#67](https://github.com/CSCI-435-SE/actual-budget/issues/67) (custom color wheel, [PR #144](https://github.com/CSCI-435-SE/actual-budget/pull/144)). The PR is finished, but the reviewer requested changes, so it carries over to Sprint 3.

- **New features:** personal inflation report and widget, net worth percentage change, bulk editing of schedules, adjustable icon size, account colors and descriptions, and a live hex preview in the tag color picker.
- **Bug fixes:** custom reports no longer count unchecked subcategories, and context menus no longer close on their own when the sidebar is pinned.
- **Infrastructure:** CI now runs on every PR (lint, typecheck, unit, E2E and VRT), the fork is synced with upstream v26.10.0, and tests that failed locally (especially on Windows) now pass.

## Sprint 1 Carryovers & What Changed

### Sprint 1 carryovers

| Sprint 1 item                                                                                                          | What happened in Sprint 2                                                                                                                                                                                                                                                                                                 |
| :--------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Icon size setting ([#53](https://github.com/CSCI-435-SE/actual-budget/issues/53)), PR in review at the end of Sprint 1 | **Carried over and merged.** [PR #84](https://github.com/CSCI-435-SE/actual-budget/pull/84) was revised after review and merged.                                                                                                                                                                                          |
| Account color customization ([#24](https://github.com/CSCI-435-SE/actual-budget/issues/24)), open and unassigned      | **Carried over and merged.** Picked up by bennettmatuszewski and merged in [PR #112](https://github.com/CSCI-435-SE/actual-budget/pull/112). The scope grew to include an account description, modeled on tags.                                                                                                              |
| Layout verification across viewport sizes ([#70](https://github.com/CSCI-435-SE/actual-budget/issues/70))             | **Carried over and merged.** Re-scoped from small to medium once we decided to cover it with Playwright tests. [PR #140](https://github.com/CSCI-435-SE/actual-budget/pull/140) merged. It found a narrow-viewport bug, filed as [#139](https://github.com/CSCI-435-SE/actual-budget/issues/139) for a later sprint. |
| Failing `mutations.test.tsx` tests (Sprint 1 risk)                                                                     | **Done.** Tracked as [#94](https://github.com/CSCI-435-SE/actual-budget/issues/94) and [#98](https://github.com/CSCI-435-SE/actual-budget/issues/98), and fixed in [PR #104](https://github.com/CSCI-435-SE/actual-budget/pull/104).                                                                                         |
| Merge the latest upstream release (Sprint 1 risk)                                                                      | **Done.** Tracked as [#95](https://github.com/CSCI-435-SE/actual-budget/issues/95) and merged in [PR #99](https://github.com/CSCI-435-SE/actual-budget/pull/99).                                                                                                                                                             |
| PDF layout polish deferred from [#61](https://github.com/CSCI-435-SE/actual-budget/issues/61)                          | **Not carried over.** Written up as [#97](https://github.com/CSCI-435-SE/actual-budget/issues/97). Fixing CI was prioritized this sprint; it will be finished in Sprint 3.                                                                                                                                                            |
| "Unsaved changes" popup for the Personal Goal widget                                                                   | **Not carried over; re-scoped.** It became [#96](https://github.com/CSCI-435-SE/actual-budget/issues/96): a "(modified)" label on every report widget instead of a blocking popup. That is a large issue, so it was split into [#125](https://github.com/CSCI-435-SE/actual-budget/issues/125) and [#126](https://github.com/CSCI-435-SE/actual-budget/issues/126) for Sprint 3. |

### What changed from Sprint 1

- **CI runs on every PR.** In Sprint 1, CI never ran, so problems were found only by hand. Now each PR gets lint, typecheck, unit, E2E and VRT checks, and PRs that change the UI include updated VRT screenshots.
- **Specs and estimates.** The issue creator still writes the first spec and estimate. The assignee then adds anything missing before coding. Estimating as a full team took too long in Sprint 1, so the creator now estimates on their own.
- **Design decisions name alternatives.** Decisions now list the options we considered and explain why one was chosen (see [Requirements & Design](#requirements--design)).
- **Tech debt is tracked.** 13 of the 15 Sprint 2 PR descriptions have a Tech Debt section (Introduced / Encountered).
- **Reviews are more substantive.** Reviewers requested changes on PRs [#84](https://github.com/CSCI-435-SE/actual-budget/pull/84), [#124](https://github.com/CSCI-435-SE/actual-budget/pull/124), [#128](https://github.com/CSCI-435-SE/actual-budget/pull/128), [#129](https://github.com/CSCI-435-SE/actual-budget/pull/129) and [#144](https://github.com/CSCI-435-SE/actual-budget/pull/144) before approving.
- **New deliverables:** UML diagrams with Q&A (D6) and the mid-sprint check-in (D7).

## Sprint Backlog

**Milestone:** [Sprint 2 milestone](https://github.com/CSCI-435-SE/actual-budget/milestone/2)

**How we read the columns.** _Owner_ is the person who created the issue and wrote its scope, requirements and estimate. _Assigned to_ is the person who implemented it. If the spec was missing details, the assignee added them before coding.

**Story points.** We use a 1–10 scale: 1–2 is small, 3–7 is medium and 8–10 is large. We started by estimating as a team, as in Sprint 1, but it took too long, so each issue's owner estimated it. A few issues were scoped by the whole team.

**Backlog rationale.**

- **Sprint 1 carryovers first.** Unfinished Sprint 1 work (#53, #24, #70) went into the backlog before any new work.
- **Scope minimum.** Each member then took at least 2 medium issues (or the equivalent in small issues). We wrote 4 new medium issues so there were enough to go around.
- **CI and maintenance issues were added mid-sprint.** Once CI was running, failures on master blocked every feature PR, so we added and fixed them: #101, #118, #119, #120, #94/#98 and #95. #119 and #120 were created after their PRs, to document CI fixes that were already in progress.

| Issue                                                                                                                              | Owner                | Assigned to        | Points   | Scope     | PR                                                            | Status                   |
| :--------------------------------------------------------------------------------------------------------------------------------- | :------------------- | :----------------- | :------- | :-------- | :------------------------------------------------------------ | :----------------------- |
| Add the ability to increase icon sizes ([#53](https://github.com/CSCI-435-SE/actual-budget/issues/53))                             | RaccoonSwarm         | sgstrick           | 5        | Medium    | [#84](https://github.com/CSCI-435-SE/actual-budget/pull/84)   | Merged                   |
| Verify layout across viewport sizes and document narrow-screen behavior ([#70](https://github.com/CSCI-435-SE/actual-budget/issues/70)) | icsasso         | sgstrick           | 3 | Medium    | [#140](https://github.com/CSCI-435-SE/actual-budget/pull/140) | Merged                   |
| Allow color customization for accounts ([#24](https://github.com/CSCI-435-SE/actual-budget/issues/24))                             | sgstrick             | bennettmatuszewski | 4        | Medium    | [#112](https://github.com/CSCI-435-SE/actual-budget/pull/112) | Merged                   |
| Sync our project with upstream v26.10.0 ([#95](https://github.com/CSCI-435-SE/actual-budget/issues/95))                           | TigerK9              | bennettmatuszewski | 1        | Small     | [#99](https://github.com/CSCI-435-SE/actual-budget/pull/99)   | Merged                   |
| 6 tests fail in `mutations.test.tsx` ([#94](https://github.com/CSCI-435-SE/actual-budget/issues/94)) and failing tests on Windows ([#98](https://github.com/CSCI-435-SE/actual-budget/issues/98)) | TigerK9 / sgstrick | bennettmatuszewski | 3 (both) | 2 × Small | [#104](https://github.com/CSCI-435-SE/actual-budget/pull/104) | Merged |
| CI jobs never run on PRs ([#101](https://github.com/CSCI-435-SE/actual-budget/issues/101))                                         | jamesleonard3rd      | TigerK9            | 3        | Medium    | [#113](https://github.com/CSCI-435-SE/actual-budget/pull/113) | Merged                   |
| Fix lint, formatting, and knip errors failing the CI Test workflow ([#119](https://github.com/CSCI-435-SE/actual-budget/issues/119)) | TigerK9            | TigerK9            | 2        | Small     | [#115](https://github.com/CSCI-435-SE/actual-budget/pull/115) | Merged                   |
| Regenerate stale VRT screenshots after recent UI change ([#120](https://github.com/CSCI-435-SE/actual-budget/issues/120))         | TigerK9              | TigerK9            | 2        | Small     | [#116](https://github.com/CSCI-435-SE/actual-budget/pull/116) | Merged                   |
| Context menus close ~350 ms after leaving a popover when sidebar is pinned ([#118](https://github.com/CSCI-435-SE/actual-budget/issues/118)) | jamesleonard3rd | TigerK9         | 2        | Small     | [#132](https://github.com/CSCI-435-SE/actual-budget/pull/132) | Merged                   |
| Custom color improvements for tag color editor ([#66](https://github.com/CSCI-435-SE/actual-budget/issues/66))                    | bennettmatuszewski   | icsasso            | 5        | Medium    | [#136](https://github.com/CSCI-435-SE/actual-budget/pull/136) | Merged                   |
| Add custom color wheel to color picker ([#67](https://github.com/CSCI-435-SE/actual-budget/issues/67))                            | bennettmatuszewski   | icsasso            | 5        | Medium    | [#144](https://github.com/CSCI-435-SE/actual-budget/pull/144) | Open – changes requested |
| Fix subcategory visualization in report graphs ([#100](https://github.com/CSCI-435-SE/actual-budget/issues/100))                  | TigerK9              | jamesleonard3rd    | 4        | Medium    | [#128](https://github.com/CSCI-435-SE/actual-budget/pull/128) | Merged                   |
| Allow bulk editing in Schedules tab ([#65](https://github.com/CSCI-435-SE/actual-budget/issues/65))                               | bennettmatuszewski   | jamesleonard3rd    | 5        | Medium    | [#129](https://github.com/CSCI-435-SE/actual-budget/pull/129) | Merged                   |
| Add percentage change in net worth to reports ([#11](https://github.com/CSCI-435-SE/actual-budget/issues/11))                     | TigerK9              | RaccoonSwarm       | 5        | Medium    | [#124](https://github.com/CSCI-435-SE/actual-budget/pull/124) | Merged                   |
| Add personal rate of inflation tracking ([#15](https://github.com/CSCI-435-SE/actual-budget/issues/15))                           | icsasso              | RaccoonSwarm       | 5 | Medium    | [#130](https://github.com/CSCI-435-SE/actual-budget/pull/130) | Merged                   |

**Issues per member:**

| Member             | Issues implemented                                    |
| :----------------- | :---------------------------------------------------- |
| TigerK9            | #101 (medium), #118, #119, #120 (small)               |
| icsasso            | #66, #67 (medium; #67 carries over)                   |
| bennettmatuszewski | #24 (medium), #95, #94/#98 (small)                    |
| sgstrick           | #53, #70 (medium)                                     |
| RaccoonSwarm       | #11, #15 (medium)                                     |
| jamesleonard3rd    | #100, #65 (medium)                                    |

## Requirements & Design

**Were specs complete before coding?** For most issues, yes. Feature issues had a user story, user scenario, acceptance criteria and out-of-scope list, and bug issues had observed behavior, expected behavior and steps to reproduce, before work began. The exceptions were #119 and #120, which were created after their PRs to document CI fixes that had to happen immediately to unblock everyone else.

**Surprises:**

- **The upstream sync was much harder than expected.** It was estimated at 1 point. Merging the `v26.10.0` release tag produced dozens of false conflicts and had to be aborted. The final merge brought in 215 upstream commits and needed 25 conflicts resolved by hand.
- **CI had never run on any of our PRs.** Upstream's workflows use Depot runners, which are blocked on our repo. That meant lint errors, 69 outdated screenshots and a broken E2E test had reached master unnoticed.
- **#11 was smaller than estimated.** It was first estimated as large. Once we found that the YTD logic and starting balance already existed in `net-worth-spreadsheet.ts`, it was re-scoped to medium.
- **#70 found a real bug.** Its new layout tests found a narrow-screen bug between 668 and 749px, filed as [#139](https://github.com/CSCI-435-SE/actual-budget/issues/139).

**Key design decisions.** Full details, including consequences, are in each linked issue or PR.

| Issue / PR | Decision | Alternatives considered | Why |
| :--------- | :------- | :---------------------- | :-- |
| [#53](https://github.com/CSCI-435-SE/actual-budget/issues/53) / [PR 84](https://github.com/CSCI-435-SE/actual-budget/pull/84) (sgstrick) | Icon size is its own setting, with fixed Small/Medium/Large options. | Let the user enter an exact size or scale for icons. | Fixed sizes can each be tested to fit in every page layout. An arbitrary size could break layouts. |
| [#95](https://github.com/CSCI-435-SE/actual-budget/issues/95) / [PR 99](https://github.com/CSCI-435-SE/actual-budget/pull/99) (bennettmatuszewski) | Merge upstream into a separate sync branch and open a reviewed PR. Target the upstream commit the 26.10.0 release was built from. | Rebase our commits onto upstream; GitHub's "Sync fork" button; merge the `v26.10.0` tag; merge upstream's latest `master`. | Rebasing would rewrite shared history. "Sync fork" has no review step. The tag produced false conflicts. Latest `master` included unreleased work. |
| [#94/#98](https://github.com/CSCI-435-SE/actual-budget/issues/98) / [PR 104](https://github.com/CSCI-435-SE/actual-budget/pull/104) (bennettmatuszewski) | Fix the Windows `EBUSY` error by closing the database in the migration. | Close it in the test cleanup instead. | A real down migration on Windows would hit the same error, so fixing the migration covers both. |
| [#24](https://github.com/CSCI-435-SE/actual-budget/issues/24) / [PR 112](https://github.com/CSCI-435-SE/actual-budget/pull/112) (bennettmatuszewski) | Store account color and description as new database columns, and show the color as a tag-style pill. | Reuse account Notes for the description; store the color as a per-account preference; show a colored dot or colored text. | Columns can be undone, sync and are loaded with every account. The pill matches tags and stays readable in every theme. |
| [#101](https://github.com/CSCI-435-SE/actual-budget/issues/101) / [PR 113](https://github.com/CSCI-435-SE/actual-budget/pull/113) (TigerK9) | Keep upstream's workflows, swap Depot runners for GitHub-hosted ones in the PR checks, and turn off upstream-only jobs. | Swap every runner label everywhere; write our own CI file; use a self-hosted runner or pay for Depot. | Keeps upstream's full E2E and VRT suite for free, without letting publish jobs run on our repo. |
| [#119](https://github.com/CSCI-435-SE/actual-budget/issues/119) / [PR 115](https://github.com/CSCI-435-SE/actual-budget/pull/115) (TigerK9) | Exclude `ai-logs/` and `docs/` from the formatter and auto-fix only source code. | Let the formatter rewrite everything; revert log changes by hand; turn off the lint job. | AI logs must stay verbatim. Turning off lint would hide real problems. |
| [#120](https://github.com/CSCI-435-SE/actual-budget/issues/120) / [PR 116](https://github.com/CSCI-435-SE/actual-budget/pull/116) (TigerK9) | Regenerate screenshots with a temporary workflow that copies CI's environment, then delete it before merging. | Generate them locally in the dev container; adapt upstream's `/update-vrt` bot; add a permanent workflow. | Local screenshots don't match CI's rendering. Upstream's bot only works on their repo. A permanent workflow is planned for Sprint 3. |
| [#118](https://github.com/CSCI-435-SE/actual-budget/issues/118) / [PR 132](https://github.com/CSCI-435-SE/actual-budget/pull/132) (TigerK9) | Don't track popover hover at all when the sidebar is pinned. | Only add a "floating" check to the close effect; close menus from inside the hide timer. | Removes the cause instead of hiding it, and leaves floating mode untouched. |
| [#100](https://github.com/CSCI-435-SE/actual-budget/issues/100) / [PR 128](https://github.com/CSCI-435-SE/actual-budget/pull/128) (jamesleonard3rd) | Fix which subcategories are counted in parent totals without redesigning the graphs. | Show each subcategory as its own bar; split each parent bar into colored segments. | Both alternatives need large changes across five graph types and wouldn't fix the totals on their own. They are left as follow-ups. |
| [#65](https://github.com/CSCI-435-SE/actual-budget/issues/65) / [PR 129](https://github.com/CSCI-435-SE/actual-budget/pull/129) (jamesleonard3rd) | Run bulk schedule actions as a loop on the client, reusing the existing single-schedule actions. Completed schedules get no checkbox. | New batch server methods; letting completed schedules be selected and disabling actions that don't apply. | No `loot-core` changes, and each action behaves exactly as it already did. Editing completed schedules is out of scope. |
| [#66](https://github.com/CSCI-435-SE/actual-budget/issues/66) / [PR 136](https://github.com/CSCI-435-SE/actual-budget/pull/136) (icsasso) | A fixed, non-editable "#" prefix, with the input holding only the hex digits. | Keep "#" in the value and block deleting it. | Blocking Backspace/Delete at the start of the input has many easy-to-miss edge cases. |
| [#67](https://github.com/CSCI-435-SE/actual-budget/issues/67) / [PR 144](https://github.com/CSCI-435-SE/actual-budget/pull/144) (icsasso, in review) | Preview colors live, but save only when a change settles. | Debounce saves to about 150 ms; add an Apply/Cancel button. | Exactly one save per change. Debouncing still records in-between colors, and a button adds an extra click. |
| [#70](https://github.com/CSCI-435-SE/actual-budget/issues/70) / [PR 140](https://github.com/CSCI-435-SE/actual-budget/pull/140) (sgstrick) | Verify layouts with Playwright E2E tests plus screenshots. | Vitest component tests or unit tests of the width logic; screenshots only or code checks only. | Vitest's jsdom doesn't calculate layout, so overflow can't be measured. Screenshots alone can approve an image that already has a bug. |

## Completed Issues

| Issue | Owner | PR | Author | Reviewer(s) | Status | Description |
| :---- | :---- | :- | :----- | :---------- | :----- | :---------- |
| Add the ability to increase icon sizes ([#53](https://github.com/CSCI-435-SE/actual-budget/issues/53)) | RaccoonSwarm | [#84](https://github.com/CSCI-435-SE/actual-budget/pull/84) | sgstrick | TigerK9 | Closed and Merged | Adds an accessibility setting for icon size. Users can make icons smaller to fit their window, or bigger to see them more easily. |
| Verify layout across viewport sizes and document narrow-screen behavior ([#70](https://github.com/CSCI-435-SE/actual-budget/issues/70)) | icsasso | [#140](https://github.com/CSCI-435-SE/actual-budget/pull/140) | sgstrick | icsasso | Closed and Merged | Adds Playwright tests that check layouts across viewport sizes, documents narrow-screen behavior, and lists next steps. The narrow-screen bug it found is filed as [#139](https://github.com/CSCI-435-SE/actual-budget/issues/139). |
| Allow color customization for accounts ([#24](https://github.com/CSCI-435-SE/actual-budget/issues/24)) | sgstrick | [#112](https://github.com/CSCI-435-SE/actual-budget/pull/112) | bennettmatuszewski | jamesleonard3rd | Closed and Merged | Users can give each account a color, as they already can for tags, so accounts are easy to tell apart. The color appears everywhere the account name is shown. Accounts also get a short description field, separate from Notes. |
| Sync our project with upstream v26.10.0 ([#95](https://github.com/CSCI-435-SE/actual-budget/issues/95)) | TigerK9 | [#99](https://github.com/CSCI-435-SE/actual-budget/pull/99) | bennettmatuszewski | TigerK9 | Closed and Merged | Merges 215 commits from the upstream Actual Budget repo to keep our fork current, resolving 25 conflicts with our own changes. |
| 6 tests fail in `mutations.test.tsx` ([#94](https://github.com/CSCI-435-SE/actual-budget/issues/94)) and failing tests on Windows ([#98](https://github.com/CSCI-435-SE/actual-budget/issues/98)) | TigerK9 / sgstrick | [#104](https://github.com/CSCI-435-SE/actual-budget/pull/104) | bennettmatuszewski | TigerK9 | Closed and Merged | Fixes test failures that appeared when running `yarn test` locally, especially on Windows. |
| CI jobs never run on PRs ([#101](https://github.com/CSCI-435-SE/actual-budget/issues/101)) | jamesleonard3rd | [#113](https://github.com/CSCI-435-SE/actual-budget/pull/113) | TigerK9 | sgstrick | Closed and Merged | Moves CI from upstream's Depot runners, which are blocked on our repo, to GitHub's hosted runners. CI had never run on our PRs, which let bugs reach master. Also adds a checker script that fails if a Depot runner label comes back. |
| Fix lint, formatting, and knip errors failing the CI Test workflow ([#119](https://github.com/CSCI-435-SE/actual-budget/issues/119)) | TigerK9 | [#115](https://github.com/CSCI-435-SE/actual-budget/pull/115) | TigerK9 | bennettmatuszewski | Closed and Merged | Fixes the formatting and lint errors that reached master while CI was down, and stops the formatter from rewriting `ai-logs/` and `docs/`. Also marks three Babel dependencies as used in `knip.json`, since knip wrongly reported them as unused. _This issue was created after its PR, to document the CI fix._ |
| Regenerate stale VRT screenshots after recent UI change ([#120](https://github.com/CSCI-435-SE/actual-budget/issues/120)) | TigerK9 | [#116](https://github.com/CSCI-435-SE/actual-budget/pull/116) | TigerK9 | bennettmatuszewski | Closed and Merged | Regenerates 69 outdated VRT screenshots in CI's own Playwright container, using a temporary workflow that was removed before merging. Teammates later reused the workflow to generate screenshots for their own PRs. _This issue was created after its PR, to document the CI fix._ |
| Context menus close ~350 ms after leaving a popover when sidebar is pinned ([#118](https://github.com/CSCI-435-SE/actual-budget/issues/118)) | jamesleonard3rd | [#132](https://github.com/CSCI-435-SE/actual-budget/pull/132) | TigerK9 | bennettmatuszewski | Closed and Merged | With the sidebar pinned, context menus (such as a schedule row's "⋯" menu) closed on their own about 350 ms after the pointer left a popover. `SidebarProvider` now tracks popover hover only when the sidebar is floating. This also fixed the failing "schedules" E2E test. |
| Custom color improvements for tag color editor ([#66](https://github.com/CSCI-435-SE/actual-budget/issues/66)) | bennettmatuszewski | [#136](https://github.com/CSCI-435-SE/actual-budget/pull/136) | icsasso | bennettmatuszewski | Closed and Merged | Replaces the picker's color field with a hex input that keeps "#" as a fixed prefix, so the tag color updates while typing. A preview swatch next to the input shows the typed color and stays in sync with swatch selection through `ColorPickerStateContext`. |
| Add custom color wheel to color picker ([#67](https://github.com/CSCI-435-SE/actual-budget/issues/67)) | bennettmatuszewski | [#144](https://github.com/CSCI-435-SE/actual-budget/pull/144) | icsasso | sgstrick | In Review – Carried over to Sprint 3 | Clicking the color preview opens a saturation/brightness area and hue slider (react-aria-components), kept in sync with the swatches and hex input through the shared picker state. The reviewer requested changes, which will be addressed in Sprint 3. |
| Fix subcategory visualization in report graphs ([#100](https://github.com/CSCI-435-SE/actual-budget/issues/100)) | TigerK9 | [#128](https://github.com/CSCI-435-SE/actual-budget/pull/128) | jamesleonard3rd | RaccoonSwarm | Closed and Merged | Fixes a bug from the Sprint 1 subcategories work: checking or unchecking a subcategory didn't change the chart. Now unchecked subcategories are left out, and the chart and parent totals update correctly. |
| Allow bulk editing in Schedules tab ([#65](https://github.com/CSCI-435-SE/actual-budget/issues/65)) | bennettmatuszewski | [#129](https://github.com/CSCI-435-SE/actual-budget/pull/129) | jamesleonard3rd | RaccoonSwarm | Closed and Merged | Adds checkboxes and a bulk actions menu to the Schedules page, so several active schedules can be posted, skipped, completed or deleted at once, as on the Rules, Payees and Tags pages. Before, each schedule had to be changed one at a time through its row's "⋯" menu. |
| Add percentage change in net worth to reports ([#11](https://github.com/CSCI-435-SE/actual-budget/issues/11)) | TigerK9 | [#124](https://github.com/CSCI-435-SE/actual-budget/pull/124) | RaccoonSwarm | TigerK9 | Closed and Merged | Adds a `totalChangePercent` value to the net worth spreadsheet and shows it next to the dollar change in the Net Worth report and dashboard widget. Users can see how significant a change is, not just its dollar amount. |
| Add personal rate of inflation tracking ([#15](https://github.com/CSCI-435-SE/actual-budget/issues/15)) | icsasso | [#130](https://github.com/CSCI-435-SE/actual-budget/pull/130) | RaccoonSwarm | jamesleonard3rd | Closed and Merged | Adds a new report page and dashboard widget that track the user's personal inflation rate over a window and comparison period the user picks. An increase in spending shows as a positive percentage in red, and a decrease as a negative percentage in green. Users can see whether their spending is rising faster than they want and adjust their habits. |

## Test Strategy

**Getting CI working came first.** Before [PR #113](https://github.com/CSCI-435-SE/actual-budget/pull/113), CI had never run on our PRs, because upstream's workflows use Depot runners that are blocked on our repo. Lint errors, outdated screenshots and a broken E2E test had reached master as a result. After moving CI to GitHub-hosted runners, we fixed the failures that had piled up:

- [PR #115](https://github.com/CSCI-435-SE/actual-budget/pull/115) fixed lint, formatting and knip errors.
- [PR #116](https://github.com/CSCI-435-SE/actual-budget/pull/116) regenerated 69 outdated VRT screenshots.
- [PR #132](https://github.com/CSCI-435-SE/actual-budget/pull/132) fixed the bug behind the failing "schedules" E2E test.
- [PR #104](https://github.com/CSCI-435-SE/actual-budget/pull/104) fixed tests that failed locally: Windows file locks, Vitest picking up Stryker's leftover `.stryker-tmp` copies, and an i18n race in `mutations.test.tsx`.

From then on, every PR got lint, typecheck, unit, E2E and VRT checks automatically.

**Kinds of tests written:**

- **Unit and component tests (Vitest)** were the most common.
  - [PR #84](https://github.com/CSCI-435-SE/actual-budget/pull/84) tests saving and loading the icon size setting, the default fallback, and the pixel size for each option.
  - [PR #128](https://github.com/CSCI-435-SE/actual-budget/pull/128) adds `subcategories.test.ts` and `showActivity.test.ts`, which check that unchecked subcategories are left out of custom reports.
  - [PR #132](https://github.com/CSCI-435-SE/actual-budget/pull/132) adds three pinned-sidebar tests using fake timers, including a regression test for the original bug, and updates three existing tests.
  - [PR #136](https://github.com/CSCI-435-SE/actual-budget/pull/136) adds six tests for the hex input.
  - PRs [#124](https://github.com/CSCI-435-SE/actual-budget/pull/124) and [#130](https://github.com/CSCI-435-SE/actual-budget/pull/130) add AI-generated unit tests for the net worth percentage and personal inflation features.
- **End-to-end tests (Playwright).**
  - [PR #129](https://github.com/CSCI-435-SE/actual-budget/pull/129) tests bulk skip, complete and delete, select-all, completed rows having no checkbox, and clicking a row still opening the editor.
  - [PR #140](https://github.com/CSCI-435-SE/actual-budget/pull/140) tests layouts at four viewport widths in three themes, plus a sweep across 19 widths. It records two known layout bugs with `test.fail()`, so they become regression tests once fixed.
- **Visual regression tests (VRT).** Screenshots were regenerated whenever a PR changed the UI ([PR #116](https://github.com/CSCI-435-SE/actual-budget/pull/116), [PR #128](https://github.com/CSCI-435-SE/actual-budget/pull/128), [PR #129](https://github.com/CSCI-435-SE/actual-budget/pull/129)).
- **Mutation testing (Stryker).** In [PR #112](https://github.com/CSCI-435-SE/actual-budget/pull/112), the changed code scored 100%, and each killed mutant was checked to be a real test failure.

**What we couldn't test automatically, and why:**

- **Upstream sync ([PR #99](https://github.com/CSCI-435-SE/actual-budget/pull/99)).** It touched hundreds of files we didn't write, so no new tests could cover it. The author checked the app by hand for regressions and asked teammates to do the same before merging.
- **CI changes ([PR #113](https://github.com/CSCI-435-SE/actual-budget/pull/113)).** A workflow can only be tested by running it on GitHub. We verified it by watching CI run on the PR, and tested the runner-label checker by hand against sample workflows.
- **How things look.** Whether icons look right at every size ([PR #84](https://github.com/CSCI-435-SE/actual-budget/pull/84)) or colors look right in each theme ([PR #136](https://github.com/CSCI-435-SE/actual-budget/pull/136), [PR #144](https://github.com/CSCI-435-SE/actual-budget/pull/144)) needs a person to look. VRT screenshots only catch changes, not whether the new look is correct.
- **Mutation testing on Windows.** Stryker's Vitest runner ran 0 tests on Windows and parallel runs crashed, so it had to be run one mutant at a time with temporary configs.
- **[PR #144](https://github.com/CSCI-435-SE/actual-budget/pull/144)'s unit tests** couldn't be run in the author's environment because Vitest wouldn't start. They rely on CI.

**Every PR was also tested by hand** in the running app. Several ([#128](https://github.com/CSCI-435-SE/actual-budget/pull/128), [#130](https://github.com/CSCI-435-SE/actual-budget/pull/130), [#136](https://github.com/CSCI-435-SE/actual-budget/pull/136), [#144](https://github.com/CSCI-435-SE/actual-budget/pull/144)) include step-by-step instructions so the reviewer could repeat the check.

## AI Tool Usage

AI log folder: [`ai-logs/sprint2/`](https://github.com/CSCI-435-SE/actual-budget/tree/master/ai-logs/sprint2)

- **Liam:** For this sprint I used AI in a very similar manner to Sprint 1. I used Claude Code as an extension in Visual Studio, and used specstory to log them in my ai-logs like before. For PR descriptions and review comments, I would have AI type out responses, then I'd take the time to rewrite responses in my own words, though I didn't always do this. I'd like to take more time to rewrite what Claude outputs so that I understand exactly what is being output and why. Something I did in this sprint that I didn't do before was to push back on a lot of the outputs. Claude would tell me we should do something one way, and I'd realize it wouldn't follow the structure of our project, or was too far out of the scope of the issue being worked on, and I'd bring the agent back in. I worked on four PRs, three of which I used AI to help me code and understand the project structure more. I also had it help me create my UML and Class diagrams during one of those sessions. I also used AI to review my teammates' code, giving one session to each PR reviewed. The other times I used AI were to create more extensive issue descriptions for my teammates to more easily implement their issues. Sessions logged: 9 [ai logs](https://github.com/CSCI-435-SE/actual-budget/tree/master/ai-logs/sprint2/tigerk9)
- **Isabella:** I used AI similarly to Sprint 1. I used the Claude Code extension inside VSCode. Claude code helped me implement code, as well as draft potential future issues for the next sprint, based on findings from this sprint. Something new I did with AI this sprint was that I also used Claude to help me build the UML diagrams, which was very helpful and accurate to the structure of the codebase. Another new thing was that I used Claude to help me with testing my code and making sure it adhered to certain design specifications that the repo preferred. Claude also helped me review a teammate's code, and I hadn't used it to do that until now; I think it got way too into the nitty gritty details of some changes that aren't really worth changing, but I liked that it gave me a better view of the changes in general. Sessions logged: 4 [AI Logs](https://github.com/CSCI-435-SE/actual-budget/tree/master/ai-logs/sprint2/icsasso)
- **Bennett:** For this Sprint I used AI in a similar way I have in previous sprints. It was very useful yet again for scoping out issues and implementing fixes. Most notably it was very helpful for fixing our failing test cases which would be a big pain to debug without the help of AI. It also helped a ton with syncing our project upstream with the parent repo. We thought this task would be fairly simple, but proved to be extremely difficult and introduced many merge conflicts. Without AI this would have been an extremely tedious task, but AI helped a ton. I also used it to help with reviewing PRs and creating and understanding UML diagrams, which was helpful to visualize. Sessions logged: 9 [Ai logs.](https://github.com/CSCI-435-SE/actual-budget/tree/master/ai-logs/sprint2/bennettmatuszewski)
- **Reese:** For Sprint 2, I utilized Claude Code similarly to how I have in previous sprints. I use the VS Code Claude extension and utilize AI to help me plan and implement features related to the issues I claimed from our backlog. I also used Claude to help me generate unit tests an and run existing tests in our yarn suite. One thing I utilized AI for more than usual in this sprint was in my code reviews for other team members' PRs. I not only used it to help me run tests and review changes, but I gave it the criteria we were scoring based on and had it help me rate their PR under those categories. I think this was really useful and helped me catch certain issues in their code that I would not have found otherwise. I also used it to help me create my UML diagrams which helped optimize efficiency, though I still had to make some changes to them afterwards. Sessions logged: 4 [AI Logs](https://github.com/CSCI-435-SE/actual-budget/tree/master/ai-logs/sprint2/RaccoonSwarm)
- **James:** He never answered this.
- **Sara:** For Sprint 2, I switched from the Claude browser to Claude Code in VS Code. I used AI to help implement features and fixes that were assigned to me, as well as writing unit tests for those issues and troubleshooting when things went wrong. The main thing that changed between Sprint 1 and now is that I was able to have Claude manually make changes and run tests rather than doing it myself. This helped when testing would be tedious, but it also meant that I had to put extra effort into understanding the code that was changed. Sessions logged: 2 [AI Logs](https://github.com/CSCI-435-SE/actual-budget/tree/master/ai-logs/sprint2/sgstrick)

## Release

**Tag:** `v26.9.0-csci435-s2` – [Sprint 2 release](https://github.com/CSCI-435-SE/actual-budget/releases/tag/v26.9.0-csci435-s2)

We kept the same base version as Sprints 0 and 1 (`v26.9.0`), following the tagging convention, even though the code now includes the upstream v26.10.0 sync.

## UML Diagrams and Mid-Sprint Check-ins

UML diagrams folder: [`docs/sprint2/diagrams/`](https://github.com/CSCI-435-SE/actual-budget/tree/master/docs/sprint2/diagrams) · Check-in folder: [`docs/sprint2/checkin/`](https://github.com/CSCI-435-SE/actual-budget/tree/master/docs/sprint2/checkin)

| Member                       | D6: UML diagrams and Q&A                                                                                                                                                                       | D7: Mid-sprint check-in                                                                                              |
| :--------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------- |
| Liam (TigerK9)               | Issue #118: [118-tigerk9.md](https://github.com/CSCI-435-SE/actual-budget/blob/master/docs/sprint2/diagrams/118-tigerk9.md)                                                                    | [tigerk9.md](https://github.com/CSCI-435-SE/actual-budget/blob/master/docs/sprint2/checkin/tigerk9.md)               |
| Isabella (icsasso)           | Issue #67: [67-icsasso.md](https://github.com/CSCI-435-SE/actual-budget/pull/144/changes#diff-267cd6dda92751576d33c8ac8d672fa98c47597346905ed556aa041f9dce93a7) (in PR #144, not yet on master) | [icsasso.md](https://github.com/CSCI-435-SE/actual-budget/blob/master/docs/sprint2/checkin/icsasso.md)               |
| Bennett (bennettmatuszewski) | Issue #24: [24-bennettmatuszewski.md](https://github.com/CSCI-435-SE/actual-budget/blob/master/docs/sprint2/diagrams/24-bennettmatuszewski.md)                                                 | [bamatuszewski.md](https://github.com/CSCI-435-SE/actual-budget/blob/master/docs/sprint2/checkin/bamatuszewski.md)   |
| Reese (RaccoonSwarm)         | Issue #15: [15-raccoonswarm.md](https://github.com/CSCI-435-SE/actual-budget/blob/master/docs/sprint2/diagrams/15-raccoonswarm.md)                                                             | [raccoonswarm.md](https://github.com/CSCI-435-SE/actual-budget/blob/master/docs/sprint2/checkin/raccoonswarm.md)     |
| James (jamesleonard3rd)      | Issue #100: [100-jamesleonard3rd.md](https://github.com/CSCI-435-SE/actual-budget/blob/master/docs/sprint2/diagrams/100-jamesleonard3rd.md)                                                    | [jamesleonard3rd.md](https://github.com/CSCI-435-SE/actual-budget/blob/master/docs/sprint2/checkin/jamesleonard3rd.md) |
| Sara (sgstrick)              | Issue #53: [53-sgstrick.md](https://github.com/CSCI-435-SE/actual-budget/blob/master/docs/sprint2/diagrams/53-sgstrick.md)                                                                     | [sgstrick.md](https://github.com/CSCI-435-SE/actual-budget/blob/master/docs/sprint2/checkin/sgstrick.md)             |

## Risks & Retrospective

### What went well

- **15 of 16 issues merged.** The only open PR ([#144](https://github.com/CSCI-435-SE/actual-budget/pull/144)) is finished apart from a few small requested changes.
- **CI works.** Every PR is now checked automatically. Before this sprint, CI had never run on our repo.
- **Our fork is current.** It is synced with upstream v26.10.0, and the tests that used to fail locally (including on Windows) now pass.
- **Reviews caught real problems.** Five PRs had changes requested before they were approved.

### What slowed us down

- **Other commitments.** Work for other classes and jobs was the biggest thing slowing us down, which led to a last-minute scramble. 7 of the 16 issues were closed in the last 30 hours of the sprint.
- **Unplanned infrastructure work.** Fixing CI and syncing with upstream took far longer than estimated (the upstream sync was estimated at 1 point). Feature PRs couldn't get green checks until it was done.
- **Slow CI runners.** GitHub's hosted runners are slower than upstream's Depot runners, so CI runs took longer and some jobs had to be re-run.

### What we would do differently in Sprint 3

- Start PRs earlier so there is more time for review and for fixing the finer details. With PRs coming in at the last minute, some small details were skipped for the sake of finishing.
- Estimate infrastructure work (syncing, CI) more carefully. It turned out to be much larger than it looked.

### Risks going forward

- **Flaky CI.** Some CI tests occasionally fail because GitHub-hosted runners are much slower than upstream's Depot runners. Re-running a failed job usually passes, but we need to keep an eye on it and fix tests as the slowness comes up.
- **Config drift from upstream.** Our CI workflows, `.oxfmtrc.json` and `knip.json` now differ from upstream's, which may cause merge conflicts at the next upstream sync.
- **Known narrow-screen bug.** The layout bug found by PR #140 ([#139](https://github.com/CSCI-435-SE/actual-budget/issues/139)) is still open.

## Sprint 3 Plan

- Address the review on [PR #144](https://github.com/CSCI-435-SE/actual-budget/pull/144) and merge it (carryover of [#67](https://github.com/CSCI-435-SE/actual-budget/issues/67)).
- Polish the PDF export ([#97](https://github.com/CSCI-435-SE/actual-budget/issues/97)). We planned this after Sprint 1 but didn't get to it this sprint.
- Show a "(modified)" label on report widgets with unsaved changes ([#125](https://github.com/CSCI-435-SE/actual-budget/issues/125), [#126](https://github.com/CSCI-435-SE/actual-budget/issues/126)).
- Fix the narrow-viewport layout bug ([#139](https://github.com/CSCI-435-SE/actual-budget/issues/139)).
- Add issues for bringing the UI changes we made in line with the project's "impeccable" design guidelines.
- Add screenshot tests for new UI elements that didn't have them before.
- Build a reliable way to update screenshots, like upstream's bot, so we no longer have to add and remove a temporary workflow each time.
