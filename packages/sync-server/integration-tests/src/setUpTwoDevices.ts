import { createDevice } from './createDevice';
import type { Device } from './createDevice';
import { startSyncServerWithBudget } from './startSyncServerWithBudget';
import type { SyncServerWithBudgetHandle } from './startSyncServerWithBudget';

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
 */
export async function setUpTwoDevices(): Promise<TwoDevices> {
  const server = await startSyncServerWithBudget();
  const devices: Device[] = [];

  async function tearDown() {
    await Promise.all(devices.map(device => device.close()));
    await server.shutdown();
  }

  try {
    const { url, token, fileId, groupId } = server;
    devices.push(
      await createDevice(url, token, fileId, groupId, { name: 'A' }),
    );
    devices.push(
      await createDevice(url, token, fileId, groupId, { name: 'B' }),
    );
  } catch (error) {
    await tearDown();
    throw error;
  }

  const [a, b] = devices;
  return { server, a, b, tearDown };
}
