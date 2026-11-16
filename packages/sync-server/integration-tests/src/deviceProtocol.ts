// Messages between `createDevice` (test thread) and `deviceWorker` (one
// worker thread per device).

export type DeviceInit = {
  serverUrl: string;
  token: string;
  fileId: string;
  groupId: string;
  dataDir: string;
};

/** A change `makeChange` applies to a device's local database. */
export type Change =
  | { type: 'createAccount'; name: string; offBudget?: boolean }
  | {
      type: 'updateAccount';
      id: string;
      fields: { name?: string; offbudget?: boolean; closed?: boolean };
    }
  | { type: 'deleteAccount'; id: string };

export type ChangeResult = { id: string };

/** A message as stored in the CRDT log, made safe to post between threads. */
export type SyncedMessage = {
  timestamp: string;
  dataset: string;
  row: string;
  column: string;
  value: unknown;
};

export type SyncResult = {
  /** Messages this device received from the server. */
  received: SyncedMessage[];
};

export type TableRow = Record<string, unknown> & { id: string };

/** A device's synced data, as `assertInSync` compares it. */
export type DeviceSnapshot = {
  /** Root hash of the device's merkle trie (0 when it has no messages). */
  merkleHash: number;
  messageCount: number;
  /** Every row of each requested table, keyed by table name. */
  tables: Record<string, TableRow[]>;
};

export type DeviceOp =
  | { type: 'init'; config: DeviceInit }
  // A public `@actual-app/api` method, e.g. `getAccounts`
  | { type: 'api'; method: string; args: unknown[] }
  // An internal loot-core handler, e.g. `load-prefs`
  | { type: 'send'; name: string; args?: unknown }
  // The CRDT node id from this device's clock
  | { type: 'clientId' }
  | { type: 'makeChange'; change: Change }
  | { type: 'sync' }
  | { type: 'setOnline'; online: boolean }
  // URLs of non-loopback requests the device attempted (and was refused)
  | { type: 'blockedRequests' }
  // Tables this device holds CRDT messages for
  | { type: 'syncedTables' }
  | { type: 'snapshot'; tables: string[] }
  | { type: 'shutdown' };

export type DeviceRequest = { id: number; op: DeviceOp };

export type DeviceError = {
  message: string;
  stack?: string;
  /** loot-core's error reason or code, e.g. `network-failure` */
  reason?: string;
};

export type DeviceResponse =
  | { id: number; ok: true; value: unknown }
  | { id: number; ok: false; error: DeviceError };
