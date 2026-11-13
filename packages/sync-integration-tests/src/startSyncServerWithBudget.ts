import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { strToU8, zipSync } from 'fflate';

import { startSyncServer } from './startSyncServer';
import type { SyncServerHandle } from './startSyncServer';

export type SyncServerWithBudgetHandle = SyncServerHandle & {
  password: string;
  token: string;
  fileId: string;
  groupId: string;
  budgetId: string;
  budgetName: string;
};

// The empty schema loot-core copies when it creates a new budget. It isn't
// in loot-core's package exports, so it's referenced by its repo path.
const DEFAULT_DB_URL = new URL(
  '../../loot-core/default-db.sqlite',
  import.meta.url,
);

const PASSWORD = 'integration-test-password';

/**
 * Starts a sync server (see `startSyncServer`), bootstraps its password
 * account, logs in, and uploads a minimal starter budget, the same way
 * the client does when it first uploads a new budget.
 */
export async function startSyncServerWithBudget(): Promise<SyncServerWithBudgetHandle> {
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
    const groupId = await uploadStarterBudget(server.url, {
      token,
      fileId,
      budgetId,
      budgetName,
    });

    return {
      ...server,
      password: PASSWORD,
      token,
      fileId,
      groupId,
      budgetId,
      budgetName,
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
  }: { token: string; fileId: string; budgetId: string; budgetName: string },
): Promise<string> {
  // Same shape as loot-core's `upload()`: a zip of db.sqlite and
  // metadata.json, with `resetClock` so each downloading client gets its
  // own CRDT node id
  const zipped = zipSync({
    'db.sqlite': new Uint8Array(await readFile(DEFAULT_DB_URL)),
    'metadata.json': strToU8(
      JSON.stringify({ id: budgetId, budgetName, resetClock: true }),
    ),
  });

  const res = await fetch(`${baseUrl}/sync/upload-user-file`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/encrypted-file',
      'X-ACTUAL-TOKEN': token,
      'X-ACTUAL-FILE-ID': fileId,
      'X-ACTUAL-NAME': encodeURIComponent(budgetName),
      'X-ACTUAL-FORMAT': '2',
    },
    body: zipped,
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
): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
