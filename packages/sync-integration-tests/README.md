# Sync integration tests

End-to-end tests for Actual's sync. Each test runs the **real sync server** and
two or more **real clients** ("devices"), and checks that the devices converge.

- The server is the real `sync-server` app, started in the test process on a
  free port, with its own temporary data directories.
- Each device is a full loot-core client (through `@actual-app/api`) in its own
  worker thread, with its own database, clock and prefs.
- Devices talk to the server over loopback HTTP only, and sync only when a test
  tells them to.

Use this package to write sync scenarios: concurrent edits, offline catch-up,
and so on. The unit tests in `packages/loot-core/src/server/sync/` (which use
`mockSyncServer.ts`) and `packages/sync-server/src/app-sync.test.ts` are
unchanged; this package adds coverage across both.

## Running the tests

From the repo root:

```bash
# As part of the whole suite. Builds @actual-app/api first (cached).
yarn test

# Just this package. Needs a current API build; see the note below.
yarn build:api
yarn workspace @actual-app/sync-integration-tests run test
```

Devices run on the **bundled** `@actual-app/api` build in `packages/api/dist`.
`yarn test` builds it (or restores it from lage's cache) before these tests.
When you run this package directly, build it yourself after changing loot-core
or the API, and after any `yarn typecheck`: typecheck overwrites
`packages/api/dist/index.js` with an unbundled compile. If the bundle is
missing or overwritten, the tests stop right away and tell you to run
`yarn build:api`.

Requirements: Node 23.6 or newer (the device worker is a TypeScript file that
Node loads directly; the repo's `.nvmrc` pins a version that works).

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
  the initial budget download reach the server.
- **Only loopback is reachable.** A device that tries any other host gets a
  network error, and the attempt is recorded
  (`device.request({ type: 'blockedRequests' })`).
- **Prefer the helpers to `device.api(...)` for changes.** `device.api` calls
  any `@actual-app/api` method and is fine for reading (`getAccounts`), but
  `makeChange` is where change types are defined for every scenario to share.

## Helper reference

| Helper                                                       | File                           | What it does                                                                                                                                                                 |
| ------------------------------------------------------------ | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `setUpTwoDevices()`                                          | `setUpTwoDevices.ts`           | Server with an uploaded budget, plus devices `a` and `b`. Returns `{ server, a, b, tearDown }`.                                                                              |
| `startSyncServerWithBudget()`                                | `startSyncServerWithBudget.ts` | Server, owner account, login token and uploaded starter budget. Returns `{ url, token, fileId, groupId, password, budgetId, budgetName, serverFiles, userFiles, shutdown }`. |
| `startSyncServer()`                                          | `startSyncServer.ts`           | Just the server, with temporary `serverFiles`/`userFiles` and migrations run. Returns `{ url, port, serverFiles, userFiles, shutdown }`.                                     |
| `createDevice(serverUrl, token, fileId, groupId, { name? })` | `createDevice.ts`              | A client in its own worker thread and data directory, signed in and with the budget downloaded. Use it for three or more devices.                                            |
| `makeChange(device, change)`                                 | `deviceHelpers.ts`             | Applies a change to that device's database only. Returns `{ id }`.                                                                                                           |
| `sync(device)`                                               | `deviceHelpers.ts`             | Runs one full sync (send, receive, repeat until device and server agree). Returns `{ received }`; throws on failure with loot-core's `reason`, e.g. `network-failure`.       |
| `goOffline(device)` / `goOnline(device)`                     | `deviceHelpers.ts`             | While offline, every request from the device fails like a dropped connection. Changes still work locally.                                                                    |
| `assertInSync(...devices)`                                   | `assertInSync.ts`              | Throws `OutOfSyncError` listing merkle hashes and the tables, rows and columns that differ.                                                                                  |
| `countServerMessages(server, groupId)`                       | `serverMessages.ts`            | How many sync messages the server has stored. Useful to check whether a change reached it.                                                                                   |

A `Device` also has `api(method, ...args)` and `send(handler, args)` (any
API method or internal loot-core handler), `getPrefs()`/`savePrefs()`,
`getClientId()` (its CRDT node id), `connection` and `close()`.

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

`makeChange` currently supports `createAccount`, `updateAccount` and
`deleteAccount`. To add one (say, a transaction):

1. Add a variant to `Change` in [`src/deviceProtocol.ts`](src/deviceProtocol.ts).
2. Handle it in `makeChange` in [`src/deviceWorker.ts`](src/deviceWorker.ts),
   using the `api` methods, and return `{ id }`.

Keep values plain data (strings, numbers, booleans, arrays, objects): changes
and results are posted between threads.

## How it works

These answer the open questions from the issue that introduced this package.

- **Why worker threads?** loot-core keeps its clock, database, prefs and sync
  state in module-level variables, so two clients in one module graph would
  share them. Each device runs in its own worker thread (its own module
  graph), which isolates them by construction.
- **Why `@actual-app/api`?** It already connects a loot-core client to a server
  (`init` with a session token, `downloadBudget`). Its bundled build runs in a
  plain worker thread, which loot-core's TypeScript source can't. No loot-core
  changes were needed.
- **Starting the server without building it.** Vitest compiles sync-server from
  source, including its `?raw` SQL imports and migration loading, so no
  sync-server build and no `--experimental-vm-modules` flag are needed. The
  only change to sync-server is that `src/app.ts` exports its Express `app`,
  so tests can listen on port 0 and close the server afterwards.
- **Why a separate workspace?** It depends on both the client
  (`@actual-app/api`) and the server (`@actual-app/sync-server`), and neither
  of those should depend on the other.
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
- **A test times out while starting up**: startup is slow (several seconds per
  server, plus loot-core per device). Timeouts are 60s and at most two files
  run at once; see `vitest.config.ts`. A test that times out during startup
  can leave a temporary directory behind.
- **`[cause]: TypeError: fetch failed: automatic sync is disabled on test devices`**
  in the output is expected: it's loot-core logging an automatic sync that
  the device blocked.
- **`Cannot read properties of undefined (reading 'config')` from Vitest in
  every file**: an intermittent Vitest failure seen in several packages in
  this repo, not specific to these tests. Rerun.
