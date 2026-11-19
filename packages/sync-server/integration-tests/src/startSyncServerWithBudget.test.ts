import { describe, expect, it } from 'vitest';

import { startSyncServerWithBudget } from './startSyncServerWithBudget';

describe('startSyncServerWithBudget', () => {
  it('creates an account, a token, and an uploaded budget', async () => {
    const server = await startSyncServerWithBudget();

    try {
      const { url, token, fileId, groupId } = server;
      // The token is a credential, so only its length is logged
      console.log('sync server setup', {
        url,
        tokenLength: token.length,
        fileId,
        groupId,
      });

      for (const field of [
        'password',
        'token',
        'fileId',
        'groupId',
        'budgetId',
        'budgetName',
      ] as const) {
        expect(server[field], field).toEqual(expect.any(String));
        expect(server[field], field).not.toBe('');
      }

      // The server knows the file under that group, for that token
      const res = await fetch(`${url}/sync/get-user-file-info`, {
        headers: { 'X-ACTUAL-TOKEN': token, 'X-ACTUAL-FILE-ID': fileId },
      });
      const info = await res.json();
      expect(info).toMatchObject({
        status: 'ok',
        data: { fileId, groupId, name: server.budgetName, deleted: 0 },
      });
    } finally {
      await server.shutdown();
    }
  });
});
