# Bulk categorize imported transactions

**Created:** 9/24/2026 18:10:02  
**Updated:** 9/24/2026 18:20:05  
**Exported:** 9/24/2026 18:27:00  
**Link:** [https://claude.ai/chat/99d46150-946d-4ec2-a774-5603e46b78f5](https://claude.ai/chat/99d46150-946d-4ec2-a774-5603e46b78f5)  

## User:

> 9/24/2026 18:10:06

Look at this existing ticket, write detailed  acceptance criteria, out of scope, and open questions.

**User Story**

As a user who just imported 80 credit card transactions, I want to select all "Uncategorized" entries and assign them a category in one action so that I don't have to click into each transaction one by one.

## User Scenario
When users import a large batch of transactions — say, three months of credit card statements — they often need to recategorize dozens of entries at once. Currently, each transaction must be edited individually. A multi-select checkbox on the transactions list plus a bulk-action toolbar (set category, set payee, add/replace notes, delete) would dramatically reduce the time cost of keeping a budget up to date after an import.

## Acceptance Criteria
1. 
2. 
3. 

## Out of Scope
- ...

## Open Questions
- ...

**Rough Scope**

Large — Multi-select UI state, a conditional bulk-action toolbar, and coordinating writes across multiple records are each non-trivial on their own. Combined, and in an unfamiliar codebase, a beginner team will need to hold a lot of moving pieces together simultaneously. Interaction design also needs careful attention to prevent accidental bulk overwrites.

**Source**

Common pain point reported repeatedly in the Actual Budget community Discord and GitHub Discussions. Assisted with Claude for issue generation.

## Assistant:

> 9/24/2026 18:10:40

> Viewed file
>
> - Check for frontend design skill
> - **Done**

Here's the filled-out ticket:

---

**User Story**

As a user who just imported 80 credit card transactions, I want to select all "Uncategorized" entries and assign them a category in one action so that I don't have to click into each transaction one by one.

## User Scenario
When users import a large batch of transactions — say, three months of credit card statements — they often need to recategorize dozens of entries at once. Currently, each transaction must be edited individually. A multi-select checkbox on the transactions list plus a bulk-action toolbar (set category, set payee, add/replace notes, delete) would dramatically reduce the time cost of keeping a budget up to date after an import.

## Acceptance Criteria

1. **Checkbox column** — A checkbox appears as the first column of every row in the transactions list. It is hidden (or shown as a faint placeholder) until the user hovers a row or checks any checkbox, at which point all checkboxes become visible and remain visible until the selection is cleared.
2. **Select-all control** — A checkbox in the column header selects all transactions currently visible in the list (respecting any active filters). Checking it again, or checking it when some rows are already selected, enters an indeterminate state; a second click deselects all.
3. **"Select all uncategorized" shortcut** — When a filter for "Uncategorized" is active (or via a dedicated quick-filter), a banner or button reads "Select all [N] uncategorized transactions." Clicking it selects every matching row, even those not yet scrolled into view.
4. **Bulk-action toolbar** — When ≥1 row is selected, a toolbar appears (above or pinned below the list). It shows: selected count, **Set Category**, **Set Payee**, **Add / Replace Notes**, and **Delete**. The toolbar disappears when selection is cleared.
5. **Set Category action** — Clicking "Set Category" opens the existing category picker. Confirming applies the chosen category to all selected transactions and shows a toast: "Category updated for [N] transactions."
6. **Set Payee action** — Same pattern as Set Category, using the existing payee picker/input.
7. **Add / Replace Notes action** — A modal offers two radio options: "Add to existing notes" and "Replace notes." The user types the text and confirms. Result toast: "Notes updated for [N] transactions."
8. **Delete action** — A confirmation dialog lists the count and warns the action is irreversible. Confirming deletes all selected transactions. Result toast: "Deleted [N] transactions." Undo is available for the same session duration as single-transaction delete, if that pattern already exists.
9. **Partial failure handling** — If one or more records fail to update (e.g., a sync conflict), the toast reports how many succeeded and how many failed, and the failed rows remain selected.
10. **Selection persistence during scroll** — Checked rows stay checked while the user scrolls. Applying a filter or navigating away from the page clears the selection.
11. **Keyboard accessibility** — Space toggles the focused row's checkbox; `Escape` clears the selection and dismisses the toolbar; bulk-action buttons are reachable via Tab and operable via Enter/Space.
12. **Mobile / narrow viewport** — On viewports below the breakpoint where a checkbox column is impractical, a long-press (or tap-and-hold) on a row enters selection mode, with the same toolbar appearing at the bottom of the screen.

## Out of Scope

- Saved or named selection sets (e.g., "my import selection") — selections are ephemeral per session.
- Bulk-editing amount, date, or account fields — only category, payee, notes, and delete are in scope.
- Cross-account bulk actions (selecting transactions from multiple accounts simultaneously).
- Undo/redo infrastructure beyond what already exists for single-transaction delete.
- Scheduled or deferred bulk actions (e.g., "apply this category to all future transactions from this payee") — that is a rules/auto-categorization feature.
- Bulk import or bulk export of transactions.
- Any changes to the import flow itself.

## Open Questions

1. **Select-all scope** — When the user clicks "select all," should it select only the rows loaded in the current virtual/paginated window, or truly every matching record in the database? If the list is virtualized and thousands of rows exist, a "select all in DB" path requires a different code path than "select all rendered rows." Which behavior is expected, and is there a row-count cap?
2. **Undo behavior** — Does a bulk delete need to be undoable? If so, does the existing undo stack support batched operations, or would this require new infrastructure?
3. **Conflict with existing inline edit** — Today, clicking a row opens it for inline editing. Does adding a checkbox column change that click target, or does clicking anywhere outside the checkbox still open the row? This needs a clear decision before implementation to avoid conflicting event handlers.
4. **Filter interaction** — If the user selects 20 rows, then changes the active filter, should the previously selected (now hidden) rows remain selected, or does a filter change implicitly clear selection? Either choice needs a clear indicator.
5. **Bulk-action order of operations** — If a user opens "Set Category" and "Set Payee" back-to-back without clearing selection, are those treated as two separate writes per record? Confirming expected behavior prevents duplicate network calls or race conditions.
6. **Permission / read-only accounts** — Are there budget configurations (e.g., shared budgets with viewer-only access) where bulk edits should be disabled? If so, should the checkboxes be hidden, or shown but the toolbar actions disabled with a tooltip?
7. **"Replace notes" default** — Should the notes modal default to "Add" or "Replace"? Defaulting to "Replace" is more dangerous; defaulting to "Add" may surprise users expecting an overwrite. Worth a quick design review or a Discord poll given this is a community-sourced feature.

## User:

> 9/24/2026 18:12:16

make the acceptance criteria more succint, and add in the numbers that can be copypasted plaintext

## Assistant:

> 9/24/2026 18:12:24

Here's the updated Acceptance Criteria section — ready to copy:

---

## Acceptance Criteria

1. Every transaction row has a checkbox as its first column; checkboxes are visually subtle until the user hovers a row or checks one, after which all remain visible until selection is cleared.
2. A header checkbox selects all visible rows (respecting active filters); when rows are partially selected it shows an indeterminate state, and clicking it again deselects all.
3. When an "Uncategorized" filter is active, a prompt reads "Select all [N] uncategorized transactions" and selects every matching record, including rows not yet scrolled into view.
4. Selecting ≥1 row shows a bulk-action toolbar displaying the selected count and actions: **Set Category**, **Set Payee**, **Add / Replace Notes**, and **Delete**; the toolbar disappears when selection is cleared.
5. **Set Category** opens the existing category picker; confirming applies the category to all selected rows and shows a toast: "Category updated for [N] transactions."
6. **Set Payee** follows the same pattern as Set Category using the existing payee picker.
7. **Add / Replace Notes** opens a modal with two options — append to existing notes or overwrite them — plus a text input; confirming shows a toast: "Notes updated for [N] transactions."
8. **Delete** requires a confirmation dialog stating the count and that the action is irreversible; confirming shows a toast: "Deleted [N] transactions."
9. If any records fail to update, the toast reports how many succeeded and how many failed, and the failed rows remain selected.
10. Checked rows persist while scrolling; applying a filter or navigating away clears the selection.
11. `Space` toggles the focused row's checkbox; `Escape` clears selection and dismisses the toolbar; all toolbar actions are reachable by `Tab` and operable by `Enter` or `Space`.
12. On narrow viewports, long-pressing a row enters selection mode and the toolbar pins to the bottom of the screen.

## User:

> 9/24/2026 18:12:36

the numbers cant be copy pasted.

## Assistant:

> 9/24/2026 18:12:40

You're right — the bold formatting is interfering. Here's the plain text version:

---

## Acceptance Criteria

1. Every transaction row has a checkbox as its first column; checkboxes are visually subtle until the user hovers a row or checks one, after which all remain visible until selection is cleared.
2. A header checkbox selects all visible rows (respecting active filters); when rows are partially selected it shows an indeterminate state, and clicking it again deselects all.
3. When an "Uncategorized" filter is active, a prompt reads "Select all [N] uncategorized transactions" and selects every matching record, including rows not yet scrolled into view.
4. Selecting 1 or more rows shows a bulk-action toolbar displaying the selected count and actions: Set Category, Set Payee, Add / Replace Notes, and Delete; the toolbar disappears when selection is cleared.
5. Set Category opens the existing category picker; confirming applies the category to all selected rows and shows a toast: "Category updated for [N] transactions."
6. Set Payee follows the same pattern as Set Category using the existing payee picker.
7. Add / Replace Notes opens a modal with two options — append to existing notes or overwrite them — plus a text input; confirming shows a toast: "Notes updated for [N] transactions."
8. Delete requires a confirmation dialog stating the count and that the action is irreversible; confirming shows a toast: "Deleted [N] transactions."
9. If any records fail to update, the toast reports how many succeeded and how many failed, and the failed rows remain selected.
10. Checked rows persist while scrolling; applying a filter or navigating away clears the selection.
11. Space toggles the focused row's checkbox; Escape clears selection and dismisses the toolbar; all toolbar actions are reachable by Tab and operable by Enter or Space.
12. On narrow viewports, long-pressing a row enters selection mode and the toolbar pins to the bottom of the screen.

## User:

> 9/24/2026 18:16:09

Let's add the same missing categories to this ticket and fix the existing formatting for the titles.

**Summary**

Over time, imported transactions accumulate near-duplicate payee names ("AMAZON", "Amazon.com", "AMAZON MKTPLACE", "Amazon Prime"). These fragment spending reports and make auto-categorization rules harder to write. A Payee Management screen where users can view all payees, select duplicates, and merge them into a canonical name would keep data clean. Merging should retroactively update all transactions that referenced the old name(s).

**User Story**

As a user with 15 variations of "Amazon" as payees, I want to select them all and merge them into one canonical payee so that my spending reports accurately reflect total Amazon spending.

**Rough Scope**

Medium — Unlike most of these issues, this one requires building a net-new management screen rather than adding to an existing one, which means dealing with routing, page layout, and the merge write all at once. Each of those is a learning moment for a beginner team, and the edge case of conflicting auto-categorization rules on merged payees will require careful handling.

**Source**

Common data hygiene problem for anyone who imports bank or credit card CSVs; observed in Actual Budget community discussions. Assisted with Claude for issue generation.

## Assistant:

> 9/24/2026 18:16:25

**Summary**

Over time, imported transactions accumulate near-duplicate payee names ("AMAZON", "Amazon.com", "AMAZON MKTPLACE", "Amazon Prime"). These fragment spending reports and make auto-categorization rules harder to write. A Payee Management screen where users can view all payees, select duplicates, and merge them into a canonical name would keep data clean. Merging should retroactively update all transactions that referenced the old name(s).

## User Story

As a user with 15 variations of "Amazon" as payees, I want to select them all and merge them into one canonical payee so that my spending reports accurately reflect total Amazon spending.

## Acceptance Criteria

1. A Payee Management screen is accessible from the main navigation or budget settings, and lists all payees alphabetically with a transaction count next to each name.
2. Each payee row has a checkbox; a header checkbox selects all visible payees, with an indeterminate state when partially selected.
3. A search or filter input narrows the list in real time so users can surface near-duplicates (e.g., typing "amazon" shows all variants).
4. Selecting 2 or more payees enables a Merge button in a toolbar that also shows the selected count.
5. Clicking Merge opens a confirmation modal listing the selected payees and a text input pre-filled with the alphabetically first selection, allowing the user to set the canonical name before confirming.
6. Confirming the merge renames all transactions that referenced any of the old payee names to the canonical name and removes the old payees from the payee list.
7. If any merged payees had conflicting auto-categorization rules, the modal surfaces the conflict before confirming and asks the user to choose which rule to keep, discard, or combine.
8. After a successful merge, a toast reads "Merged [N] payees into [canonical name]" and the list updates to show only the canonical payee with the combined transaction count.
9. If any records fail to update, the toast reports how many succeeded and how many failed, and no partial rename is committed — the operation is all-or-nothing.
10. The merge action is reachable by keyboard: Tab to reach the toolbar, Enter or Space to open the modal, and Escape to cancel without changes.

## Out of Scope

- Automatically suggesting likely duplicate payees (fuzzy matching or ML-based deduplication).
- Splitting one payee into multiple payees.
- Bulk-renaming a payee without merging (renaming a single payee is a separate edit action on the payee row).
- Merging payees across multiple budgets.
- Undoing a merge after navigating away from the page.

## Open Questions

1. Should a merged payee's canonical name be editable inline on the Payee Management screen, or only via the merge flow? Clarifying this avoids building two separate rename paths.
2. If two payees each have an auto-categorization rule that assigns different categories, is the conflict resolution always a manual user choice, or should one rule (e.g., the one on the payee with more transactions) win by default?
3. Is there a practical upper limit on payees that can be merged in one operation? A merge touching thousands of transactions could be slow and may need a loading state or background job.
4. Should deleted payees (ones with zero transactions after a prior cleanup) appear in this list, or only payees currently referenced by at least one transaction?

## Rough Scope

Medium — Unlike most of these issues, this one requires building a net-new management screen rather than adding to an existing one, which means dealing with routing, page layout, and the merge write all at once. Each of those is a learning moment for a beginner team, and the edge case of conflicting auto-categorization rules on merged payees will require careful handling.

## Source

Common data hygiene problem for anyone who imports bank or credit card CSVs; observed in Actual Budget community discussions. Assisted with Claude for issue generation.

## User:

> 9/24/2026 18:18:19

Ok great, do the same here

**Summary**

Actual Budget tracks balances across checking, savings, loans, and credit cards, but there is no single view that shows net worth (assets minus liabilities) at a glance. A Net Worth summary card on the accounts overview page — pulling from already-loaded account balances and broken down by asset accounts vs. liability accounts — would give users an immediate read on their overall financial position without navigating account by account.

**User Story**

As a user on the accounts overview page, I want to see my total assets, total liabilities, and net worth in a summary card so that I can understand my overall financial position at a glance without adding up account balances myself.

**Rough Scope**

Medium — The arithmetic is simple and account balances are already in memory, but for a beginner team finding where to slot a new component into the accounts page, understanding the data flow to that component, and matching Actual's existing visual style and component conventions all add meaningful time on top of the core logic.

**Source**

Derived from a common feature request; scoped down from a full Net Worth report to stay frontend-only. Assisted with Claude for issue generation.

## Assistant:

> 9/24/2026 18:18:31

**Summary**

Actual Budget tracks balances across checking, savings, loans, and credit cards, but there is no single view that shows net worth (assets minus liabilities) at a glance. A Net Worth summary card on the accounts overview page — pulling from already-loaded account balances and broken down by asset accounts vs. liability accounts — would give users an immediate read on their overall financial position without navigating account by account.

## User Story

As a user on the accounts overview page, I want to see my total assets, total liabilities, and net worth in a summary card so that I can understand my overall financial position at a glance without adding up account balances myself.

## Acceptance Criteria

1. A summary card appears at the top of the accounts overview page showing three values: Total Assets, Total Liabilities, and Net Worth.
2. Total Assets is the sum of all positive-balance account types (e.g., checking, savings, investments); Total Liabilities is the sum of all liability account types (e.g., credit cards, loans); Net Worth is Total Assets minus Total Liabilities.
3. All three values update immediately when any account balance changes on the page, with no additional user action required.
4. Each value is formatted consistently with the currency and decimal conventions used elsewhere in Actual.
5. Net Worth is visually distinguished when negative (e.g., displayed in red) to make an at-a-glance deficit obvious.
6. The card is visible without scrolling on typical desktop viewports and reflows gracefully on narrow viewports without truncating values.
7. If an account is hidden or excluded from totals by the user, it is also excluded from the summary card calculations.

## Out of Scope

- A full Net Worth over time report or chart.
- Filtering the summary by date range or custom account groupings.
- Including off-budget accounts in the totals.
- Any new backend endpoints — all values must be derived from balances already loaded in the accounts overview.
- Exporting or sharing the summary card.

## Open Questions

1. Should off-budget accounts (e.g., a tracking account for a mortgage) be included, excluded, or optionally toggleable? This affects both the arithmetic and the UI.
2. Is there an existing summary or header component on the accounts page this card should slot into, or does it need to be a net-new component placed above the account list?
3. Should the card be collapsible or dismissible for users who do not want it? If so, should that preference persist across sessions?
4. How should accounts with a zero balance be treated in the asset vs. liability breakdown — counted in assets, ignored entirely, or shown separately?

## Rough Scope

Medium — The arithmetic is simple and account balances are already in memory, but for a beginner team finding where to slot a new component into the accounts page, understanding the data flow to that component, and matching Actual's existing visual style and component conventions all add meaningful time on top of the core logic.

## Source

Derived from a common feature request; scoped down from a full Net Worth report to stay frontend-only. Assisted with Claude for issue generation.

## User:

> 9/24/2026 18:19:45

Ok do the same for this ticket

**Summary**

Actual Budget's CSV import currently requires the uploaded file to match a specific column format, or the user must pre-process the file externally. Different banks export CSVs with wildly different headers ("Debit Amount" vs. "Amount" vs. "Transaction Amount"). A column-mapping step added to the existing import wizard — detecting headers from the uploaded file and letting the user assign them to Actual's expected fields — would make importing from any bank's export work without external preprocessing.

**User Story**

As a user importing a CSV from a bank whose export doesn't match Actual's expected format, I want to map my bank's columns to Actual's fields in a UI step so that I don't have to reformat the file in Excel before every import.

**Rough Scope**

Large — The mapping step itself is frontend-only (parse headers, show dropdowns, validate, pass to the existing pipeline), but inserting a new step into an existing multi-step import wizard is architecturally fiddly. A beginner team will need to fully understand the wizard's current state flow and step sequencing before touching it, which is significant ramp-up. Getting validation and error states right across the new step adds further scope.

**Source**

Frequently requested; directly observed in Actual Budget GitHub issues as a common barrier to adoption for new users coming from other budgeting tools. Assisted with Claude for issue generation.

## Assistant:

> 9/24/2026 18:20:05

**Summary**

Actual Budget's CSV import currently requires the uploaded file to match a specific column format, or the user must pre-process the file externally. Different banks export CSVs with wildly different headers ("Debit Amount" vs. "Amount" vs. "Transaction Amount"). A column-mapping step added to the existing import wizard — detecting headers from the uploaded file and letting the user assign them to Actual's expected fields — would make importing from any bank's export work without external preprocessing.

## User Story

As a user importing a CSV from a bank whose export doesn't match Actual's expected format, I want to map my bank's columns to Actual's fields in a UI step so that I don't have to reformat the file in Excel before every import.

## Acceptance Criteria

1. After a CSV is uploaded, the import wizard inserts a column-mapping step before any data is committed, showing the headers detected in the file as a list of source columns.
2. Each of Actual's required fields (Date, Payee, Amount) has a dropdown pre-populated with the detected headers; optional fields (Notes, Category) also have dropdowns but can be left unmapped.
3. Where a detected header closely matches an expected field name (e.g., "Transaction Date" for Date), it is pre-selected automatically; the user can override any pre-selection.
4. A live preview table beneath the mapping UI shows the first 3 to 5 rows of data as they will be interpreted, updating immediately when any dropdown changes.
5. The wizard does not allow advancing past the mapping step until all required fields are mapped to distinct source columns; unmapped required fields are highlighted with an inline error.
6. If two required fields are mapped to the same source column, an inline error is shown and the Next button remains disabled.
7. Amount fields support a split debit/credit mapping: the user can map a single signed Amount column or map separate Debit and Credit columns, with the wizard combining them into a single signed value on import.
8. The completed mapping is saved per account so that subsequent imports from the same account pre-fill the mapping without the user needing to redo it.
9. If a saved mapping references a header not present in a newly uploaded file, the wizard surfaces a warning and requires the user to remap before proceeding.
10. The mapping step is fully keyboard navigable: all dropdowns reachable by Tab, openable by Enter or Space, and dismissible by Escape.

## Out of Scope

- Parsing or importing non-CSV file formats (OFX, QIF, Excel).
- Automatically detecting the bank or file format without user input.
- Transforming or cleaning cell values during import (e.g., stripping currency symbols, reformatting dates) beyond what the existing pipeline already handles.
- Managing or deleting saved mappings outside of the import flow.
- Server-side storage of mappings — saved mappings may be stored locally per device.

## Open Questions

1. Where exactly in the wizard does the mapping step sit — before or after the user selects which account to import into? The answer affects whether saved mappings can be keyed to an account, or must be keyed to something else (e.g., a detected header fingerprint).
2. What date formats are currently handled by the existing import pipeline? If the mapping step hands off a raw string, the pipeline may silently misparse dates from non-US locales; this may need explicit date-format selection in the mapping UI.
3. Should saved mappings be budget-file-scoped (stored inside the Actual data file and therefore synced across devices) or local-only? This has meaningful backend implications if sync is desired.
4. Is there a maximum number of columns or file size the CSV parser currently handles? Large exports from some banks could have dozens of columns or tens of thousands of rows, which may affect how the preview table is rendered.

## Rough Scope

Large — The mapping step itself is frontend-only (parse headers, show dropdowns, validate, pass to the existing pipeline), but inserting a new step into an existing multi-step import wizard is architecturally fiddly. A beginner team will need to fully understand the wizard's current state flow and step sequencing before touching it, which is significant ramp-up. Getting validation and error states right across the new step adds further scope.

## Source

Frequently requested; directly observed in Actual Budget GitHub issues as a common barrier to adoption for new users coming from other budgeting tools. Assisted with Claude for issue generation.

Powered by Claude Exporter (https://www.ai-chat-exporter.net)
