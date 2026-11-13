import { afterEach, describe, expect, it } from 'vitest';

import { makeChange, sync } from './deviceHelpers';
import { setUpTwoDevices } from './setUpTwoDevices';
import type { TwoDevices } from './setUpTwoDevices';

type Account = { name: string };

const PROBE_PREF = 'isolationProbe';

// Control for createDevice.test.ts: the devices are isolated from each
// other, not cut off from the server. (Its own file because each test file
// can start only one sync server.)
describe('createDevice through the server', () => {
  let setup: TwoDevices | undefined;

  afterEach(async () => {
    await setup?.tearDown();
    setup = undefined;
  });

  it('shares budget data, but not local prefs, once both devices sync', async () => {
    setup = await setUpTwoDevices();
    const { a, b } = setup;

    await makeChange(a, { type: 'createAccount', name: 'Checking' });
    await a.savePrefs({ [PROBE_PREF]: 'written-on-A' });
    await sync(a);
    await sync(b);

    expect(await b.api<Account[]>('getAccounts')).toMatchObject([
      { name: 'Checking' },
    ]);
    expect((await b.getPrefs())[PROBE_PREF]).toBeUndefined();
  });
});
