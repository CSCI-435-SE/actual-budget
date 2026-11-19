// Where the built `@actual-app/api` lives, a check that it's usable, and
// the parts of it that device workers use.
//
// sync-server doesn't depend on `@actual-app/api`, and adding the
// dependency would change yarn.lock, so devices load the built bundle by
// its path in the repo and these types describe the calls they make. If
// the API changes one of these signatures, update it here.
//
// deviceWorker.ts is loaded by Node directly and can only `import type`
// from this file, so `createDevice` passes it `API_BUNDLE_URL` instead.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const API_BUNDLE_URL = new URL(
  '../../../api/dist/index.js',
  import.meta.url,
);

let bundleChecked: Promise<void> | null = null;

/**
 * Throws a clear error if the API bundle is missing or isn't the bundled
 * build. `yarn typecheck` overwrites it with a plain compile of
 * `packages/api/index.ts` that imports loot-core's TypeScript source,
 * which a device can't load; without this check every device would fail
 * with "Cannot find module" instead. Only a successful check is cached.
 */
export function assertApiBundleBuilt(): Promise<void> {
  bundleChecked ??= checkApiBundle().catch(error => {
    bundleChecked = null;
    throw error;
  });
  return bundleChecked;
}

async function checkApiBundle(): Promise<void> {
  const path = fileURLToPath(API_BUNDLE_URL);
  const code = await readFile(path, 'utf8').catch(() => null);
  if (code === null || code.includes('@actual-app/core/')) {
    throw new Error(
      `${path} is ${code === null ? 'missing' : 'not the bundled build'}. ` +
        'Run `yarn build:api` from the repo root, then run the tests again. ' +
        '(`yarn typecheck` overwrites the bundle; `yarn test` rebuilds it automatically.)',
    );
  }
}

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

/**
 * What `init` returns: loot-core's handler bridge and its database.
 * `send` is a plain function (it doesn't use `this`), so it's safe to pass
 * around on its own.
 */
export type ApiLib = {
  send(this: void, name: 'load-prefs'): Promise<ApiPrefs>;
  send(this: void, name: 'sync'): Promise<ApiSyncResult>;
  send(this: void, name: string, args?: unknown): Promise<unknown>;
  db: {
    all<T extends object = Row>(sql: string, params?: unknown[]): Promise<T[]>;
    first<T extends object = Row>(
      sql: string,
      params?: unknown[],
    ): Promise<T | null>;
  };
};

/** The transaction fields devices set; the API accepts more. */
export type ApiTransactionFields = {
  date: string;
  amount?: number;
  notes?: string;
};

export type ApiModule = {
  init(config: {
    dataDir: string;
    serverURL: string;
    sessionToken: string;
  }): Promise<ApiLib>;
  downloadBudget(
    syncId: string,
    options?: { password?: string },
  ): Promise<void>;
  createAccount(
    account: { name: string; offbudget: boolean },
    initialBalance: number,
  ): Promise<string>;
  updateAccount(
    id: string,
    fields: { name?: string; offbudget?: boolean; closed?: boolean },
  ): Promise<void>;
  deleteAccount(id: string): Promise<void>;
  /** Doesn't return the new ids (loot-core generates them) */
  addTransactions(
    accountId: string,
    transactions: ApiTransactionFields[],
    options?: { learnCategories?: boolean; runTransfers?: boolean },
  ): Promise<'ok'>;
  getTransactions(
    accountId: string,
    startDate: string,
    endDate: string,
  ): Promise<Array<{ id: string } & Row>>;
  updateTransaction(
    id: string,
    fields: Partial<ApiTransactionFields>,
  ): Promise<unknown>;
  deleteTransaction(id: string): Promise<unknown>;
  shutdown(): Promise<void>;
};
