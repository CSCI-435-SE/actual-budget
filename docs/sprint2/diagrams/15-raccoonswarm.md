# Issue #15 -- Add Personal Rate of Inflation tracking

## Class Diagram

![Class diagram](15-raccoonswarm-class.png)

## Sequence Diagram

![Sequence diagram](15-raccoonswarm-sequence.png)

## Q&A

**Class diagram:**

1. Among all the classes shown in the diagram, which 1--2 are most central to understanding the codebase and solving the issue? Explain what role each one plays.

   The two most central classes are `shared/personal-inflation.ts` and `server/budget/base.ts`. The new `shared/personal-inflation.ts` calculates the personal inflation rate: it weights each category's spending change by that category's share of prior-period spending, and handles categories with no history without dividing by zero. The existing `server/budget/base.ts` is where Actual already totals spending per category each month. My server code uses the same query filters, so the report's numbers match the Budget page.

2. What is the most significant relationship shown in the diagram? Explain what it represents in the system and why it matters for understanding the solution.

   The most significant relationship is the dependency from `server/reports/personal-inflation.ts` to `shared/personal-inflation.ts`, labeled "calls calculatePersonalInflation()". It shows how the solution splits its work: the server module gets the data (monthly spending, expense categories and where the budget's history starts) from the database, then passes it to the shared module, which does only the math. This matters because it keeps the calculation separate from the database, so it can be tested on its own, and the same logic serves both the single report and the 12-month trend.

3. Looking back at your implementation, is there anything in this design you would change, and why?

   I would change how `server/reports/personal-inflation.ts` gets its spending data. Right now it copies the query filters from `getSumAmountsByMonth` in `server/budget/base.ts` instead of sharing them, so if the budget's filters ever change, the report could stop matching the Budget page without anyone noticing. I would move that query into a shared helper that both modules use. I would also combine the three separate requests the report makes into one, since each currently reloads the same categories and history from the database.

**Sequence diagram:**

1. What user action or system event starts the sequence, and what is the expected outcome when it completes successfully?

   The sequence starts when the user opens the Personal Inflation report, or changes its date range or comparison (for example, picking "Last month" and "Compare to previous period"). When it completes successfully, the report shows the overall personal inflation rate, the two periods being compared, a 12-month trend graph, and a table of each category's change against both the previous period and the same months last year.

2. Identify the 2--3 most important steps in the sequence. For each one, describe what is happening and note whether it involves existing code or new/modified code from your solution.

   The first important step is the three parallel `send()` calls from `personal-inflation-spreadsheet` (new code), which request the previous-period comparison, the same-months-last-year comparison, and the trend at the same time so the table can show both comparisons side by side; they travel through the existing `send()` connection to `ReportsHandlers` (modified). The second is the server module `server/reports/personal-inflation.ts` (new code) querying the existing SQLite database for monthly spending per category, the expense categories, and the month of the first transaction, using the same filters as the budget's existing spent totals. The third is the call to `calculatePersonalInflation` in `shared/personal-inflation.ts` (new code), which weights each category's change by its share of prior spending, adds up the overall rate, and returns null rates when there isn't enough history.

3. What error cases or alternative paths are not shown in the diagram, and why did you leave them out?

   The diagram leaves out invalid date ranges, which the server rejects in `validatePeriod`, and a request failing, in which case the report stays on its loading indicator. It also leaves out the alternative results: comparisons with insufficient history, new categories with no prior spending, periods that include the unfinished current month, and saving the settings to the dashboard widget. I left these out to keep the diagram focused on the main success path. The alternative results don't add new steps, since they come back as flags and null values from the same calculation, and saving the widget uses existing dashboard code.

**Cross-cutting:**

4. If you used AI to create or check any part of the diagrams, describe what it produced, what you verified against the actual code, and what you had to correct or add. If AI was not used, write "N/A."

   I used AI (Claude Code) to create both diagrams as Mermaid code, including the color coding for new, modified, and existing code and the annotation notes, based on the code it helped me write for this issue. I reviewed the rendered images and checked the classes, methods, and steps against the actual files in my branch. Corrections included fixing colors and notes that didn't render and enlarging boxes whose text didn't fit. I also narrowed the deliverable to the server/data class diagram and the sequence diagram.