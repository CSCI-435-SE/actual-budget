import { existsSync } from 'node:fs';
import { dirname } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { assertInSync } from './assertInSync';
import { createDevice } from './createDevice';
import type { Device } from './createDevice';
import { makeChange, sync } from './deviceHelpers';
import { startSyncServerWithBudget } from './startSyncServerWithBudget';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

// End to end: a real sync server in this process and two devices, each a
// real loot-core client in its own worker thread, talking over loopback.
describe('sync smoke test', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('syncs a change made on device A to device B', async () => {
    // Records every request made from this thread (the test and the
    // in-process server) while still sending it
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const server = await startSyncServerWithBudget();
    const createdPaths = [dirname(server.serverFiles)];
    let a: Device | undefined;
    let b: Device | undefined;

    try {
      const { url, token, fileId, groupId } = server;
      a = await createDevice(url, token, fileId, groupId, { name: 'A' });
      createdPaths.push(a.dataDir);
      b = await createDevice(url, token, fileId, groupId, { name: 'B' });
      createdPaths.push(b.dataDir);

      const { id } = await makeChange(a, {
        type: 'createAccount',
        name: 'Checking',
      });
      await sync(a);
      await sync(b);

      await assertInSync(a, b);
      expect(await b.api('getAccounts')).toMatchObject([
        { id, name: 'Checking' },
      ]);

      // No real network: the devices only tried loopback hosts...
      expect(await a.request({ type: 'blockedRequests' })).toEqual([]);
      expect(await b.request({ type: 'blockedRequests' })).toEqual([]);
      // ...and neither did anything in this thread
      const hosts = fetchSpy.mock.calls.map(
        ([input]) =>
          new URL(input instanceof Request ? input.url : String(input))
            .hostname,
      );
      expect(hosts.filter(host => !LOOPBACK_HOSTS.has(host))).toEqual([]);
    } finally {
      await Promise.all([a?.close(), b?.close()]);
      await server.shutdown();
    }

    // No temporary files left: the server's directory and both devices'
    // data directories are gone
    expect(createdPaths.filter(path => existsSync(path))).toEqual([]);
  });
});
