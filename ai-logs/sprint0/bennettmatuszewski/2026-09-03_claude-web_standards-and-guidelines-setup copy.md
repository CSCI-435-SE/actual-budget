# Codebase conventions summary

**Created:** 9/3/2026 21:17:39  
**Updated:** 9/3/2026 21:45:01  
**Exported:** 9/3/2026 22:08:12  
**Link:** [https://claude.ai/chat/f6af533d-0ed9-4e3c-8b3b-794417bdf784](https://claude.ai/chat/f6af533d-0ed9-4e3c-8b3b-794417bdf784)

## User:

> 9/3/2026 21:17:39

> File:

Create a brief summary of the existing conventions for this codebase

## Assistant:

> 9/3/2026 21:17:47

## Actual Budget Contribution Conventions

**Before submitting code**, run these in order:

1. `yarn typecheck` — catch type errors
2. `yarn lint:fix` — auto-fix style issues
3. `yarn test` (or workspace-specific variant) — ensure nothing is broken

**Pull requests** should:

- Link the related issue with `Fixes #<ticket_number>` in the description
- Include a release note generated via `yarn generate:release-notes`
- Drop the `[WIP]` prefix from the title when ready for review
- Stay rebased/merged with `master` until merged

**Release notes** live in `upcoming-release-notes/<slug>.md` with front matter specifying `category` (Features, Enhancements, Bugfix, or Maintenance) and `authors`. Write them as imperative commands — _"Add option to…"_ not _"Added option to…"_

**Feature scope**: Small changes can go straight to a PR. Larger features should start as a GitHub issue to align with the team before implementation begins.

**Design philosophy**: Minimalist UI that progressively exposes advanced features. Avoid adding user-facing toggles/settings for minor UI details (sizes, padding, etc.) — the settings screen is reserved for core settings only.

**Process norms**: Issues are open to anyone (no assignments), PRs aren't guaranteed a review without a clear rationale from the author, and maintainer wellbeing takes priority over turnaround speed.

## User:

> 9/3/2026 21:41:21

What is the defintion of done for Actual Budget prs?

https://actualbudget.org/docs/

## Assistant:

> 9/3/2026 21:41:26

I can see the contributing doc you shared mentions some PR requirements, but it doesn't include a formal "definition of done." To get the full picture from the docs link you shared, I'd need to actually browse that URL — I can't access external links directly.

Based on what's in the document you provided, the closest thing to a PR checklist is:

- Link the related issue with `Fixes #<ticket_number>`
- Add a release note via `yarn generate:release-notes`
- Remove `[WIP]` from the PR title when ready
- Pass `yarn typecheck`, `yarn lint:fix`, and relevant tests
- Keep the branch up to date with `master`
- Include a clear description justifying the change and its tradeoffs (since reviews aren't automatic)

If you'd like me to look at the actual docs site for a more formal definition, you could paste the relevant page content here and I can summarize it. Alternatively, if you have web search enabled, I can try to find it that way.

## User:

> 9/3/2026 21:44:56

Write a definition of done based on existing docs.

## Assistant:

> 9/3/2026 21:45:01

Based solely on the contributing document you shared, here's a Definition of Done for Actual Budget PRs:

---

## Definition of Done — Actual Budget

A pull request is considered ready to merge when:

### Code Quality

- [ ] `yarn typecheck` passes with no errors
- [ ] `yarn lint:fix` has been run and all issues resolved
- [ ] All relevant tests pass (`yarn test` or workspace-specific equivalent)

### PR Hygiene

- [ ] The PR title does **not** have a `[WIP]` prefix
- [ ] The related issue is linked using `Fixes #<ticket_number>` in the description
- [ ] The PR description explains **why** the change is being made and details any tradeoffs
- [ ] The branch is up to date with `master` (via merge or rebase)

### Release Notes

- [ ] A release note has been generated via `yarn generate:release-notes`
- [ ] The note is filed under the correct category: `Features`, `Enhancements`, `Bugfix`, or `Maintenance`
- [ ] The note is phrased as an imperative command (_"Add…"_ not _"Added…"_)

### Design

- [ ] UI changes follow the minimalist, progressive-disclosure design philosophy
- [ ] No unnecessary user-facing toggles or settings have been added for minor UI details

---

Note that passing all of the above does not guarantee a review — the PR author is still responsible for convincing maintainers the change is worthwhile.

Powered by Claude Exporter (https://www.ai-chat-exporter.net)
