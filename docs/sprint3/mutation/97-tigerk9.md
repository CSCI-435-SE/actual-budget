# Mutation testing: Issue #97 -- Improve PDF export formatting/data view

**PR(s):** #TODO  **Tool:** StrykerJS 10.0.0 (command runner; see [Setup notes](#setup-notes))  **Config:** [`packages/desktop-client/stryker.issue-97.config.json`](../../../packages/desktop-client/stryker.issue-97.config.json), [`vitest.stryker.issue-97.config.mts`](../../../packages/desktop-client/vitest.stryker.issue-97.config.mts) and [`vitest.stryker.issue-97.setup.ts`](../../../packages/desktop-client/vitest.stryker.issue-97.setup.ts), based on Bennett Matuszewski's setup from #163  **Command:** `cd packages/desktop-client && npx stryker run stryker.issue-97.config.json`
**Reports:** [before](reports/97-tigerk9-before.json) · [after](reports/97-tigerk9-after.json)
**Mutation score:** before 75.15% → after 90.53%

|        | Mutants | Killed | Timed out | Survived | Score  |
| ------ | ------- | ------ | --------- | -------- | ------ |
| Before | 169     | 127    | 0         | 42       | 75.15% |
| After  | 169     | 153    | 0         | 16       | 90.53% |

| File                    | Before  | After   |
| ----------------------- | ------- | ------- |
| `pdfText.ts`            | 85.71%  | 100.00% |
| `budgetMonthPdfRows.ts` | 100.00% | 100.00% |
| `budgetMonthPdf.ts`     | 59.26%  | 80.25%  |

**What was mutated.** The three source files the PR changes in `packages/desktop-client/src/components/budget/export/`: `pdfText.ts` (new: cleans text so jsPDF's built-in font can draw it), `budgetMonthPdfRows.ts` (row shape: one Category column, separate Total and To Budget types) and `budgetMonthPdf.ts` (table layout, styles, "Page N of M"). The PR's only other source change is the one-line PDF title in `BudgetExportMenu.tsx`, a React component that the unit tests don't render, so I left it out. The tests run are the three PDF test files plus `budgetMonthCsv.test.ts`, which guards AC8 (the CSV export must not change).

## Setup notes

- **Command runner, as in #163.** The Vitest runner (`@stryker-mutator/vitest-runner` 10.0.0) runs no tests for any mutant with Vitest 5, so every mutant "survives". Bennett documented this in [125-bennettmatuszewski.md](125-bennettmatuszewski.md). I used his workaround: Stryker's command runner starts Vitest once per mutant (`--bail 1 --maxWorkers 1`).
- **Separate config files.** I added `stryker.issue-97.config.json` and `vitest.stryker.issue-97.config.mts` instead of editing Bennett's, so his command still reproduces his report.
- **Two additions to the standalone Vitest config:**
  - The shared row walk (`budgetMonthRows.ts`) imports `MonthsContext.tsx`, so the config compiles JSX (`oxc: { jsx: { runtime: 'automatic' } }`). Without it, the CSV and row tests fail to load.
  - `vitest.stryker.issue-97.setup.ts` initializes i18next. The regular test run initializes it indirectly (`setupTests.ts` → mocks → redux store → i18n). Without it, `t('Total')` returns `undefined` and 16 tests fail before Stryker starts. I checked that all 57 (before) and 73 (after) tests pass under this config before each run.
- **Commits.** [`33f7a49f6`](https://github.com/CSCI-435-SE/actual-budget/commit/33f7a49f6) is the code and tests the before run saw; [`08cd6fa9d`](https://github.com/CSCI-435-SE/actual-budget/commit/08cd6fa9d) adds the tests written from the survivor analysis, the after report and this write-up. I made the before run before committing anything, so to build `33f7a49f6` I took those tests back out. One difference: the "indents category names" test uses the version without `as` casts that I cleaned up later, which has the same assertions. I reran Stryker on `33f7a49f6` and got the same 75.15%, with every one of the 169 mutants in the same state as the before report.
- **Timeouts.** My first after run used `concurrency: 4`. It reported 4 mutants in `budgetMonthPdf.ts` (lines 114–117) as timed out, which Stryker counts as detected (92.90%). They had survived the before run, and two of them are equivalent (see the table), so the timeouts were the machine being overloaded, not tests catching them. I reran at `concurrency: 2` and they survived with no timeouts. The after report and score above are from that run, and the committed config uses 2. The before run had no timeouts at 4.

## Surviving mutants

All 42 survivors are in lines this PR added. "Gap" = a test was missing; "Equivalent" = no test can tell the mutant from the original. "Killed by" names the test added after the before run (all in `src/components/budget/export/`).

| Location (file:line) | Mutation | Equivalent or test gap? | Why |
| --- | --- | --- | --- |
| pdfText.ts:28 | `code === 0x200e \|\|` → `false` (×2) | Gap | The tests only used the two direction marks `useFormat` emits today (U+202A/U+202C). The issue's Design 1 lists U+200E too. Killed by `pdfText.test.ts › strips the direction mark U+%s`. |
| pdfText.ts:28 | `code === 0x200e \|\| code === 0x200f` → `&&` | Gap | Same gap as the row above. |
| pdfText.ts:29 | `code === 0x200f` → `false` | Gap | Same gap: U+200F was never tested. |
| pdfText.ts:30 | `code <= 0x202e` → `<` | Gap | U+202E (the top of the range) was never tested. Killed by the same test. |
| pdfText.ts:31 | isolate range `0x2066–0x2069` → `false` | Gap | No test used an isolate mark (U+2066–U+2069), which Design 1 lists. |
| pdfText.ts:31 | `code >= 0x2066` → `>` | Gap | Same gap: the boundary U+2066 was never tested. |
| pdfText.ts:31 | `code <= 0x2069` → `<` | Gap | Same gap: the boundary U+2069 was never tested. |
| pdfText.ts:58 | `code <= 0xff` → `<` | Gap | No test used U+00FF (ÿ), the last Latin-1 character, which the PDF font can draw. With this mutant it prints as `?`. Killed by `pdfText.test.ts › keeps the last Latin-1 character and replaces the first one after it`. |
| budgetMonthPdf.ts:29 | Total `lineWidth: { top: 1 }` → `{}` | Gap | The AC5 test only checked that the four row types look different, and bold still made Total differ. Nothing checked the top border AC5 gives as its example. Killed by `budgetMonthPdf.test.ts › draws a top border above the Total and To Budget rows`. |
| budgetMonthPdf.ts:36 | To Budget `lineWidth: { top: 1 }` → `{}` | Gap | Same gap; To Budget still differed through its fill. Same killing test. |
| budgetMonthPdf.ts:40 | `HEAD_STYLES` → `{}` | Gap | No test checked the header row's look at all. Killed by `… › lays out ordinary rows unshaded, a bold dark header, and right-aligned amounts`. |
| budgetMonthPdf.ts:41 | header `fontStyle: 'bold'` → `''` | Gap | Same gap. Same killing test. |
| budgetMonthPdf.ts:86 | money header `styles: { halign: 'right' }` → `{}`, and `'right'` → `''` (×2) | Gap | No test checked that the Budgeted/Spent/Balance headers sit above their right-aligned amounts. Same killing test. |
| budgetMonthPdf.ts:114 | `orientation: 'portrait'` → `''` | Equivalent | jsPDF's default orientation is portrait. I checked that a document with `''` has the same 595.28pt page width. |
| budgetMonthPdf.ts:116 | title `setFont('helvetica', 'bold')` → `''` name or `''` style (×2) | Gap (not fixed) | jsPDF falls back to Times for an unknown font, so the title prints in Times. No test checks which font the title uses. AC6 only asks for the title text, so I left this gap open; see Q1. |
| budgetMonthPdf.ts:117 | `doc.setFontSize(16)` removed | Equivalent | 16 is jsPDF's default font size (checked with `getFontSize()` on a new document). |
| budgetMonthPdf.ts:119 | `setFont('helvetica', 'normal')` after the title → `''` (×2) | Equivalent | This only resets the font after the title. Autotable sets the font for every cell it draws, and the footer sets its own, so nothing is ever drawn with this font. |
| budgetMonthPdf.ts:121 | `moneyColumn` → `{}` | Gap | The AC4 test checked that amounts fit on one line, and they still do with automatic widths. No test checked they are right-aligned. Killed by the layout test above. |
| budgetMonthPdf.ts:122 | money column `halign: 'right'` → `''` | Gap | Same gap. Same killing test. |
| budgetMonthPdf.ts:127 | `t('Category')` → `t('')` | Gap | The AC7 test only counted the "Budgeted" header, so a blank Category header passed. Killed by `… › repeats the header, numbers every page "Page N of M" and never splits a row`, which now checks all four headers on every page. |
| budgetMonthPdf.ts:129 | `t('Spent')` → `t('')` | Gap | Same gap. Same killing test. |
| budgetMonthPdf.ts:130 | `t('Balance')` → `t('')` | Gap | Same gap. Same killing test. |
| budgetMonthPdf.ts:139 | `margin: {...}` → `{}` | Equivalent | Autotable's default margin is 40pt on every side, the same as `PAGE_MARGIN` (checked on a table with no `margin`). |
| budgetMonthPdf.ts:143 | `rowPageBreak: 'avoid'` → `''` | Gap | The AC7 test used one-line rows, which never straddle a page break, so splitting never happened either way. I checked that with three-line rows, `'auto'`/`''` split 2 rows and `'avoid'` splits none. The test now uses long names that wrap. Same killing test. |
| budgetMonthPdf.ts:144 | `theme: 'plain'` → `''` | Gap | An unknown theme falls back to "striped", which shades every other category row. AC5 wants ordinary rows to look ordinary, but no test looked at the laid-out table's fills. Killed by the layout test. |
| budgetMonthPdf.ts:145 | `styles: {...}` → `{}` | Equivalent | Autotable's defaults are already font size 10, padding 5 and `overflow: 'linebreak'` (checked on a table with no `styles`). |
| budgetMonthPdf.ts:151 | `columnStyles: {...}` → `{}` | Gap | Same gap as line 121 (no alignment check). Killed by the layout test. |
| budgetMonthPdf.ts:152 | `label: { cellWidth: 'auto' }` → `{}`, and `'auto'` → `''` (×2) | Equivalent | `'auto'` is the default, and an unknown width is treated as auto (checked: the column gets the same width). |
| budgetMonthPdf.ts:162 | footer `setFont('helvetica', 'normal')` → `''` name or style (×2) | Gap (not fixed) | The footer would print in Times. Same kind of gap as line 116. |
| budgetMonthPdf.ts:163 | footer `doc.setFontSize(9)` removed | Gap (not fixed) | The footer would use the last cell's size (10 or 11). No AC sets the footer size. |
| budgetMonthPdf.ts:172 | `getHeight() - 20` → `+ 20` | Gap | The footer then sits 20pt *below* the page. The AC7 test only checked that the text "Page 1 of 2" exists in the file, not that it is on the page. Killed by `… › draws the page number inside the bottom margin of each page`. |
| budgetMonthPdf.ts:179 | `if (!drawn.table)` → `false`, and its body → `{}` (×2) | Equivalent | A defensive guard: autotable always calls `didDrawPage` at least once, even for an empty table, so the branch can't run. |
| budgetMonthPdf.ts:180 | error message → `''` | Equivalent | Inside the unreachable branch above. |
| budgetMonthPdf.ts:190 | `buildBudgetMonthPdfBytes` body → `{}` | Gap | No unit test called the function the export menu uses; all of them called `renderBudgetMonthPdf`. Killed by `budgetMonthPdf.test.ts › buildBudgetMonthPdfBytes › returns the bytes of a PDF file`. |
| budgetMonthPdf.ts:192 | `doc.output('arraybuffer')` → `output('')` | Gap | Same gap. Same killing test. |

**Totals:** 42 survivors = 26 gaps killed + 5 gaps left open (cosmetic fonts, lines 116/162/163) + 11 equivalent. The after report's 16 survivors are those 11 equivalent and 5 open gaps.

## New or strengthened test

Commit: [`08cd6fa9d`](https://github.com/CSCI-435-SE/actual-budget/commit/08cd6fa9d) (all tests added from the survivor analysis; the code they test is in [`33f7a49f6`](https://github.com/CSCI-435-SE/actual-budget/commit/33f7a49f6)) · Test: `budgetMonthPdf.test.ts › renderBudgetMonthPdf › draws the page number inside the bottom margin of each page` · Kills: `budgetMonthPdf.ts:172` (`pageSize.getHeight() - 20` → `+ 20`), shown as Killed in the after report.

All tests added or strengthened from this analysis:

| Test | Kills |
| --- | --- |
| `pdfText.test.ts › strips the direction mark U+%s` (11 cases) | pdfText.ts:28 (×3), 29, 30, 31 (×3) |
| `pdfText.test.ts › keeps the last Latin-1 character and replaces the first one after it` | pdfText.ts:58 |
| `budgetMonthPdf.test.ts › toAutoTableRows › row styles › draws a top border above the Total and To Budget rows` | budgetMonthPdf.ts:29, 36 |
| `budgetMonthPdf.test.ts › renderBudgetMonthPdf › lays out ordinary rows unshaded, a bold dark header, and right-aligned amounts` | budgetMonthPdf.ts:40, 41, 86 (×2), 121, 122, 144, 151 |
| `… › repeats the header, numbers every page "Page N of M" and never splits a row` (strengthened: all four headers, wrapping rows) | budgetMonthPdf.ts:127, 129, 130, 143 |
| `… › draws the page number inside the bottom margin of each page` | budgetMonthPdf.ts:172 |
| `budgetMonthPdf.test.ts › buildBudgetMonthPdfBytes › returns the bytes of a PDF file` | budgetMonthPdf.ts:190, 192 |

## Questions

<!-- DRAFT: rewrite these answers in your own words before submitting. -->

**1. What did the surviving mutants reveal about your tests?**

My first tests checked *what* the PDF says but not much about *where or how* it says it. The text checks were solid: `budgetMonthPdfRows.ts` was already at 100% and every amount-formatting mutant was killed. But several tests passed for the wrong reason. The "never splits a row" check used one-line rows, which can't straddle a page break anyway. The page-number check found "Page 1 of 2" in the file without checking it was on the page. The style test checked that the four row types differ, not *how*, so dropping Total's border still passed because bold kept the rows different. The `pdfText.ts` survivors showed I had only tested the characters `useFormat` produces today, not the full set the issue's design says to strip. I left the title and footer font gaps open on purpose: no AC specifies fonts, and a test that pins jsPDF's internal font numbers would be brittle.

**2. Did any survivor expose an assertion whose expected value wasn't based on the requirements?**

No assertion had a wrong expected value, but one test was weaker than its requirement. The AC7 test was named "repeats the header", yet it only checked the "Budgeted" header, so any of the other three could have been blank (lines 127/129/130). AC7 says the *column header row* repeats, so the fixed test checks all four header texts on every page. Separately, while writing the tests the code formatter rewrote `’` into an ASCII `'` in both the input and the expected value of one test. That test "passed" while checking nothing about the apostrophe-dot format. I found it by scanning the files for non-ASCII characters, and changed the tests to build those characters from code points (`String.fromCharCode(0x2019)`).

**3. AI use, and what was verified or corrected.**

I used Claude Code (Opus 5.5) to set up the Stryker config, run both passes and draft the survivor table; the session is logged in [ai-logs/sprint3/tigerk9/](../../../ai-logs/sprint3/tigerk9/) (TODO: link the specific file). I checked the classifications rather than taking them on trust. Each "equivalent" claim about a library default was confirmed with a small script against the real jsPDF/autotable: default font size 16, 40pt margins, default cell styles, `'auto'` width, and Times as the fallback for an unknown font. That last check changed lines 116/162 from "equivalent" to "gap". The 4 timeouts in the first after run were rerun at lower concurrency rather than counted as kills, which lowered the reported score from 92.90% to 90.53%.
