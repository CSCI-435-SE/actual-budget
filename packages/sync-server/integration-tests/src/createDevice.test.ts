import { afterEach, describe, expect, it } from 'vitest';

import { setUpTwoDevices } from './setUpTwoDevices';
import type { TwoDevices } from './setUpTwoDevices';

type Account = { name: string };

// A test-only metadata pref: nothing in the app reads, writes or syncs it,
// so any value on device B can only have leaked from device A
const PROBE_PREF = 'isolationProbe';

describe('createDevice', () => {
  let setup: TwoDevices | undefined;

  afterEach(async () => {
    await setup?.tearDown();
    setup = undefined;
  });

  it('gives each device its own prefs, clock and database', async () => {
    setup = await setUpTwoDevices();
    const { a, b } = setup;

    // Separate storage on disk
    expect(a.dataDir).not.toBe(b.dataDir);

    // Separate clocks: each download got its own CRDT node id
    const clientA = await a.getClientId();
    const clientB = await b.getClientId();
    expect(clientA).toMatch(/^[0-9A-F]{16}$/i);
    expect(clientA).not.toBe(clientB);

    // Separate prefs: a pref written on A doesn't appear on B
    await a.savePrefs({ [PROBE_PREF]: 'written-on-A' });
    expect((await a.getPrefs())[PROBE_PREF]).toBe('written-on-A');
    expect((await b.getPrefs())[PROBE_PREF]).toBeUndefined();

    // Separate databases: A's new account isn't in B's database
    await a.api('createAccount', { name: 'Checking' }, 0);
    expect(await a.api<Account[]>('getAccounts')).toMatchObject([
      { name: 'Checking' },
    ]);
    expect(await b.api<Account[]>('getAccounts')).toEqual([]);
  });
});
