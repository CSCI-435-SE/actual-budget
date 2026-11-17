## What have you implemented so far, and what remains?

So far I have implemented issue #125, which adds a "(modified)" label to eight dashboard reports (Net Worth, Cash Flow, Spending, Summary, Crossover, Age of Money, Calendar and Goal) whenever the report has settings that haven't been saved yet. Each report now builds what "Save widget" writes and what gets compared from the same function, so the label only reacts to settings that are actually saved. I added unit tests for all eight reports and page tests for Goal and Net Worth, and ran StrykerJS mutation testing, taking the score from 88.62% to 100%. What remains is getting the PR approved and merged, and following up on the reviewer's small code comments.

**Link:** [PR #163](https://github.com/CSCI-435-SE/actual-budget/pull/163)

## What is one thing you learned about testing in your project?

One thing I have learned about testing is that code coverage doesn't mean your tests are correct. Using a mutation testing framework such as StrykerJS allows you to make sure your tests actually cover what they are supposed to and there are no gaps, something that a traditional code coverage report would not find. I also learned that these reports takea very long time to run. My tests took over an hour to run because there were many files change and stryker had to simulate many mutants which was quite time consuming.



## What is one risk to finishing your work by Nov 19, and what will you do about it?

The main risk is that PR #163 isn't merged in time. It's a large change across eight reports, so review takes a while, and any new code commit means the reviewer has to look at it again before approving. A second risk is that StrykerJS's Vitest runner doesn't work with our Vitest 5, so I used Stryker's command runner instead. To handle this, I have already updated the PR description with everything the reviewer asked for and will look into this to fixing in the future.

**Link:** [PR #163 review](https://github.com/CSCI-435-SE/actual-budget/pull/163)
