// Runs inside a worker thread: one loot-core client per worker. loot-core
// keeps its clock, database, prefs and sync state in module-level
// variables, so a separate thread (and module graph) per device is what
// keeps devices from sharing state.
//
// This file is loaded by Node directly (type stripping), not by Vitest, so
// it must only use erasable TypeScript syntax and type-only local imports.
import { parentPort, workerData } from 'node:worker_threads';

import type { ApiLib, ApiModule, ApiSyncMessage } from './apiBundle';
import type {
  Change,
  ChangeResult,
  DeviceError,
  DeviceInit,
  DeviceOp,
  DeviceRequest,
  DeviceResponse,
  DeviceSnapshot,
  SyncedMessage,
  SyncResult,
  TableRow,
} from './deviceProtocol';

// --- Network gate -------------------------------------------------------
//
// loot-core's API build captures `globalThis.fetch` when it loads, so the
// gate has to be installed before `@actual-app/api` is imported.
//
// - Offline: every request fails like a dropped connection, which loot-core
//   reports as `network-failure`.
// - Online: requests go through, except sync requests that don't come from
//   an explicit `sync` op. loot-core normally starts a sync after every
//   local change; blocking those keeps `makeChange` local and makes `sync`
//   the only way data reaches the server, so tests stay deterministic.
// - Always: only loopback hosts are reachable. Anything else is refused and
//   recorded, so tests can assert the device never touched a real network.
const realFetch = globalThis.fetch;
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);
const blockedRequests: string[] = [];
let isOnline = true;
let explicitSyncsRunning = 0;
let blockedAutoSyncs = 0;
// Sizes of the sync requests that went through, so tests can see how close
// an upload gets to the server's `upload.fileSizeSyncLimitMB`
const syncRequestBytes: number[] = [];

globalThis.fetch = (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (!LOOPBACK_HOSTS.has(url.hostname)) {
    blockedRequests.push(url.href);
    return Promise.reject(
      new TypeError(`fetch failed: test devices only reach loopback hosts`),
    );
  }
  if (!isOnline) {
    return Promise.reject(new TypeError('fetch failed: device is offline'));
  }
  if (isSyncRequest(input)) {
    if (explicitSyncsRunning === 0) {
      blockedAutoSyncs++;
      return Promise.reject(
        new TypeError(
          'fetch failed: automatic sync is disabled on test devices',
        ),
      );
    }
    const body = init?.body;
    if (ArrayBuffer.isView(body) || body instanceof ArrayBuffer) {
      syncRequestBytes.push(body.byteLength);
    }
  }
  return realFetch(input, init);
};

function isSyncRequest(input: Parameters<typeof fetch>[0]): boolean {
  const url = input instanceof Request ? input.url : String(input);
  return new URL(url).pathname.endsWith('/sync/sync');
}

// The built API, loaded by path because sync-server doesn't depend on
// `@actual-app/api`. `createDevice` checks the bundle and passes its URL
// (see apiBundle.ts).
const apiBundleUrl: unknown = Reflect.get(Object(workerData), 'apiBundleUrl');
if (typeof apiBundleUrl !== 'string') {
  throw new Error('deviceWorker needs workerData.apiBundleUrl');
}
const api: ApiModule = await import(apiBundleUrl);

// --- Message handling ---------------------------------------------------

if (!parentPort) {
  throw new Error('deviceWorker must run in a worker thread');
}
const port = parentPort;

let lib: ApiLib | null = null;
// Kept from `init` so a later `downloadBudget` op can decrypt the budget too
let budgetPassword: string | undefined = undefined;

port.on('message', async ({ id, op }: DeviceRequest) => {
  let response: DeviceResponse;
  try {
    response = { id, ok: true, value: await handle(op) };
  } catch (error) {
    response = { id, ok: false, error: toDeviceError(error) };
  }
  port.postMessage(response);
});

async function handle(op: DeviceOp): Promise<unknown> {
  switch (op.type) {
    case 'init':
      return init(op.config);
    case 'api': {
      const method = Reflect.get(api, op.method);
      if (typeof method !== 'function') {
        throw new Error(`Unknown @actual-app/api method: ${op.method}`);
      }
      return Reflect.apply(method, api, op.args);
    }
    case 'send':
      return Reflect.apply(requireLib().send, null, [op.name, op.args]);
    case 'clientId':
      return getClientId();
    case 'makeChange':
      return makeChange(op.change);
    case 'sync':
      return runSync();
    case 'downloadBudget':
      // Like `init`, the download ends with a sync, so let it through
      await allowingSync(() =>
        api.downloadBudget(op.groupId, { password: budgetPassword }),
      );
      return null;
    case 'setOnline':
      isOnline = op.online;
      return null;
    case 'blockedRequests':
      return [...blockedRequests];
    case 'blockedAutoSyncs':
      return blockedAutoSyncs;
    case 'syncRequestBytes':
      return [...syncRequestBytes];
    case 'syncedTables':
      return getSyncedTables();
    case 'snapshot':
      return getSnapshot(op.tables);
    case 'shutdown':
      await api.shutdown();
      lib = null;
      return null;
    default:
      throw new Error(`Unknown device op: ${JSON.stringify(op)}`);
  }
}

async function init({
  serverUrl,
  token,
  fileId,
  groupId,
  dataDir,
  encryptionPassword,
}: DeviceInit) {
  budgetPassword = encryptionPassword;
  lib = await api.init({ dataDir, serverURL: serverUrl, sessionToken: token });
  // The sync id the API asks for is the server's group id. Downloading
  // ends with a sync to catch up on changes made since the upload, so let
  // that one through the gate. For an encrypted budget, the API first
  // checks the password against the server's key (`key-test`) and fails
  // with `decrypt-failure` if it's wrong.
  await allowingSync(() =>
    api.downloadBudget(groupId, { password: encryptionPassword }),
  );

  const prefs = await lib.send('load-prefs');
  if (prefs.cloudFileId !== fileId || prefs.groupId !== groupId) {
    throw new Error(
      `Downloaded the wrong budget: expected file ${fileId} in group ${groupId}, ` +
        `got file ${prefs.cloudFileId} in group ${prefs.groupId}`,
    );
  }
  return { budgetId: prefs.id };
}

async function makeChange(change: Change): Promise<ChangeResult> {
  switch (change.type) {
    case 'createAccount': {
      const id = await api.createAccount(
        { name: change.name, offbudget: change.offBudget ?? false },
        0,
      );
      return { id };
    }
    case 'updateAccount':
      await api.updateAccount(change.id, change.fields);
      return { id: change.id };
    case 'deleteAccount':
      await api.deleteAccount(change.id);
      return { id: change.id };
    case 'createTransaction':
      return createTransaction(change);
    case 'updateTransaction':
      await api.updateTransaction(change.id, change.fields);
      return { id: change.id };
    case 'deleteTransaction':
      await api.deleteTransaction(change.id);
      return { id: change.id };
    default:
      throw new Error(`Unknown change: ${JSON.stringify(change)}`);
  }
}

// `addTransactions` generates the id and doesn't return it, so compare the
// account's transactions before and after to find the new one
async function createTransaction({
  accountId,
  date,
  amount,
  notes,
}: Extract<Change, { type: 'createTransaction' }>): Promise<ChangeResult> {
  const listIds = async () =>
    (await api.getTransactions(accountId, '1900-01-01', '9999-12-31')).map(
      transaction => transaction.id,
    );

  const before = new Set(await listIds());
  await api.addTransactions(accountId, [{ date, amount, notes }]);
  const added = (await listIds()).filter(id => !before.has(id));
  if (added.length !== 1) {
    throw new Error(
      `Expected one new transaction in account ${accountId}, found ${added.length}`,
    );
  }
  return { id: added[0] };
}

async function allowingSync<T>(fn: () => Promise<T>): Promise<T> {
  explicitSyncsRunning++;
  try {
    return await fn();
  } finally {
    explicitSyncsRunning--;
  }
}

function runSync(): Promise<SyncResult> {
  return allowingSync(async () => {
    const { send } = requireLib();
    let result = await send('sync');
    // loot-core runs one full sync at a time and hands concurrent callers
    // the in-flight result, so this call may have joined an automatic
    // attempt that the gate had already blocked. Retry once if so.
    if (
      'error' in result &&
      result.error.reason === 'network-failure' &&
      isOnline
    ) {
      result = await send('sync');
    }
    if ('error' in result) {
      const { reason, message } = result.error;
      throw Object.assign(new Error(`Sync failed: ${message || reason}`), {
        reason,
      });
    }
    return { received: result.messages.map(toSyncedMessage) };
  });
}

function toSyncedMessage(message: ApiSyncMessage): SyncedMessage {
  const { timestamp, dataset, row, column, value } = message;
  return { timestamp: String(timestamp), dataset, row, column, value };
}

// Datasets that aren't real tables: `prefs` lives in metadata.json and
// `spreadsheet_cells` is a derived cache loot-core ignores when syncing
const NON_TABLE_DATASETS = new Set(['prefs', 'spreadsheet_cells']);

async function getSyncedTables(): Promise<string[]> {
  const rows = await requireLib().db.all<{ dataset: string }>(
    'SELECT DISTINCT dataset FROM messages_crdt',
  );
  return rows
    .map(row => row.dataset)
    .filter(dataset => !NON_TABLE_DATASETS.has(dataset));
}

async function getSnapshot(tableNames: string[]): Promise<DeviceSnapshot> {
  const { db } = requireLib();
  const clockRow = await db.first<{ clock: string }>(
    'SELECT clock FROM messages_clock WHERE id = 1',
  );
  const merkleHash = clockRow
    ? (JSON.parse(clockRow.clock).merkle?.hash ?? 0)
    : 0;
  const countRow = await db.first<{ count: number }>(
    'SELECT count(*) AS count FROM messages_crdt',
  );

  const tables: Record<string, TableRow[]> = {};
  for (const table of tableNames) {
    // Table names come from the CRDT log; quote them like loot-core does
    const quoted = `"${table.replaceAll('"', '""')}"`;
    tables[table] = await db.all<TableRow>(
      `SELECT * FROM ${quoted} ORDER BY id`,
    );
  }

  return { merkleHash, messageCount: countRow?.count ?? 0, tables };
}

async function getClientId(): Promise<string> {
  const row = await requireLib().db.first<{ clock: string }>(
    'SELECT clock FROM messages_clock WHERE id = 1',
  );
  if (!row) {
    throw new Error('This device has no clock yet');
  }
  // A serialized timestamp ends in the 16-hex-digit node id
  const { timestamp } = JSON.parse(row.clock);
  return String(timestamp).split('-').pop() ?? '';
}

function requireLib(): ApiLib {
  if (!lib) {
    throw new Error('Device is not initialized');
  }
  return lib;
}

function toDeviceError(error: unknown): DeviceError {
  if (!(error instanceof Error)) {
    return { message: String(error) };
  }
  // loot-core uses `reason` on its own errors and `code` on API errors
  const reason = Reflect.get(error, 'reason') ?? Reflect.get(error, 'code');
  return {
    message: error.message,
    stack: error.stack,
    reason: typeof reason === 'string' ? reason : undefined,
  };
}
