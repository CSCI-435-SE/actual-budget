Sprint 3

Created: 11/12/2026 17:28:52
Updated: 11/18/2026 20:40:32
Exported: 11/18/2026 22:31:12
Link: https://claude.ai/chat/1fb649ef-0bc3-4c75-b510-9d1432e38bc4

User:

11/12/2026 17:28:52

## Summary
Actual syncs budgets between devices through the sync server using CRDT messages. Today no test runs a real client against a real sync server. The client tests in `packages/loot-core/src/server/sync/` replace the server with a mock (`packages/loot-core/src/server/tests/mockSyncServer.ts`), and the server tests in `packages/sync-server/src/app-sync.test.ts` exercise the endpoints with no real client. This issue builds the test setup that end-to-end sync tests need: start the real sync server in-process with temporary storage, create a user and a budget file, and connect two or more independent client instances to it. It also adds helpers to sync a device and compare devices. The scenarios themselves are a separate issue (#162), which depends on this one.

## User Story
As a developer working on Actual's sync system, I want a reusable way to start a real sync server and several real clients in a test, so that I and others can write end-to-end sync tests without rebuilding that setup each time.

## User Scenario
A developer writes a new test file and calls a setup helper. The helper starts the sync server on a free port with its own temporary directories, creates a user session, uploads a starter budget, and returns handles for "device A" and "device B" connected to that server. The developer makes changes through those handles, calls `sync(deviceA)` and `sync(deviceB)`, and then calls a compare helper. If the devices differ, it fails with a readable list of the tables and rows that don't match. When the test finishes, the server is shut down and the temporary files are removed.

## Acceptance Criteria
1. A setup helper that:
   - starts the real `sync-server` app in-process on a free port, with temporary `serverFiles` and `userFiles` directories
   - creates an account or session and returns a valid token
   - uploads an initial budget file and returns its `fileId` and `groupId`
   - shuts everything down and removes the temporary files afterwards, even when a test fails
2. A way to create at least two independent client instances that point at that server and don't share sync state (prefs, clock, open database).
3. Helpers:
   - `makeChange(device, …)`: makes a change on one device
   - `sync(device)`: runs a full sync and returns or throws the result
   - `goOffline(device)` and `goOnline(device)`
   - `assertInSync(...devices)`: checks that the budget database tables match across devices and that every device's merkle hash matches the server's
4. One smoke test that proves the setup works: a change on A appears on B after both sync.
5. Runs under `yarn test` (or a documented separate script; see Open Questions) with no network access, and the existing unit tests and `mockSyncServer.ts` keep working unchanged.
6. A short README or comment explaining how to use the helpers to write a new scenario.

## Rough Scope
Medium. The main difficulty is running more than one client. loot-core keeps sync state (`prefs`, `getClock()`, `db`) in module-level variables, so two clients in one process may need separate workers or processes, or `vi.resetModules()`-style isolation. Starting the server from tests may also need config changes, because its test script uses `--experimental-vm-modules` and `sync-simple.js` imports SQL with `?raw`. The work touches `packages/sync-server` (the app and its config), `packages/loot-core` (the sync client and the `post` and `cloud-storage` layer), and the test and lage setup. It doesn't touch the UI.

## Out of Scope
- The full set of sync scenarios (edits at the same time, offline catch-up, sync reset, encryption). Those are issue B.
- Fixing sync bugs the setup finds. File each one separately.
- UI or Playwright end-to-end tests, load testing, and bank-sync integrations.

## Open Questions
- Can two loot-core clients run in one Node process, or does each need its own worker or process?
- Where should the setup live: in `loot-core`, in `sync-server`, or in a new test-only workspace that depends on both?
- Can the sync server be started from tests without building it first?
- Should the client side go through `@actual-app/api` (which already supports connecting to a server) instead of loot-core internals?
- Should this run on every `yarn test` or behind a separate `yarn test:integration` script?

## Source
Found by our team while reading the sync code (`packages/loot-core/src/server/sync/index.ts`, `packages/sync-server/src/app-sync.ts`, `packages/sync-server/src/sync-simple.js`). This is groundwork for issue #162 and for other sync work we're considering (batching large uploads, validating input on `/sync`, real-time change notifications).

Explain this issue to me.

Assistant:

11/12/2026 17:29:02

This GitHub issue is about building a test infrastructure for end-to-end sync testing in the Actual budgeting app.

The problem today: Actual syncs budgets between devices through a sync server, but no test ever runs a real client against a real server. Client tests use a fake/mock server, and server tests run with no real client. So the two sides have never been tested together.

What the issue asks for: A reusable test setup that:

Starts the real sync server in-process (no network needed) with temporary storage that gets cleaned up after each test

Creates real client instances — at least two — that behave like separate devices

Provides helpers to make changes on a device, trigger a sync, toggle a device offline/online, and assert that two devices have identical data after syncing

Includes one smoke test proving it all works: device A makes a change, both sync, device B sees the change

The main technical challenge is running multiple clients in one process. The sync client code stores its state (preferences, clocks, database) in module-level variables, which means two clients would normally clobber each other's state. The issue flags a few possible workarounds — separate worker threads/processes, or module isolation tricks — but leaves the choice open.

What it explicitly leaves out: The actual sync scenarios (concurrent edits, offline catch-up, etc.) are a follow-up issue. This issue is purely the scaffolding those scenarios will be built on.

In short: it's foundational plumbing work so that future sync tests can be written simply and reliably, without each developer rebuilding the same complicated setup from scratch.

User:

11/12/2026 17:29:52

Can you create a series of prompts that will yield this result?

Assistant:

11/12/2026 17:30:16

Here's a series of prompts designed to build this out incrementally, where each step produces something testable before moving to the next.

Prompt 1 — Understand the existing code

Read the following files and summarize how sync currently works, what state is stored at the module level in loot-core, and what the sync server's startup and shutdown lifecycle looks like: packages/loot-core/src/server/sync/index.ts, packages/sync-server/src/app-sync.ts, packages/sync-server/src/sync-simple.js, and packages/loot-core/src/server/tests/mockSyncServer.ts. I need to know what has to be isolated to run two clients in one process.

Prompt 2 — Decide the architecture

Based on what you found: can two loot-core clients run in one Node process given the module-level state, or does each need its own worker thread? Recommend one approach (same process with module reset, worker threads, or child processes) and explain the trade-offs. Also recommend where the shared test setup should live: inside loot-core, inside sync-server, or in a new test-only workspace.

Prompt 3 — Server setup helper

Create a startSyncServer() helper that starts the real sync-server app in-process on a random free port, with temporary serverFiles and userFiles directories. It should return a shutdown() function that stops the server and deletes those directories. Write a minimal test that calls startSyncServer(), confirms the health endpoint responds, and calls shutdown(). No client connection yet.

Prompt 4 — Auth and file bootstrap

Extend the helper from Prompt 3 to also create a user account, obtain a valid token, upload a minimal starter budget file, and return the fileId, groupId, and token. Write a test that calls this full setup helper and logs those values to confirm they are populated.

Prompt 5 — Client isolation

Using the approach chosen in Prompt 2, create a createDevice(serverUrl, token, fileId, groupId) factory that returns an isolated client instance with its own prefs, clock, and database — completely independent of any other device created in the same test. Write a test that creates two devices from the same server and confirms they don't share any state (e.g. writing a pref on device A does not appear on device B).

Prompt 6 — Core helpers

Add the following helpers that operate on a device handle returned by createDevice:

makeChange(device, change) — applies a change to that device's local database

sync(device) — runs a full sync cycle and returns the result or throws on failure

goOffline(device) / goOnline(device) — toggles whether the device can reach the server

Write a unit test for each helper in isolation (no cross-device sync yet).

Prompt 7 — assertInSync helper

Write assertInSync(...devices) that fetches the relevant budget tables from each device and the server's merkle hash, compares them, and throws a readable error listing the specific tables and rows that differ if anything is out of sync. Write a test that puts two devices deliberately out of sync and confirms the helper produces a useful failure message.

Prompt 8 — Smoke test

Write the end-to-end smoke test: start the server, create device A and device B, make a change on A, call sync(deviceA) then sync(deviceB), and call assertInSync(deviceA, deviceB). This test should pass, run under yarn test with no real network, and leave no temporary files behind.

Prompt 9 — Cleanup and existing tests

Confirm that all existing unit tests and mockSyncServer.ts still pass unchanged. Fix any import conflicts or naming collisions introduced by the new code. Run the full test suite and report results.

Prompt 10 — Documentation

Write a short README section (or an inline comment block at the top of the setup file) explaining: how to start the server in a test, how to create devices, how to use each helper, and a minimal example test. Aim for something a new contributor could follow in under five minutes.

Each prompt builds directly on the last, so if something breaks or the architecture decision in Prompt 2 changes, you only need to backtrack one or two steps rather than rewrite everything.

User:

11/12/2026 17:56:38

After Prompt 3, I receive this:
When you commit, CODEOWNERS has no entry for the new workspace, and the PR will probably need a release note. Say if you want me to handle either.
Which (if any) should I continue with? Or just move on to Prompt 4?

Assistant:

11/12/2026 17:56:42

Skip both and move on to Prompt 4.

CODEOWNERS is an administrative file that assigns reviewers to PRs — it's housekeeping for a team workflow and irrelevant while you're building and testing locally.

Release notes are for when you're shipping something to users. This is internal test infrastructure that never touches the UI or any user-facing behavior, so it almost certainly doesn't warrant one.

If you're working toward an actual PR on the real Actual repo, you can revisit both at the very end. But they have no bearing on whether the code works.

User:

11/12/2026 22:42:25

Explain how the Actual Budget sync server works.

Assistant:

11/12/2026 22:42:35

Based on the issue document you shared, I can tell you what it reveals, but I should be upfront that it only gives a partial picture. Here's what it actually says:

What the document tells us:

Actual syncs budgets between devices through a sync server

It uses CRDT messages (Conflict-free Replicated Data Types) — a technique where each change is recorded as an independent message that can be merged without conflicts, even if devices were offline

The server has at least these endpoints: one for syncing (/sync) and one for uploading a budget file

State tracked per-client includes prefs, a clock (used by the CRDT), and a database

The server tracks a merkle hash per file, which is used to verify that devices are in sync

Relevant files are packages/loot-core/src/server/sync/index.ts, packages/sync-server/src/app-sync.ts, and packages/sync-server/src/sync-simple.js

What the document doesn't explain — and I'd be guessing if I elaborated on — is the exact sync protocol, how conflicts are resolved, how encryption fits in, or the precise message format.

If you want a thorough explanation, the best next step would be to feed me those source files directly, which is essentially what Prompt 1 in the series is designed to do. That would give me the actual code to reason from rather than a summary.

User:

11/12/2026 22:46:41

## How sync works, what state is shared, and what to isolate

**Short answer:** almost all client sync state in loot-core is held in module-level variables, so you can't run two clients side by side in one process just by creating two objects. The server side is in better shape. It's stateless per request apart from its config and one cached account database, so one in-process server can safely serve both clients.

### How sync works today (client, `loot-core/src/server/sync/index.ts`)

1. **Local edits** go through `sendMessages`. Inside `batchMessages` they collect in `_BATCHED`; otherwise they go to `_sendMessages`. That calls `applyMessages` and then `scheduleFullSync()`.
2. **`applyMessages`** is wrapped in `sequential`, so it runs one call at a time. In a single `immediate` DB transaction it:
   - drops messages already in `messages_crdt`, and marks ones superseded by a newer value as `old` (`compareMessages`);
   - reads the affected rows before and after the writes (`fetchData`);
   - writes each message's value to its table, adds it to `messages_crdt` and inserts it into the merkle tree;
   - saves the clock to `messages_clock`.

   After the commit it updates the undo history, the budget type, the in-memory clock's merkle, prefs and the spreadsheet. Then it calls the sync listeners and emits `app.events 'sync'`.
3. **`scheduleFullSync`**: when `NODE_ENV === 'test'` it calls `fullSync()` straight away. Otherwise it sets a 1-second `setTimeout`.
4. **`fullSync`** is wrapped in `once`, so concurrent callers share one run. `_fullSync`:
   - reads `id/cloudFileId/groupId/lastSyncedTimestamp` from `prefs.getPrefs()`;
   - sends `messages_crdt` entries newer than `since`, with the `user-token` from `asyncStorage`, to `getServer().SYNC_SERVER + '/sync'`;
   - applies the reply through `receiveMessages` (`Timestamp.recv` and then `applyMessages`);
   - compares the server's merkle with `getClock().merkle` and recurses from the point where they differ. After 10 identical diffs or 100 attempts it throws `out-of-sync`.

   Once the merkles match, it saves `lastSyncedTimestamp`.

### Module-level state in loot-core (all global per process)

| Location | State | Notes |
|---|---|---|
| `sync/index.ts` | `SYNCING_MODE` | enabled / offline / disabled / import |
| | `_syncListeners` | |
| | `IS_BATCHING`, `_BATCHED` | Batching is shared: client B's messages could end up in client A's batch |
| | `syncTimeout` | Scheduled full sync |
| | `applyMessages` queue (`sequential`), `fullSync` in-flight promise (`once`) | Created once at module load and shared by every caller |
| | `compareMessagesSqlByTermCount` | Only SQL strings, so safe to share |
| `@actual-app/crdt` `timestamp.ts` | `clock` (`setClock`/`getClock`) | **The most important one.** It holds the node ID, the HLC timestamp and the merkle. `Timestamp.send/recv` change it in place |
| `db/index.ts` | `db`, `dbPath`, `_queryCache` (prepared statements) | `db.cache()` statements are tied to the open connection |
| `prefs.ts` | `prefs` | Holds `id`, `groupId`, `cloudFileId`, `lastSyncedTimestamp` |
| `sheet.ts` | `globalSheet`, `globalOnChange`, `globalCacheDb` | |
| `undo.ts` | `MESSAGE_HISTORY`, `CURSOR` | |
| `mutators.ts` | `runningMethods`, `currentContext`, `globalMutationsEnabled`, … | `receiveMessages` goes through `runMutator` |
| `server-config.ts` | `config` (`SYNC_SERVER` URL) | |
| `asyncStorage` (platform) | global store, including `user-token` and `readOnly` | |
| `main-app.ts` | `app` and its `app.events` emitter | Both clients' sync events would go to the same emitter |
| `budget/base` | budget type (`setBudgetType`) | |

### Mock server (`tests/mockSyncServer.ts`)

- It's a single module-level store: `currentMessages`, `currentClock` (its merkle) and `currentMockData`. `reset()` clears it.
- `__mocks__/post.ts` sends `post` and `postBinary` here, and `handleRequest` removes the host part of the URL.
- It **ignores `groupId` and `fileId`**: every sync request reads and writes the same message list. For two clients on the same budget that's actually what you want, since one shared server is the point.
- It matches already-stored messages by timestamp only, and it doesn't check auth.

### Real server (`app-sync.ts` and `sync-simple.js`)

- **`/sync`** decodes the protobuf and checks the file exists, that the user has access, and that the group and key IDs match. It then calls `simpleSync.sync(messages, since, groupId)`.
- **`sync-simple.sync`** opens `group-<groupId>.sqlite`, creating the schema if the file is new. It reads messages newer than `since`, then inserts the incoming ones with `INSERT OR IGNORE` and updates and saves the merkle, all in one transaction. **It closes the database on every request**, so there's no per-group state in memory.
- **Global server state:**
  - the `convict` `config`, loaded once at import from `ACTUAL_CONFIG_PATH` or the environment, which sets `userFiles` and `serverFiles`;
  - `_accountDb`, opened on first use by `getAccountDb()` (`closeAccountDb()` resets it);
  - the Express app instances, built when the module is imported.

### Server startup and shutdown

- **Startup:**
  1. `bin/actual-server.js` parses its arguments, then imports `app.js`.
  2. `app.ts` (the package root file) runs `runMigrations()`. Only after that does it dynamically import `src/app.js`, because the route modules read the config and database when they load.
  3. It then calls `run()`. That runs OpenID setup if it's configured, then `app.listen(port, hostname)` (or HTTPS).
  4. When the server is up it posts `server-started` to `parentPort` for Electron.
- **Shutdown: none exists.** `run()` throws away the `http.Server` it creates, and there are no `SIGTERM`/`SIGINT` handlers, only an `unhandledRejection` logger. The only cleanup function is `closeAccountDb()`. To start and stop it in a test, skip `run()`: either use `supertest(handlers)`, as `app-sync.test.ts` does, or call `app.listen(0)` yourself and keep the handle so you can `close()` it.
- Sync-server tests already run with `fileParallelism: false` because every test file shares `account.sqlite`.

### What has to be isolated to run two clients in one process

1. **The CRDT clock.** Each client needs its own node ID, timestamp and merkle. With one global `clock`, client B's `Timestamp.send` advances A's clock and the merkle comparisons become meaningless. This is the hardest blocker.
2. **The database connection and `_queryCache`.** Each client needs its own SQLite file and its own prepared statements.
3. **Prefs** (`groupId`, `cloudFileId`, `lastSyncedTimestamp`). The two clients share `cloudFileId` and `groupId` but must not share `lastSyncedTimestamp`.
4. **Sync control state:** `SYNCING_MODE`, `IS_BATCHING`/`_BATCHED`, `syncTimeout`, and the `sequential` queue and `once` guard.
5. **Spreadsheet, undo history and mutator context**, plus `app.events`, so that sync events reach the right client.
6. **`asyncStorage` and the server config** if the clients use different users or tokens. For one user against one server they can be shared.

**Realistic options:**
- **(a) Swap the globals.** Before each client acts, save and restore its context (clock, `db`, prefs, sheet, sync-module variables), and run both clients' actions one after the other. This means adding getters and setters for the sync module's private variables. It works only if the two clients' code never interleaves across an `await`.
- **(b) Use separate module instances,** for example `vi.resetModules()` and re-importing to get a second module graph. Make sure `@actual-app/crdt` is duplicated too, or the clock stays shared.
- **(c) Put each client in its own worker thread** and share one server: either a real sync server on `listen(0)` or one mock store. Of the three, only this gives true isolation without refactoring.
- **(d) Refactor** these globals into a per-client context object. This is the long-term fix, but it's a large change.

On the server side you don't need to isolate anything for two clients of the same budget. Point both at one server instance; for the mock, don't call `reset()` between the clients' steps.

Given this response, condense it and explain how the Actual Budget sync server works.

Assistant:

11/12/2026 22:46:52

Here's how the Actual Budget sync system works, based on this analysis:

The core idea is CRDT (Conflict-free Replicated Data Types). Every change a client makes is recorded as an independent timestamped message. Because messages are independent, two clients can make changes offline and merge later without conflicts.

On the client side, when you make a change:

It gets recorded as a message with a hybrid logical clock (HLC) timestamp

It's written to the local SQLite database

A sync is scheduled (immediately in tests, after 1 second otherwise)

When syncing, the client sends any messages the server hasn't seen yet, receives messages it hasn't seen, and then compares a merkle hash with the server to verify they agree. If they don't match, it figures out exactly where they diverged and tries again, up to 100 attempts before throwing an "out-of-sync" error.

On the server side, it's intentionally simple and stateless:

Each request opens a SQLite file for that budget group, inserts any new messages (ignoring duplicates), updates the merkle hash, and closes the file

Nothing is kept in memory between requests

It checks that the user, file, and group IDs are valid before doing anything

The fundamental problem for testing is that the client is the opposite of stateless — the clock, database connection, prefs, and sync state are all stored in module-level globals. That means you can't simply create two client objects in one process; they'd share and corrupt each other's state. The recommended solution from this analysis is separate worker threads, one per client, pointing at a single shared server instance.

User:

11/12/2026 22:52:52

Summarize the work that has been done here.

Assistant:

11/12/2026 22:53:01

Here's what's been covered in this conversation:

Starting point: A GitHub issue describing the need for end-to-end sync testing infrastructure in the Actual Budget app. The core problem is that client and server tests have never been run together against each other.

What was produced:

A plain-English explanation of the issue — what it's asking for, why it's technically difficult, and what's out of scope

A 10-prompt series to build the solution incrementally, each step producing something testable before moving on

A brief clarification that CODEOWNERS and release notes from Prompt 3's output could be safely ignored for now

A technical explanation of how Actual's sync system works, drawn first from the issue document alone, then refined and deepened using the full code analysis document (the Prompt 1 output)

Key technical findings from the code analysis:

The server is stateless and easy to run in-process for tests

The client is the hard part — clock, database, prefs, and sync state are all module-level globals

The recommended isolation approach for running two clients is separate worker threads

The mock server currently used in tests ignores auth and file IDs, which is why it works but also why it doesn't prove the real sync path works

The conversation is currently positioned between Prompt 3 and Prompt 4 of the implementation plan.

User:

11/12/2026 22:53:18

Describe the solution.

Assistant:

11/12/2026 22:53:32

Based on everything covered in this conversation, here's the full picture of what needs to be built:

The Goal
A reusable test harness that runs a real sync server and multiple real clients in a single test, so developers can write end-to-end sync tests without rebuilding the setup each time.

The Server Side
Since the sync server is stateless per request, one in-process server instance can serve all clients. The setup helper needs to:

Start the server on a random free port with temporary storage directories

Create a user account and return a valid auth token

Upload a starter budget file and return its fileId and groupId

Shut everything down and clean up temp files afterward, even if the test fails

The key insight from the code analysis is that you skip the server's normal run() startup and instead call app.listen(0) directly, keeping the handle so you can call close() at the end of the test.

The Client Side
Each "device" needs to be fully isolated from every other device. Because the client stores its clock, database, prefs, and sync state in module-level globals, the only clean solution is to run each client in its own worker thread, with all threads pointing at the shared server instance.

Each device handle exposes:

makeChange(device, change) — writes a change to that device's local database

sync(device) — runs a full sync cycle against the real server

goOffline(device) / goOnline(device) — toggles server connectivity

assertInSync(...devices) — compares budget tables across devices and against the server's merkle hash, failing with a readable diff if anything doesn't match

The Smoke Test
One test that proves the whole thing works:

Start the server

Create device A and device B

Make a change on A

Sync A, then sync B

Assert A and B are in sync

This runs under yarn test with no real network access and leaves no temporary files behind.

What It Doesn't Touch

The existing unit tests and mock server remain unchanged

No UI changes

The actual sync scenarios (concurrent edits, offline catch-up, etc.) are a follow-up — this is purely the scaffolding they'll be built on

User:

11/12/2026 23:04:02

How can I test to make sure the Issue has been successfully fulfilled?

Assistant:

11/12/2026 23:04:14

Based on the acceptance criteria in the original issue, here's how to verify each requirement:

1. Server setup helper works

Start a test, call the setup helper, and confirm:
The server responds to its health endpoint on the assigned port

A valid token is returned

A fileId and groupId are returned

After the test, the temporary directories no longer exist on disk (check even when the test throws an error)

2. Client isolation works

Create two devices from the same server

Write a pref or value on device A

Confirm it does not appear on device B without a sync

Confirm each device has its own separate SQLite file on disk

3. Each helper works correctly

makeChange — make a change on a device and confirm it appears in that device's local database

sync — call sync on a device and confirm it returns a result; call it when the server is unreachable and confirm it throws

goOffline / goOnline — go offline, make a change, attempt a sync and confirm it fails; go back online and confirm sync succeeds

assertInSync — deliberately put two devices out of sync and confirm the helper produces a readable error naming the specific tables and rows that differ

4. The smoke test passes

Make a change on device A

Sync A then sync B

Assert they are in sync

The test passes cleanly with no leftover temp files

5. Existing tests still pass

Run the full test suite with yarn test

Confirm every existing unit test and mockSyncServer.ts-based test still passes unchanged

Confirm no network access is required for any of the new tests

6. Documentation is usable

Hand the README or comment block to someone unfamiliar with the code

They should be able to write a new sync scenario test in under five minutes without looking at anything else

If all six pass, the issue is fulfilled. If the smoke test passes but assertInSync doesn't produce a useful failure message, or if any existing test breaks, the issue is only partially done.

User:

11/12/2026 23:19:18

## Description

This PR adds a test setup that runs the **real sync server** and **two or more real clients** in one test, plus helpers to drive and compare them. Until now, no test exercised a real client against a real server: loot-core's sync tests replace the server with `mockSyncServer.ts`, and sync-server's `app-sync.test.ts` calls the endpoints without a client. This is the groundwork for the end-to-end sync scenarios in #162.

What's included, all in a new test-only workspace, `packages/sync-integration-tests`:

- **Server setup:** `startSyncServer()` starts the real sync-server app in-process on a free port with temporary data directories. `startSyncServerWithBudget()` also creates the owner account, logs in, and uploads a starter budget, returning `token`, `fileId` and `groupId`. `shutdown()` stops the server and deletes its files.
- **Isolated clients:** `createDevice(serverUrl, token, fileId, groupId)` runs a full client (through `@actual-app/api`) in its own worker thread with its own data directory, so devices don't share a clock, database or prefs. `setUpTwoDevices()` returns a server plus devices A and B.
- **Helpers:** `makeChange(device, change)`, `sync(device)`, `goOffline(device)` / `goOnline(device)`, and `assertInSync(...devices)`. The last one compares every device's merkle hash with the server's, plus each synced table row by row, and throws a readable list of the rows and columns that differ.
- **A smoke test:** a change on A appears on B after both sync, with no non-loopback network requests and no files left behind.
- **README:** how to write a new scenario, a reference for every helper, and how the setup works.

Changes outside the new package (all small):
- `packages/sync-server/src/app.ts` now exports its Express `app`, so tests can listen on port 0 and close the server afterwards. Production startup through `run()` is unchanged.
- `lage.config.js` makes this package's tests depend on `@actual-app/api#build` (cached), so `yarn test` never runs them against a missing or stale client build.
- The root `tsconfig.json` references the new package, and `yarn.lock` adds its workspace entry.

No loot-core code changed, including `mockSyncServer.ts`.

[AI section: This change was written with Claude Code (Claude Opus 5.5): code, tests and README. Add your own statement of what you reviewed and verified before posting.]

## Related issue(s)

Closes #<number of the sync test setup issue>. Groundwork for #162 (sync scenarios), which depends on it.

## Testing

New tests in `packages/sync-integration-tests` (13 tests in 8 files), each testing one piece in isolation and then together:

| Test file | What it checks |
|---|---|
| `startSyncServer.test.ts` | Server starts on a free port, `/health` responds, migrations ran in the temp directories, and `shutdown()` removes them and closes the port |
| `startSyncServerWithBudget.test.ts` | Account, token, upload: the server reports the file under the returned `groupId` |
| `createDevice.test.ts` | Two devices have separate data directories, different CRDT node ids, separate prefs (a pref written on A is absent on B) and separate databases |
| `createDevice.sync.test.ts` | Control for the above: after both sync, B has A's account but not A's local pref |
| `deviceHelpers.test.ts` | One test per helper: `makeChange` stays local (checked against the server's stored message count, even after loot-core's usual 1s auto-sync delay); `sync` pushes changes and returns a result; `goOffline` makes `sync` throw `network-failure` while local changes still work; `goOnline` delivers changes made offline |
| `assertInSync.test.ts` | Passes when devices are synced; reports a missing row; reports a stale column |
| `e2e.smoke.test.ts` | The end-to-end smoke test described above |
| `exampleScenario.test.ts` | The README's walkthrough, kept as a real test so the docs can't drift |

Extra checks during development:
- **Mutation check:** disabling the auto-sync block makes the `makeChange` test fail, so its "stays local" assertion is meaningful.
- **Repeat runs:** the package suite passed repeatedly, including `assertInSync` runs that produced both positive and negative merkle hashes.
- **Full suite:** `yarn test:debug` (every package, uncached) passed all 13 targets, including loot-core's `sync.test.ts` and `accounts/sync.test.ts`, which use `mockSyncServer.ts` (54 passed, 2 skipped by existing `it.skip`). `yarn typecheck` passes.

How to run:
```bash
yarn test                                              # builds @actual-app/api first
# or just this package:
yarn build:api && yarn workspace @actual-app/sync-integration-tests run test

Known testing caveats:

Only run on Windows so far. [Confirm the CI (Linux) result here once it runs.]
One earlier uncached full run had intermittent Vitest failures (Cannot read properties of undefined (reading 'config')) in several packages, including ones this PR doesn't touch. The next full run passed. Cause not found; see Tech Debt.
yarn lint fails on Windows only because of CRLF line endings in 505 existing files. None of them are from this PR. The oxlint step passes, and the new files pass the format check.
Design Decisions
Clients run one per worker thread. We decided to run each client in its own worker thread. Alternatives: two clients in one process with vi.resetModules(), or one child process per client. loot-core keeps its clock, database, prefs and sync state in module-level variables, so a separate module graph per client is the only option that isolates them by construction. Module resets would split mockSyncServer-style shared state and could miss a global silently. Child processes add startup cost and give no isolation that workers lack. Consequence: devices are driven by message passing, and the worker loads the built API bundle rather than loot-core source.
Clients use @actual-app/api. We decided to drive clients through the bundled @actual-app/api. Alternatives: calling loot-core internals directly, or loading loot-core from source in the worker. The API already supports signing in with a token and downloading a budget, and its bundle runs in a plain worker, which loot-core's TypeScript source can't. Consequence: no loot-core changes, but the tests need a current API build.
The setup lives in a new workspace. We decided to put it in packages/sync-integration-tests. Alternatives: inside loot-core, or inside sync-server. The setup depends on both client and server, and putting it in either would make one depend on the other. A separate package also keeps these slower tests out of loot-core's fast suite. Consequence: one more workspace in lage, the root tsconfig and yarn.lock.
The tests run on every yarn test. We decided to include them in yarn test rather than a separate yarn test:integration script. Alternative: an opt-in script that is easy to forget. Running them by default keeps the setup from rotting. Consequence: about 30–40s added to the suite, plus the API build when loot-core changes (cached otherwise).
Devices never sync on their own. We decided that devices sync only when a test calls sync(), by wrapping fetch in the worker. Alternatives: let loot-core's 1-second automatic sync run, or set NODE_ENV=test so it syncs inside each change. Automatic syncing makes the order of events nondeterministic. Test mode syncs inside every change and throws when offline, which makes offline scenarios impossible. Consequence: scenarios state every sync explicitly, and workers run with NODE_ENV=production.
assertInSync compares only synced tables. We decided to compare only tables that appear in the CRDT log, plus merkle hashes. Alternative: compare every table in the budget database. Per-device tables such as caches differ legitimately and would cause false failures. Consequence: a table that never produces sync messages isn't compared.
Tech Debt
Introduced:

sync-server exports app only for tests. run() throws away the server handle and has no shutdown, so tests need the app itself.
Device control depends on an API internal. The worker relies on the API bundle reading globalThis.fetch when it loads; if that changes, offline simulation and the sync block stop working.
The Vitest temp-folder cleanup reads _tmpDir, a Vitest internal. It's guarded to do nothing if the value doesn't look like a temp folder.
One sync server per test file, because sync-server reads its config once when it's imported.
A test that times out during server startup can leave a temporary directory behind. Cleanup otherwise relies on tests calling tearDown()/shutdown() in afterEach/finally; nothing registers it automatically.
makeChange supports only accounts (create, update, delete). #162 will need to add transactions, categories and so on.
The device worker is TypeScript that Node loads directly, which needs Node 23.6 or newer. .nvmrc pins 24, but engines allows 22.
Test-only timeouts: 60s timeouts and at most 2 test files at once, because each file starts a server and loads loot-core per device.
Encountered:

Global module state in loot-core (clock, database, prefs, sync mode) makes multiple clients in one process impossible. We worked around it with worker threads rather than refactoring loot-core.
yarn typecheck overwrites packages/api/dist/index.js. packages/api/tsconfig.json emits JavaScript into dist/, replacing the bundle from yarn build:api with an unbundled compile. yarn test is unaffected, because it rebuilds or restores the bundle first. For direct runs, this package now checks the bundle and stops with "run yarn build:api". Not fixed here (out of scope, different code owner). Likely fix: "emitDeclarationOnly": true in that tsconfig.
Vitest 5.0 leaves a temp folder behind on every run on Windows, in every package. This package now removes its own; other packages still leak.
Intermittent Vitest runner failures (reading 'config') were seen once across several packages in a full run, then not reproduced in about 12 runs. Cause not found.
yarn lint fails on Windows checkouts because of CRLF line endings in existing files. Left as is.

Can you condense these to follow this format?

Description

[clearly explains what changed, why, and how it was tested]
[AI section]

Related issue(s)

[closes #, related to]

Testing

[new or updated tests for every behavioral change; test strategy explained in the PR]

Design Decisions

[one sentence stating what you decided, alternatives considered (at least two concrete options you evaluated), rationale (why you chose this option over the others), and consequences]

Tech Debt

Introduced: [Describe any shortcuts, workarounds, or design compromises
made in this implementation, and why. If none, write "None."]
Encountered: [Describe any pre-existing tech debt you ran into while
working on this issue, and how you handled it. If none, write "None."]

Assistant:

11/12/2026 23:19:57

Description

Adds a test-only workspace, packages/sync-integration-tests, that runs the real sync server and two or more real clients in one test. Until now, no test exercised a real client against a real server: loot-core's sync tests replace the server with mockSyncServer.ts, and sync-server's app-sync.test.ts calls endpoints without a client. Includes server setup helpers, isolated client devices via worker threads, sync/offline helpers, an assertInSync comparator, a smoke test, and a README. One small change outside the new package: packages/sync-server/src/app.ts now exports its Express app so tests can bind to port 0 and close the server cleanly; production startup via run() is unchanged. No loot-core code changed.

[AI section: This change was written with Claude Code (Claude Opus 5.5): code, tests and README. Add your own statement of what you reviewed and verified before posting.]

Related issue(s)

Closes #<number of the sync test setup issue>. Groundwork for #162 (sync scenarios), which depends on it.

Testing

13 tests across 8 files, each isolating one piece before combining them:

Test file
What it checks
startSyncServer.test.ts
Server starts on a free port, /health responds, temp directories are removed after shutdown
startSyncServerWithBudget.test.ts
Account creation, login, and budget upload return a valid token, fileId, and groupId
createDevice.test.ts
Two devices have separate data directories, CRDT node IDs, prefs, and databases
createDevice.sync.test.ts
After sync, B has A's account data but not A's local prefs
deviceHelpers.test.ts
makeChange stays local; sync pushes changes; goOffline makes sync throw; goOnline delivers offline changes
assertInSync.test.ts
Passes when synced; reports missing rows and stale columns with readable output
e2e.smoke.test.ts
A change on A appears on B after both sync, with no non-loopback network requests and no files left behind
exampleScenario.test.ts
The README walkthrough kept as a live test so docs can't drift

Full suite (yarn test:debug) passed all 13 targets including loot-core's existing sync tests (54 passed, 2 skipped by pre-existing it.skip). yarn typecheck passes. Known caveat: only run on Windows so far — confirm CI (Linux) result once it runs.

Design Decisions

Clients run in worker threads. Considered: same-process module resets via vi.resetModules(), child processes, or worker threads. loot-core's clock, database, prefs, and sync state are module-level globals, so a separate module graph per client is the only option that isolates them by construction; module resets risk silently missing a shared global, and child processes add startup cost without additional isolation. Consequence: devices are driven by message passing and load the built API bundle rather than loot-core source.

Clients use @actual-app/api. Considered: calling loot-core internals directly, loading loot-core from source in the worker, or using the bundled API. The API already supports token-based login and budget download, and its bundle runs in a plain worker without TypeScript tooling. Consequence: no loot-core changes required, but tests need a current API build.

Setup lives in a new workspace. Considered: colocating inside loot-core, inside sync-server, or in a new package. The setup depends on both client and server; placing it in either would create a circular dependency, and a separate package also keeps these slower tests out of loot-core's fast suite. Consequence: one additional workspace in lage, the root tsconfig, and yarn.lock.

Tests run on every yarn test. Considered: an opt-in yarn test:integration script or including in the default suite. An opt-in script is easy to forget and lets the setup rot; running by default keeps it honest. Consequence: roughly 30–40s added to the suite plus the API build cost (cached when loot-core is unchanged).

Devices sync only when the test calls sync(). Considered: allowing loot-core's 1-second automatic sync, using NODE_ENV=test to sync inside each change, or explicit test-controlled syncing. Automatic syncing makes event ordering nondeterministic; test mode makes offline scenarios impossible. Consequence: scenarios must state every sync explicitly, and workers run with NODE_ENV=production.

assertInSync compares only synced tables. Considered: comparing every table in the budget database or only CRDT-logged tables plus merkle hashes. Per-device tables such as caches differ legitimately and would cause false failures. Consequence: a table that never produces sync messages is not compared.

Tech Debt

Introduced:

sync-server exports app only because run() discards the server handle and has no shutdown path; tests need the app object directly.

Offline simulation depends on the API bundle reading globalThis.fetch at load time; if that changes, offline toggling and the sync block silently stop working.

assertInSync uses _tmpDir, a Vitest internal, for temp folder cleanup; guarded to no-op if the value doesn't look like a temp path.

One sync server per test file, because sync-server reads its config once on import.

A test that times out during server startup can leave a temporary directory behind.

makeChange supports accounts only; #162 will need transactions, categories, and other entity types.

The device worker is TypeScript loaded directly by Node, requiring Node 23.6+; .nvmrc pins 24 but engines allows 22.

60s timeouts and a cap of 2 concurrent test files, because each file starts a server and loads loot-core per device.

Encountered:

Module-level globals in loot-core (clock, database, prefs, sync mode) make multiple clients in one process impossible; worked around with worker threads rather than refactoring loot-core.

yarn typecheck overwrites packages/api/dist/index.js with an unbundled compile, replacing the bundle from yarn build:api; this package now detects the missing bundle and exits with a clear message. Root fix (setting emitDeclarationOnly in that tsconfig) is out of scope and owned by a different team.

Vitest 5.0 leaks a temp folder on every run on Windows across all packages; this package cleans up its own, but others still leak.

Intermittent Vitest runner failures (Cannot read properties of undefined (reading 'config')) appeared once across a full run and were not reproduced in roughly 12 subsequent runs; cause unknown.

yarn lint fails on Windows due to CRLF line endings in 505 existing files unrelated to this PR; left as-is.

User:

11/12/2026 23:20:23

Can you repost this as pure text?

Assistant:

11/12/2026 23:20:51

Description

Adds a test-only workspace, packages/sync-integration-tests, that runs the real sync server and two or more real clients in one test. Until now, no test exercised a real client against a real server: loot-core's sync tests replace the server with mockSyncServer.ts, and sync-server's app-sync.test.ts calls endpoints without a client. Includes server setup helpers, isolated client devices via worker threads, sync/offline helpers, an assertInSync comparator, a smoke test, and a README. One small change outside the new package: packages/sync-server/src/app.ts now exports its Express app so tests can bind to port 0 and close the server cleanly; production startup via run() is unchanged. No loot-core code changed.

[AI section: This change was written with Claude Code (Claude Opus 5.5): code, tests and README. Add your own statement of what you reviewed and verified before posting.]

Related issue(s)

Closes #. Groundwork for #162 (sync scenarios), which depends on it.

Testing

13 tests across 8 files, each isolating one piece before combining them.

startSyncServer.test.ts: Server starts on a free port, /health responds, temp directories are removed after shutdown.

startSyncServerWithBudget.test.ts: Account creation, login, and budget upload return a valid token, fileId, and groupId.

createDevice.test.ts: Two devices have separate data directories, CRDT node IDs, prefs, and databases.

createDevice.sync.test.ts: After sync, B has A's account data but not A's local prefs.

deviceHelpers.test.ts: makeChange stays local; sync pushes changes; goOffline makes sync throw; goOnline delivers offline changes.

assertInSync.test.ts: Passes when synced; reports missing rows and stale columns with readable output.

e2e.smoke.test.ts: A change on A appears on B after both sync, with no non-loopback network requests and no files left behind.

exampleScenario.test.ts: The README walkthrough kept as a live test so docs can't drift.

Full suite (yarn test:debug) passed all 13 targets including loot-core's existing sync tests (54 passed, 2 skipped by pre-existing it.skip). yarn typecheck passes. Known caveat: only run on Windows so far — confirm CI (Linux) result once it runs.

Design Decisions

Clients run in worker threads. Considered: same-process module resets via vi.resetModules(), child processes, or worker threads. loot-core's clock, database, prefs, and sync state are module-level globals, so a separate module graph per client is the only option that isolates them by construction; module resets risk silently missing a shared global, and child processes add startup cost without additional isolation. Consequence: devices are driven by message passing and load the built API bundle rather than loot-core source.

Clients use @actual-app/api. Considered: calling loot-core internals directly, loading loot-core from source in the worker, or using the bundled API. The API already supports token-based login and budget download, and its bundle runs in a plain worker without TypeScript tooling. Consequence: no loot-core changes required, but tests need a current API build.

Setup lives in a new workspace. Considered: colocating inside loot-core, inside sync-server, or in a new package. The setup depends on both client and server; placing it in either would create a circular dependency, and a separate package also keeps these slower tests out of loot-core's fast suite. Consequence: one additional workspace in lage, the root tsconfig, and yarn.lock.

Tests run on every yarn test. Considered: an opt-in yarn test:integration script or including in the default suite. An opt-in script is easy to forget and lets the setup rot; running by default keeps it honest. Consequence: roughly 30-40s added to the suite plus the API build cost (cached when loot-core is unchanged).

Devices sync only when the test calls sync(). Considered: allowing loot-core's 1-second automatic sync, using NODE_ENV=test to sync inside each change, or explicit test-controlled syncing. Automatic syncing makes event ordering nondeterministic; test mode makes offline scenarios impossible. Consequence: scenarios must state every sync explicitly, and workers run with NODE_ENV=production.

assertInSync compares only synced tables. Considered: comparing every table in the budget database or only CRDT-logged tables plus merkle hashes. Per-device tables such as caches differ legitimately and would cause false failures. Consequence: a table that never produces sync messages is not compared.

Tech Debt

Introduced:

sync-server exports app only because run() discards the server handle and has no shutdown path; tests need the app object directly.

Offline simulation depends on the API bundle reading globalThis.fetch at load time; if that changes, offline toggling and the sync block silently stop working.

assertInSync uses _tmpDir, a Vitest internal, for temp folder cleanup; guarded to no-op if the value doesn't look like a temp path.

One sync server per test file, because sync-server reads its config once on import.

A test that times out during server startup can leave a temporary directory behind.

makeChange supports accounts only; #162 will need transactions, categories, and other entity types.

The device worker is TypeScript loaded directly by Node, requiring Node 23.6+; .nvmrc pins 24 but engines allows 22.

60s timeouts and a cap of 2 concurrent test files, because each file starts a server and loads loot-core per device.

Encountered:

Module-level globals in loot-core (clock, database, prefs, sync mode) make multiple clients in one process impossible; worked around with worker threads rather than refactoring loot-core.

yarn typecheck overwrites packages/api/dist/index.js with an unbundled compile, replacing the bundle from yarn build:api; this package now detects the missing bundle and exits with a clear message. Root fix (setting emitDeclarationOnly in that tsconfig) is out of scope and owned by a different team.

Vitest 5.0 leaks a temp folder on every run on Windows across all packages; this package cleans up its own, but others still leak.

Intermittent Vitest runner failures (Cannot read properties of undefined (reading 'config')) appeared once across a full run and were not reproduced in roughly 12 subsequent runs; cause unknown.

yarn lint fails on Windows due to CRLF line endings in 505 existing files unrelated to this PR; left as-is.

User:

11/12/2026 23:27:28

How can I review a PR on Github?

Assistant:

11/12/2026 23:27:32

That's outside what I can helpfully answer from this conversation — everything here has been specific to the Actual Budget sync issue and PR content.

For how to review a pull request on GitHub, the official GitHub docs are the best starting point:

For a general overview: docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/about-pull-request-reviews

Step by step: docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/reviewing-proposed-changes-in-a-pull-request

That said, if you're asking in the context of reviewing this specific PR — what to look for, what to verify, what questions to ask — that's something I can help with based on everything we've covered. Just let me know.

User:

11/16/2026 16:20:18

## Summary
Using the test setup from issue A, this issue adds end-to-end tests for the situations where syncing between devices usually goes wrong: edits made at the same time, a device that has been offline for a long time, a sync reset while another device is still syncing, and encrypted budgets. Each test runs real clients against a real sync server and checks that every device ends up with the same data and the same merkle hash as the server. Today none of these cases is tested end to end. The existing client tests use a mocked server (`mockSyncServer.ts`), so a change to the client or server sync code could break real multi-device sync without any test failing.

## User Story
As a developer changing Actual's sync code, I want tests for the realistic ways devices fall out of step, so that I find out before merging if my change causes devices to end up with different data or get stuck with an `out-of-sync` error.

## User Scenario
A developer changes how the client sends messages to the server and runs `yarn test`. The integration suite runs each scenario. In one, device B goes offline, makes 500 edits, comes back online and syncs. In another, A and B both rename the same category before either one syncs. If the change breaks anything, the failing test names the scenario and shows which tables or merkle hashes differ, so the developer knows where to look.

## Acceptance Criteria
1. **Basic sync both ways:** changes made on A appear on B, and changes made on B appear on A.
2. **Edits at the same time:** A and B change the same field before either one syncs. After both sync, both devices hold the same value, and it is the one with the later timestamp.
3. **Different records at the same time:** A and B each add and delete different transactions while out of contact. After syncing, both devices have every change.
4. **Offline catch-up:** B makes a large number of changes (hundreds or more) while offline, then reconnects. Both devices end up in sync with no `out-of-sync` error. Note in the test how large a batch it handles before the server's size limit (`upload.fileSizeSyncLimitMB`) gets in the way.
5. **Sync reset:** A resets sync, which gives the file a new `groupId`. B then tries to sync. B detects the reset and does not apply messages from the old group (see the `groupId` check in `_fullSync`, `packages/loot-core/src/server/sync/index.ts`).
6. **Encrypted file:** scenarios 1 and 2 pass with end-to-end encryption turned on, and a device with the wrong key gets a decrypt error instead of corrupted data.
7. Every scenario ends with the `assertInSync` helper from 6a. Scenarios that fail because of real bugs are marked skipped or known-failing, with a link to a separate bug issue.
8. The whole suite finishes in a reasonable time (aim for under about 60 seconds) and runs in CI.

## Rough Scope
Medium. Once issue #161 is done, each scenario is a fairly short test. The time goes into understanding the expected behaviour: how the client resolves edits made at the same time (by timestamp), what a sync reset does to other devices, and how encryption keys get to a second device. Expect some scenarios to expose real bugs that need their own issues.

## Out of Scope
- Building the test setup (issue A).
- Fixing bugs these tests find. File each one as its own issue.
- Batching large uploads. The offline catch-up test may show that this is needed, but implementing it is a separate issue.
- Clock-drift testing, load or performance testing, and bank-sync integrations.

## Open Questions
- What counts as "the same data" when comparing devices? Should the check cover only user-facing tables (transactions, categories, payees, etc.), or also internal tables such as `messages_crdt`?
- How large an offline batch should the catch-up test use: just under the server's size limit, or over it, with the test marked known-failing until upload batching is done?
- How does a second device get the encryption key in a test? Does it need the user's password entered again, or can it reuse the key?
- Should the expected behaviour after a sync reset be documented somewhere as well as tested?

## Source
Follows on from issue #161. Found by our team while reading the sync code (`packages/loot-core/src/server/sync/index.ts`, `packages/sync-server/src/sync-simple.js`). These scenarios cover the cases most likely to break if we later add upload batching, `/sync` input validation or real-time change notifications.

Explain this issue to me.

Assistant:

11/16/2026 16:20:28

This is the follow-up issue to everything we've been discussing. Where the previous issue (#161) was about building the test scaffolding, this one (#162) is about actually using that scaffolding to test the specific ways sync can go wrong in the real world.

What it's testing

Six concrete scenarios:

Basic two-way sync — changes on A appear on B and vice versa. The simplest case, but explicit.

Simultaneous edits to the same field — A and B both rename the same category before either syncs. The expected result is that the later timestamp wins, so both devices end up with the same value afterward.

Simultaneous edits to different records — A and B each add and delete different transactions while disconnected. After syncing, both devices should have all the changes from both sides.

Offline catch-up — B makes hundreds of changes offline then reconnects. This is testing whether the system can handle a large batch without throwing an out-of-sync error or hitting the server's file size limit.

Sync reset — A resets sync, which gives the budget a new group ID. When B tries to sync, it should detect that the group ID has changed and not apply messages from the old group. This tests a specific guard already in the client code.

Encryption — scenarios 1 and 2 repeated with end-to-end encryption on. A device with the wrong key should get a decrypt error, not silently corrupted data.

Why it matters

The existing tests mock the server, so a bug introduced in either the client or server sync code could break real multi-device sync without any test catching it. These tests close that gap.

The honest unknowns

The issue flags several things it hasn't figured out yet — how large the offline batch should be, how a second device gets the encryption key in a test environment, and whether the offline catch-up test should be marked as expected-to-fail until upload batching is built. Some of these scenarios may also expose real bugs, which would then be filed as separate issues rather than fixed here.

User:

11/16/2026 16:23:14

Can you create a series of prompts that will yield this result?

Assistant:

11/16/2026 16:23:38

Here's a series of prompts to build out the sync scenarios incrementally, assuming the infrastructure from #161 is already in place.

Prompt 1 — Understand the existing behavior

Read the following files and explain how the sync client resolves each of these situations: two devices editing the same field at the same time, a device reconnecting after a long offline period, a sync reset that changes the groupId, and an encrypted budget. For each one, identify the exact code path and any edge cases or known limitations: packages/loot-core/src/server/sync/index.ts, packages/sync-server/src/sync-simple.js, and any encryption-related files in loot-core.

Prompt 2 — Scenario 1: Basic two-way sync

Using the helpers from packages/sync-integration-tests, write a test that confirms changes made on device A appear on device B and changes made on device B appear on device A. Each direction should be tested independently. Use assertInSync at the end of each case.

Prompt 3 — Scenario 2: Simultaneous edits to the same field

Write a test where device A and device B both change the same field on the same record before either one syncs. After both sync, confirm that both devices hold the same value and that it is the one with the later timestamp. Document in the test which code path determines the winner and what the expected behavior is if the timestamps are identical.

Prompt 4 — Scenario 3: Simultaneous edits to different records

Write a test where device A adds and deletes a set of transactions while device B adds and deletes a different set, with no syncing in between. After both sync, confirm that every change from both devices appears on both, and use assertInSync to verify the merkle hashes match the server.

Prompt 5 — Scenario 4: Offline catch-up

Write a test where device B goes offline and makes a large number of changes (start with 500), then reconnects and syncs. Confirm both devices end up in sync with no out-of-sync error. Note in a comment the largest batch size that succeeds before hitting the server's upload.fileSizeSyncLimitMB limit. If the batch size needed to expose the limit is impractical, mark that case as a known-failing test with a comment explaining what would need to be built (upload batching) to fix it.

Prompt 6 — Scenario 5: Sync reset

Write a test where device A resets sync, giving the budget a new groupId. Device B then attempts to sync. Confirm that B detects the groupId mismatch and does not apply messages from the old group. Reference the specific guard in _fullSync in packages/loot-core/src/server/sync/index.ts and confirm the test exercises that exact code path.

Prompt 7 — Scenario 6: Encryption

First, explain how a second device obtains the encryption key in a real session and replicate that in a test environment. Then repeat scenarios 1 and 2 with end-to-end encryption turned on and confirm both devices end up in sync. Add a third case where a device uses the wrong key and confirm it receives a decrypt error rather than silently corrupted data.

Prompt 8 — Timing and CI

Run the full scenario suite and measure total runtime. If it exceeds 60 seconds, identify which tests are slowest and optimize them (larger batch sizes in the offline test are the most likely cause). Confirm the suite passes in CI on Linux, since earlier testing was Windows-only.

Prompt 9 — Handle real bugs found

Review the test results. For any scenario that fails due to a real sync bug rather than a test setup problem, mark that test as skipped with it.skip, add a comment explaining the expected behavior and why it currently fails, and open a separate issue for each bug. Do not fix the bugs here.

Prompt 10 — Documentation

Add a comment block at the top of each test file explaining what scenario it covers, what the expected behavior is, which code paths it exercises, and any known limitations or related issues. Update the README in packages/sync-integration-tests to list all scenarios, their current status (passing, skipped, known-failing), and links to any related bug issues.

As before, each prompt builds on the last. Prompts 1 and 7 are the most likely to need iteration — the encryption key question in particular is flagged as unresolved in the issue itself, so that answer will shape how Prompt 7 is implemented.

User:

11/18/2026 10:49:54

File: packages.zip

Given this implementation of #161, recreate a series of prompts that will yield this result.

Assistant:

11/18/2026 10:51:25

Let me read the uploaded files first before reconstructing the prompts.

Viewed file, ran 6 commands

Check uploaded file structure

Extract and list all files

Find the sync-integration-tests package

List top-level packages

Explore sync-server package structure

Check sync-server source files

Explore the integration-tests directory

Done

Now I have a clear picture of the actual implementation. Let me read the key source files.

Ran 2 commands

Read the core implementation files

Read the smoke test, setup helper, and README

Done

Now I have everything I need. Here's the prompt series reconstructed to match the actual implementation:

Prompt 1 — Understand the existing code

Read packages/loot-core/src/server/sync/index.ts, packages/sync-server/src/app-sync.ts, packages/sync-server/src/sync-simple.js, and packages/loot-core/src/server/tests/mockSyncServer.ts. Summarize how sync works, identify every module-level variable in the client, and describe the server's startup and shutdown lifecycle. I need to understand what must be isolated to run two clients in one process.

Prompt 2 — Server startup helper

In packages/sync-server/integration-tests/src/startSyncServer.ts, write a startSyncServer() function that starts the real sync-server app in-process on a random free port with temporary serverFiles and userFiles directories. Use mkdtemp for the temp dirs. Set ACTUAL_CONFIG_PATH, ACTUAL_DATA_DIR, ACTUAL_SERVER_FILES, and ACTUAL_USER_FILES as environment variables before importing the app, then restore them. Run migrations before importing the app (the app's modules touch the account database as they load). Call app.listen(0) and keep the returned server handle so shutdown() can call server.close(). Export shutdown() from the returned handle — it must call closeAccountDb() before deleting the temp directory (Windows can't delete an open SQLite file). Guard against calling this more than once per process, since sync-server reads its config once on import. Write a test in startSyncServer.test.ts that starts the server, confirms /health responds with 200, and confirms shutdown() deletes the temp directory even when called twice.

Prompt 3 — Export the Express app from sync-server

packages/sync-server/src/app.ts currently calls app.listen() inside run() and discards the server handle, making it impossible to close the server from a test. Export the Express app instance from src/app.ts and add a #app subpath import to package.json so the integration tests can import it directly. The existing run() function and production startup must remain unchanged.

Prompt 4 — Server-with-budget helper

In packages/sync-server/integration-tests/src/startSyncServerWithBudget.ts, write startSyncServerWithBudget() that calls startSyncServer(), bootstraps the password account via POST /account/bootstrap, logs in via POST /account/login, and uploads a minimal starter budget using the same zip format loot-core uses (db.sqlite from packages/loot-core/default-db.sqlite and a metadata.json with resetClock: true). Write a small zip.ts helper using the STORED compression method rather than a zip library dependency. Return the server handle extended with password, token, fileId, groupId, budgetId, and budgetName. Write a test in startSyncServerWithBudget.test.ts confirming all these fields are populated and the server reports the file under the returned groupId.

Prompt 5 — Device worker and isolation

In packages/sync-server/integration-tests/src/deviceWorker.ts, write a worker thread that loads packages/api/dist/index.js by repo path (sync-server must not depend on @actual-app/api), wraps globalThis.fetch before loading the API to block automatic syncs and non-loopback hosts, and runs with NODE_ENV=production so loot-core doesn't sync inside every change. The worker receives typed DeviceOp messages and replies with DeviceResponse. On init, call api.init() with the data directory and server URL, then api.downloadBudget(). On shutdown, close the budget. Define DeviceOp and DeviceResponse in deviceProtocol.ts. Check in src/apiBundle.ts that the API bundle exists before the worker tries to load it, and throw a clear error if it doesn't — yarn typecheck overwrites the bundle with an unbundled compile.

Prompt 6 — createDevice factory

In packages/sync-server/integration-tests/src/createDevice.ts, write createDevice(serverUrl, token, fileId, groupId, { name? }) that creates a temporary data directory with mkdtemp, starts the device worker with execArgv: [] and NODE_ENV: 'production', drives it over a promise-based message channel, and returns a Device handle with api(), send(), getPrefs(), savePrefs(), getClientId(), request(), and close(). close() must call shutdown on the worker, then worker.terminate(), then delete the data directory. Write createDevice.test.ts confirming two devices have different data directories, different CRDT node IDs, and don't share prefs. Write createDevice.sync.test.ts confirming that after both sync, B has A's budget account but not A's local prefs.

Prompt 7 — Device helpers

In packages/sync-server/integration-tests/src/deviceHelpers.ts, write makeChange(device, change), sync(device), goOffline(device), and goOnline(device). makeChange starts with createAccount, updateAccount, and deleteAccount and returns { id }. sync sends a sync op to the worker and returns { received }; throws on failure with loot-core's reason on the error (e.g. network-failure). goOffline and goOnline send setOnline ops. Write deviceHelpers.test.ts with one test per helper: confirm makeChange stays local (check against countServerMessages even after the 1-second auto-sync delay); confirm sync pushes changes and returns a result; confirm goOffline makes sync throw with reason: 'network-failure'; confirm goOnline lets changes made offline reach the server.

Prompt 8 — assertInSync helper

In packages/sync-server/integration-tests/src/assertInSync.ts, write assertInSync(...devices) that fetches the server's merkle hash by sending an empty sync request with since set far in the future, takes a snapshot from each device (merkle hash, message count, and rows from every table that appears in any device's CRDT log), and throws an OutOfSyncError listing merkle hashes and the specific tables, rows, and columns that differ. Limit the output to 10 rows per table and summarize the rest. Write assertInSync.test.ts with three cases: passes when devices are synced; throws naming a missing row; throws naming a stale column.

Prompt 9 — Convenience setup helper and smoke test

In packages/sync-server/integration-tests/src/setUpTwoDevices.ts, write setUpTwoDevices() that calls startSyncServerWithBudget(), creates devices A and B, and returns { server, a, b, tearDown }. tearDown must close both devices before shutting down the server. Write packages/sync-server/integration-tests/src/e2e.smoke.test.ts: start the server, create A and B, make a change on A (createAccount), sync A then B, call assertInSync(a, b), confirm b.api('getAccounts') contains the account, confirm neither device made any non-loopback network request (spy on globalThis.fetch from the test thread; check device.request({ type: 'blockedRequests' }) on each device), and confirm all temporary directories are deleted after the finally block closes everything.

Prompt 10 — vitest config, lage wiring, and existing tests

Add integration-tests/vitest.config.ts with a 60-second timeout and maxConcurrency: 2 (each test file starts a server, and running too many at once exhausts memory). Add integration-tests/vitest.globalSetup.ts to delete the Vitest-internal temp folder that Vitest 5 leaks on Windows. Update packages/sync-server/package.json to add a test:integration script and include the integration tests in the existing test script after the unit tests. Update lage.config.js to make sync-server#test depend on api#build (cached), so yarn test always has a current API bundle. Update the root tsconfig.json to reference the new integration-tests/tsconfig.json. Confirm yarn test passes all existing loot-core sync tests and all 13 new integration tests, and that yarn typecheck passes.

Prompt 11 — README

Write packages/sync-server/integration-tests/README.md covering: how to run the tests (yarn test and the direct yarn workspace command); the requirement for a current @actual-app/api build and why yarn typecheck can break it; how to write a new scenario (the setUpTwoDevices / makeChange / sync / assertInSync pattern, with the full exampleScenario.test.ts as a runnable example); the one-server-per-file constraint; a helper reference table; how assertInSync works and what a failure looks like; how to add a new change type; and answers to the architecture open questions (why workers, why @actual-app/api, why loaded by path, how the server is started without a build, how devices are controlled, and how cleanup works).

User:

11/18/2026 11:51:24

When asking if the current implementation solves the issue, I receive this response:

No, it doesn't. The current implementation is the test infrastructure from #161 (this issue's "issue A"), not the scenarios this issue asks for. Of the eight acceptance criteria, two are met, two are partly met and four aren't started.

#
Criterion
Status
What exists today
1
Basic sync both ways
Partly
exampleScenario.test.ts has A and B each create an account, sync, and see both. That's both directions, but only for accounts, and B's change is made while offline. The smoke test only covers A to B.
2
Same field edited at the same time
No
assertInSync.test.ts has a stale rename, but only A edits it. Nothing has both devices edit the same field before syncing, or checks that the later timestamp wins.
3
Different records at the same time
No
makeChange only supports accounts. Transactions could be added through device.api('addTransactions', …), but no test does it.
4
Offline catch-up with hundreds of changes
No
The offline tests make only one or two changes. Nothing checks large batches or the upload.fileSizeSyncLimitMB limit (20 MB by default).
5
Sync reset
No
There's no helper to reset sync and no test of B against a new groupId. The device's send op could call loot-core's reset handler, but that isn't done or checked.
6
Encrypted file
No
The devices can't use encryption. Device setup has no password or key option, and the starter budget is uploaded without encryption metadata. This needs infrastructure work first.
7
Every scenario ends with assertInSync, known bugs marked skipped with a link
Partly
assertInSync exists and the example scenario uses it. There are no skipped or known-failing scenarios, because the scenarios don't exist yet.
8
Under about 60 s and runs in CI
Yes, for now
The current suite takes about 28 s. It runs as part of sync-server's yarn test, which the check.yml workflow runs. The 500-change and encryption scenarios will add time.

What's ready to use: a real server started in the test process, isolated devices running in worker threads, makeChange, sync, goOffline/goOnline, assertInSync with readable output, and generic api and send ops. Criteria 1–5 are mostly short tests on top of that, plus a transaction change type.

What needs new infrastructure first:

Encryption (criterion 6): devices need a way to receive a password or key during setup. That's your third open question, and the answer decides how to build it.

Sync reset (criterion 5): it needs a resetSync helper. The test also has to show that B saw the new group and didn't apply the old group's messages, not just that assertInSync passes.

Your open questions:

What counts as the same data: assertInSync already settles this. It compares every table in any device's CRDT log, which covers user-facing tables, plus the merkle hash against the server. It doesn't compare messages_crdt row by row.

Batch size for offline catch-up: still undecided.

Encryption keys on a second device: still undecided.

Documenting sync-reset behaviour: still undecided.

Assistant:

11/18/2026 11:51:56

Given this response, here's the updated prompt series for #162, grounded in what actually exists:

Prompt 1 — Add transaction change type

In packages/sync-server/integration-tests/src/deviceProtocol.ts, add createTransaction, updateTransaction, and deleteTransaction variants to the Change type. Handle them in deviceWorker.ts using api.addTransactions, api.updateTransaction, and api.deleteTransaction. Add their signatures to ApiModule in apiBundle.ts. Write a quick test confirming a transaction created on A appears on B after both sync.

Prompt 2 — Scenario 1: Basic two-way sync

In a new file packages/sync-server/integration-tests/src/scenarios/basicSync.test.ts, write two tests using setUpTwoDevices: one where A creates an account and B receives it after syncing, and one where B creates an account and A receives it. Each test must call assertInSync at the end. The existing exampleScenario.test.ts covers offline edits, not clean two-way sync, so this is a gap.

Prompt 3 — Scenario 2: Simultaneous edits to the same field

In packages/sync-server/integration-tests/src/scenarios/conflictSameField.test.ts, write a test where both A and B rename the same account to different names before either syncs. After sync(a) then sync(b) then sync(a), confirm both devices hold the same name and that it matches the account with the later CRDT timestamp. Add a comment identifying the exact code path in packages/loot-core/src/server/sync/index.ts (compareMessages) that decides the winner, and what happens if timestamps are identical.

Prompt 4 — Scenario 3: Simultaneous edits to different records

In packages/sync-server/integration-tests/src/scenarios/conflictDifferentRecords.test.ts, write a test where A creates and immediately deletes one account while B creates and immediately deletes a different account, with no syncing in between. After both sync fully (A, B, A), confirm both devices have both tombstones and call assertInSync. Use the transaction change type from Prompt 1 for a second case that covers transactions.

Prompt 5 — Scenario 4: Offline catch-up

In packages/sync-server/integration-tests/src/scenarios/offlineCatchUp.test.ts, write a test where B goes offline, creates 500 accounts in a loop using makeChange, comes back online, and syncs. Confirm no out-of-sync error and call assertInSync. Add a comment in the test measuring how close 500 accounts gets to the server's upload.fileSizeSyncLimitMB limit (20 MB by default) and what the realistic ceiling is. If the batch size needed to hit the limit is impractical in a test, add an it.skip with a comment explaining that upload batching (a separate issue) is required to handle it.

Prompt 6 — Sync reset helper and Scenario 5

Add a resetSync(device) helper to deviceHelpers.ts that calls the loot-core sync/reset handler via device.send. In packages/sync-server/integration-tests/src/scenarios/syncReset.test.ts, write a test where A makes a change and syncs, then A resets sync (producing a new groupId), then B attempts to sync against the old groupId. Confirm B detects the mismatch and does not apply messages from the old group — reference the specific groupId guard in _fullSync in packages/loot-core/src/server/sync/index.ts. Add a second case where B re-downloads the budget with the new groupId and confirm assertInSync passes.

Prompt 7 — Encryption infrastructure

Extend startSyncServerWithBudget to accept an optional encryptionPassword parameter. When provided, derive an encryption key from the password using the same method as loot-core, encrypt the starter budget zip before uploading, and include the key ID in the upload headers. Extend createDevice to accept the same encryptionPassword and pass it to api.downloadBudget. Write a test confirming a device initialized with the correct password can read the budget, and a device initialized with the wrong password gets a decrypt error rather than silently corrupted data.

Prompt 8 — Scenario 6: Encrypted sync

In packages/sync-server/integration-tests/src/scenarios/encryption.test.ts, repeat Scenario 1 (basic two-way sync) and Scenario 2 (simultaneous same-field edits) with encryptionPassword set. Confirm assertInSync passes after each. Add a third case where a third device is created with the wrong password and confirm it throws a decrypt error rather than producing wrong data.

Prompt 9 — Timing and CI

Run the full integration suite with yarn workspace @actual-app/sync-server run test:integration and measure total runtime. If it exceeds 60 seconds, profile which tests are slowest — the 500-account offline test is the most likely candidate — and optimize (reduce to the minimum count that still exercises the batch path). Confirm the suite passes on Linux (CI uses Ubuntu; prior testing was Windows-only). Update integration-tests/vitest.config.ts if concurrency or timeout adjustments are needed.

Prompt 10 — Mark known failures and update documentation

Review all test results. For any test that fails because of a real sync bug (not a test setup problem), mark it it.skip with a comment describing the expected behavior, why it currently fails, and a placeholder for a bug issue link. Do not fix the bugs here. Update integration-tests/README.md to list all six scenarios, their current pass/skip/known-failing status, and the open questions that remain (batch size ceiling, encryption key derivation approach, sync-reset behavior documentation).

User:

11/18/2026 11:52:12

## Summary
Using the test setup from issue A, this issue adds end-to-end tests for the situations where syncing between devices usually goes wrong: edits made at the same time, a device that has been offline for a long time, a sync reset while another device is still syncing, and encrypted budgets. Each test runs real clients against a real sync server and checks that every device ends up with the same data and the same merkle hash as the server. Today none of these cases is tested end to end. The existing client tests use a mocked server (`mockSyncServer.ts`), so a change to the client or server sync code could break real multi-device sync without any test failing.

## User Story
As a developer changing Actual's sync code, I want tests for the realistic ways devices fall out of step, so that I find out before merging if my change causes devices to end up with different data or get stuck with an `out-of-sync` error.

## User Scenario
A developer changes how the client sends messages to the server and runs `yarn test`. The integration suite runs each scenario. In one, device B goes offline, makes 500 edits, comes back online and syncs. In another, A and B both rename the same category before either one syncs. If the change breaks anything, the failing test names the scenario and shows which tables or merkle hashes differ, so the developer knows where to look.

## Acceptance Criteria
1. **Basic sync both ways:** changes made on A appear on B, and changes made on B appear on A.
2. **Edits at the same time:** A and B change the same field before either one syncs. After both sync, both devices hold the same value, and it is the one with the later timestamp.
3. **Different records at the same time:** A and B each add and delete different transactions while out of contact. After syncing, both devices have every change.
4. **Offline catch-up:** B makes a large number of changes (hundreds or more) while offline, then reconnects. Both devices end up in sync with no `out-of-sync` error. Note in the test how large a batch it handles before the server's size limit (`upload.fileSizeSyncLimitMB`) gets in the way.
5. **Sync reset:** A resets sync, which gives the file a new `groupId`. B then tries to sync. B detects the reset and does not apply messages from the old group (see the `groupId` check in `_fullSync`, `packages/loot-core/src/server/sync/index.ts`).
6. **Encrypted file:** scenarios 1 and 2 pass with end-to-end encryption turned on, and a device with the wrong key gets a decrypt error instead of corrupted data.
7. Every scenario ends with the `assertInSync` helper from 6a. Scenarios that fail because of real bugs are marked skipped or known-failing, with a link to a separate bug issue.
8. The whole suite finishes in a reasonable time (aim for under about 60 seconds) and runs in CI.

## Rough Scope
Medium. Once issue #161 is done, each scenario is a fairly short test. The time goes into understanding the expected behaviour: how the client resolves edits made at the same time (by timestamp), what a sync reset does to other devices, and how encryption keys get to a second device. Expect some scenarios to expose real bugs that need their own issues.

## Out of Scope
- Building the test setup (issue A).
- Fixing bugs these tests find. File each one as its own issue.
- Batching large uploads. The offline catch-up test may show that this is needed, but implementing it is a separate issue.
- Clock-drift testing, load or performance testing, and bank-sync integrations.

## Open Questions
- What counts as "the same data" when comparing devices? Should the check cover only user-facing tables (transactions, categories, payees, etc.), or also internal tables such as `messages_crdt`?
- How large an offline batch should the catch-up test use: just under the server's size limit, or over it, with the test marked known-failing until upload batching is done?
- How does a second device get the encryption key in a test? Does it need the user's password entered again, or can it reuse the key?
- Should the expected behaviour after a sync reset be documented somewhere as well as tested?

## Source
Follows on from issue #161. Found by our team while reading the sync code (`packages/loot-core/src/server/sync/index.ts`, `packages/sync-server/src/sync-simple.js`). These scenarios cover the cases most likely to break if we later add upload batching, `/sync` input validation or real-time change notifications.

Do these prompts solve this issue?

Assistant:

11/18/2026 11:52:25

Based on what we know from the uploaded implementation, mostly yes — but with two significant caveats.

What the prompts clearly cover:

Criteria 1–5 are well-addressed. The infrastructure exists, the prompts build directly on it, and each scenario is a short test on top of what's already there. Criterion 7 (assertInSync and skipping known bugs) is handled in Prompt 10. Criterion 8 (timing and CI) is Prompt 9.

The two caveats:

Criterion 6 (encryption) is the weakest prompt. The issue flags this as an open question — "how does a second device get the encryption key in a test?" — and the prompt proposes an answer (pass encryptionPassword to both startSyncServerWithBudget and createDevice), but that answer may not match how loot-core actually handles encryption key exchange. If the key derivation or the upload format differs from what the prompt assumes, Prompt 7 could require significant iteration before Prompt 8 (the encryption scenarios) is reachable. You'd want to read the encryption code in loot-core before committing to that approach.

Criterion 3 (different records at the same time) uses transactions, which Prompt 1 adds. If api.addTransactions or api.deleteTransaction don't behave the way the worker expects — wrong arguments, different return shape, side effects — that change type may need debugging before Scenario 3 can be written cleanly.

What's missing entirely:

The issue asks whether sync-reset behavior should be documented somewhere beyond the test. None of the prompts address that, but the issue itself marks it as an open question rather than a requirement, so it's likely acceptable to leave it.

Bottom line: Prompts 1–6 and 9–10 are solid. Prompts 7 and 8 (encryption) carry the most risk and may need a preliminary investigation step — essentially a Prompt 6.5 that reads the loot-core encryption code and answers the open question before writing any infrastructure.

User:

11/18/2026 19:14:25

Is the issue asking to test the reset-during-sync case or descope it explicitly in the issue?

Assistant:

11/18/2026 19:14:35

The issue does not test reset-during-sync. Reading criterion 5 carefully:

"A resets sync, which gives the file a new groupId. B then tries to sync. B detects the reset and does not apply messages from the old group."

That's a sequential scenario — A resets, then B syncs. There's no overlap, no race condition, no B actively mid-sync when A pulls the reset. The parenthetical even points to a specific static guard in _fullSync that checks the groupId, which is a code-path check, not a concurrency test.

The summary at the top does mention "a sync reset while another device is still syncing" in the list of situations where sync goes wrong, but that phrasing doesn't appear in the acceptance criteria, and the acceptance criteria are what the issue is actually committing to. The summary is scene-setting.

So the concurrent reset-during-sync case is neither required nor explicitly descoped — it's just absent from the criteria. If you wanted to add it, you'd need to open a separate issue, since this one doesn't budget for it.

User:

11/18/2026 19:16:03

One thing to decide: the issue's acceptance criterion says the offline device should make "hundreds or more" changes. 150 accounts is 1,050 CRDT changes, but only 150 records. If you'd rather meet the wording literally, 200 accounts adds about 2 seconds.

Decide on 150 accounts versus 500.

Assistant:

11/18/2026 19:16:08

Go with 150.

The criterion says "hundreds or more changes," and 150 accounts producing 1,050 CRDT messages meets that in the way that actually matters — the sync protocol operates on messages, not records, and 1,050 is well into the hundreds. The wording is about exercising the batch path under realistic load, not hitting a specific record count.

500 accounts adds 2 seconds of test time for no additional coverage. The offline catch-up scenario is already the slowest test in the suite, and the 60-second budget is tight once encryption scenarios are added.

If the goal were to approach the server's upload.fileSizeSyncLimitMB ceiling, 500 still wouldn't get there, so there's no meaningful threshold difference between the two numbers. 150 is the better choice.

User:

11/18/2026 20:40:28

Decide on criterion 5: accept the server-side refusal as meeting it, or add a test for the _fullSync guard, which needs a sync held open while the same device resets.

What should I do?

Assistant:

11/18/2026 20:40:32

Accept the server-side refusal as meeting it.

The criterion says "B detects the reset and does not apply messages from the old group," and the server-side refusal achieves exactly that outcome. B tries to sync, the server rejects the request because the groupId no longer matches, and B never applies old messages. The outcome is correct regardless of which layer enforces it.

Testing the _fullSync guard specifically would require holding a sync open mid-flight while the same device resets — that's a concurrency test of an internal implementation detail, not a behavior the criterion asks for. If the guard ever became the only thing standing between B and corrupt data, that would be a separate concern worth its own issue.

The criterion is a behavior specification, not a code-path specification. The server-side refusal satisfies the behavior.

Powered by Claude Exporter (https://www.ai-chat-exporter.net)