# Sync integration tests

End-to-end tests for Actual's sync. Each test runs the **real sync server** and
two or more **real clients** ("devices"), and checks that the devices converge.

- The server is the real `sync-server` app, started in the test process on a
  free port, with its own temporary data directories.
- Each device is a full loot-core client (through `@actual-app/api`) in its own
  worker thread, with its own database, clock and prefs.
- Devices talk to the server over loopback HTTP only, and sync only when a test
  tells them to.

Use these tests to write sync scenarios: concurrent edits, offline catch-up,
and so on. They live in `packages/sync-server/integration-tests/` and run as
part of sync-server's `test` script, after its unit tests. The unit tests in
`packages/loot-core/src/server/sync/` (which use `mockSyncServer.ts`) and
`packages/sync-server/src/` are unchanged; these add coverage across both.

## Running the tests

From the repo root:

```bash
# As part of the whole suite. Builds @actual-app/api first (cached).
yarn test

# Just the integration tests. Needs a current API build; see the note below.
yarn build:api
yarn workspace @actual-app/sync-server run test:integration
```

Devices run on the **bundled** `@actual-app/api` build in `packages/api/dist`.
`yarn test` builds it (or restores it from lage's cache) before these tests.
When you run the integration tests directly, build it yourself after changing loot-core
or the API, and after any `yarn typecheck`: typecheck overwrites
`packages/api/dist/index.js` with an unbundled compile. If the bundle is
missing or overwritten, the tests stop right away and tell you to run
`yarn build:api`.

Requirements: Node 23.6 or newer (the device worker is a TypeScript file that
Node loads directly; the repo's `.nvmrc` pins a version that works).

The suite takes about 50–60 seconds. Most of that is startup: each test file
starts its own server (about 3 seconds) and devices. It has been run on
Windows and in a Linux container (Node 24.18.1, 4 CPUs, like CI's
`ubuntu-latest`); not yet on GitHub CI itself.

## Scenarios and status

The sync scenarios live in [`src/scenarios/`](src/scenarios/). Each one ends
with `assertInSync`.

| #   | Scenario                                                                                               | File                                                                                 | Status                           |
| --- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | -------------------------------- |
| 1   | Basic sync both ways: a change on A reaches B, and a change on B reaches A                             | [`basicSync.test.ts`](src/scenarios/basicSync.test.ts)                               | 2 passing                        |
| 2   | Edits at the same time: A and B rename the same account; the later CRDT timestamp wins on both         | [`conflictSameField.test.ts`](src/scenarios/conflictSameField.test.ts)               | 1 passing                        |
| 3   | Different records at the same time: each device creates and deletes its own account, then transaction  | [`conflictDifferentRecords.test.ts`](src/scenarios/conflictDifferentRecords.test.ts) | 2 passing                        |
| 4   | Offline catch-up: B creates 150 accounts (1,050 changes) offline, then syncs                           | [`offlineCatchUp.test.ts`](src/scenarios/offlineCatchUp.test.ts)                     | 1 passing, 1 skipped (see below) |
| 5   | Sync reset: A resets; B's sync is refused with `file-has-reset` and applies nothing; B downloads again | [`syncReset.test.ts`](src/scenarios/syncReset.test.ts)                               | 2 passing                        |
| 6   | Encryption: scenarios 1 and 2 with end-to-end encryption, plus a device with the wrong password        | [`encryption.test.ts`](src/scenarios/encryption.test.ts)                             | 4 passing                        |

There are no known-failing tests. The one skipped test is a known sync
limitation, not a test problem:

- **Offline catch-up over the upload limit** (scenario 4). A device that
  collected more than `upload.fileSizeSyncLimitMB` (20 MB by default) of
  changes offline can never catch up: loot-core sends them all in one
  `/sync` request, and the server refuses it. It needs upload batching,
  tracked in
  [#186](https://github.com/CSCI-435-SE/actual-budget/issues/186). It's skipped
  rather than left failing because reaching 20 MB takes about 16 minutes.

Supporting tests outside `scenarios/` cover the helpers themselves, including
[`encryptedBudget.test.ts`](src/encryptedBudget.test.ts) (an encrypted server
and a single device) and
[`transactions.sync.test.ts`](src/transactions.sync.test.ts).

## Open questions

These came up while writing the scenarios and still need a decision.

- **Upload size ceiling.** Measured with 500 accounts: about 891 bytes per
  account (7 changes, about 127 bytes each), so the 20 MB default fits about
  23,500 new accounts, or 165,000 changes, in one offline period. Larger
  values (long notes, imported payee names) reach it sooner. Still open:
  - what the client actually reports when the server answers 413 (not
    checked);
  - how to test past the limit quickly once batching exists: fewer, larger
    changes, or a server started with a smaller limit;
  - whether 150 accounts is enough. That is the smallest count that makes
    loot-core apply the batch in more than one chunk of 100, but the issue
    asked for "hundreds" of changes; 200 adds about 2 seconds.
- **How encryption keys are derived.** The test server encrypts the starter
  budget with its own copy of loot-core's scheme
  ([`src/encryption.ts`](src/encryption.ts): PBKDF2-SHA512 with 10,000
  iterations, AES-256-GCM), because the budget is uploaded before any device
  exists. If loot-core changes its scheme, that copy has to change too, and
  devices will fail with `decrypt-failure` until it does. The alternative is
  to upload an unencrypted budget and have device A turn encryption on
  through loot-core's own `key-make` handler, which tests the real
  enable-encryption path but adds a sync reset to every encrypted setup.
  Other devices get the key the way the app does: the password is passed to
  `downloadBudget`.
- **Documenting sync-reset behavior.** The tests pin down what happens to
  another device after a reset (its sync is refused with `file-has-reset`,
  nothing is applied, and it has to download the budget again), but this
  isn't written up for users or contributors yet. Also untested:
  - what happens to changes B made but never synced before A reset (a fresh
    download replaces B's budget, so they're presumably lost);
  - the client-side `groupId` guard in `_fullSync`
    (`packages/loot-core/src/server/sync/index.ts`), which drops a server
    response if the device's own group changed while the request was in
    flight. No scenario reaches it; testing it needs a sync held open while
    the same device resets. This isn't needed for scenario 5: another
    device's stale sync is refused by the server (`file-has-reset`) before
    the guard could matter, and the team accepted that as meeting the
    issue's reset criterion. It would be a follow-up test, not a gap in
    scenario 5.
- **Two devices with the same CRDT node id.** If two devices ever shared a
  node id (a copied clock), they could produce identical timestamps for
  different values, and `compareMessages` would keep whichever arrived first,
  so the devices could disagree. The duplicate-node check in
  `Timestamp.recv` (`packages/crdt/src/crdt/timestamp.ts`) is commented out,
  so nothing would catch it. Budgets are uploaded with `resetClock` to avoid
  this; whether it can still happen hasn't been checked.

## Writing a scenario

This is [`src/exampleScenario.test.ts`](src/exampleScenario.test.ts), which
runs with the rest of the suite:

```ts
import { afterEach, describe, expect, it } from 'vitest';

import { assertInSync } from './assertInSync';
import { goOffline, goOnline, makeChange, sync } from './deviceHelpers';
import { setUpTwoDevices } from './setUpTwoDevices';
import type { TwoDevices } from './setUpTwoDevices';

describe('offline edits', () => {
  let setup: TwoDevices | undefined;

  afterEach(async () => {
    await setup?.tearDown();
    setup = undefined;
  });

  it('merges changes made while one device was offline', async () => {
    setup = await setUpTwoDevices();
    const { a, b } = setup;

    await goOffline(b);
    await makeChange(a, { type: 'createAccount', name: 'Checking' });
    await sync(a);
    await makeChange(b, { type: 'createAccount', name: 'Savings' });

    await goOnline(b);
    await sync(b); // sends Savings, receives Checking
    await sync(a); // receives Savings

    await assertInSync(a, b);
    const names = (await b.api<{ name: string }[]>('getAccounts')).map(
      account => account.name,
    );
    expect(names.sort()).toEqual(['Checking', 'Savings']);
  });
});
```

The pattern:

1. **Set up** with `setUpTwoDevices()`, and always tear down in `afterEach`
   (or `finally`), so the server and temporary files are cleaned up when a
   test fails.
2. **Change** devices with `makeChange`. Changes stay on that device.
3. **Sync** explicitly. Devices never sync on their own, so you decide the
   order. To fully converge, sync every device, then sync again any device
   that hasn't received the others' latest changes. With two devices,
   "A, B, A" always converges.
4. **Check** with `assertInSync(...devices)`, plus any specific `expect`s.

### Rules to know

- **One server per test file.** sync-server reads its config once, when its
  modules are first imported, so `startSyncServer()` can only run once per
  file. Several tests in a file can share one server (start it in
  `beforeAll`) and create fresh devices per test, as
  [`deviceHelpers.test.ts`](src/deviceHelpers.test.ts) does. Shared-server
  tests see each other's synced data, so don't assert exact totals across
  tests.
- **Nothing syncs implicitly.** loot-core normally starts a sync about a
  second after each change; test devices block that. Only `sync(device)` and
  the initial budget download reach the server. The device counts the
  automatic syncs it blocked (`device.request({ type: 'blockedAutoSyncs' })`),
  so a test can wait for one instead of sleeping.
- **Only loopback is reachable.** A device that tries any other host gets a
  network error, and the attempt is recorded
  (`device.request({ type: 'blockedRequests' })`).
- **Prefer the helpers to `device.api(...)` for changes.** `device.api` calls
  any `@actual-app/api` method and is fine for reading (`getAccounts`), but
  `makeChange` is where change types are defined for every scenario to share.

## Helper reference

| Helper                                                                            | File                           | What it does                                                                                                                                                                                                                    |
| --------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Helper                                                                            | File                           | What it does                                                                                                                                                                                                                    |
| ---                                                                               | ---                            | ---                                                                                                                                                                                                                             |
| `setUpTwoDevices({ encryptionPassword? })`                                        | `setUpTwoDevices.ts`           | Server with an uploaded budget, plus devices `a` and `b`. With a password, the budget is end-to-end encrypted and both devices use it. Returns `{ server, a, b, tearDown }`.                                                    |
| `startSyncServerWithBudget({ encryptionPassword? })`                              | `startSyncServerWithBudget.ts` | Server, owner account, login token and uploaded starter budget, optionally encrypted. Returns the `startSyncServer` handle plus `{ token, fileId, groupId, password, budgetId, budgetName, encryptionPassword, encryptKeyId }`. |
| `startSyncServer()`                                                               | `startSyncServer.ts`           | Just the server, with temporary `serverFiles`/`userFiles` and migrations run. Returns `{ url, port, dataDir, serverFiles, userFiles, shutdown }`.                                                                               |
| `createDevice(serverUrl, token, fileId, groupId, { name?, encryptionPassword? })` | `createDevice.ts`              | A client in its own worker thread and data directory, signed in and with the budget downloaded. Use it for three or more devices. A wrong password rejects with `reason: 'decrypt-failure'`.                                    |
| `makeChange(device, change)`                                                      | `deviceHelpers.ts`             | Applies a change to that device's database only. Returns `{ id }`.                                                                                                                                                              |
| `sync(device)`                                                                    | `deviceHelpers.ts`             | Runs one full sync (send, receive, repeat until device and server agree). Returns `{ received }`; throws on failure with loot-core's `reason`, e.g. `network-failure`.                                                          |
| `goOffline(device)` / `goOnline(device)`                                          | `deviceHelpers.ts`             | While offline, every request from the device fails like a dropped connection. Changes still work locally.                                                                                                                       |
| `resetSync(device)`                                                               | `deviceHelpers.ts`             | Resets sync from that device, like "Reset sync" in the app. Returns the new group id.                                                                                                                                           |
| `downloadBudget(device, groupId)`                                                 | `deviceHelpers.ts`             | Downloads the budget again (e.g. after another device reset sync) and opens it.                                                                                                                                                 |
| `findReceived(result, { dataset, row, column, value })`                           | `deviceHelpers.ts`             | The message in a `sync` result that set that cell, e.g. to read its timestamp.                                                                                                                                                  |
| `assertInSync(...devices)`                                                        | `assertInSync.ts`              | Throws `OutOfSyncError` listing merkle hashes and the tables, rows and columns that differ, or that the devices are in different sync groups or use different keys.                                                             |
| `countServerMessages(server, groupId)` / `countEncryptedServerMessages(...)`      | `serverMessages.ts`            | How many sync messages (or encrypted ones) the server has stored. Useful to check whether a change reached it.                                                                                                                  |

A `Device` also has `api(method, ...args)` and `send(handler, args)` (any
API method or internal loot-core handler), `getPrefs()`/`savePrefs()`,
`getClientId()` (its CRDT node id), `connection` and `close()`. Its
`connection.groupId` is the group at creation; after a sync reset, the
current one is in its prefs. `device.request({ type: 'syncRequestBytes' })`
returns the size of each sync request it sent.

### What `assertInSync` compares

- Each device's **merkle root hash** against the server's. Equal hashes mean
  the same set of sync messages.
- Every row of every table that **any device has sync messages for**, matched
  by `id` and compared column by column (deleted rows included, via
  `tombstone`). Tables that are per device by design, such as caches, aren't
  compared, so they can't cause false failures.

It doesn't sync anything itself; call it after syncing. A failure looks like:

```text
Devices A, B are out of sync (group f545151c-…):

Merkle hashes (each device should match the server):
  server: 2083451566
  A: 2083451566 (14 messages)
  B: -1929899909 (7 messages)   <-- differs

Table "accounts": 1 row(s) differ
  row 9a54c33b-…: column "name" differs
    name: A="Everyday", B="Checking"
```

## Adding a change type

`makeChange` currently supports `createAccount`, `updateAccount`,
`deleteAccount`, `createTransaction`, `updateTransaction` and
`deleteTransaction`. To add one (say, a category):

1. Add a variant to `Change` in [`src/deviceProtocol.ts`](src/deviceProtocol.ts).
2. Handle it in `makeChange` in [`src/deviceWorker.ts`](src/deviceWorker.ts),
   using the `api` methods, and return `{ id }`. If you call an API method
   the devices haven't used before, add its signature to `ApiModule` in
   [`src/apiBundle.ts`](src/apiBundle.ts).

Keep values plain data (strings, numbers, booleans, arrays, objects): changes
and results are posted between threads.

## How it works

These answer the open questions from the issue that introduced these tests.

- **Why worker threads?** loot-core keeps its clock, database, prefs and sync
  state in module-level variables, so two clients in one module graph would
  share them. Each device runs in its own worker thread (its own module
  graph), which isolates them by construction.
- **Why `@actual-app/api`?** It already connects a loot-core client to a server
  (`init` with a session token, `downloadBudget`). Its bundled build runs in a
  plain worker thread, which loot-core's TypeScript source can't. No loot-core
  changes were needed.
- **Why the API is loaded by path.** sync-server doesn't depend on
  `@actual-app/api`, and adding that dependency (or a separate workspace for
  these tests) would change `yarn.lock`. So the device worker imports
  `packages/api/dist/index.js` by its repo path. `src/apiBundle.ts` holds that
  path, checks that the bundle is there and bundled before any worker loads
  it, and types the methods the worker calls. lage still builds the API before sync-server's tests.
  For the same reason, the starter budget is zipped by a small writer in
  `src/zip.ts` instead of a zip library.
- **Starting the server without building it.** Vitest compiles sync-server from
  source, including its `?raw` SQL imports and migration loading, so no
  sync-server build and no `--experimental-vm-modules` flag are needed. The
  changes to sync-server itself are that `src/app.ts` exports its Express
  `app` (plus a `#app` subpath import for it), so tests can listen on port 0
  and close the server afterwards.
- **How devices are controlled.** The worker wraps `fetch` before loading the
  API, which is how it blocks automatic syncs, simulates going offline, and
  refuses non-loopback hosts. Workers run with `NODE_ENV=production`, because
  in test mode loot-core syncs inside every change and throws if that fails.
- **Cleanup.** `shutdown()` and `close()` stop the server and workers, close
  their databases and delete their directories. `vitest.globalSetup.ts` also
  removes the temporary folders Vitest itself leaves behind on Windows.

## Troubleshooting

- **"…packages/api/dist/index.js is not the bundled build"**: run
  `yarn build:api`, then rerun. See [Running the tests](#running-the-tests).
- **Every test file fails with "Cannot read properties of undefined (reading
  'config')" (Windows)**: your shell's working directory has a lowercase
  drive letter (`c:\…`), which VS Code terminals often start with. Vitest
  (5.0 through at least 5.1.1) then loads two copies of its own runner and
  every test file fails before it runs. It affects every Vitest suite in the
  repo, not just these. `cd` to the repo with an upper-case drive letter
  (`cd C:\path\to\actual`) and run again.
- **A test times out while starting up**: startup is slow (several seconds per
  server, plus loot-core per device). Timeouts are 60s and at most two files
  run at once; see `integration-tests/vitest.config.ts`. A test that times out during startup
  can leave a temporary directory behind.
- **`[cause]: TypeError: fetch failed: automatic sync is disabled on test devices`**
  in the output is expected: it's loot-core logging an automatic sync that
  the device blocked.
- **`Error: Unsupported state or unable to authenticate data`** in the output
  is expected too: it's loot-core logging the failed decryption in the
  wrong-password tests.
