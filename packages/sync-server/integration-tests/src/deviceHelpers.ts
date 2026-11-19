import type { Device } from './createDevice';
import type {
  Change,
  ChangeResult,
  SyncedMessage,
  SyncResult,
} from './deviceProtocol';

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

/**
 * The message in a sync result that set `column` of `row` in `dataset` to
 * `value`, e.g. to read the timestamp of another device's edit. Throws if
 * the device didn't receive it.
 */
export function findReceived(
  result: SyncResult,
  { dataset, row, column, value }: Omit<SyncedMessage, 'timestamp'>,
): SyncedMessage {
  const message = result.received.find(
    m =>
      m.dataset === dataset &&
      m.row === row &&
      m.column === column &&
      m.value === value,
  );
  if (!message) {
    throw new Error(
      `Expected to receive ${dataset}.${column} = ${JSON.stringify(value)} for row ${row}`,
    );
  }
  return message;
}

/** Makes every request from the device fail as if it had no connection. */
export async function goOffline(device: Device): Promise<void> {
  await device.request({ type: 'setOnline', online: false });
}

/** Lets the device reach the server again. */
export async function goOnline(device: Device): Promise<void> {
  await device.request({ type: 'setOnline', online: true });
}

/**
 * Resets sync from this device, like "Reset sync" in the app (loot-core's
 * `sync-reset` handler): it clears the device's CRDT log and clock, and
 * uploads its budget as the new version, which the server puts in a new
 * group. Every other device then has to download the budget again. Returns
 * the new group id. Throws with loot-core's `reason` if the reset fails.
 */
export async function resetSync(device: Device): Promise<string> {
  const result = await device.send<{ error?: { reason: string } }>(
    'sync-reset',
  );
  if (result?.error) {
    throw Object.assign(
      new Error(`[${device.name}] Sync reset failed: ${result.error.reason}`),
      { reason: result.error.reason },
    );
  }
  const { groupId } = await device.getPrefs();
  if (typeof groupId !== 'string') {
    throw new Error(`[${device.name}] No group id after resetting sync`);
  }
  return groupId;
}

/**
 * Downloads the budget in `groupId` onto the device again and opens it,
 * e.g. after another device reset sync. Uses the API's `downloadBudget`,
 * which downloads a fresh copy when the device doesn't have that group.
 * The sync at the end of the download is allowed through.
 */
export async function downloadBudget(
  device: Device,
  groupId: string,
): Promise<void> {
  await device.request({ type: 'downloadBudget', groupId });
}
