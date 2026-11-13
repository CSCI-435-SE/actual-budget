import { describe, expect, it } from 'vitest';

import { startSyncServerWithBudget } from './startSyncServerWithBudget';

describe('startSyncServerWithBudget', () => {
  it('creates an account, a token, and an uploaded budget', async () => {
    const server = await startSyncServerWithBudget();

    try {
      const { url, token, fileId, groupId } = server;
      console.log('sync server setup', { url, token, fileId, groupId });

      expect(token).toEqual(expect.any(String));
      expect(token).not.toBe('');
      expect(fileId).not.toBe('');
      expect(groupId).not.toBe('');

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
