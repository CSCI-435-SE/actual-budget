import { createDevice } from './createDevice';
import type { Device } from './createDevice';
import { startSyncServerWithBudget } from './startSyncServerWithBudget';
import type {
  StartSyncServerWithBudgetOptions,
  SyncServerWithBudgetHandle,
} from './startSyncServerWithBudget';

export type TwoDevices = {
  server: SyncServerWithBudgetHandle;
  a: Device;
  b: Device;
  /** Closes both devices, then stops the server. */
  tearDown: () => Promise<void>;
};

/**
 * Starts a sync server with an uploaded budget and downloads it onto two
 * devices, A and B. Like `startSyncServer`, call it once per test file.
 * With `encryptionPassword`, the budget is end-to-end encrypted and both
 * devices open it with that password.
 */
export async function setUpTwoDevices({
  encryptionPassword,
}: StartSyncServerWithBudgetOptions = {}): Promise<TwoDevices> {
  const server = await startSyncServerWithBudget({ encryptionPassword });
  const devices: Device[] = [];

  async function tearDown() {
    // Stop the server even if a device fails to close, then report the
    // first failure
    const results = await Promise.allSettled(
      devices.map(device => device.close()),
    );
    await server.shutdown();
    const failed = results.find(result => result.status === 'rejected');
    if (failed) {
      throw failed.reason;
    }
  }

  try {
    const { url, token, fileId, groupId } = server;
    for (const name of ['A', 'B']) {
      devices.push(
        await createDevice(url, token, fileId, groupId, {
          name,
          encryptionPassword,
        }),
      );
    }
  } catch (error) {
    await tearDown();
    throw error;
  }

  const [a, b] = devices;
  return { server, a, b, tearDown };
}
