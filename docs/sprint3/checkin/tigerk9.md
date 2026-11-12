What have you implemented so far, and what remains?

- So far, I’ve implemented a new workflow to our repo (once it’s merged). It adds the ability for VRT (visual regression test) screenshots to be updated through the repo page just by telling the workflow what PR you’re working on that the VRT tests failed, and which specific screenshot tests failed. It automatically updates the screenshots and retests the VRT after updating, and commits the changes to the PR. This removes the need for us to go through the complicated process of creating linux rendered webpage’s screenshots. This will make updating screenshots much more straightforward for the team. In my next PR, I’m going to make the formatting of the PDF export better.

What is one thing you learned about testing in your project?

- I knew that you could make forks of repos, but it was cool to actually make one so I could implement my VRT screenshot tests. I couldn’t test the PR until it was merged with main, but I didn’t want to merge non-working code, nor did I want to wait for my teammates to review my work every time. Instead, I made a fork, then set my working branch as the base branch of the fork, and this allowed me to test the functionality of the new VRT workflow, and this allowed me to catch a couple errors that Claude made when implementing the feature. 

What is one risk to finishing your work by Nov 19, and what will you do about it?

- One risk is that I’ve got a lot of final projects that I need to start working on for my other classes. I’m working out my schedule so I can make time for each thing I need to do, but I’m not too worried about getting things done for this sprint. I plan to get my PRs done days before the due date so we can spend the last few days of the sprint reviewing PRs and getting the report done, rather than scrambling to review PRs.