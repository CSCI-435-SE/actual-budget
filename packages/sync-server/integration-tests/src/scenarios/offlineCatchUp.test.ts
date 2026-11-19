import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertInSync } from '../assertInSync';
import type { Device } from '../createDevice';
import { goOffline, goOnline, makeChange, sync } from '../deviceHelpers';
import { setUpTwoDevices } from '../setUpTwoDevices';
import type { TwoDevices } from '../setUpTwoDevices';

// How close this gets to the server's upload limit
// -------------------------------------------------
// When B comes back online, `_fullSync` (loot-core
// src/server/sync/index.ts) sends every message since its last sync in ONE
// `/sync` request; there's no batching. The server parses that body with
// `express.raw({ limit: '<upload.fileSizeSyncLimitMB>mb' })` (app-sync.ts).
// The default is 20 MB, which the `bytes` parser reads as 20 × 1024² =
// 20,971,520 bytes. Above that the server refuses the request (HTTP 413).
//
// Measured (Windows, Node 24, Nov 2026), creating 500 accounts offline:
// - 3,500 CRDT messages (7 per account: the account's fields plus its
//   transfer payee and payee mapping)
// - one sync request of 445,449 bytes: ~891 bytes per account, ~127 bytes
//   per message, about 2% of the limit
// - ~20 s to create the accounts (~40 ms each); the sync itself took <1 s
//
// So the realistic ceiling for one offline period is roughly 23,500 new
// accounts, or ~165,000 CRDT messages of this size. Changes with larger
// values (long notes, imported payee names) reach it sooner. Hitting it
// with accounts would take about 16 minutes here, so that case is the
// skipped test below.
//
// How many accounts the test creates
// ----------------------------------
// Upload size doesn't depend on batching (there is none), so the count is
// chosen for the receiving side. When A applies B's catch-up, loot-core
// works in chunks of 100: `fetchAll` reads changed rows 100 ids at a time
// per table, and `compareMessages` looks up 100 cells per query (padding
// the last chunk). 150 accounts means 150 rows each in `accounts` and
// `payees` (a full chunk of 100 plus a partial one) and 1,050 messages,
// so every chunked path runs more than once. It's the smallest round count
// that does, and takes ~6 s to create instead of ~20 s for 500. The size
// figures above were measured with 500 and scale linearly.
const ACCOUNT_COUNT = 150;
const SYNC_LIMIT_BYTES = 20 * 1024 * 1024;
const BYTES_PER_ACCOUNT = 891; // measured above
const ACCOUNTS_TO_EXCEED_LIMIT = Math.ceil(
  SYNC_LIMIT_BYTES / BYTES_PER_ACCOUNT,
);

describe('offline catch-up', () => {
  let setup: TwoDevices;

  beforeAll(async () => {
    setup = await setUpTwoDevices();
  });

  afterAll(async () => {
    await setup?.tearDown();
  });

  async function createAccountsOffline(device: Device, count: number) {
    await goOffline(device);
    for (let i = 1; i <= count; i++) {
      await makeChange(device, { type: 'createAccount', name: `Offline ${i}` });
    }
    await goOnline(device);
  }

  function syncRequestBytes(device: Device) {
    return device.request<number[]>({ type: 'syncRequestBytes' });
  }

  it(`syncs ${ACCOUNT_COUNT} accounts created while offline`, async () => {
    const { a, b } = setup;
    await createAccountsOffline(b, ACCOUNT_COUNT);

    // `sync` throws on any sync error, including `out-of-sync`
    const sentBefore = (await syncRequestBytes(b)).length;
    await sync(b);
    await sync(a);

    // Still well under the server's limit (see the comment above). If
    // this fails, messages got much bigger and the ceiling moved.
    const sent = (await syncRequestBytes(b)).slice(sentBefore);
    expect(Math.max(...sent)).toBeLessThan(SYNC_LIMIT_BYTES / 10);

    expect(await a.api<unknown[]>('getAccounts')).toHaveLength(ACCOUNT_COUNT);
    await assertInSync(a, b);
  });

  // SKIPPED: known sync limitation.
  // Bug issue: https://github.com/CSCI-435-SE/actual-budget/issues/186
  //
  // Expected: a device that was offline long enough to collect more changes
  // than the server's `upload.fileSizeSyncLimitMB` (20 MB by default) still
  // catches up when it reconnects, and both devices end up in sync.
  //
  // Why it fails today: `_fullSync` (loot-core src/server/sync/index.ts)
  // sends every message since the last sync in a single `/sync` request.
  // Over the limit, the server refuses that request (HTTP 413 from
  // `express.raw` in app-sync.ts), and every retry sends the same oversized
  // request, so B can never catch up until uploads are split into batches.
  // Not yet confirmed: what error the client reports for the 413.
  //
  // Why it's skipped rather than run as known-failing: reaching 20 MB with
  // accounts takes ~23,500 of them (~16 minutes here). Once batching is
  // fixed, make it fast by exceeding the limit with fewer, larger changes
  // or with a server started with a smaller limit, then unskip it.
  it.skip(`syncs ${ACCOUNTS_TO_EXCEED_LIMIT} accounts created while offline (over the upload limit)`, async () => {
    const { a, b } = setup;
    await createAccountsOffline(b, ACCOUNTS_TO_EXCEED_LIMIT);

    await sync(b);
    await sync(a);

    await assertInSync(a, b);
  });
});
