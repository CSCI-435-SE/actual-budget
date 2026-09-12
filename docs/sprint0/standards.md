# Standards & Guidelines - Actual Budget

**Version & Date:** v1.0 [2026-09-04]
**Project Repo:** https://github.com/CSCI-435-SE/actual-budget

## Existing Conventions

There are many existing conventions that exist when contributing to Actual Budget that will be carried over into CSCI-435. Below is a summary of many existing conventions.

### Contributing Conventions

These contributing conventions can be found in the documentation here. What follows is a brief summary.

Before submitting code, run these in order:

1. `yarn typecheck` — catch type errors
2. `yarn lint:fix` — auto-fix style issues
3. `yarn test` (or workspace-specific variant) — ensure nothing is broken

Pull requests should:

- Link the related issue with `Fixes #<ticket_number>` in the description
- Include a release note generated via `yarn generate:release-notes`
- Drop the `[WIP]` prefix from the title when ready for review
- Stay rebased/merged with master until merged

Release notes live in `upcoming-release-notes/<slug>.md` with front matter specifying category (Features, Enhancements, Bugfix, or Maintenance) and authors. Write them as imperative commands — "Add option to…" not "Added option to…"

**Feature scope:** Small changes can go straight to a PR. Larger features should start as a GitHub issue to align with the team before implementation begins.

**Design philosophy:** Minimalist UI that progressively exposes advanced features. Avoid adding user-facing toggles/settings for minor UI details (sizes, padding, etc.) — the settings screen is reserved for core settings only.

**Process norms:** Issues are open to anyone (no assignments), PRs aren't guaranteed a review without a clear rationale from the author, and maintainer wellbeing takes priority over turnaround speed.

### AI Use Conventions

The documentation also contains an official AI use policy which can be found here. In short, AI is allowed for contributions to the project. This being said, it should be used carefully, must be disclosed, and should not be used when interacting with maintainers. It also acknowledges that modern AI tools make it easy to generate a large number of changes very quickly, and emphasizes quality over quantity when creating new PRs.

### Testing Conventions

Actual Budget also contains an extensive testing framework, which can be found here. The project uses Vitest for unit testing, Playwright for E2E testing, and Lage for running tests across the monorepo efficiently. The framework notes that before submitting a pull request:

- All existing tests pass (`yarn test`)
- New functionality has appropriate test coverage
- Tests follow best practices (minimize mocking, descriptive names)
- E2E tests pass if UI changes were made

### Coding Conventions

The Actual Budget project contains a list of coding conventions which can be found here. The coding conventions listed are fairly standard across modern web applications made with React, and emphasize clean, readable, and reusable code.

## Definition of Done

The Actual Budget documentation does not contain a formal definition of done, but one can be inferred from the available information.

A pull request is considered ready to merge when:

### Code Quality

- `yarn typecheck` passes with no errors
- `yarn lint:fix` has been run and all issues resolved
- All relevant tests pass (`yarn test` or workspace-specific equivalent)

### PR Hygiene

- The PR title does not have a `[WIP]` prefix
- The related issue is linked using `Fixes #<ticket_number>` in the description
- The PR description explains why the change is being made and details any tradeoffs
- The branch is up to date with master (via merge or rebase)

### Release Notes

- A release note has been generated via `yarn generate:release-notes`
- The note is filed under the correct category: Features, Enhancements, Bugfix, or Maintenance
- The note is phrased as an imperative command ("Add…" not "Added…")

### Design

- UI changes follow the minimalist, progressive-disclosure design philosophy
- No unnecessary user-facing toggles or settings have been added for minor UI details
