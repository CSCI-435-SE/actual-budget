import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertInSync } from '../assertInSync';
import { createDevice } from '../createDevice';
import type { Device, DeviceRequestError } from '../createDevice';
import { findReceived, makeChange, sync } from '../deviceHelpers';
import type { SyncResult } from '../deviceHelpers';
import {
  countEncryptedServerMessages,
  countServerMessages,
} from '../serverMessages';
import { setUpTwoDevices } from '../setUpTwoDevices';
import type { TwoDevices } from '../setUpTwoDevices';

type Account = { id: string; name: string };

const ENCRYPTION_PASSWORD = 'correct horse battery staple';

// The basic sync and same-field conflict scenarios (basicSync.test.ts,
// conflictSameField.test.ts) with end-to-end encryption on: the budget is
// uploaded encrypted, both devices open it with the password, and every
// sync message is encrypted before it reaches the server. loot-core
// decrypts received messages before applying them, so CRDT behaviour
// should be the same as without encryption.
//
// One server and pair of devices for the file (sync-server allows one per
// module graph). Each case uses its own account.
describe('sync with end-to-end encryption', () => {
  let setup: TwoDevices;

  beforeAll(async () => {
    setup = await setUpTwoDevices({ encryptionPassword: ENCRYPTION_PASSWORD });
  });

  afterAll(async () => {
    await setup?.tearDown();
  });

  async function getName(device: Device, id: string) {
    const accounts = await device.api<Account[]>('getAccounts');
    return accounts.find(account => account.id === id)?.name;
  }

  function expectServerOnlyHasCiphertext() {
    const { server } = setup;
    const total = countServerMessages(server, server.groupId);
    expect(total).toBeGreaterThan(0);
    expect(countEncryptedServerMessages(server, server.groupId)).toBe(total);
  }

  it('an account created on A reaches B', async () => {
    const { a, b } = setup;
    const { id } = await makeChange(a, {
      type: 'createAccount',
      name: 'Created on A',
    });
    expect(await getName(b, id)).toBeUndefined();

    await sync(a);
    await sync(b);

    expect(await getName(b, id)).toBe('Created on A');
    expectServerOnlyHasCiphertext();
    await assertInSync(a, b);
  });

  it('an account created on B reaches A', async () => {
    const { a, b } = setup;
    const { id } = await makeChange(b, {
      type: 'createAccount',
      name: 'Created on B',
    });
    expect(await getName(a, id)).toBeUndefined();

    await sync(b);
    await sync(a);

    expect(await getName(a, id)).toBe('Created on B');
    expectServerOnlyHasCiphertext();
    await assertInSync(a, b);
  });

  it('simultaneous renames keep the one with the later timestamp', async () => {
    const { a, b } = setup;
    const { id } = await makeChange(a, {
      type: 'createAccount',
      name: 'Checking',
    });
    await sync(a);
    await sync(b);

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

    await sync(a);
    const bResult = await sync(b); // receives A's rename
    const aResult = await sync(a); // receives B's rename

    // Received messages are already decrypted, so their values are names.
    // The later timestamp wins (see conflictSameField.test.ts for how).
    const rename = (result: SyncResult, name: string) =>
      findReceived(result, {
        dataset: 'accounts',
        row: id,
        column: 'name',
        value: name,
      });
    const renameA = rename(bResult, 'Renamed on A');
    const renameB = rename(aResult, 'Renamed on B');
    const winner =
      renameA.timestamp > renameB.timestamp ? renameA.value : renameB.value;

    expect(await getName(a, id)).toBe(winner);
    expect(await getName(b, id)).toBe(winner);
    expectServerOnlyHasCiphertext();
    await assertInSync(a, b);
  });

  it('a third device with the wrong password gets a decrypt error', async () => {
    const { a, b, server } = setup;
    const { url, token, fileId, groupId } = server;

    const error: DeviceRequestError = await createDevice(
      url,
      token,
      fileId,
      groupId,
      { name: 'C', encryptionPassword: 'wrong password' },
    ).then(
      async opened => {
        await opened.close();
        throw new Error('Expected the wrong password to be rejected');
      },
      (e: DeviceRequestError) => e,
    );
    // Rejected with a decrypt error: no budget is opened, so there's no
    // device holding wrongly decrypted data
    expect(error.reason).toBe('decrypt-failure');

    // And the failed attempt didn't disturb the devices that have the key
    await assertInSync(a, b);
  });
});
