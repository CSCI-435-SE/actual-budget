# Personal inflation rate tracking by category

**Created:** 9/10/2026 11:29:50  
**Updated:** 9/10/2026 16:40:45  
**Exported:** 9/13/2026 15:10:46  
**Link:** [https://claude.ai/chat/9ddbf25b-ce6b-4ff0-a802-a56a07938c67](https://claude.ai/chat/9ddbf25b-ce6b-4ff0-a802-a56a07938c67)

## User:

> 9/10/2026 11:29:53

Please help me generate a GitHub Issue for Actual Budget (actualbudget.org) as someone wishing to contribute. Follow the same organization as this example issue:
"Summary

Actual Budget's CSV import currently requires the uploaded file to match a specific column format, or the user must pre-process the file externally. Different banks export CSVs with wildly different headers ("Debit Amount" vs. "Amount" vs. "Transaction Amount"). A column-mapping step added to the existing import wizard — detecting headers from the uploaded file and letting the user assign them to Actual's expected fields — would make importing from any bank's export work without external preprocessing.

User Story

As a user importing a CSV from a bank whose export doesn't match Actual's expected format, I want to map my bank's columns to Actual's fields in a UI step so that I don't have to reformat the file in Excel before every import.

Rough Scope

Large — The mapping step itself is frontend-only (parse headers, show dropdowns, validate, pass to the existing pipeline), but inserting a new step into an existing multi-step import wizard is architecturally fiddly. A beginner team will need to fully understand the wizard's current state flow and step sequencing before touching it, which is significant ramp-up. Getting validation and error states right across the new step adds further scope.

Source

Frequently requested; directly observed in Actual Budget GitHub issues as a common barrier to adoption for new users coming from other budgeting tools. Assisted with Claude for issue generation."

Please base it off of this Discord community idea/suggestion:
"Track Personal Rate of Inflation
I'd love for Actual to include functionality to help me track and report on my personal inflation rate. Actual already knows my categories and their weights relative to my total budget. A simple formula would reveal month over month and year over year changes to actual spending. A real life example for me is groceries. I'm constantly bumping or going over that number this year. Sure I can increase the budget number. But it would be informative for me to know how much more expensive MY groceries are vs. last month/ year as opposed to a generic nationwide inflation number."

## Assistant:

> 9/10/2026 11:30:10

> Viewed file
>
> - Check frontend-design skill for any relevant formatting guidance
> - **Done**

Here's the GitHub issue, modeled closely after the example you provided:

---

**Summary**

Actual Budget already tracks spending by category month over month, but it has no way to surface how much more (or less) a user is spending in a given category relative to a prior period — the personal rate of inflation. Unlike a national CPI figure, a personal inflation rate uses a user's own category weights and actual spending history: if groceries represent 20% of a budget and grocery spending rose 12% year over year, that category contributes differently to the user's real cost-of-living than it would for someone with a 5% grocery weight. A reporting view (and optionally a dashboard widget) that computes month-over-month and year-over-year spending change per category — and an aggregate weighted figure across the full budget — would give users meaningful, personalized inflation visibility that no generic economic index can provide.

**User Story**

As a user who wants to understand my real cost-of-living changes, I want Actual to show me how much my spending in each category has changed versus last month and last year — weighted by each category's share of my total budget — so that I can distinguish genuine price increases from changes in my own habits, without relying on a national inflation figure that doesn't reflect my life.

**Rough Scope**

Medium-to-Large — The core calculation is straightforward: for each category, compute the percentage change in average monthly spending between two periods, then weight each category by its share of total budgeted or actual spend to produce a composite figure. The data is already present in Actual's database. The complexity lies in the reporting surface: decisions about which periods to compare (calendar month vs. rolling 30 days, prior year same month vs. trailing 12-month average), how to handle categories with zero spend in one period (division-by-zero edge cases), and whether to expose this as a standalone report, an addition to the existing Reports section, or a summary widget on the budget view. A beginner team should start by producing the weighted calculation as a standalone read-only report before attempting any dashboard integration.

**Source**

Requested by a community member in the Actual Budget Discord. Directly analogous to well-established personal-finance analysis (personal CPI / cost-of-living tracking) and a natural extension of Actual's existing category-based reporting. Assisted with Claude for issue generation.

---

Feel free to adjust the scope label or any specifics before filing — particularly the period-comparison defaults, since that's the most subjective design call in the feature. Let me know if you'd like a version with more technical implementation detail or a different tone.

## User:

> 9/10/2026 16:01:40

Using the same organization as the example issue, generate me an issue based on the following:
When clicking on the dropdown of the name of the Budget (located on the side panel that you click the hamburger to open up), the box with the different options (Rename Budget, Settings, Switch File) does not go away with the side panel.

## Assistant:

> 9/10/2026 16:01:47

**Summary**

When the side navigation panel is opened via the hamburger menu and the budget name dropdown is triggered, a floating options box appears containing actions such as Rename Budget, Settings, and Switch File. If the user closes the side panel while this dropdown is open, the panel dismisses correctly but the dropdown overlay remains visible on screen, orphaned from its trigger element. The dropdown should be dismissed whenever its parent panel is closed.

**User Story**

As a user who opens the budget name dropdown and then closes the side panel, I want the dropdown to close along with the panel so that I don't see a floating, non-functional menu left over on the screen.

**Rough Scope**

Small — This is a UI state synchronization bug. The fix requires ensuring the dropdown's open state is reset (or the component unmounted) when the side panel closes, rather than allowing the two pieces of state to diverge. The side panel's close handler — or a useEffect watching the panel's open state — is the most likely place to add the dismissal. No new UI, no data layer changes, and no architectural decisions are involved. A beginner contributor should be able to locate the relevant panel and dropdown components and trace the close event with modest ramp-up.

**Source**

Directly observed behavior reported by a community member. Assisted with Claude for issue generation.

## User:

> 9/10/2026 16:04:13

What would be a good title for this issue

## Assistant:

> 9/10/2026 16:04:16

A few options depending on the tone/style the project uses:

**Bug-style (most common for GitHub issues):**

- `Bug: Budget name dropdown persists after side panel is closed`
- `Bug: Budget dropdown does not dismiss when hamburger menu is closed`

**Descriptive without a prefix:**

- `Budget name dropdown stays open when side panel is closed`

I'd lean toward **`Bug: Budget name dropdown persists after side panel is closed`** — it's precise, scannable, and makes the cause/effect relationship immediately clear to a maintainer skimming the issue list.

## User:

> 9/10/2026 16:31:23

Using the same organization as the example issue, generate me an issue based on the following:
Limit length of bank account name, the app should enforce a reasonable character maximum and notify users when they are near or at the limit so that they do not encounter unexpected errors when saving

## Assistant:

> 9/10/2026 16:31:31

**Summary**

Actual Budget currently does not enforce a maximum character length on bank account name fields. Users who enter an unusually long account name may encounter an unexpected error at save time — after the fact, with no prior warning — rather than being guided toward a valid input as they type. A reasonable character limit enforced at the input level, paired with a visible character counter that warns users as they approach the cap, would prevent silent failures and bring the field in line with standard form UX expectations.

**User Story**

As a user creating or editing a bank account, I want the account name field to show me how close I am to the character limit as I type so that I don't hit an unexpected error after trying to save a name that is too long.

**Rough Scope**

Small — The fix has two parts: adding a `maxLength` constraint to the account name input (either as an HTML attribute or validated on submit), and rendering a character counter near the field that becomes visually prominent as the user nears the limit. Both are frontend-only changes scoped to the account creation and edit forms. The main decision to align on before opening a PR is what the character maximum should be — this should match any constraint already enforced by the underlying data layer or sync backend, if one exists, so that the UI limit and the real limit are never out of sync. A beginner contributor can tackle this with a straightforward understanding of the relevant form component.

**Source**

Reported as unexpected behavior by a community member encountering silent save errors. Assisted with Claude for issue generation.

## User:

> 9/10/2026 16:40:37

Using the same organization as the example issue, generate me an issue based on the following:
The main view/screen should always be resized when the side panel is opened up so that no information gets covered up while the side panel is open

## Assistant:

> 9/10/2026 16:40:45

**Summary**

When the side navigation panel is opened via the hamburger menu, it overlays the main budget view rather than pushing or resizing it. Content beneath the panel — including budget rows, account balances, and transaction data — remains rendered at full width but is partially or fully obscured by the panel. The main content area should reflow to occupy only the remaining visible space while the panel is open, ensuring no information is hidden behind it at any screen size where both can reasonably coexist.

**User Story**

As a user who opens the side panel while reviewing my budget, I want the main content area to resize so that it fits alongside the open panel so that I can still see and interact with my budget data without the panel covering it up.

**Rough Scope**

Medium — The core change is a layout adjustment: the main content area needs to respond to the panel's open state, either by reducing its width or shifting its offset to accommodate the panel's footprint. If the layout is already flex or grid-based this may be relatively contained, but if the panel is currently positioned absolutely or fixed outside the normal document flow, the main content area will need structural changes to participate in the same layout context. Care is also needed at smaller viewport widths where there may not be enough room for both panel and content to coexist, in which case the existing overlay behavior may be the correct fallback. A beginner contributor should audit the current panel positioning strategy and the main layout's structure before writing any code, as the right fix depends heavily on how these two elements are currently composed.

**Source**

Reported as a usability gap by a community member. Consistent with standard side-drawer layout patterns where content reflow is the expected behavior. Assisted with Claude for issue generation.

Powered by Claude Exporter (https://www.ai-chat-exporter.net)
