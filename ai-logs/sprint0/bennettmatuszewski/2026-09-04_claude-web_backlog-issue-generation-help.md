# CSV export for account transactions

**Created:** 9/4/2026 10:03:44  
**Updated:** 9/4/2026 10:17:01  
**Exported:** 9/4/2026 10:34:47  
**Link:** [https://claude.ai/chat/dcfc289a-a6d6-49ba-864a-b66a6a5ae033](https://claude.ai/chat/dcfc289a-a6d6-49ba-864a-b66a6a5ae033)

## User:

> 9/4/2026 10:03:45

I am working on contributing to Actual Budget, an open source budget tracking app for my software engineering class. I need to draft features to put in the issue backlog for my team. One idea I had for an issue was a "download all transactions as CSV" button at the account level. Using the issue creation guidelines, create an issue title and description, prompting me for more detail if needed.

https://github.com/actualbudget/actual

There is no upper limit. If you have more ideas, open more issues. Remember that you team will have to analyze the existing backlog of issues, decompose them, prioritize them, assign them, etc. within a given sprint so that the work reasonably fits 2.5 - 3 weeks. Therefore, it is okay to have many ideas/issues in Sprint 0.
What makes a good issue: A feature is a user-visible or developer-visible change that makes the product better: a new capability, a significant improvement to an existing one, or a meaningful non-functional improvement (performance, accessibility, security). Each issue must include:
Field Description
Title Short, descriptive, action-oriented (e.g., "Add keyboard shortcut to dismiss notification toasts")
Summary what the feature is, why it matters, who benefits
User story "As a [role], I want [action] so that [outcome]" or a short scenario of what user needs to do and how the system should respond
Rough scope Small / Medium / Large / XL — one sentence justifying the estimate
Source Where the idea came from (project issue tracker, personal use, docs gap, community request, etc.)
Issue labels to apply (use the project's existing labels where available; create these if they don't exist):
Label Meaning
scope: small / scope: medium / scope: large / scope: xl Size estimate
type: feature This is a new capability
type: improvement Improving an existing capability
type: bug This is a bug
Aim high on the ambitious ones
Sprint 0 is the time to think big. Some of these features will be scoped, decomposed, or merged during Sprint 1 requirements analysis; that is expected. Propose features you would actually want to use or build.

## Assistant:

> 9/4/2026 10:05:24

Let me check out the Actual Budget repo and their existing issue guidelines before drafting anything.

> Ran 5 commands
>
> - Get repo info
> - Get existing labels
> - Get labels raw
> - Check for issue templates
> - Check contributing guide
> - **Done**

Good — I have enough context from the repo and your guidelines. Rather than prompting you for more detail upfront (since you've given me a solid seed idea and the "think big" mandate), let me draft a full Sprint 0 backlog. I'll start with your CSV idea and expand from there into features a real Actual Budget user or contributor would genuinely want.

> Viewed file
>
> - Check for skills
> - **Done**

I have what I need. Let me write up a full Sprint 0 backlog as a Markdown file — your CSV idea plus a solid set of ambitious, well-scoped issues.

> Created file, presented file
>
> - Sprint 0 issue backlog for Actual Budget contributions
> - Presenting file(s)...
> - **Done**

Here's the full Sprint 0 backlog — 12 issues total. Here's a quick overview of what's in there and the thinking behind it:

**Your original idea** (Issue 1 — Export CSV) is scoped Small and ready to post as-is.

**The rest** are organized to give your team a healthy mix:

| Size       | Issues                                                                                               |
| ---------- | ---------------------------------------------------------------------------------------------------- |
| Small (5)  | CSV Export, Skip Recurring Occurrence, Payee Merge, Command Palette, …and Keyboard Shortcuts overlay |
| Medium (5) | Bulk Edit, Undo, Budget Templates, CSV Import Column Mapping, Dark Mode, Advanced Search             |
| Large (1)  | Net Worth Dashboard                                                                                  |
| XL (1)     | Mobile-Responsive UI                                                                                 |

A few of these are genuinely ambitious picks that will likely get decomposed in Sprint 1 (Mobile Responsive, Net Worth Dashboard), which is exactly what Sprint 0 is for. The Small/Medium ones are realistic candidates for a 2.5–3 week sprint once your team prioritizes.

**A few questions that might sharpen any of these before you post them:**

1. Does your team have any particular strength — frontend-heavy, data/query work, design? That would influence which to prioritize.
2. Are you targeting the self-hosted web version, or also the Electron desktop app? Some of these (especially mobile) have different implications depending on the answer.
3. Any of these catch your eye as ones you'd personally want to build? Happy to flesh those out further or break them into sub-issues.

> File: [/mnt/user-data/outputs/actual_budget_sprint0_issues.md](https://claude.ai/api/organizations/38254c7f-df06-43f6-8b6b-ffc54a0a88e9/conversations/dcfc289a-a6d6-49ba-864a-b66a6a5ae033/wiggle/download-file?path=%2Fmnt%2Fuser-data%2Foutputs%2Factual_budget_sprint0_issues.md)

## User:

> 9/4/2026 10:08:23

1. Our strength is more simple, frontend heavy changes. Avoid heavy data/query work and design.
2. We are focusing on the self-hosted web version.
3. Issues 1, 2,4,6,7,9,10 appeal to me most

## Assistant:

> 9/4/2026 10:08:38

Good callouts. Let me re-evaluate each of your 7 picks against your constraints (frontend-focused, no heavy data/query work, web version) and flag any concerns before you commit them to the backlog.

**Issue 1 — Export CSV** ✅ Keep as-is. Pure frontend — serialize existing data to a string, trigger a download. Perfect scope: Small.

**Issue 2 — Bulk Edit Transactions** ✅ Keep. Mostly UI state (checkbox selection, action toolbar). The actual data writes reuse existing single-transaction update paths. Medium is right.

**Issue 4 — Net Worth Dashboard** ⚠️ **Caution.** This one is deceptively backend-heavy. The chart itself is frontend, but generating balance snapshots over time requires non-trivial aggregation queries across account history. I'd recommend either dropping it or narrowing it significantly — see below.

**Issue 6 — Undo for Edits/Deletions** ⚠️ **Caution.** The undo stack itself is frontend state, but hooking it reliably into Actual's sync/persistence layer (it uses a local SQLite database via a custom sync engine) is tricky. A session-only, in-memory undo for single transaction edits is doable frontend-only; bulk undo or persistence across reloads gets complicated fast. Worth keeping but with a tighter scope.

**Issue 7 — Payee Merge** ✅ Keep. The UI is a simple list + merge action. The data write is a bulk UPDATE but it's a single well-defined operation, not a query design problem.

**Issue 9 — Command Palette** ✅ Keep as-is. Entirely frontend. A library like `cmdk` does the heavy lifting. Small.

**Issue 10 — CSV Import Column Mapping** ✅ Keep. The mapping step is pure frontend — parse headers from the uploaded file, show a mapping UI, feed results into the existing import pipeline. No query changes.

---

Here's what I'd suggest doing with the two flagged ones:

- **Issue 4 (Net Worth):** Narrow it to a _static_ Net Worth summary card — current assets vs. liabilities from already-loaded account balances, no historical chart. That removes the aggregation query problem entirely. I can rewrite it at that reduced scope.
- **Issue 6 (Undo):** Narrow explicitly to _single-transaction_ undo only, session-scoped, so it's purely a React state problem with no sync-layer involvement.

Want me to rewrite those two with the tightened scopes, then produce a clean final version of just your 7 issues?

## User:

> 9/4/2026 10:09:06

Yes, go ahead

## Assistant:

> 9/4/2026 10:10:03

> Ran command, presented file
>
> - Write final issue backlog
> - Presenting file(s)...
> - **Done**

Here's the final set — 7 issues, all frontend-safe, all targeting the web version. Here's a quick summary of what changed from the earlier draft:

**Issue 4 (Net Worth)** was rewritten from a Large featuring a historical chart and backend aggregation queries, down to a Small that just does arithmetic on account balances already in memory. No new queries at all — it's purely a new display component.

**Issue 6 (Undo)** was narrowed to single-transaction, session-only undo implemented entirely in React state. The key constraint called out explicitly in the scope is that it must not touch the sync/persistence layer — keeping it safely in frontend territory.

The final shape of the backlog:

| #   | Issue                     | Size   |
| --- | ------------------------- | ------ |
| 1   | Export CSV                | Small  |
| 2   | Bulk Edit Transactions    | Medium |
| 3   | Net Worth Summary Card    | Small  |
| 4   | Undo Last Transaction     | Medium |
| 5   | Payee Merge Tool          | Small  |
| 6   | Command Palette           | Small  |
| 7   | CSV Import Column Mapping | Medium |

Four Smalls and three Mediums gives your team good flexibility when prioritizing — you can stack a couple Smalls with a Medium in a sprint without overcommitting. Let me know if you want any of these decomposed into sub-issues or if the scope on any feels off.

> File: [/mnt/user-data/outputs/actual_budget_sprint0_issues_final.md](https://claude.ai/api/organizations/38254c7f-df06-43f6-8b6b-ffc54a0a88e9/conversations/dcfc289a-a6d6-49ba-864a-b66a6a5ae033/wiggle/download-file?path=%2Fmnt%2Fuser-data%2Foutputs%2Factual_budget_sprint0_issues_final.md)

## User:

> 9/4/2026 10:15:02

Let's rewrite the scope a bit. This is a beginner team, for example, I think issue 1 should at minimum be medium in scope.

## Assistant:

> 9/4/2026 10:15:13

Good call — a beginner team will spend real time just orienting to the codebase, finding the right files to touch, understanding Actual's component patterns, and getting a dev environment running. Even "trivial" frontend work takes longer when everything is unfamiliar.

Here's how I'd re-estimate the whole set with that lens:

| #   | Issue                     | Old Scope | New Scope  | Reasoning                                                                                                                                                                                                               |
| --- | ------------------------- | --------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Export CSV                | Small     | **Medium** | Finding the right component to add the button, understanding how transaction data is accessed in that context, and handling edge cases (empty account, filtered view vs. full account) all take real time for beginners |
| 2   | Bulk Edit Transactions    | Medium    | **Large**  | Multi-select UI state, a conditional toolbar, and coordinating writes across multiple records are each non-trivial — combined for a beginner team this is a lot to hold together                                        |
| 3   | Net Worth Summary Card    | Small     | **Medium** | Simple arithmetic, but finding where to slot a new component into the accounts page, understanding the data flow to that component, and matching Actual's visual style all add up                                       |
| 4   | Undo Last Transaction     | Medium    | **Large**  | Capturing before-snapshots at mutation points requires deeply understanding where and how mutations happen in the codebase — that archaeology alone is significant for beginners                                        |
| 5   | Payee Merge Tool          | Small     | **Medium** | Requires building a net-new management screen, not just adding to an existing one — routing, layout, and the merge write are each a learning moment                                                                     |
| 6   | Command Palette           | Small     | **Medium** | `cmdk` handles the widget, but wiring it to live app state (accounts list, navigation) and getting keyboard shortcuts right without conflicts is trickier than it looks                                                 |
| 7   | CSV Import Column Mapping | Medium    | **Large**  | Adding a new step to an existing multi-step wizard is architecturally fiddly — understanding the wizard's state flow before touching it will take significant ramp-up                                                   |

Want me to rewrite all 7 issues with the updated scope estimates and revised justifications baked in?

## User:

> 9/4/2026 10:16:07

Looks good to me!

## Assistant:

> 9/4/2026 10:17:01

> Ran command, presented file
>
> - Rewrite final backlog with updated scope estimates
> - Presenting file(s)...
> - **Done**

All 7 issues updated. Final breakdown:

| #   | Issue                     | Scope  |
| --- | ------------------------- | ------ |
| 1   | Export CSV                | Medium |
| 2   | Bulk Edit Transactions    | Large  |
| 3   | Net Worth Summary Card    | Medium |
| 4   | Undo Last Transaction     | Large  |
| 5   | Payee Merge Tool          | Medium |
| 6   | Command Palette           | Medium |
| 7   | CSV Import Column Mapping | Large  |

Nothing ended up Small, which feels right for a beginner team — even the "simple" issues have a codebase orientation tax baked in. The Large issues (2, 4, 7) are the ones most likely to get decomposed into sub-issues during Sprint 1 planning, which is exactly what that session is for. Good luck posting these!

> File: [/mnt/user-data/outputs/actual_budget_sprint0_issues_final.md](https://claude.ai/api/organizations/38254c7f-df06-43f6-8b6b-ffc54a0a88e9/conversations/dcfc289a-a6d6-49ba-864a-b66a6a5ae033/wiggle/download-file?path=%2Fmnt%2Fuser-data%2Foutputs%2Factual_budget_sprint0_issues_final.md)

Powered by Claude Exporter (https://www.ai-chat-exporter.net)
