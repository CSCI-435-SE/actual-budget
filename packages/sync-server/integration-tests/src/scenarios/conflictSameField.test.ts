import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertInSync } from '../assertInSync';
import type { Device } from '../createDevice';
import { findReceived, makeChange, sync } from '../deviceHelpers';
import type { SyncResult } from '../deviceHelpers';
import { setUpTwoDevices } from '../setUpTwoDevices';
import type { TwoDevices } from '../setUpTwoDevices';

type Account = { id: string; name: string };

// How loot-core picks the winner when two devices edit the same field
// (packages/loot-core/src/server/sync/index.ts):
//
// - Each edit is a CRDT message for one cell (dataset, row, column) with a
//   hybrid logical clock timestamp. `Timestamp.toString()` is
//   `<ISO millis>-<4-hex counter>-<16-hex node id>`, so comparing the strings
//   orders by wall time, then counter, then node id.
// - When a device receives messages, `_applyMessages` passes them to
//   `compareMessages`. For each incoming message it looks up the timestamps
//   already logged in `messages_crdt` for the same cell. If any logged
//   timestamp is later (`logged.some(timestamp => timestamp > timestampStr)`)
//   the incoming message is marked `old: true`. `_applyMessages` still adds
//   an old message to `messages_crdt` and the merkle trie, but skips writing
//   it to the table (`if (!msg.old)`). So the value with the later timestamp
//   stays, whichever order the messages arrive in: last writer wins.
// - Identical timestamps: `compareMessages` treats an incoming message whose
//   timestamp is already logged for that cell (`logged.includes(...)`) as
//   already applied and drops it, without comparing values. Two different
//   devices can't produce the same timestamp, because the node id is part of
//   it. It could only happen if two devices shared a node id (a copied clock),
//   which is why an uploaded budget sets `resetClock` so each download gets
//   its own. Then the first value applied would stay and the devices could
//   disagree, and nothing would catch it: the duplicate-node check in
//   `Timestamp.recv` (packages/crdt) is commented out.
//
// One server and pair of devices for the file (sync-server allows one per
// module graph).
describe('conflicting edits to the same field', () => {
  let setup: TwoDevices;

  beforeAll(async () => {
    setup = await setUpTwoDevices();
  });

  afterAll(async () => {
    await setup?.tearDown();
  });

  async function getName(device: Device, id: string) {
    const accounts = await device.api<Account[]>('getAccounts');
    return accounts.find(account => account.id === id)?.name;
  }

  /** The rename message for `id` with value `name` in a sync result. */
  function findRename(result: SyncResult, id: string, name: string) {
    return findReceived(result, {
      dataset: 'accounts',
      row: id,
      column: 'name',
      value: name,
    });
  }

  it('both devices keep the rename with the later timestamp', async () => {
    const { a, b } = setup;
    const { id } = await makeChange(a, {
      type: 'createAccount',
      name: 'Checking',
    });
    await sync(a);
    await sync(b);
    expect(await getName(b, id)).toBe('Checking');

    // Both rename the account before either syncs
    await makeChange(a, {
      type: 'updateAccount',
      id,
      fields: { name: 'Renamed on A' },
    });
    await makeChange(b, {
      type: 'updateAccount',
      id,
      fields: { name: 'Renamed on B' },
    });
    expect(await getName(a, id)).toBe('Renamed on A');
    expect(await getName(b, id)).toBe('Renamed on B');

    await sync(a); // sends A's rename
    const bResult = await sync(b); // sends B's rename, receives A's
    const aResult = await sync(a); // receives B's

    // The real timestamps of the two renames, as the other device received
    // them. Don't assume B's is later because B renamed second: both can
    // land in the same millisecond, and then the counter and node id decide.
    const renameA = findRename(bResult, id, 'Renamed on A');
    const renameB = findRename(aResult, id, 'Renamed on B');
    expect(renameA.timestamp).not.toBe(renameB.timestamp);
    const winner =
      renameA.timestamp > renameB.timestamp ? renameA.value : renameB.value;

    expect(await getName(a, id)).toBe(winner);
    expect(await getName(b, id)).toBe(winner);
    await assertInSync(a, b);
  });
});
