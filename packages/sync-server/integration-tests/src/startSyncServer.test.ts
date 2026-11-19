import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { startSyncServer } from './startSyncServer';

// sync-server reads its config once per module graph, so this file starts a
// single server and checks everything against it
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

      // A second server in the same module graph would share the first's
      // config, so it's refused
      await expect(startSyncServer()).rejects.toThrow(/already called/);
    } finally {
      await server.shutdown();
    }

    expect(existsSync(server.dataDir)).toBe(false);
    await expect(fetch(`${server.url}/health`)).rejects.toThrow();

    // Calling shutdown again is a no-op rather than an error
    await expect(server.shutdown()).resolves.toBeUndefined();
    expect(existsSync(server.dataDir)).toBe(false);
  });
});
