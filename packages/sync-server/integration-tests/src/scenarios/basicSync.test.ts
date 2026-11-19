import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertInSync } from '../assertInSync';
import type { Device } from '../createDevice';
import { makeChange, sync } from '../deviceHelpers';
import { setUpTwoDevices } from '../setUpTwoDevices';
import type { TwoDevices } from '../setUpTwoDevices';

type Account = { id: string; name: string };

// Clean two-way sync: both devices online, one change at a time.
// (exampleScenario.test.ts covers edits made while a device is offline.)
//
// One server and pair of devices for the file, since sync-server allows one
// server per module graph. Each test creates its own account, so they don't
// depend on each other's data.
describe('basic sync', () => {
  let setup: TwoDevices;

  beforeAll(async () => {
    setup = await setUpTwoDevices();
  });

  afterAll(async () => {
    await setup?.tearDown();
  });

  function getAccounts(device: Device) {
    return device.api<Account[]>('getAccounts');
  }

  it('an account created on A reaches B', async () => {
    const { a, b } = setup;
    const { id } = await makeChange(a, {
      type: 'createAccount',
      name: 'Created on A',
    });
    expect(await getAccounts(b)).not.toContainEqual(
      expect.objectContaining({ id }),
    );

    await sync(a);
    await sync(b);

    expect(await getAccounts(b)).toContainEqual(
      expect.objectContaining({ id, name: 'Created on A' }),
    );
    await assertInSync(a, b);
  });

  it('an account created on B reaches A', async () => {
    const { a, b } = setup;
    const { id } = await makeChange(b, {
      type: 'createAccount',
      name: 'Created on B',
    });
    expect(await getAccounts(a)).not.toContainEqual(
      expect.objectContaining({ id }),
    );

    await sync(b);
    await sync(a);

    expect(await getAccounts(a)).toContainEqual(
      expect.objectContaining({ id, name: 'Created on B' }),
    );
    await assertInSync(a, b);
  });
});
