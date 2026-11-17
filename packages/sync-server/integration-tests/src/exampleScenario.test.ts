import { afterEach, describe, expect, it } from 'vitest';

import { assertInSync } from './assertInSync';
import { goOffline, goOnline, makeChange, sync } from './deviceHelpers';
import { setUpTwoDevices } from './setUpTwoDevices';
import type { TwoDevices } from './setUpTwoDevices';

describe('offline edits', () => {
  let setup: TwoDevices | undefined;

  afterEach(async () => {
    await setup?.tearDown();
    setup = undefined;
  });

  it('merges changes made while one device was offline', async () => {
    setup = await setUpTwoDevices();
    const { a, b } = setup;

    await goOffline(b);
    await makeChange(a, { type: 'createAccount', name: 'Checking' });
    await sync(a);
    await makeChange(b, { type: 'createAccount', name: 'Savings' });

    await goOnline(b);
    await sync(b); // sends Savings, receives Checking
    await sync(a); // receives Savings

    await assertInSync(a, b);
    const names = (await b.api<{ name: string }[]>('getAccounts')).map(
      account => account.name,
    );
    expect(names.sort()).toEqual(['Checking', 'Savings']);
  });
});
