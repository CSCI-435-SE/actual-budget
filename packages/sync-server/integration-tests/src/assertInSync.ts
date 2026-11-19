import { isDeepStrictEqual } from 'node:util';

import {
  create,
  fromBinary,
  SyncRequestSchema,
  SyncResponseSchema,
  toBinary,
} from '@actual-app/crdt';

import type { Device, DeviceConnection } from './createDevice';
import type { DeviceSnapshot, TableRow } from './deviceProtocol';

// How many differing rows to print per table before summarizing the rest
const MAX_ROWS_PER_TABLE = 10;

// Sorts after every real timestamp, so the server sends no messages back
const FAR_FUTURE_SINCE = '9999-12-31T23:59:59.999Z-0000-0000000000000000';

export class OutOfSyncError extends Error {
  override name = 'OutOfSyncError';
}

/**
 * Checks that every device holds the same synced data and the same set of
 * sync messages as the server. Compares:
 *
 * - each device's merkle root hash with the server's, and
 * - every row of every table any device has sync messages for.
 *
 * Throws an `OutOfSyncError` listing the hashes and the specific tables,
 * rows and columns that differ. Call it after syncing; it doesn't sync.
 */
export async function assertInSync(...devices: Device[]): Promise<void> {
  if (devices.length < 1) {
    throw new Error('assertInSync needs at least one device');
  }
  const connection = await currentConnection(devices);

  const tableLists = await Promise.all(
    devices.map(device => device.request<string[]>({ type: 'syncedTables' })),
  );
  const tables = [...new Set(tableLists.flat())].sort();

  const [serverHash, snapshots] = await Promise.all([
    fetchServerMerkleHash(connection),
    Promise.all(
      devices.map(device =>
        device.request<DeviceSnapshot>({ type: 'snapshot', tables }),
      ),
    ),
  ]);

  const problems = [
    ...compareHashes(devices, snapshots, serverHash),
    ...tables.flatMap(table => compareTable(table, devices, snapshots)),
  ];

  if (problems.length > 0) {
    const names = devices.map(device => device.name).join(', ');
    throw new OutOfSyncError(
      [
        `Devices ${names} are out of sync (group ${connection.groupId}):`,
        '',
        ...problems,
      ].join('\n'),
    );
  }
}

/** Where the devices sync now, and the key their messages are encrypted with. */
type SyncTarget = DeviceConnection & { keyId?: string };

/**
 * The server and budget the devices sync with now. The group id comes from
 * each device's prefs rather than `device.connection`, because a sync reset
 * moves the budget to a new group after the device was created. The
 * encryption key id comes from the prefs too: the server refuses a sync
 * request for an encrypted file without it (`file-has-new-key`).
 */
async function currentConnection(devices: Device[]): Promise<SyncTarget> {
  const [first] = devices;
  const mismatched = devices.find(
    device =>
      device.connection.serverUrl !== first.connection.serverUrl ||
      device.connection.fileId !== first.connection.fileId,
  );
  if (mismatched) {
    throw new Error(
      `assertInSync: ${mismatched.name} syncs a different server or budget than ${first.name}`,
    );
  }

  const prefs = await Promise.all(devices.map(device => device.getPrefs()));
  const groupIds = prefs.map(p => p.groupId);
  if (groupIds.some(groupId => groupId !== groupIds[0])) {
    throw new OutOfSyncError(
      [
        'Devices are in different sync groups (one may need to download the budget again after a sync reset):',
        ...devices.map((device, i) => `  ${device.name}: ${groupIds[i]}`),
      ].join('\n'),
    );
  }
  if (typeof groupIds[0] !== 'string') {
    throw new Error(`assertInSync: ${first.name} has no sync group id`);
  }

  const keyIds = prefs.map(p => p.encryptKeyId ?? undefined);
  if (keyIds.some(keyId => keyId !== keyIds[0])) {
    throw new OutOfSyncError(
      [
        'Devices use different encryption keys:',
        ...devices.map((device, i) => `  ${device.name}: ${keyIds[i]}`),
      ].join('\n'),
    );
  }
  const keyId = typeof keyIds[0] === 'string' ? keyIds[0] : undefined;

  return { ...first.connection, groupId: groupIds[0], keyId };
}

/** Asks the server for its merkle via an empty sync request. */
async function fetchServerMerkleHash({
  serverUrl,
  token,
  fileId,
  groupId,
  keyId,
}: SyncTarget): Promise<number> {
  const request = create(SyncRequestSchema, {
    fileId,
    groupId,
    // Sent like a device does (loot-core's sync encoder), or the server
    // rejects requests for an encrypted file
    keyId,
    since: FAR_FUTURE_SINCE,
    messages: [],
  });
  const res = await fetch(`${serverUrl}/sync/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/actual-sync',
      'X-ACTUAL-TOKEN': token,
    },
    body: toBinary(SyncRequestSchema, request),
  });
  if (!res.ok) {
    throw new Error(
      `assertInSync: server sync request failed (${res.status}): ${await res.text()}`,
    );
  }
  const response = fromBinary(
    SyncResponseSchema,
    new Uint8Array(await res.arrayBuffer()),
  );
  return JSON.parse(response.merkle).hash ?? 0;
}

function compareHashes(
  devices: Device[],
  snapshots: DeviceSnapshot[],
  serverHash: number,
): string[] {
  const allMatch = snapshots.every(s => s.merkleHash === serverHash);
  if (allMatch) {
    return [];
  }
  return [
    'Merkle hashes (each device should match the server):',
    `  server: ${serverHash}`,
    ...devices.map((device, i) => {
      const { merkleHash, messageCount } = snapshots[i];
      const mark = merkleHash === serverHash ? '' : '   <-- differs';
      return `  ${device.name}: ${merkleHash} (${messageCount} messages)${mark}`;
    }),
    '',
  ];
}

function compareTable(
  table: string,
  devices: Device[],
  snapshots: DeviceSnapshot[],
): string[] {
  const rowsByDevice = snapshots.map(
    snapshot =>
      new Map((snapshot.tables[table] ?? []).map(row => [row.id, row])),
  );
  const ids = [
    ...new Set(rowsByDevice.flatMap(rows => [...rows.keys()])),
  ].sort();

  const rowProblems: string[][] = [];
  for (const id of ids) {
    const rows = rowsByDevice.map(byId => byId.get(id));
    const problem = describeRowDifference(id, devices, rows);
    if (problem) {
      rowProblems.push(problem);
    }
  }

  if (rowProblems.length === 0) {
    return [];
  }
  const shown = rowProblems.slice(0, MAX_ROWS_PER_TABLE).flat();
  const hidden = rowProblems.length - MAX_ROWS_PER_TABLE;
  return [
    `Table "${table}": ${rowProblems.length} row(s) differ`,
    ...shown,
    ...(hidden > 0 ? [`  ...and ${hidden} more row(s)`] : []),
    '',
  ];
}

function describeRowDifference(
  id: string,
  devices: Device[],
  rows: Array<TableRow | undefined>,
): string[] | null {
  const missingOn = devices.filter((_, i) => rows[i] === undefined);
  if (missingOn.length > 0) {
    const presentOn = devices.filter((_, i) => rows[i] !== undefined);
    return [
      `  row ${id}: only on ${names(presentOn)}, missing on ${names(missingOn)}`,
      ...presentOn.map(
        device =>
          `    ${device.name}: ${format(rows[devices.indexOf(device)])}`,
      ),
    ];
  }

  const columns = [
    ...new Set(rows.flatMap(row => Object.keys(row ?? {}))),
  ].sort();
  const differing = columns.filter(column =>
    rows.some(row => !isDeepStrictEqual(row?.[column], rows[0]?.[column])),
  );
  if (differing.length === 0) {
    return null;
  }
  return [
    `  row ${id}: ${differing.length === 1 ? 'column' : 'columns'} ${differing
      .map(column => `"${column}"`)
      .join(', ')} ${differing.length === 1 ? 'differs' : 'differ'}`,
    ...differing.map(
      column =>
        `    ${column}: ${devices
          .map((device, i) => `${device.name}=${format(rows[i]?.[column])}`)
          .join(', ')}`,
    ),
  ];
}

function names(devices: Device[]): string {
  return devices.map(device => device.name).join(', ');
}

function format(value: unknown): string {
  return JSON.stringify(value) ?? String(value);
}
