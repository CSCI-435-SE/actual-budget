import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertInSync } from '../assertInSync';
import type { Device, DeviceRequestError } from '../createDevice';
import { downloadBudget, makeChange, resetSync, sync } from '../deviceHelpers';
import type { DeviceSnapshot } from '../deviceProtocol';
import { setUpTwoDevices } from '../setUpTwoDevices';
import type { TwoDevices } from '../setUpTwoDevices';

type Account = { id: string; name: string };

// What a sync reset does to another device
// ----------------------------------------
// `resetSync` on A (loot-core src/server/sync/reset.ts) asks the server to
// drop the file's group (`/reset-user-file` deletes `group-<id>.sqlite`),
// clears A's CRDT log and clock, and uploads A's budget, for which the
// server creates a new group id.
//
// B still has the old group id in its prefs. Its next sync is refused by
// the SERVER, before any messages are read or returned:
// `validateSyncedFile` (packages/sync-server/src/app-sync/validation.js)
// returns `file-has-reset` when the request's group id isn't the file's
// current one. The client turns that 400 into `PostError('file-has-reset')`
// (`throwIfNot200` in post.ts), and `fullSync` reports it as a sync error.
// The old group's messages are gone from the server anyway.
//
// The client-side groupId guard in `_fullSync`
// (packages/loot-core/src/server/sync/index.ts:934-938):
//
//   if (!prefs.getPrefs() || prefs.getPrefs().groupId !== groupId) {
//     return [];
//   }
//
// covers a different case: the device's OWN group id changing while its
// sync request is in flight (it reset, or closed the file, mid-sync). It
// compares the group id read at the start of `_fullSync` with the current
// prefs and drops the server's response without applying it. In this
// scenario B's group id never changes, so B never reaches that guard; it's
// stopped by the server first. Exercising the guard would need a sync
// request held open while the same device resets, which these tests don't
// do.
//
// The reset happens once, in `beforeAll`, so the two cases don't depend on
// each other: the first only checks B's failed sync (which changes
// nothing), the second has B download the budget again.
describe('sync reset on another device', () => {
  let setup: TwoDevices;
  let oldGroupId: string;
  let newGroupId: string;
  let sharedId: string; // created and synced to both before the reset
  let unseenId: string; // synced by A to the old group, never received by B

  beforeAll(async () => {
    setup = await setUpTwoDevices();
    const { a, b, server } = setup;
    oldGroupId = server.groupId;

    ({ id: sharedId } = await makeChange(a, {
      type: 'createAccount',
      name: 'Before reset',
    }));
    await sync(a);
    await sync(b);

    ({ id: unseenId } = await makeChange(a, {
      type: 'createAccount',
      name: 'Synced by A, not by B',
    }));
    await sync(a);

    newGroupId = await resetSync(a);
  });

  afterAll(async () => {
    await setup?.tearDown();
  });

  async function accountIds(device: Device) {
    const accounts = await device.api<Account[]>('getAccounts');
    return accounts.map(account => account.id);
  }

  async function messageCount(device: Device) {
    const snapshot = await device.request<DeviceSnapshot>({
      type: 'snapshot',
      tables: [],
    });
    return snapshot.messageCount;
  }

  it('B is refused with file-has-reset and applies nothing', async () => {
    const { a, b } = setup;
    expect(newGroupId).not.toBe(oldGroupId);
    expect((await a.getPrefs()).groupId).toBe(newGroupId);
    expect((await b.getPrefs()).groupId).toBe(oldGroupId);

    const accountsBefore = await accountIds(b);
    const messagesBefore = await messageCount(b);
    expect(accountsBefore).toContain(sharedId);
    expect(accountsBefore).not.toContain(unseenId);

    const error: DeviceRequestError = await sync(b).then(
      () => {
        throw new Error('Expected B to fail to sync against the old group');
      },
      (e: DeviceRequestError) => e,
    );
    expect(error.reason).toBe('file-has-reset');

    // Nothing from the old group (or the new one) was applied
    expect(await accountIds(b)).toEqual(accountsBefore);
    expect(await messageCount(b)).toBe(messagesBefore);
    expect((await b.getPrefs()).groupId).toBe(oldGroupId);

    // assertInSync refuses to compare devices in different groups
    await expect(assertInSync(a, b)).rejects.toThrow(
      /different sync groups[\s\S]*B: /,
    );
  });

  it('B downloads the budget again and is back in sync', async () => {
    const { a, b } = setup;

    await downloadBudget(b, newGroupId);
    expect((await b.getPrefs()).groupId).toBe(newGroupId);
    // The download is A's reset copy, which includes the account B never
    // received through sync
    expect(await accountIds(b)).toEqual(
      expect.arrayContaining([sharedId, unseenId]),
    );

    // And normal sync works in the new group, both ways
    const { id: afterReset } = await makeChange(b, {
      type: 'createAccount',
      name: 'After reset, on B',
    });
    await sync(b);
    await sync(a);
    expect(await accountIds(a)).toContain(afterReset);

    await assertInSync(a, b);
  });
});
