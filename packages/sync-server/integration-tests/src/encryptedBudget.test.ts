import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDevice } from './createDevice';
import type { Device, DeviceRequestError } from './createDevice';
import { makeChange, sync } from './deviceHelpers';
import {
  countEncryptedServerMessages,
  countServerMessages,
} from './serverMessages';
import { startSyncServerWithBudget } from './startSyncServerWithBudget';
import type { SyncServerWithBudgetHandle } from './startSyncServerWithBudget';

const ENCRYPTION_PASSWORD = 'correct horse battery staple';

// One encrypted server for the file (sync-server allows one per module
// graph) and a fresh device per test
describe('end-to-end encrypted budget', () => {
  let server: SyncServerWithBudgetHandle;
  let device: Device | undefined;

  beforeAll(async () => {
    server = await startSyncServerWithBudget({
      encryptionPassword: ENCRYPTION_PASSWORD,
    });
  });

  afterAll(async () => {
    await device?.close();
    await server?.shutdown();
  });

  function connect(encryptionPassword: string) {
    const { url, token, fileId, groupId } = server;
    return createDevice(url, token, fileId, groupId, { encryptionPassword });
  }

  it('the server only holds ciphertext', async () => {
    expect(server.encryptKeyId).toEqual(expect.any(String));
    // A plain zip starts with "PK"; the uploaded budget must not
    const blob = await readFile(
      join(server.userFiles, `file-${server.fileId}.blob`),
    );
    expect(blob.subarray(0, 2).toString('latin1')).not.toBe('PK');
  });

  it('a device with the correct password reads the budget', async () => {
    device = await connect(ENCRYPTION_PASSWORD);

    // budgetName comes from metadata.json inside the encrypted zip, so the
    // device could only know it by decrypting the download
    const prefs = await device.getPrefs();
    expect(prefs).toMatchObject({
      budgetName: server.budgetName,
      encryptKeyId: server.encryptKeyId,
      groupId: server.groupId,
    });
    expect(await device.api('getAccounts')).toEqual([]);

    // It also syncs, and what it sends is encrypted with the same key
    await makeChange(device, { type: 'createAccount', name: 'Checking' });
    await sync(device);
    const total = countServerMessages(server, server.groupId);
    expect(total).toBeGreaterThan(0);
    expect(countEncryptedServerMessages(server, server.groupId)).toBe(total);

    await device.close();
    device = undefined;
  });

  it('a device with the wrong password gets a decrypt error', async () => {
    // createDevice rejects instead of opening a budget it couldn't decrypt.
    // The API checks the password against the key's test message
    // (`key-test`) before downloading anything.
    const error: DeviceRequestError = await connect('wrong password').then(
      opened => {
        device = opened;
        throw new Error('Expected the wrong password to be rejected');
      },
      (e: DeviceRequestError) => e,
    );
    expect(error.reason).toBe('decrypt-failure');
  });
});
