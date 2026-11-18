import type { Device } from './createDevice';
import type { Change, ChangeResult, SyncResult } from './deviceProtocol';

export type {
  Change,
  ChangeResult,
  SyncedMessage,
  SyncResult,
} from './deviceProtocol';

/**
 * Applies `change` to the device's local database. Nothing is sent to the
 * server until `sync(device)` runs: test devices don't sync automatically.
 */
export function makeChange(
  device: Device,
  change: Change,
): Promise<ChangeResult> {
  return device.request({ type: 'makeChange', change });
}

/**
 * Runs one full sync cycle (send local changes, receive and apply remote
 * ones, repeat until the device and server agree). Throws on failure; the
 * error's `reason` is loot-core's, e.g. `network-failure` when offline.
 */
export function sync(device: Device): Promise<SyncResult> {
  return device.request({ type: 'sync' });
}

/** Makes every request from the device fail as if it had no connection. */
export async function goOffline(device: Device): Promise<void> {
  await device.request({ type: 'setOnline', online: false });
}

/** Lets the device reach the server again. */
export async function goOnline(device: Device): Promise<void> {
  await device.request({ type: 'setOnline', online: true });
}
