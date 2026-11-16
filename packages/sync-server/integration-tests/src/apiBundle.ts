// The parts of the built `@actual-app/api` that device workers use.
//
// sync-server doesn't depend on `@actual-app/api`, and adding the
// dependency would change yarn.lock, so devices load the built bundle by
// its path in the repo and these types describe the calls they make. If
// the API changes one of these signatures, update it here.
//
// Types only: deviceWorker.ts is loaded by Node
// directly and imports it with `import type`.

/** A row of a synced table, keyed by column name. */
type Row = Record<string, unknown>;

export type ApiSyncMessage = {
  timestamp: unknown;
  dataset: string;
  row: string;
  column: string;
  value: unknown;
};

export type ApiSyncResult =
  | { error: { reason: string; message?: string } }
  | { messages: ApiSyncMessage[] };

export type ApiPrefs = {
  id: string;
  cloudFileId?: string;
  groupId?: string;
};

/** What `init` returns: loot-core's handler bridge and its database. */
export type ApiLib = {
  send(name: 'load-prefs'): Promise<ApiPrefs>;
  send(name: 'sync'): Promise<ApiSyncResult>;
  send(name: string, args?: unknown): Promise<unknown>;
  db: {
    all<T extends object = Row>(sql: string, params?: unknown[]): Promise<T[]>;
    first<T extends object = Row>(
      sql: string,
      params?: unknown[],
    ): Promise<T | null>;
  };
};

export type ApiModule = {
  init(config: {
    dataDir: string;
    serverURL: string;
    sessionToken: string;
  }): Promise<ApiLib>;
  downloadBudget(syncId: string): Promise<void>;
  createAccount(
    account: { name: string; offbudget: boolean },
    initialBalance: number,
  ): Promise<string>;
  updateAccount(
    id: string,
    fields: { name?: string; offbudget?: boolean; closed?: boolean },
  ): Promise<void>;
  deleteAccount(id: string): Promise<void>;
  shutdown(): Promise<void>;
};
