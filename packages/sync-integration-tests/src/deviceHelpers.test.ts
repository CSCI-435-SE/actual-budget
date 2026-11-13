import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import { createDevice } from './createDevice';
import type { Device, DeviceRequestError } from './createDevice';
import { goOffline, goOnline, makeChange, sync } from './deviceHelpers';
import { countServerMessages } from './serverMessages';
import { startSyncServerWithBudget } from './startSyncServerWithBudget';
import type { SyncServerWithBudgetHandle } from './startSyncServerWithBudget';

type Account = { id: string; name: string; offbudget: boolean };

// loot-core normally starts a sync 1s after a local change
const PAST_AUTO_SYNC_DELAY_MS = 1500;

// One server for the file (sync-server allows one per module graph) and a
// fresh device per test. Each test only uses a single device.
describe('device helpers', () => {
  let server: SyncServerWithBudgetHandle;
  let device: Device;

  beforeAll(async () => {
    server = await startSyncServerWithBudget();
  });

  afterAll(async () => {
    await server?.shutdown();
  });

  beforeEach(async () => {
    const { url, token, fileId, groupId } = server;
    device = await createDevice(url, token, fileId, groupId);
  });

  afterEach(async () => {
    await device?.close();
  });

  function serverMessageCount() {
    return countServerMessages(server, server.groupId);
  }

  async function getAccounts() {
    return device.api<Account[]>('getAccounts');
  }

  it('makeChange applies changes to the local database only', async () => {
    const before = serverMessageCount();

    const { id } = await makeChange(device, {
      type: 'createAccount',
      name: 'Checking',
    });
    expect(await getAccounts()).toMatchObject([{ id, name: 'Checking' }]);

    await makeChange(device, {
      type: 'updateAccount',
      id,
      fields: { name: 'Everyday' },
    });
    expect(await getAccounts()).toMatchObject([{ id, name: 'Everyday' }]);

    await makeChange(device, { type: 'deleteAccount', id });
    expect(await getAccounts()).toEqual([]);

    // Nothing reached the server, even after loot-core's usual auto-sync delay
    await new Promise(resolve => setTimeout(resolve, PAST_AUTO_SYNC_DELAY_MS));
    expect(serverMessageCount()).toBe(before);
  });

  it('sync sends local changes to the server and returns the result', async () => {
    const before = serverMessageCount();
    await makeChange(device, { type: 'createAccount', name: 'Savings' });

    const result = await sync(device);

    expect(result.received).toEqual(expect.any(Array));
    const afterFirstSync = serverMessageCount();
    expect(afterFirstSync).toBeGreaterThan(before);

    // A second sync with nothing new succeeds and stores nothing more
    await expect(sync(device)).resolves.toEqual({
      received: expect.any(Array),
    });
    expect(serverMessageCount()).toBe(afterFirstSync);
  });

  it('goOffline makes sync fail but keeps local changes working', async () => {
    const before = serverMessageCount();
    await goOffline(device);

    const { id } = await makeChange(device, {
      type: 'createAccount',
      name: 'Cash',
    });
    expect(await getAccounts()).toContainEqual(
      expect.objectContaining({ id, name: 'Cash' }),
    );

    const error: DeviceRequestError = await sync(device).then(
      () => {
        throw new Error('Expected sync to fail while offline');
      },
      (e: DeviceRequestError) => e,
    );
    expect(error.reason).toBe('network-failure');
    expect(serverMessageCount()).toBe(before);
  });

  it('goOnline lets changes made offline reach the server', async () => {
    await goOffline(device);
    await makeChange(device, { type: 'createAccount', name: 'Travel' });
    const before = serverMessageCount();

    await goOnline(device);
    await sync(device);

    expect(serverMessageCount()).toBeGreaterThan(before);
  });
});
