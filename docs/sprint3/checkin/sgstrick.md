## What did you implement so far in the sprint, and what remains?

So far I have been implementing Issue #161. This is a subissue from Issue #160, and blocks Issue #162. These all deal with the sync server aspect of Actual Budget, which is something we have not worked with before. The goal is to build a test that runs the sync server and multiple clients together in a single test so we can write end-to-end sync tests without rebuilding the setup each time. After making initial changes to be tested and review, I created PR #171.

PR Link: https://github.com/CSCI-435-SE/actual-budget/pull/171

## What is one thing you learned about the codebase or about software engineering practice?

I learned how the sync servers work. Essentially it works like a conversation. When one user runs the program (as one client), it sends a message to the server which hashes it and then, when the client finishes, it syncs whatever messages have been sent, even between different clients.


## What is one risk to finishing your work by Nov 19, and what will you do about it?

So far, our group has yet to touch on anything related to the servers. When starting these issues, I knew very little about networking and how sync servers work. I still do not know very much. It has been a large learning curve, which does not help when trying to understand the prompts I am feeding AI. I do not think time will be an issue this sprint (at least I hope), but I do think that my understanding of the work I am doing will tank a bit. I am trying to ask clarifying questions as I go using different AI agents so I get varied results in order to help with this. 
