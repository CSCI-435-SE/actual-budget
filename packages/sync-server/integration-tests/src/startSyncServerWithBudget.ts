import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import {
  createKeyFromPassword,
  encrypt,
  makeKeyTestContent,
} from './encryption';
import type { EncryptionKey } from './encryption';
import { startSyncServer } from './startSyncServer';
import type { SyncServerHandle } from './startSyncServer';
import { zipStored } from './zip';

export type SyncServerWithBudgetHandle = SyncServerHandle & {
  password: string;
  token: string;
  fileId: string;
  groupId: string;
  budgetId: string;
  budgetName: string;
  /** Set when the budget is end-to-end encrypted. */
  encryptionPassword?: string;
  /** The id of the key the budget is encrypted with, if any. */
  encryptKeyId?: string;
};

export type StartSyncServerWithBudgetOptions = {
  /**
   * Encrypts the budget end to end with a key derived from this password,
   * like turning on encryption in the app. Devices then need the same
   * password to download it.
   */
  encryptionPassword?: string;
};

// The empty schema loot-core copies when it creates a new budget. It isn't
// in loot-core's package exports, so it's referenced by its repo path.
const DEFAULT_DB_URL = new URL(
  '../../../loot-core/default-db.sqlite',
  import.meta.url,
);

const PASSWORD = 'integration-test-password';

/**
 * Starts a sync server (see `startSyncServer`), bootstraps its password
 * account, logs in, and uploads a minimal starter budget, the same way
 * the client does when it first uploads a new budget. With
 * `encryptionPassword`, the budget is encrypted end to end.
 */
export async function startSyncServerWithBudget({
  encryptionPassword,
}: StartSyncServerWithBudgetOptions = {}): Promise<SyncServerWithBudgetHandle> {
  const server = await startSyncServer();

  try {
    await postJson(server.url, '/account/bootstrap', { password: PASSWORD });
    const { token } = await postJson<{ token: string }>(
      server.url,
      '/account/login',
      { password: PASSWORD },
    );

    const budgetId = `Sync-Test-${randomUUID().slice(0, 7)}`;
    const budgetName = 'Sync Test Budget';
    const fileId = randomUUID();
    const key =
      encryptionPassword === undefined
        ? undefined
        : createKeyFromPassword(encryptionPassword);
    const groupId = await uploadStarterBudget(server.url, {
      token,
      fileId,
      budgetId,
      budgetName,
      key,
    });

    if (key) {
      // Register the key the way `key-make` does (via `resetSyncState`),
      // so devices can check a password against it (`key-test`) and the
      // server accepts syncs encrypted with it
      await postJson(
        server.url,
        '/sync/user-create-key',
        {
          fileId,
          keyId: key.id,
          keySalt: key.salt,
          testContent: makeKeyTestContent(key),
        },
        token,
      );
    }

    return {
      ...server,
      password: PASSWORD,
      token,
      fileId,
      groupId,
      budgetId,
      budgetName,
      encryptionPassword,
      encryptKeyId: key?.id,
    };
  } catch (error) {
    await server.shutdown();
    throw error;
  }
}

async function uploadStarterBudget(
  baseUrl: string,
  {
    token,
    fileId,
    budgetId,
    budgetName,
    key,
  }: {
    token: string;
    fileId: string;
    budgetId: string;
    budgetName: string;
    key?: EncryptionKey;
  },
): Promise<string> {
  // Same shape as loot-core's `upload()`: a zip of db.sqlite and
  // metadata.json, with `resetClock` so each downloading client gets its
  // own CRDT node id
  const zipped = zipStored({
    'db.sqlite': new Uint8Array(await readFile(DEFAULT_DB_URL)),
    'metadata.json': new TextEncoder().encode(
      JSON.stringify({ id: budgetId, budgetName, resetClock: true }),
    ),
  });

  // Encrypted like `upload()` does when the budget has a key: the whole
  // zip, with the IV, auth tag and key id sent as X-ACTUAL-ENCRYPT-META
  const encrypted = key ? encrypt(key, zipped) : undefined;

  const res = await fetch(`${baseUrl}/sync/upload-user-file`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/encrypted-file',
      'X-ACTUAL-TOKEN': token,
      'X-ACTUAL-FILE-ID': fileId,
      'X-ACTUAL-NAME': encodeURIComponent(budgetName),
      'X-ACTUAL-FORMAT': '2',
      ...(encrypted
        ? { 'X-ACTUAL-ENCRYPT-META': JSON.stringify(encrypted.meta) }
        : {}),
    },
    body: encrypted ? new Uint8Array(encrypted.value) : zipped,
  });
  const body = await readJson<{ status: string; groupId?: string }>(res);
  if (body.status !== 'ok' || !body.groupId) {
    throw new Error(`Budget upload failed: ${JSON.stringify(body)}`);
  }
  return body.groupId;
}

async function postJson<T = unknown>(
  baseUrl: string,
  path: string,
  payload: unknown,
  token?: string,
): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'X-ACTUAL-TOKEN': token } : {}),
    },
    body: JSON.stringify(payload),
  });
  const body = await readJson<{ status: string; data: T }>(res);
  if (body.status !== 'ok') {
    throw new Error(`POST ${path} failed: ${JSON.stringify(body)}`);
  }
  return body.data;
}

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Expected JSON from ${res.url} (${res.status}): ${text}`);
  }
}
