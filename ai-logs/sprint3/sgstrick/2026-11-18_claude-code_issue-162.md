Issue #162 — Sync scenario tests, plus follow-up work on the #161 harness (Claude Code)

Created: 11/18/2026
Exported: 11/18/2026 22:39:03
Tool: Claude Code (VS Code extension), model Claude Opus 5.5
Note: tool calls are listed by name and description; tool outputs are omitted. Per-message timestamps weren't available for this export, so only the date is shown. Background-task completion notices are noted inside the assistant turns they triggered.

User:

Read packages/loot-core/src/server/sync/index.ts, packages/sync-server/src/app-sync.ts, packages/sync-server/src/sync-simple.js, and packages/loot-core/src/server/tests/mockSyncServer.ts. Summarize how sync works, identify every module-level variable in the client, and describe the server's startup and shutdown lifecycle. I need to understand what must be isolated to run two clients in one process.

Assistant:

> Tool: Read — packages/loot-core/src/server/sync/index.ts

> Tool: Read — packages/sync-server/src/app-sync.ts

> Tool: Read — packages/sync-server/src/sync-simple.js

> Tool: Read — packages/loot-core/src/server/tests/mockSyncServer.ts

> Tool: Bash — Find server entry, lifecycle hooks, and singletons

> Tool: Bash — List module-level mutable state in client sync deps

> Tool: Bash — Inspect server lifecycle and remaining client singletons

## How sync works

**Client (sync/index.ts)**

1. **Local write.** A mutator calls `sendMessages`. If a `batchMessages` call is open, the messages are queued in `_BATCHED`. Otherwise `_sendMessages` runs `applyMessages` and then `scheduleFullSync`.
2. **Apply.** `_applyMessages` is wrapped in `sequential`, so only one apply runs at a time. It does all of its database work in a single immediate transaction: `compareMessages` drops messages already in the log and marks superseded ones as `old`; it reads the affected rows (`oldData`), writes the changes, and appends to `messages_crdt`; it updates the merkle trie and saves the clock to `messages_clock`, then reads the rows again (`newData`). After the commit it updates in-memory state: undo history, budget type, `clock.merkle`, prefs, spreadsheet recompute, sync listeners, and the `app.events 'sync'` event.
3. **Schedule.** When `NODE_ENV === 'test'`, `scheduleFullSync` runs `fullSync()` straight away and waits for it. Otherwise it sets a 1-second `setTimeout`.
4. **Full sync.** `fullSync` is wrapped in `once`, so concurrent calls share the same promise. `_fullSync` reads `id`, `cloudFileId`, `groupId` and `lastSyncedTimestamp` from prefs; collects local messages newer than `since` and encodes them (encrypting if a key is set); POSTs them to `getServer().SYNC_SERVER + '/sync'` with `X-ACTUAL-TOKEN` from `asyncStorage`; decodes the reply and applies it through `receiveMessages`, which calls `Timestamp.recv` and runs `applyMessages` inside `runMutator`.
5. **Merkle check.** `merkle.diff(server, local)` decides what happens next. If they differ, it syncs again from the point where they diverge, up to 10 attempts with the same diff (100 at most), and then throws `out-of-sync`. If they match, it saves `lastSyncedTimestamp`.

**Server (app-sync.ts and sync-simple.js)**

- `POST /sync` decodes the protobuf request, checks that the file exists, that the user has access, and that the group and key IDs are valid. It then calls `simpleSync.sync(messages, since, groupId)`.
- `sync()` opens `group-<groupId>.sqlite` fresh on every request and selects `messages_binary WHERE timestamp > since`. Then, in one transaction, it runs `INSERT OR IGNORE` for each incoming message, adds newly inserted ones to the stored merkle, prunes it and saves it. Finally it closes the database and returns `{trie, newMessages}`.
- The server stores encrypted blobs, never decodes their content, and treats a message's timestamp as its unique ID. The query for new messages runs before the insert, so a client never gets its own messages back.
- The only persistent state is on disk: `account.sqlite` plus one group database per file.

**Mock server (mockSyncServer.ts)**

The same algorithm in memory, with module-level `currentMessages`, `currentClock`, `currentMockData` and `handlers`; `reset()` clears them. Unlike the real server it ignores `groupId` and `fileId`, so every client in the process shares one message log, and it does no authentication or validation.

## Module-level state in the client

**Inside `sync/index.ts`:** `SYNCING_MODE`; `_syncListeners`; `compareMessagesSqlByTermCount` (safe to share); `IS_BATCHING` and `_BATCHED`; `syncTimeout`; the closures inside `applyMessages = sequential(...)` and `fullSync = once(...)` (B's `fullSync()` would return A's in-flight sync); constants `FULL_SYNC_DELAY` and `COMPARE_CHUNK_SIZES`.

**In modules `sync/index.ts` uses (these matter more):** the crdt `clock` (`@actual-app/crdt` timestamp.ts); `db`, `dbPath` and `_queryCache` (db/index.ts); `prefs` (prefs.ts); `config` (server-config.ts); `globalSheet`, `globalOnChange`, `globalCacheDb` (sheet.ts); `MESSAGE_HISTORY` and `CURSOR` (undo.ts); `runningMethods`, `currentContext`, `globalMutationsEnabled` (mutators.ts); the single `app.events` emitter (main-app.ts); `keys` (encryption/index.ts); `asyncStorage` state; `platform/server/fs` roots; and `platform/server/connection`.

## Server lifecycle

**Startup** happens at import: load-config.js reads `ACTUAL_DATA_DIR` and the config file once; app.ts builds the Express app and exports `app`; app-sync.ts builds its handlers with body limits from config. `run()` bootstraps OpenID if configured, then calls `listen` and **throws away the server handle**. The account database opens lazily on the first `getAccountDb()`.

**Shutdown:** there's no shutdown function. `closeAccountDb()` closes the account database; group databases are opened and closed per request. To stop a test server, keep the handle from your own `app.listen(0)`, close it, then call `closeAccountDb()`.

## What this means for two clients in one process

**The server isn't the problem.** One instance on an ephemeral port can serve both clients. Set `ACTUAL_DATA_DIR` before the first import, bootstrap a user, and close the server and account DB in teardown.

**The client can't be isolated by patching `sync/index.ts`.** The crdt clock, db handle, prefs, sheet, the `once`/`sequential` closures and `app.events` are all process-wide singletons. Options: (1) separate module graphs per client, e.g. a `worker_threads` Worker or child process per device (recommended); (2) strictly alternating clients with `closeBudget`/`loadBudget` on every switch (cheaper but not concurrent); (3) `vi.resetModules()` plus dynamic import per client (unreliable). Whatever you choose, give each client its own data directory, budget id, crdt node ID, `user-token` storage, `SYNC_SERVER` config and `fetch`.

User:

In packages/sync-server/integration-tests/src/startSyncServer.ts, write a startSyncServer() function that starts the real sync-server app in-process on a random free port with temporary serverFiles and userFiles directories. Use mkdtemp for the temp dirs. Set ACTUAL_CONFIG_PATH, ACTUAL_DATA_DIR, ACTUAL_SERVER_FILES, and ACTUAL_USER_FILES as environment variables before importing the app, then restore them. Run migrations before importing the app (the app's modules touch the account database as they load). Call app.listen(0) and keep the returned server handle so shutdown() can call server.close(). Export shutdown() from the returned handle — it must call closeAccountDb() before deleting the temp directory (Windows can't delete an open SQLite file). Guard against calling this more than once per process, since sync-server reads its config once on import. Write a test in startSyncServer.test.ts that starts the server, confirms /health responds with 200, and confirms shutdown() deletes the temp directory even when called twice.

Assistant:

> Tool: Bash — Inspect sync-server layout, config, migrations, health route

> Tool: Bash — List integration-tests sources and config

> Tool: Bash — Read existing startSyncServer and its test

> Tool: Edit — startSyncServer.ts (add `dataDir` to the handle)

> Tool: Edit — startSyncServer.ts (shared `cleanUp()` for shutdown and startup errors)

> Tool: Write — startSyncServer.test.ts

> Tool: Bash — Run the startSyncServer integration test

> Tool: Bash — Typecheck, lint, and format-check changed files

Both files already existed from the earlier #161 work, and most of what you asked for was already in place. I filled the gaps instead of rewriting them. The test passes on this Windows machine, including the check that the temp directory is deleted, and the type check, lint and format check are clean. Nothing is committed.

**Already in place:** `mkdtemp` temp directory; the four `ACTUAL_*` environment variables set and restored in a `finally`; migrations before importing `#app`; `app.listen(0)` on 127.0.0.1 with the handle kept; `closeAccountDb()` before deleting the directory; a second call throws.

**What I changed:**
- **`dataDir` on the handle**, so the test can check the temp root itself is gone.
- **Cleanup when shutdown fails:** shutdown and the startup error path share a `cleanUp()` helper that runs `closeAccountDb()` and deletes the directory in a `finally`.
- **Cleanup when startup fails:** the port check now happens inside the cleanup path.
- **The test** checks migrations created `account.sqlite`; `/health` returns 200 with `{status: 'UP'}`; a second `startSyncServer()` is refused; the temp directory is deleted after `shutdown()`; the server stops answering; a second `shutdown()` resolves and the directory stays gone.

One limit: the guard works per module graph, not per process. Vitest gives each test file its own module graph (`isolate: true`), so each file gets its own server.

User:

packages/sync-server/src/app.ts currently calls app.listen() inside run() and discards the server handle, making it impossible to close the server from a test. Export the Express app instance from src/app.ts and add a #app subpath import to package.json so the integration tests can import it directly. The existing run() function and production startup must remain unchanged.

Assistant:

> Tool: Bash — Compare app.ts and package.json against master

No changes were needed: both are already on `master` and on this branch, from commit `14ee6fd86` ("feat: first attempt at sync server tests (#162)").

- **Exported app:** app.ts line 27 has `export { app };`.
- **Subpath import:** package.json maps `"#app": "./src/app.ts"`, with a matching `publishConfig.imports` entry pointing to `./build/src/app.js`.
- **Production startup:** `run()` still calls `app.listen` and discards the handle; `git diff master` shows no changes.

`startSyncServer()` already uses this, and the test run earlier imported `#app` that way and passed.

User:

In packages/sync-server/integration-tests/src/startSyncServerWithBudget.ts, write startSyncServerWithBudget() that calls startSyncServer(), bootstraps the password account via POST /account/bootstrap, logs in via POST /account/login, and uploads a minimal starter budget using the same zip format loot-core uses (db.sqlite from packages/loot-core/default-db.sqlite and a metadata.json with resetClock: true). Write a small zip.ts helper using the STORED compression method rather than a zip library dependency. Return the server handle extended with password, token, fileId, groupId, budgetId, and budgetName. Write a test in startSyncServerWithBudget.test.ts confirming all these fields are populated and the server reports the file under the returned groupId.

Assistant:

> Tool: Bash — Read existing budget bootstrap, test, and zip helper

> Tool: Bash — Check loot-core's upload zip format and headers

> Tool: Edit — startSyncServerWithBudget.test.ts (check all six fields)

> Tool: Bash — Run budget test, typecheck, lint, format check

All three files already existed from commit `d66d05c1b` and did what you asked, so I only changed the test. It passes, and the checks are clean. Nothing is committed.

**Already in place:** the bootstrap, login and upload, with shutdown on failure; an upload matching loot-core's `upload()` (zip of `db.sqlite` and `metadata.json` with `resetClock: true`, same headers); zip.ts writing STORED entries with Node's built-in `zlib.crc32`.

**What I changed:** the test now checks that all six fields are non-empty strings, labelled by field name. The existing check that `/sync/get-user-file-info` reports the file under the returned `groupId` is unchanged.

User:

In packages/sync-server/integration-tests/src/deviceWorker.ts, write a worker thread that loads packages/api/dist/index.js by repo path (sync-server must not depend on @actual-app/api), wraps globalThis.fetch before loading the API to block automatic syncs and non-loopback hosts, and runs with NODE_ENV=production so loot-core doesn't sync inside every change. The worker receives typed DeviceOp messages and replies with DeviceResponse. On init, call api.init() with the data directory and server URL, then api.downloadBudget(). On shutdown, close the budget. Define DeviceOp and DeviceResponse in deviceProtocol.ts. Check in src/apiBundle.ts that the API bundle exists before the worker tries to load it, and throw a clear error if it doesn't — yarn typecheck overwrites the bundle with an unbundled compile.

Assistant:

> Tool: Bash — Read device protocol, bundle check, worker, createDevice

> Tool: Bash — Check API bundle and references to the bundle path

> Tool: Bash — Read README section on the API bundle

> Tool: Edit — apiBundle.ts (add `API_BUNDLE_URL` and `assertApiBundleBuilt()`)

> Tool: Edit — deviceWorker.ts (read the bundle URL from `workerData`)

> Tool: Edit — createDevice.ts (check the bundle, pass its URL to the worker)

> Tool: Edit — vitest.globalSetup.ts (use the shared check)

> Tool: Edit — README.md

> Tool: Bash — Run the full sync integration test suite

> Tool: Bash — Typecheck, lint, and format-check changed files

> Tool: Bash — (several) Isolate why every test file now fails with "Cannot read properties of undefined (reading 'config')"

The worker and protocol already existed. I moved the bundle check into `apiBundle.ts` as you asked. The type check, lint and format check pass, but **I can't get a clean integration run right now**: every test file fails before any test runs, with `TypeError: Cannot read properties of undefined (reading 'config')` at its `describe` line. The committed code without my changes fails the same way, so my changes aren't the cause. Nothing is committed.

**What I changed:** `apiBundle.ts` now holds the bundle path and `assertApiBundleBuilt()`, which throws a clear "run `yarn build:api`" error if the bundle is missing or unbundled; `createDevice` runs the check (cached on success) before starting each worker and passes the URL through `workerData`; the global setup imports the same check; the README describes the new role of `apiBundle.ts`.

**Runtime evidence:** in the first full run after these edits, all 4 `deviceHelpers` tests passed, so the worker loaded the API from the `workerData` URL. Every run after that failed with the error above.

What I'd try next: `yarn install`, delete `node_modules/.vite`, try Node 24.18.1 (this machine has 24.20.0), and run `yarn test` from the root.

User:

Keep going.

Assistant:

> Tool: Bash — (several) Find where Vitest reads `config`, compare drive-letter casing, probe with a trivial test

> Tool: PowerShell — Run probe with uppercase vs lowercase drive cwd

> Tool: Bash — Run probe via cmd with each drive-letter case

> Tool: Bash — Probe the unit-test config with both drive cases

> Tool: ToolSearch — load WebSearch

It isn't specific to the integration tests. **Any Vitest run in this repo fails when it starts from a lowercase `c:\` working directory**, and the sync-server unit tests do the same. So it's a Vitest 5 problem with Windows drive-letter case, not anything in this branch. The VS Code extension starts shells in lowercase `c:\…`, which explains why it came and went.

User:

Tool loaded.

Assistant:

> Tool: WebSearch — vitest 5 windows lowercase drive letter "Cannot read properties of undefined (reading 'config')"

> Tool: Edit / Edit — vitest.config.ts (try an upper-case `root`)

> Tool: Bash — Probe with lowercase cwd after root fix

> Tool: Bash — Revert config edit; list Vitest 5.x releases

> Tool: Bash — Create scratch projects with Vitest 5.0.0 and 5.1.1

> Tool: Bash — Run probe in each version with both drive cases

> Tool: Bash — Run full integration suite from uppercase C: cwd

> Tool: Edit — README.md (Troubleshooting entry)

I found the cause: a Vitest bug on Windows, not this branch's code. With a working directory that starts with an uppercase `C:\`, the full integration suite passes: 8 files and 13 tests, including all the device tests that use the new bundle check and the `workerData` URL.

**What breaks:** if the shell's working directory has a lowercase drive letter (`c:\…`), Node loads Vitest's runner twice, once as `c:/…` and once as `C:/…`. Every file then fails at its first `describe`.

**How I confirmed it:** from the same shell, a trivial test passes with `C:\` and fails with `c:\`; sync-server's unit-test config fails the same way; and it reproduces in a bare project with both Vitest 5.0.0 and 5.1.1, so upgrading won't fix it.

**Fix:** none works in config (an uppercase `root` doesn't help, so I reverted it). The workaround is to `cd C:\Users\sarag\actual-budget` before running tests; it's in the README's Troubleshooting section.

Sources: Vitest issue #5251 (same error pattern with a lowercase drive letter), Vitest issue #1231, Mocha's Windows drive-letter casing bug, VitePress issue #4984.

User:

In packages/sync-server/integration-tests/src/createDevice.ts, write createDevice(serverUrl, token, fileId, groupId, { name? }) that creates a temporary data directory with mkdtemp, starts the device worker with execArgv: [] and NODE_ENV: 'production', drives it over a promise-based message channel, and returns a Device handle with api(), send(), getPrefs(), savePrefs(), getClientId(), request(), and close(). close() must call shutdown on the worker, then worker.terminate(), then delete the data directory. Write createDevice.test.ts confirming two devices have different data directories, different CRDT node IDs, and don't share prefs. Write createDevice.sync.test.ts confirming that after both sync, B has A's budget account but not A's local prefs.

Assistant:

> Tool: Bash — Read both createDevice test files

Nothing needed changing. All three files already exist and match your spec, and both test files passed in the last full run.

- **createDevice.ts:** `mkdtemp` data directory; worker with `execArgv: []` and `NODE_ENV: 'production'`; id-matched promise channel that keeps loot-core's `reason` and rejects pending calls if the worker exits; the full `Device` handle; `close()` sends `shutdown`, then `terminate()`, then deletes the directory, safely twice.
- **createDevice.test.ts:** different data directories, different 16-hex-digit node IDs, separate prefs and separate databases.
- **createDevice.sync.test.ts:** after both sync, B has A's account but not A's test-only pref.

Both tests use `setUpTwoDevices()`, which creates the devices through `createDevice`.

User:

In packages/sync-server/integration-tests/src/deviceHelpers.ts, write makeChange(device, change), sync(device), goOffline(device), and goOnline(device). makeChange starts with createAccount, updateAccount, and deleteAccount and returns { id }. sync sends a sync op to the worker and returns { received }; throws on failure with loot-core's reason on the error (e.g. network-failure). goOffline and goOnline send setOnline ops. Write deviceHelpers.test.ts with one test per helper: confirm makeChange stays local (check against countServerMessages even after the 1-second auto-sync delay); confirm sync pushes changes and returns a result; confirm goOffline makes sync throw with reason: 'network-failure'; confirm goOnline lets changes made offline reach the server.

Assistant:

> Tool: Bash — Read device helpers, their test, and serverMessages

Nothing needed changing. All files exist and match your spec, and all four tests passed in the last full run.

1. **makeChange stays local:** create, rename and delete an account, then wait until loot-core actually attempted its automatic sync and the worker blocked it (rather than sleeping), then check `countServerMessages` hasn't changed.
2. **sync pushes changes:** the server count goes up and the result has `received`; a second sync adds nothing.
3. **goOffline:** local changes work, `sync` throws `network-failure`, nothing reaches the server.
4. **goOnline:** a change made offline reaches the server after `goOnline` plus `sync`.

User:

In packages/sync-server/integration-tests/src/assertInSync.ts, write assertInSync(...devices) that fetches the server's merkle hash by sending an empty sync request with since set far in the future, takes a snapshot from each device (merkle hash, message count, and rows from every table that appears in any device's CRDT log), and throws an OutOfSyncError listing merkle hashes and the specific tables, rows, and columns that differ. Limit the output to 10 rows per table and summarize the rest. Write assertInSync.test.ts with three cases: passes when devices are synced; throws naming a missing row; throws naming a stale column.

Assistant:

> Tool: Bash — Read assertInSync and its test

Nothing needed changing. Both files exist and match your spec, and all three tests passed in the last full run. The server hash comes from an empty sync request with `since` set to `9999-12-31…`; tables are the union of every device's CRDT log (skipping `prefs` and `spreadsheet_cells`); the error lists hashes, missing rows and differing columns, at most 10 rows per table with a `...and N more row(s)` line.

None of the tests exercises the 10-row limit. I can add that test if you want it.

User:

Yes.

Assistant:

> Tool: Edit — assertInSync.test.ts (add the 10-row limit test)

> Tool: Bash — Run assertInSync tests and check types, lint, format

> Tool: Edit — assertInSync.test.ts (scope the count to the accounts section)

> Tool: Bash — Rerun assertInSync tests and checks

I added a fourth test, and all four tests in the file pass. A creates 12 accounts and syncs; B never syncs. The test checks the `accounts` section says 12 rows differ, lists exactly 10, and ends with `...and 2 more row(s)`.

My first version counted rows across the whole message and got 30: each new account also adds rows to `payees` and `payee_mapping`, so all three tables hit the limit. That shows the limit applies per table. The test now reads just the `accounts` section.

User:

In packages/sync-server/integration-tests/src/setUpTwoDevices.ts, write setUpTwoDevices() that calls startSyncServerWithBudget(), creates devices A and B, and returns { server, a, b, tearDown }. tearDown must close both devices before shutting down the server. Write packages/sync-server/integration-tests/src/e2e.smoke.test.ts: start the server, create A and B, make a change on A (createAccount), sync A then B, call assertInSync(a, b), confirm b.api('getAccounts') contains the account, confirm neither device made any non-loopback network request (spy on globalThis.fetch from the test thread; check device.request({ type: 'blockedRequests' }) on each device), and confirm all temporary directories are deleted after the finally block closes everything.

Assistant:

> Tool: Bash — Read setUpTwoDevices and smoke test

> Tool: Edit — setUpTwoDevices.ts (`Promise.allSettled`, always shut down the server)

> Tool: Edit — e2e.smoke.test.ts (use `server.dataDir`; assert the spy saw requests)

> Tool: Bash — Run full integration suite and checks

Both files already existed and did what you asked. I made three small fixes, and the full suite passes: 8 files and 14 tests. Nothing is committed.

- **tearDown:** now waits with `Promise.allSettled`, always shuts down the server, then rethrows the first failure.
- **Smoke test:** gets the server's temp directory from `server.dataDir`, and asserts the `fetch` spy recorded at least one request so the loopback check can't pass on an empty list.

User:

Add integration-tests/vitest.config.ts with a 60-second timeout and maxConcurrency: 2 (each test file starts a server, and running too many at once exhausts memory). Add integration-tests/vitest.globalSetup.ts to delete the Vitest-internal temp folder that Vitest 5 leaks on Windows. Update packages/sync-server/package.json to add a test:integration script and include the integration tests in the existing test script after the unit tests. Update lage.config.js to make sync-server#test depend on api#build (cached), so yarn test always has a current API bundle. Update the root tsconfig.json to reference the new integration-tests/tsconfig.json. Confirm yarn test passes all existing loot-core sync tests and all 13 new integration tests, and that yarn typecheck passes.

Assistant:

> Tool: Bash — Read lage config, root tsconfig refs, test scripts

> Tool: Edit — tsconfig.json (reference integration-tests)

> Tool: Bash — Run yarn typecheck then yarn test from uppercase C: (background)

[background task finished]

> Tool: Bash — Show typecheck and yarn test results

> Tool: Bash — (several) Show failure cause, loot-core sync results, sync-server section

> Tool: Bash — Verify API bundle; rerun executors test alone

> Tool: Bash — Confirm no loot-core changes; list modified files

`yarn typecheck` passes. `yarn test` exited with a failure, but not from anything in this work: 2 loot-core tests unrelated to sync timed out under load, and they pass when run on their own.

- **sync-server passed**, unit and integration (14 tests, including the 10-row limit test).
- **loot-core sync tests passed:** sync.test.ts (12), deferred.test.ts (9), compare-messages.test.ts (5), migrate.test.ts (2), serialization.test.ts (2); sync.property.test.ts is skipped in the code.
- **loot-core overall:** 1,359 passed, 2 failed in `executors.test.ts` at the 20-second timeout while web tests ran alongside. Alone, they pass in 14–16 s. This branch makes no changes to loot-core.
- **Bundle:** `typecheck` overwrote the API bundle and `api#build` (a lage cache hit) restored it.

**What I changed:** added `packages/sync-server/integration-tests` to the root `tsconfig.json`. Everything else was already in place. I kept `maxWorkers: 2` instead of `maxConcurrency`: in Vitest, `maxConcurrency` only limits `test.concurrent` tests inside one file, while `maxWorkers` caps how many files (and servers) run at once.

User:

[Pasted the text of issue #162:]

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

Does the current implementation solve this issue?

Assistant:

> Tool: Bash — Check suite duration, scenario test, CI workflow

No, it doesn't. The current implementation is the test infrastructure from #161, not the scenarios this issue asks for. Of the eight criteria, two are met, two are partly met and four aren't started.

| # | Criterion | Status |
|---|---|---|
| 1 | Basic sync both ways | Partly (exampleScenario, accounts only, B offline) |
| 2 | Same-field edits | No |
| 3 | Different records at the same time | No (no transaction change type) |
| 4 | Offline catch-up | No |
| 5 | Sync reset | No |
| 6 | Encrypted file | No (devices can't use encryption yet) |
| 7 | Ends with `assertInSync`, bugs skipped with a link | Partly |
| 8 | Under 60 s, runs in CI | Yes for now (~28 s, runs in `check.yml`) |

Criteria 1–5 are mostly short tests on top of the existing harness plus a transaction change type. Encryption and sync reset need new infrastructure first.

User:

In packages/sync-server/integration-tests/src/deviceProtocol.ts, add createTransaction, updateTransaction, and deleteTransaction variants to the Change type. Handle them in deviceWorker.ts using api.addTransactions, api.updateTransaction, and api.deleteTransaction. Add their signatures to ApiModule in apiBundle.ts. Write a quick test confirming a transaction created on A appears on B after both sync.

Assistant:

> Tool: Bash — Find API transaction method signatures

> Tool: Bash — Read transactions-add handler and import type

> Tool: Bash — Check whether an id field is accepted and kept

> Tool: Bash — Read getTransactions signature and update handler

> Tool: Edit — deviceProtocol.ts, apiBundle.ts, deviceWorker.ts (transaction changes)

> Tool: Write — transactions.sync.test.ts

> Tool: Edit — README.md

> Tool: Bash — Run transaction test, typecheck, lint, format

> Tool: Bash — Run the full integration suite

Devices can now create, update and delete transactions, and a transaction created on A shows up on B after both sync. The full suite passes: 9 files, 16 tests, about 32 seconds.

**One thing worth knowing:** `api.addTransactions` returns `'ok'`, not the new id, and loot-core generates the id itself. So `createTransaction` lists the account's transactions before and after adding, and returns the one new id.

**Tests:** (1) A creates a transaction and B has it with the same id, date, amount and notes; (2) B updates it and A sees the change, then A deletes it and it's gone from B.

User:

In a new file packages/sync-server/integration-tests/src/scenarios/basicSync.test.ts, write two tests using setUpTwoDevices: one where A creates an account and B receives it after syncing, and one where B creates an account and A receives it. Each test must call assertInSync at the end. The existing exampleScenario.test.ts covers offline edits, not clean two-way sync, so this is a gap.

Assistant:

> Tool: Write — scenarios/basicSync.test.ts (failed: transient safety-check error; retried)

> Tool: Write — scenarios/basicSync.test.ts

> Tool: Bash — Run basicSync test, typecheck, lint, format

I added `scenarios/basicSync.test.ts` with both tests, and they pass (~9 s). Each test checks the other device doesn't have the account before syncing, then that it does afterwards, and ends with `assertInSync(a, b)`.

**Difference from what you asked:** both tests share one `setUpTwoDevices()` call in `beforeAll`, because sync-server loads its config once per module graph and a second call throws. Each test creates its own uniquely named account.

User:

In packages/sync-server/integration-tests/src/scenarios/conflictSameField.test.ts, write a test where both A and B rename the same account to different names before either syncs. After sync(a) then sync(b) then sync(a), confirm both devices hold the same name and that it matches the account with the later CRDT timestamp. Add a comment identifying the exact code path in packages/loot-core/src/server/sync/index.ts (compareMessages) that decides the winner, and what happens if timestamps are identical.

Assistant:

> Tool: Bash — Check timestamp format and compareMessages line numbers

> Tool: Bash — Read Timestamp toString and recv

> Tool: Write — scenarios/conflictSameField.test.ts

> Tool: Bash — Run conflict test three times; typecheck, lint, format

I added `scenarios/conflictSameField.test.ts`, and it passed three runs in a row. Both devices rename the account before either syncs; after A, B, A the test takes each rename's real timestamp from the sync results and checks both devices hold the name with the later one, then calls `assertInSync`. It doesn't assume B wins because it renamed second.

**The comment covers:** timestamps are `<ISO millis>-<counter>-<node id>` strings, so text comparison orders by time, counter, then node; `compareMessages` marks an incoming message `old` if the log has a later timestamp for that cell (line 355), and old messages are logged but never written (line 483); an identical timestamp is treated as already applied and dropped without comparing values (line 353).

**A gap worth knowing:** identical timestamps could only happen if two devices shared a node id. Then they could silently disagree, and nothing would catch it because the duplicate-node check in `Timestamp.recv` is commented out.

User:

In packages/sync-server/integration-tests/src/scenarios/conflictDifferentRecords.test.ts, write a test where A creates and immediately deletes one account while B creates and immediately deletes a different account, with no syncing in between. After both sync fully (A, B, A), confirm both devices have both tombstones and call assertInSync. Use the transaction change type from Prompt 1 for a second case that covers transactions.

Assistant:

> Tool: Bash — Check what deleting an account writes

> Tool: Bash — Read forced account-close path and db.deleteAccount

> Tool: Write — scenarios/conflictDifferentRecords.test.ts

> Tool: Bash — Format, run the new test, typecheck, lint

> Tool: Bash — Run the full integration suite

I added `scenarios/conflictDifferentRecords.test.ts` with both cases, and both pass. The full suite passes: 12 files, 21 tests, about 50 seconds.

Deletes are soft (`tombstone = 1`), and `getAccounts`/`getTransactions` hide those rows, so the tests read raw rows through the device's `snapshot` op. **Accounts:** each device creates and deletes its own account; after A, B, A both have both rows tombstoned and `assertInSync` passes. **Transactions:** after a shared account syncs, each device creates and deletes its own transaction; both end with both tombstoned and `getTransactions` empty.

**Suite time:** now about 50 seconds, close to the 60-second target.

User:

In packages/sync-server/integration-tests/src/scenarios/offlineCatchUp.test.ts, write a test where B goes offline, creates 500 accounts in a loop using makeChange, comes back online, and syncs. Confirm no out-of-sync error and call assertInSync. Add a comment in the test measuring how close 500 accounts gets to the server's upload.fileSizeSyncLimitMB limit (20 MB by default) and what the realistic ceiling is. If the batch size needed to hit the limit is impractical in a test, add an it.skip with a comment explaining that upload batching (a separate issue) is required to handle it.

Assistant:

> Tool: Edit — deviceProtocol.ts, deviceWorker.ts (record sync request sizes; `syncRequestBytes` op)

> Tool: Write — scenarios/offlineCatchUp.test.ts (measurement draft)

> Tool: Bash — Run measurement draft of offline catch-up test

> Tool: Write — scenarios/offlineCatchUp.test.ts (final)

> Tool: Bash — Format, run final test, typecheck, lint

> Tool: Read / Edit — offlineCatchUp.test.ts (move the timeout into an options object)

> Tool: Bash — Typecheck, lint, format, then run full suite

I added `scenarios/offlineCatchUp.test.ts`. The 500-account test passes, and the case that reaches the upload limit is an `it.skip`. The full suite passes (22 tests, 1 skipped) but now takes about 72 seconds.

**Measured with 500 accounts:** 3,500 CRDT messages (7 per account); one sync request of 445,449 bytes (~891 bytes per account, ~127 per message), about 2% of the 20 MB limit; ~20 s to create the accounts, under 1 s to sync. A device sends everything from one offline period in a single request, so the realistic ceiling is about 23,500 new accounts, or 165,000 messages.

**The skipped test:** reaching the limit would take about 16 minutes. Its comment explains that without upload batching the server refuses the request and the device can never catch up.

**New infrastructure:** the device worker records the size of every sync request it sends (`syncRequestBytes` op). I haven't checked what the client does after a 413.

User:

Add a resetSync(device) helper to deviceHelpers.ts that calls the loot-core sync/reset handler via device.send. In packages/sync-server/integration-tests/src/scenarios/syncReset.test.ts, write a test where A makes a change and syncs, then A resets sync (producing a new groupId), then B attempts to sync against the old groupId. Confirm B detects the mismatch and does not apply messages from the old group — reference the specific groupId guard in _fullSync in packages/loot-core/src/server/sync/index.ts. Add a second case where B re-downloads the budget with the new groupId and confirm assertInSync passes.

Assistant:

> Tool: Bash — Read resetSync and find its handler name

> Tool: Bash — Read server sync validation and client postBinary errors

> Tool: Bash — Read how non-200 responses become errors

> Tool: Bash — Read the API download-budget handler (two calls)

> Tool: Edit — deviceHelpers.ts (`resetSync`, `downloadBudget`)

> Tool: Edit — assertInSync.ts (read the current group id from prefs)

> Tool: Edit — createDevice.ts (doc comment)

> Tool: Write — scenarios/syncReset.test.ts

> Tool: Bash — Format and run the sync reset test (second case failed: `network-failure`)

> Tool: Edit — deviceProtocol.ts, deviceWorker.ts, deviceHelpers.ts (`downloadBudget` op that allows its sync)

> Tool: Bash — Rerun the sync reset test

> Tool: Bash — Typecheck, lint, format, then full suite

Both reset cases pass, and so does the full suite: 14 files, 24 tests plus 1 skipped, about 67 seconds.

**One correction to the request:** B is not stopped by the `groupId` guard in `_fullSync`. The server's `validateSyncedFile` rejects B's old group id with `file-has-reset` before reading or returning any messages. The guard (sync/index.ts lines 934–938) handles a device's *own* group id changing while its sync request is in flight. The test comment explains both paths and says this scenario doesn't exercise the guard.

**The test:** (1) B's sync throws `file-has-reset`; its accounts, message count and group id are unchanged, and `assertInSync` refuses devices in different groups; (2) B downloads the budget with the new group id, has both of A's accounts, a new change on B reaches A, and `assertInSync` passes.

**Supporting changes:** `resetSync(device)` calls `sync-reset` and returns the new group id; `downloadBudget(device, groupId)` re-downloads (my first version called the API directly and the worker blocked its sync); `assertInSync` reads each device's current group id from its prefs.

User:

Extend startSyncServerWithBudget to accept an optional encryptionPassword parameter. When provided, derive an encryption key from the password using the same method as loot-core, encrypt the starter budget zip before uploading, and include the key ID in the upload headers. Extend createDevice to accept the same encryptionPassword and pass it to api.downloadBudget. Write a test confirming a device initialized with the correct password can read the budget, and a device initialized with the wrong password gets a decrypt error rather than silently corrupted data.

Assistant:

> Tool: Bash — (several) Read loot-core's encryption internals, key-make/key-test handlers, test message, downloadBudget signature

> Tool: Write — encryption.ts

> Tool: Edit — startSyncServerWithBudget.ts (encrypt, `X-ACTUAL-ENCRYPT-META`, register the key)

> Tool: Edit — deviceProtocol.ts, apiBundle.ts, deviceWorker.ts, createDevice.ts, serverMessages.ts

> Tool: Write — encryptedBudget.test.ts

> Tool: Bash — Format and run the encrypted budget test (failed: `'const' declarations must be initialized`)

> Tool: Bash — (several) Locate the worker syntax error; read the PostToolUse format hook; reproduce the prefer-const autofix

> Tool: Edit — deviceWorker.ts (fix the variable)

> Tool: Bash — Rerun the encrypted budget test

> Tool: Bash — Typecheck, lint, format, then full suite

The test server can now start with an end-to-end encrypted budget, and devices can open it with a password. The full suite passes: 15 files, 27 tests plus 1 skipped, about 61 seconds.

- **encryption.ts** copies loot-core's scheme: PBKDF2-SHA512 over the password and a random 32-byte salt with 10,000 iterations, AES-256-GCM with a random 12-byte IV, and the encrypted test message `key-make` registers.
- **startSyncServerWithBudget({ encryptionPassword })** encrypts the starter zip, sends the IV, auth tag and key id in `X-ACTUAL-ENCRYPT-META`, and registers the key with `/sync/user-create-key`.
- **createDevice(…, { encryptionPassword })** passes the password to `api.downloadBudget`.
- **The test:** the server holds only ciphertext; the correct password reads the budget (its name comes from inside the encrypted zip) and syncs encrypted messages; the wrong password rejects with `decrypt-failure` and no budget is opened.

**A mistake of mine along the way:** the repo's edit hook runs `oxlint --fix`, and I added a `let` and its assignment in separate edits. In between, the `actual/prefer-const` auto-fix correctly turned it into `const`. I fixed the file.

User:

In packages/sync-server/integration-tests/src/scenarios/encryption.test.ts, repeat Scenario 1 (basic two-way sync) and Scenario 2 (simultaneous same-field edits) with encryptionPassword set. Confirm assertInSync passes after each. Add a third case where a third device is created with the wrong password and confirm it throws a decrypt error rather than producing wrong data.

Assistant:

> Tool: Read / Edit — setUpTwoDevices.ts (`encryptionPassword` option)

> Tool: Edit — deviceHelpers.ts (shared `findReceived`)

> Tool: Read / Edit — scenarios/conflictSameField.test.ts (use `findReceived`)

> Tool: Write — scenarios/encryption.test.ts

> Tool: Bash — Format, typecheck, lint, then full suite (4 failures: `file-has-new-key`)

> Tool: Bash / Read — Show the failures; read assertInSync

> Tool: Edit — assertInSync.ts (send the device's encryption key id)

> Tool: Bash — Typecheck, lint, format, then full suite

I added `scenarios/encryption.test.ts`, and all four cases pass with encryption on. The full suite passes: 16 files, 31 tests plus 1 skipped, about 62 seconds.

1. **A to B** and 2. **B to A**, each also checking every message the server stores is encrypted.
3. **Simultaneous renames:** both keep the name with the later CRDT timestamp.
4. **Wrong password:** a third device rejects with `decrypt-failure` and never opens a budget; A and B stay in sync.

**A bug these tests found in `assertInSync`:** its empty sync request had no key id, and the server rejects that for an encrypted file with `file-has-new-key`. It now reads each device's key id from its prefs, sends it, and reports devices using different keys as an `OutOfSyncError`.

User:

Run the full integration suite with yarn workspace @actual-app/sync-server run test:integration and measure total runtime. If it exceeds 60 seconds, profile which tests are slowest — the 500-account offline test is the most likely candidate — and optimize (reduce to the minimum count that still exercises the batch path). Confirm the suite passes on Linux (CI uses Ubuntu; prior testing was Windows-only). Update integration-tests/vitest.config.ts if concurrency or timeout adjustments are needed.

Assistant:

> Tool: Bash — Time the full suite and rank files by duration

> Tool: Bash — Check Docker/WSL availability and CI setup

> Tool: Bash — Confirm batch sizes and read test header

> Tool: Edit — offlineCatchUp.test.ts (150 accounts, explanation, drop the custom timeout)

> Tool: Bash — Typecheck, lint, then time the suite twice

> Tool: Bash — Time the suite with 3 and 4 workers

> Tool: PowerShell — Start Docker Desktop (several calls to locate and launch it)

> Tool: Bash — Wait up to 5 minutes for the Docker engine (background)

> Tool: Bash — Check Yarn setup and pack the working tree

[background task finished: Docker ready]

> Tool: Write — scratchpad run-linux.sh

> Tool: Bash — Install, build, and run the suite in a Linux container (background)

[background task finished: API build failed, no git repository in the container]

> Tool: Edit — run-linux.sh (create a throwaway git repo for lage)

> Tool: Bash — Rerun install, build, and suite in Linux container (background)

[background task finished]

> Tool: Bash — Show Linux run timings and slowest files

The suite passes on Linux and is under 60 seconds there: 55 and 52 seconds in two runs, all 31 tests passing and the over-the-limit test skipped. I cut the offline test from 500 to 150 accounts and didn't change `vitest.config.ts`.

| Setup | Accounts | Suite | Offline test file |
|---|---|---|---|
| Windows | 500 | 54 s (62–71 s earlier) | 16 s, up to 38 s under load |
| Windows | 150 | 51 s and 61 s | 8–13 s |
| Linux container, 4 CPUs | 150 | 55 s and 52 s | 13–15 s |

**Why 150:** loot-core has no upload batching, so the only count-dependent code is on the receiving side, which works in chunks of 100 (`fetchAll`, `compareMessages`). 150 accounts makes `accounts` and `payees` each need a full chunk plus a partial one.

**Why I left the config alone:** the slowest file is ~15 s, well inside 60 s; 4 workers saved only ~5 s on Windows and would likely hurt on a 4-vCPU CI runner; the remaining cost is per-file server startup.

**Caveats:** not run on actual GitHub CI; Docker Desktop is still running.

User:

Review all test results. For any test that fails because of a real sync bug (not a test setup problem), mark it it.skip with a comment describing the expected behavior, why it currently fails, and a placeholder for a bug issue link. Do not fix the bugs here. Update integration-tests/README.md to list all six scenarios, their current pass/skip/known-failing status, and the open questions that remain (batch size ceiling, encryption key derivation approach, sync-reset behavior documentation).

Assistant:

> Tool: Bash — List skip/known-failing markers and README headings

> Tool: Read / Edit — offlineCatchUp.test.ts (structured skip comment with `TODO(link)`)

> Tool: Read / Edit — README.md (scenarios and status, open questions, helper table, Troubleshooting)

> Tool: Bash — Format, lint, typecheck, run offline test, show table

No tests fail because of a sync bug. Every test passes on Windows and Linux, so I didn't add any new `it.skip`.

**The one skipped test** (offline catch-up over the 20 MB limit) now has a structured comment: a `TODO(link)` placeholder; expected behavior; why it fails (`_fullSync` sends everything in one request, the server refuses it, retries repeat it); why it's skipped rather than failing (~16 minutes).

**README:** a table of all six scenarios with status (12 passing, 1 skipped, none known-failing); open questions on the upload ceiling, encryption key derivation, sync-reset documentation, and two devices sharing a node id; an updated helper table; and a corrected Troubleshooting section.

User:

[Pasted the issue #162 text again, unchanged from above.]

Is this issue fulfilled?

Assistant:

Mostly, but not fully. All six scenarios have passing tests. Missing: a real link to a bug issue for the skipped test; a run on GitHub CI; and the "reset while another device is still syncing" case.

| # | Criterion | Status |
|---|---|---|
| 1 | Basic sync both ways | Met |
| 2 | Same-field edits, later timestamp wins | Met (renames an account rather than a category) |
| 3 | Different records at the same time | Met |
| 4 | Offline catch-up | Met, with a judgment call (150 accounts vs the issue's 500 example) |
| 5 | Sync reset | Behavior met; the server's validation stops B, not the `_fullSync` guard |
| 6 | Encryption | Met |
| 7 | `assertInSync` everywhere; bugs skipped with a link | Partly (`TODO(link)` placeholder) |
| 8 | Under ~60 s and runs in CI | Not verified on GitHub CI |

To close it: file the upload-batching issue and add its URL; decide on the reset-during-sync case; decide 150 vs 500 accounts; commit, open the PR and confirm CI.

User:

1. File the upload-batching issue and put its URL in place of the TODO(link).
2. Ignore this issue.
3. Choose 150 accounts.

Assistant:

> Tool: Bash — Show git remotes and the README open question

> Tool: Edit — README.md (150 accounts recorded as a decision)

I can't file the issue myself: the repo's agent rules don't allow agents to create GitHub issues, and a hook blocks it. I drafted it for you to file in `CSCI-435-SE/actual-budget` ("Sync: split large uploads so a device with many offline changes can catch up"), and will add the URL when you send it. For 2, I left the reset-during-sync case alone. For 3, the README now lists 150 accounts as a decision.

User:

Reformat the issue using this template:

##Title
[ Short, descriptive, action-oriented (e.g., "Add keyboard shortcut to dismiss notification toasts") ]

## Summary
[ what the feature is, why it matters, who benefits ]

## User Story
As a [type of user], I want [goal] so that [benefit].

## User Scenario
[A concrete walkthrough of how a user encounters and uses this feature.]

## Acceptance Criteria
1. ...
2. ...
3. ...

## Rough Scope
[ Small / Medium / Large / XL — one sentence justifying the estimate ]

## Out of Scope
- ...

## Open Questions
- ...

## Source

Assistant:

Here's the issue in your template. I moved the measurements into the Summary, added a Rough Scope, and wrote the first heading as `## Title`.

## Title
Split large sync uploads so a device with many offline changes can catch up

## Summary
When a device reconnects after being offline, the client sends every change since its last sync in a single `/sync` request (`_fullSync` in `packages/loot-core/src/server/sync/index.ts`). The server reads that request body with `express.raw({ limit: upload.fileSizeSyncLimitMB })` in `packages/sync-server/src/app-sync.ts`, and the limit is 20 MB by default. If a device's offline changes add up to more than that, the server refuses the request (HTTP 413). Every retry sends the same oversized request, so the device can never sync again.

The integration tests measured about 891 bytes per new account (7 changes of about 127 bytes each). That puts the ceiling for one offline period at about 23,500 new accounts, or 165,000 changes, at the default limit, and changes with larger values such as long notes reach it sooner. The fix matters most to people who make many changes while offline, such as large imports, and they currently have no way to recover.

## User Story
As a user who edits my budget on a device that's offline for a long time, I want it to sync when it reconnects, however many changes I made, so that I don't get stuck unable to sync.

## User Scenario
A user imports several years of transactions on a laptop while offline, then reconnects. The laptop tries to upload everything in one request, the server rejects it as too large, and every later sync attempt fails the same way. With batching, the laptop uploads its changes in several requests, each under the limit, and ends up in sync with the user's other devices.

## Acceptance Criteria
1. A device whose unsynced changes exceed `upload.fileSizeSyncLimitMB` syncs successfully, and all devices end up in sync.
2. Each `/sync` request stays under the server's limit.
3. The skipped test `syncs … accounts created while offline (over the upload limit)` in `packages/sync-server/integration-tests/src/scenarios/offlineCatchUp.test.ts` is enabled and passes. To keep it fast, it should exceed the limit with fewer, larger changes, or with a server started with a smaller limit.
4. The existing sync unit and integration tests still pass.

## Rough Scope
Medium: the change is mostly in the client's `_fullSync` loop, but splitting a sync into several requests has to keep its merkle-trie comparison and retry handling correct.

## Out of Scope
- Changing the default `upload.fileSizeSyncLimitMB`.
- Download size: the server's response to a sync request has no equivalent limit.
- Upload limits for whole budget files (`/upload-user-file`).

## Open Questions
- What error does the client report today when the server answers 413? It hasn't been checked.
- Should the client split uploads into several requests, or should the server accept large uploads in parts?

## Source
Found while writing the end-to-end sync scenario tests (the offline catch-up scenario in `packages/sync-server/integration-tests/src/scenarios/offlineCatchUp.test.ts`).

User:

https://github.com/CSCI-435-SE/actual-budget/issues/186

Assistant:

> Tool: Edit — offlineCatchUp.test.ts (replace `TODO(link)` with the URL)

> Tool: Bash — Find remaining placeholders mentioning the link

> Tool: Read / Edit — README.md (link #186)

> Tool: Bash — Format, lint, and confirm the links

I've linked issue #186 in the skipped test's comment and in the README's scenarios section, and no placeholders are left. That covers acceptance criterion 7. The last unmet criterion is 8: the suite has never run on GitHub CI.

User:

Fill out this template:

## Description
[clearly explains what changed, why, and how it was tested]
[AI section]

## Related issue(s)
[closes #<number>, related to]

## Testing
[new or updated tests for every behavioral change; test strategy explained in the PR]

## Design Decisions
[one sentence stating what you decided, alternatives considered (at least two concrete options you evaluated), rationale (why you chose this option over the others), and consequences]

## Tech Debt
**Introduced:** [Describe any shortcuts, workarounds, or design compromises made in this implementation, and why. If none, write "None."]
**Encountered:** [Describe any pre-existing tech debt you ran into while working on this issue, and how you handled it. If none, write "None."]

Assistant:

> Tool: Bash — Read the repo PR template and branch info

This isn't the repo's PR template (which agents must leave blank), so I filled in your team's template in English, with `#<number>` left as a placeholder. The filled template covered:

- **Description:** the six scenarios and their files; supporting harness changes (transaction changes, encryption support, `resetSync`/`downloadBudget`/`findReceived`/`countEncryptedServerMessages`/`syncRequestBytes`, `assertInSync` reading group and key ids from prefs, setup cleanup fixes, the root tsconfig reference, the README); no changes to loot-core or sync-server code; an AI disclosure naming Claude Code (Claude Opus 5.5).
- **Related issue(s):** closes this issue; related to #161 and #186.
- **Testing:** a table mapping each behavioral change to its tests; the real-code, outcome-focused strategy; results on Windows and in a Linux container; not yet run on GitHub CI.
- **Design Decisions:** encrypting the test budget with a copy of loot-core's scheme (vs `key-make` or pre-encrypted files); 150 accounts (vs 500 or near the limit); `assertInSync` reading group and key from prefs (vs updating `connection` or a separate assertion).
- **Tech Debt:** introduced — the duplicated encryption scheme, the measured `BYTES_PER_ACCOUNT` constant, one server per file, the untested `_fullSync` guard; encountered — the Vitest drive-letter bug, `yarn typecheck` overwriting the API bundle, the commented-out duplicate-node check, unknown client behavior on a 413, slow loot-core `executors.test.ts` tests.

User:

Add a release note for the issue.

Assistant:

> Tool: Skill — writing-release-notes

> Tool: Bash — Find the user's earlier release notes and authors

> Tool: Write — upcoming-release-notes/add-sync-scenario-tests.md

> Tool: Bash — Format-check and show the release note

I added the release note at `upcoming-release-notes/add-sync-scenario-tests.md`, and it passes the format check:

```markdown
---
category: Maintenance
authors: [sgstrick]
---

Add end-to-end sync tests for simultaneous edits, offline catch-up, sync resets and encrypted budgets
```

`Maintenance` because the change is tests only; `sgstrick` matches earlier notes; the wording names what this issue adds instead of repeating #161's note.

User:

Test / lint (pull_request) fails.

Assistant:

> Tool: Bash — Check pushed state and how CI runs lint

> Tool: Bash — Run the CI lint commands locally

> Tool: Bash — Check flagged files against the commit; show error lines

> Tool: Edit — assertInSync.ts (use `format()` for the group and key ids, two edits)

> Tool: Bash — Rerun type-aware lint, format check, typecheck

> Tool: Bash — Run the tsconfig-references check and knip

> Tool: Bash — Run tests that cover the changed assertInSync lines

> Tool: Bash — Show knip findings sections and any integration-tests hits

I found and fixed the lint failure. CI's lint runs `oxlint --type-aware`, but my earlier checks ran it without that flag, so two type-aware errors in `assertInSync.ts` got through: the different-groups and different-keys messages put `unknown`-typed prefs values straight into template strings (`restrict-template-expressions`). Both now use the file's existing `format()` helper.

- `oxlint --type-aware --quiet` now passes for the whole repo.
- The format check passes for every file this branch changes (the 516 other flagged files are Windows line-ending noise from `core.autocrlf`).
- The type check and `check:tsconfig-references` pass; the three test files covering the changed lines pass (10 tests).
- `knip` exits with errors, but none involve this branch (an unused `nano-staged` dependency and Husky hook binaries).

The fix isn't committed yet: the pushed commit `f5b13a1e1` still has the errors.

User:

Export this session into the path C:\Users\sarag\actual-budget\ai-logs\sprint3\sgstrick with the title 2026-11-18_claude-code_issue-162.md

Assistant:

> Tool: Bash — List AI logs and read the sibling log's format

> Tool: Bash — Read the earlier Claude Code log's format

> Tool: Bash — Get the current local time

> Tool: Write — ai-logs/sprint3/sgstrick/2026-11-18_claude-code_issue-162.md (this file)
