import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';

import type { DeviceOp, DeviceResponse } from './deviceProtocol';

export type DeviceConnection = {
  serverUrl: string;
  token: string;
  fileId: string;
  groupId: string;
};

export type Device = {
  name: string;
  dataDir: string;
  /** The server and budget this device was created for. */
  connection: DeviceConnection;
  /** Calls a public `@actual-app/api` method, e.g. `getAccounts`. */
  api<T = unknown>(method: string, ...args: unknown[]): Promise<T>;
  /** Calls an internal loot-core handler, e.g. `load-prefs`. */
  send<T = unknown>(name: string, args?: unknown): Promise<T>;
  getPrefs(): Promise<Record<string, unknown>>;
  savePrefs(prefs: Record<string, unknown>): Promise<void>;
  /** The CRDT node id of this device's clock. */
  getClientId(): Promise<string>;
  /**
   * Sends a raw op to the device's worker. Prefer the helpers in
   * `deviceHelpers` (`makeChange`, `sync`, `goOffline`, `goOnline`).
   */
  request<T = unknown>(op: DeviceOp): Promise<T>;
  /** Closes the budget, stops the worker, and deletes the data dir. */
  close(): Promise<void>;
};

/** An error from a device; `reason` is loot-core's, e.g. `network-failure`. */
export type DeviceRequestError = Error & { reason?: string };

let deviceCount = 0;

/**
 * Creates a client with its own loot-core instance (clock, database,
 * prefs, sync state) in its own worker thread and data directory, signs it
 * in with `token`, and downloads the budget `fileId` in `groupId`.
 *
 * Needs a current build of `@actual-app/api` (`yarn build:api`).
 */
export async function createDevice(
  serverUrl: string,
  token: string,
  fileId: string,
  groupId: string,
  { name = `device-${++deviceCount}` }: { name?: string } = {},
): Promise<Device> {
  const dataDir = await mkdtemp(join(tmpdir(), `actual-${name}-`));

  // `execArgv: []` keeps the test runner's Node flags out of the worker.
  // NODE_ENV is not `test`: in test mode loot-core syncs inside every change
  // call and throws when that sync fails, so an offline device couldn't make
  // changes. Automatic syncs are blocked in the worker instead.
  const worker = new Worker(new URL('./deviceWorker.ts', import.meta.url), {
    execArgv: [],
    env: { ...process.env, NODE_ENV: 'production' },
  });

  let nextId = 0;
  const pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();

  function failAll(error: Error) {
    for (const { reject } of pending.values()) {
      reject(error);
    }
    pending.clear();
  }

  worker.on('message', (response: DeviceResponse) => {
    const request = pending.get(response.id);
    if (!request) {
      return;
    }
    pending.delete(response.id);
    if (response.ok) {
      request.resolve(response.value);
    } else {
      const { message, stack, reason } = response.error;
      const error: DeviceRequestError = Object.assign(
        new Error(`[${name}] ${message}`),
        { reason },
      );
      error.stack = stack ?? error.stack;
      request.reject(error);
    }
  });
  worker.on('error', error => failAll(error));
  worker.on('exit', code =>
    failAll(new Error(`[${name}] worker exited with code ${code}`)),
  );

  function call<T>(op: DeviceOp): Promise<T> {
    const id = nextId++;
    return new Promise<T>((resolve, reject) => {
      pending.set(id, {
        resolve: value => resolve(value as T),
        reject,
      });
      worker.postMessage({ id, op });
    });
  }

  let closePromise: Promise<void> | null = null;
  async function close() {
    closePromise ??= (async () => {
      try {
        await call({ type: 'shutdown' });
      } finally {
        await worker.terminate();
        await rm(dataDir, {
          recursive: true,
          force: true,
          maxRetries: 5,
          retryDelay: 100,
        });
      }
    })();
    return closePromise;
  }

  try {
    await call({
      type: 'init',
      config: { serverUrl, token, fileId, groupId, dataDir },
    });
  } catch (error) {
    await worker.terminate();
    await rm(dataDir, { recursive: true, force: true, maxRetries: 5 });
    throw error;
  }

  return {
    name,
    dataDir,
    connection: { serverUrl, token, fileId, groupId },
    api: (method, ...args) => call({ type: 'api', method, args }),
    send: (sendName, args) => call({ type: 'send', name: sendName, args }),
    getPrefs: () => call({ type: 'send', name: 'load-prefs' }),
    savePrefs: async prefs => {
      await call({ type: 'send', name: 'save-prefs', args: prefs });
    },
    getClientId: () => call({ type: 'clientId' }),
    request: call,
    close,
  };
}
