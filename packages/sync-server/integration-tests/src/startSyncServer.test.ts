import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { startSyncServer } from './startSyncServer';

describe('startSyncServer', () => {
  it('serves the health endpoint and cleans up on shutdown', async () => {
    const server = await startSyncServer();

    try {
      // Migrations ran against the temporary directories
      expect(existsSync(join(server.serverFiles, 'account.sqlite'))).toBe(true);
      expect(existsSync(server.userFiles)).toBe(true);

      const res = await fetch(`${server.url}/health`);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ status: 'UP' });
    } finally {
      await server.shutdown();
    }

    expect(existsSync(server.serverFiles)).toBe(false);
    expect(existsSync(server.userFiles)).toBe(false);
    await expect(fetch(`${server.url}/health`)).rejects.toThrow();
  });
});
