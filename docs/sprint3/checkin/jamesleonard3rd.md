## What have you implemented so far, and what remains?

I have implemented issue #154, which lets users attach receipts (JPEG, PNG, WebP or PDF, up to 10 MB) to transactions. We rescoped it so that files are stored only on the user's device, not on the sync server. The data layer is done: a new table, file storage, handlers, and export and import. The UI is also done: a paperclip on transaction rows, an attachments window, removing with confirmation, and a viewer that explains when a file is missing. It has unit, component and Playwright tests. What remains is opening the PR, testing the desktop app by hand, and making any changes reviewers ask for.

**Link:** [Issue #154](https://github.com/CSCI-435-SE/actual-budget/issues/154)

## What is one thing you learned about testing in your project?

I learned that an end-to-end test can fail because of something the browser does, not because of my code. My Playwright test opened a PDF in a new tab and expected the tab's address to be the file. Instead, the tab closed with an empty address. I wrote a short throwaway test to see what was happening. It turned out that headless Chrome has no PDF viewer, so it downloads PDFs instead of showing them. I changed the test to catch the download and check that its bytes match the original file. That checks more than the address would have.

## What is one risk to finishing your work by Nov 19, and what will you do about it?

The biggest risk is the desktop (Electron) app. All my automated tests run in the browser, so nothing has tested file data moving between the desktop app's processes, or the "Save a copy" dialog it uses for PDFs. A second risk is review time: the change touches 32 files. To handle this, I will test the desktop app by hand before asking for review. I will also open the PR early, with a clear description and a list of known gaps, so reviewers can start sooner. If the review is too slow, I can split it into two PRs: the data layer and the UI.

**Link:** [Issue #154](https://github.com/CSCI-435-SE/actual-budget/issues/154)
