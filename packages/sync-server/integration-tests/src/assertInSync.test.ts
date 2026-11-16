import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

import { assertInSync, OutOfSyncError } from './assertInSync';
import { createDevice } from './createDevice';
import type { Device } from './createDevice';
import { makeChange, sync } from './deviceHelpers';
import { startSyncServerWithBudget } from './startSyncServerWithBudget';
import type { SyncServerWithBudgetHandle } from './startSyncServerWithBudget';

// One server for the file and two fresh devices per test
describe('assertInSync', () => {
  let server: SyncServerWithBudgetHandle;
  let a: Device;
  let b: Device;

  beforeAll(async () => {
    server = await startSyncServerWithBudget();
  });

  afterAll(async () => {
    await server?.shutdown();
  });

  beforeEach(async () => {
    const { url, token, fileId, groupId } = server;
    a = await createDevice(url, token, fileId, groupId, { name: 'A' });
    b = await createDevice(url, token, fileId, groupId, { name: 'B' });
  });

  afterEach(async () => {
    await Promise.all([a?.close(), b?.close()]);
  });

  async function syncAll() {
    // A, B, then A again so A also receives anything B sent
    await sync(a);
    await sync(b);
    await sync(a);
  }

  async function outOfSyncMessage(): Promise<string> {
    const error = await assertInSync(a, b).then(
      () => {
        throw new Error('Expected assertInSync to throw');
      },
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(OutOfSyncError);
    const { message } = error as OutOfSyncError;
    // Printed so the failure format is visible in the test output
    console.log(message);
    return message;
  }

  it('passes when every device has synced', async () => {
    await makeChange(a, { type: 'createAccount', name: 'Checking' });
    await syncAll();

    await expect(assertInSync(a, b)).resolves.toBeUndefined();
  });

  it('reports a row that only one device has', async () => {
    const { id } = await makeChange(a, {
      type: 'createAccount',
      name: 'Checking',
    });
    await sync(a); // B never syncs

    const message = await outOfSyncMessage();

    expect(message).toContain('Devices A, B are out of sync');
    // Merkle hashes are signed 32-bit numbers
    expect(message).toMatch(/Merkle hashes[\s\S]*B: -?\d+ .*<-- differs/);
    expect(message).toContain('Table "accounts"');
    expect(message).toContain(`row ${id}: only on A, missing on B`);
    expect(message).toContain('"name":"Checking"');
  });

  it('reports the columns that differ on a stale device', async () => {
    const { id } = await makeChange(a, {
      type: 'createAccount',
      name: 'Checking',
    });
    await syncAll();
    await makeChange(a, {
      type: 'updateAccount',
      id,
      fields: { name: 'Everyday' },
    });
    await sync(a); // B misses the rename

    const message = await outOfSyncMessage();

    expect(message).toContain('Table "accounts"');
    expect(message).toContain(`row ${id}: column "name" differs`);
    expect(message).toContain('name: A="Everyday", B="Checking"');
    expect(message).not.toContain(`row ${id}: only on`);
  });
});
