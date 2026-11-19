Review of Issue #148: Tag transaction counts (Claude Code)

Created: 11/16/2026
Updated: 11/18/2026 22:42:45
Exported: 11/18/2026 22:42:45
Tool: Claude Code (VS Code extension), model Claude Opus 5.5
Note: tool calls are listed by name and description; tool outputs are omitted. Exact message times were not recorded for earlier turns, so only the date is given.

User:

11/16/2026

Does the current code base fufill the following issue?

## Summary
Add a **Transactions** column to the Manage Tags page that shows how many transactions use each tag. Today the only way to tell whether a tag is in use is to click **View Transactions** on every row. With a count in each row, users can find unused tags at a glance and clean up their tag list.

## User Story
As someone who tags transactions (e.g. `#vacation`, `#reimbursable`), I want to see how many transactions use each tag on the Manage Tags page so that I can spot unused or rarely used tags and clean them up without opening each one.

## User Scenario
Alex has been using Actual for a year and has built up about 30 tags. Some were one-off experiments (`#test`, `#trip2024`) and some are used constantly (`#groceries`). Alex opens **More → Tags** to tidy up the list. Today, the only way to find out whether a tag is in use is to click **View Transactions** on each row, wait for the filtered account view, and go back, 30 times.

With this feature, every row on the Tags page shows a count next to the description, e.g. `#groceries — 214` and `#test — 0`. Alex sees at a glance that `#test` and `#trip2024` have no transactions, selects them, and deletes them. For `#reimbursable` (count 3), Alex clicks **View Transactions** and sees exactly 3 transactions, matching the number shown.

## Acceptance Criteria
1. The Manage Tags table header has a new **Transactions** column, placed between **Description** and the **View Transactions** button.
2. Each tag row shows the number of non-deleted transactions whose notes contain that tag.
3. The count uses the same tag-matching rules as the **View Transactions** button (the `hasTags` filter), so for any tag the number shown equals the number of transactions listed after clicking **View Transactions**. For example, `#food` must not count notes that only contain `#foodie`.
4. A tag used by no transactions shows `0` in a muted style, consistent with how an empty description shows "No description".
5. Counts are right-aligned and use tabular numerals so the digits line up in a column.
6. Hidden tags still show their count, with the same reduced opacity already applied to the rest of a hidden row.
7. After the user adds or removes a tag in a transaction's notes and returns to the Tags page, the count is updated without a full page reload.
8. After renaming a tag, its row shows the count for the new name.
9. The Tags page loads and stays usable while counts are being calculated; rows show a placeholder until their count is ready.
10. Unit tests cover the counting logic: zero matches, multiple matches, a tag that is a prefix of another tag, and deleted transactions not being counted. The existing `ManageTags.test.tsx` tests still pass.

## Out of Scope
- Sorting or filtering the tag list by usage count (for example, a "Show unused tags" toggle like the one on the Payees page).
- A one-click "Delete all unused tags" action.
- Showing dollar totals per tag.
- Counting tags that appear anywhere other than transaction notes, such as payee or category notes.
- The mobile app's tags screen.

## Open Questions
- **Split transactions:** if a tag appears on a child of a split transaction, do we count the child, the parent, or both? The answer should match what **View Transactions** displays.
- **Closed and off-budget accounts:** should transactions in closed or off-budget accounts count? (Proposed: yes, since the tag is still in use.)
- **Clickable count:** should clicking the count also open the filtered transaction list, making the **View Transactions** button redundant, or should the button stay as the only link?
- **Performance:** run one query per tag, or a single grouped query for all tags? This matters for budgets with many tags and many transactions.

## Rough Scope
**Size:** Medium. Estimated at about 150–250 lines across 5–7 files, similar in size to #136 (hex color preview). Should fit within one sprint for one person, including tests.

## Source
- **How it was found:** a review of the codebase for small features that are missing but easy to add, using this team's earlier closed PRs as a guide for size.
- **Gap in the current code:** each row in `TagRow.tsx` already has a **View Transactions** button that builds a `hasTags` filter for that tag, but the page never shows how many transactions match. The table only has Tag and Description columns (`TagsHeader.tsx`).
- **Precedent in Actual:** the Payees page already surfaces usage information. It shows a rule count per payee (`PayeeRuleCountLabel.tsx`) and a "Show N unused payees" filter (`ManagePayees.tsx`). This feature brings similar information to Tags.
- **Related work:** this builds on the team's recent Tags-page work in #136 (hex color preview) and #144 (color picker). It does not duplicate any open or closed issue in this repo.

Assistant:

11/16/2026

> Tool: Grep — search for "count|Transactions" in packages/desktop-client/src/components/tags

> Tool: Glob — packages/desktop-client/src/components/tags/**

Looks like it's largely implemented already. Let me verify the details against each criterion.

> Tool: Grep — find tags-get-counts / useTagCounts / getTagCounts across packages

> Tool: Read — packages/desktop-client/src/components/tags/ManageTags.tsx

> Tool: Read — packages/desktop-client/src/components/tags/TagRow.tsx (lines 180–230)

> Tool: Read — packages/loot-core/src/server/tags/app.ts

> Tool: Read — packages/desktop-client/src/tags/queries.ts

> Tool: Grep — useTagCounts in packages/desktop-client/src/hooks/useTags.ts

> Tool: Grep — getTaggedTransactionGroups / tagMatchPattern in packages/loot-core/src

> Tool: Grep — test names in packages/loot-core/src/server/tags/app.test.ts

> Tool: Bash — Show commits that added tag counts and which branches have them

> Tool: Bash — Check current branch and which branches contain the feature commit

Note: you're now on `feat/issue-148-tag-usage-count`, not the `feat/issue-161-sync-tests` branch the session started on. Let me run the relevant tests.

> Tool: Bash — Run tag counting and ManageTags tests

> Tool: Bash — Show which ManageTags tests fail and why

Those failures look like a test-setup problem (jest-dom matchers not loaded), not feature bugs. Let me run it the way the package's own script does.

> Tool: Bash — Check desktop-client test script and jest-dom setup

> Tool: Bash — Find other uses of toBeInTheDocument and config diffs vs master

Let me check whether another test file using the same matcher also fails — that tells me if it's the environment or this branch.

> Tool: Bash — Run a control test using the same matcher and check setupFiles config

Yes, on the branch you're on now, with one caveat about where the code lives.

**Where it lives:** the feature is only on `feat/issue-148-tag-usage-count`, in commits `86a0d3984` (server handler) and `955c3337a` (UI). That's the branch currently checked out. It isn't on `master` or on `feat/issue-161-sync-tests`, the branch this session started on, so it's not merged yet.

**Acceptance criteria:**

| # | Status | Where |
|---|---|---|
| 1. Transactions column between Description and View Transactions | ✅ | `TagsHeader.tsx:34` |
| 2. Counts only non-deleted transactions | ✅ | Queries `v_transactions_internal_alive`, `db/index.ts:1231` |
| 3. Same matching as `hasTags` (`#food` ≠ `#foodie`) | ✅ | Both use `tagMatchPattern` from `shared/tags.ts:31` |
| 4. `0` shown muted | ✅ | Italic, `tableTextLight` color, `TagRow.tsx:205-206` |
| 5. Right-aligned, tabular numerals | ✅ | `textAlign="right"` and `styles.tnum` |
| 6. Hidden tags dimmed but still counted | ✅ | `opacity: 0.5` when hidden |
| 7. Refreshes without a reload | ✅ | `staleTime: 0` refetches when the page opens, plus listeners for undo and sync events, `queries.ts:28`, `ManageTags.tsx:36-50` |
| 8. Count follows a rename | ✅ | The counts query sits under the tag list's query key, so renaming a tag also refreshes the counts |
| 9. Placeholder while loading | ✅ | Shows `…` with `aria-busy` |
| 10. Unit tests | ✅ | `app.test.ts` covers zero matches, multiple matches, a tag that's a prefix of another, and deleted transactions. It also covers splits, a direct check against what View Transactions lists, and odd tag names. |

**Open questions, as implemented:**
- **Splits:** a split counts once, keyed by the parent, which matches what View Transactions shows.
- **Closed and off-budget accounts:** they're counted, because nothing filters them out.
- **Clickable count:** no. The count is plain text and the View Transactions button is still there.
- **Performance:** one query fetches every tagged transaction, then the counts are worked out in memory for each tag.

**Tests I ran:**
- `app.test.ts`: all 15 pass.
- `ManageTags.test.tsx`: 4 of 8 pass. The other 4 fail with `Invalid Chai property: toBeInTheDocument`, which means the jest-dom matchers aren't loading. This is my local test setup, not the feature: `CharacterCounter.test.tsx`, which this branch doesn't touch, fails the same way. So I couldn't confirm locally that the existing `ManageTags.test.tsx` tests still pass (criterion 10). Run that file in CI or another environment where jest-dom loads before calling the criterion met.

The code covers every criterion. What's left is merging the branch and getting `ManageTags.test.tsx` to run green somewhere jest-dom works.

User:

11/18/2026

I confirmed these tests manually:

Manual testing in the app

The PR itself notes several things that can’t be tested automatically:

Visual styling — open the Manage Tags page and confirm the new Transactions column appears between Description and the action button, counts are right-aligned with tabular numerals, and unused tags show a muted 0.
Count accuracy — for a few tags, compare the number shown in the column against what you get if you click “View Transactions” for that tag. They should match exactly.
Refresh behavior — edit a transaction’s notes to add or remove a tag, then navigate away and back to the Manage Tags page. The count should update on return (since staleTime: 0 forces a reload each visit).
Rename a tag — rename a tag that has transactions and confirm the count updates correctly afterward.
Hidden/deleted tags — if you have any, confirm they appear dimmed and their counts still look right.

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

I'll check the PR description and release note before scoring documentation and AI transparency.

> Tool: Bash — Show branch diff summary and the PR's title and body

The diff adds 6,473 lines, far more than the 150–250 the issue estimated. Let me see what's driving that.

> Tool: Bash — Inspect large files, commits, release note and matcher refactor

Written for: the PR reviewer (you or your team's grader).

| Criterion | Score (1–10) | Notes |
|---|---|---|
| Correctness — does the change do what the issue asked? | 9 | All 10 acceptance criteria are met in code, and you confirmed by hand the column position, styling, that counts match View Transactions, refresh on return, rename, and hidden tags. The open questions all have sensible answers: a split counts once, matching View Transactions; closed and off-budget accounts are counted; the count isn't clickable. One point off because the PR doesn't write these decisions down for reviewers. |
| Test coverage — are tests present and meaningful? | 8 | `app.test.ts` has 15 passing tests. They cover every case the issue asked for plus splits, deleted split parents, deleted tags, odd tag names, and a direct check that the count equals the rows the `hasTags` filter returns. `tags.test.ts` covers the shared match pattern, and `ManageTags.test.tsx` adds UI tests for the column and the placeholder. Points off because 4 of the 8 `ManageTags.test.tsx` tests fail locally with `Invalid Chai property: toBeInTheDocument`. An untouched test file (`CharacterCounter.test.tsx`) fails the same way, so it's the local test setup, but the UI tests still need a green CI run. |
| Code quality — consistent style, clear naming, no unnecessary duplication | 9 | It removes duplication: the tag-matching regex used to be copied in both the `hasTags` and `hasAnyTag` branches of `transaction-rules.ts`. It now lives once in `tagMatchPattern`, shared by the filter and the counts, so the two can't disagree. The code follows the existing React Query pattern and the repo's style rules (`styles.tnum`, `Trans`, theme tokens). The one-time loop over each tag in memory is fine at normal sizes, though it would be slow for very large budgets. |
| Documentation — inline comments and PR description are clear | 7 | The inline comments are strong: they explain why `[$]` is used instead of `\$`, why the counts query sits under the tag list's query key, why `staleTime: 0`, and how splits are counted. The release note is short and plain. I couldn't read the PR description because `gh` isn't installed here, so this score covers only the code and the release note. Per repo rules the template stays blank for a human to fill in. |
| AI transparency — if AI was used, is there evidence of human verification? | 9 | All 6 commits carry the `[AI]` prefix, and a full AI session log is committed (about 6,000 lines). Your manual checks are the human verification, so add them to the PR's Testing section. Note that the log makes the diff look like +6,473 lines when the real change is about 490. Keep it out of the merge if your course doesn't require it in the repo. |
| Overall — would you merge this as-is? | 8 | Yes, once two things are done: (1) a green CI run for `ManageTags.test.tsx`, and (2) a PR description that includes your manual test results and the open-question answers above. The feature code itself needs no changes. |

User:

11/18/2026 22:42

Export this session into the path C:\Users\sarag\actual-budget\ai-logs\sprint3\sgstrick with the title 2026-11-18_claude-code_review-148.md

Assistant:

11/18/2026 22:42

> Tool: Bash — List log folder and preview existing log format

> Tool: Bash — Preview the existing Claude Code log's format

> Tool: Bash — Get current local date and time

> Tool: Write — ai-logs/sprint3/sgstrick/2026-11-18_claude-code_review-148.md

Exported this session to `ai-logs/sprint3/sgstrick/2026-11-18_claude-code_review-148.md`.
