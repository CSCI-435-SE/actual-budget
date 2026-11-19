import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertInSync } from './assertInSync';
import type { Device } from './createDevice';
import { makeChange, sync } from './deviceHelpers';
import { setUpTwoDevices } from './setUpTwoDevices';
import type { TwoDevices } from './setUpTwoDevices';

type Transaction = { id: string; date: string; amount: number; notes: string };

// One server and pair of devices for the file (sync-server allows one per
// module graph). Each test makes its own account, so they don't depend on
// each other's data.
describe('transactions through the server', () => {
  let setup: TwoDevices;

  beforeAll(async () => {
    setup = await setUpTwoDevices();
  });

  afterAll(async () => {
    await setup?.tearDown();
  });

  async function syncBoth() {
    // A, B, then A again so A also receives anything B sent
    await sync(setup.a);
    await sync(setup.b);
    await sync(setup.a);
  }

  function getTransactions(device: Device, accountId: string) {
    return device.api<Transaction[]>(
      'getTransactions',
      accountId,
      '1900-01-01',
      '9999-12-31',
    );
  }

  it('a transaction created on A appears on B', async () => {
    const { a, b } = setup;
    const { id: accountId } = await makeChange(a, {
      type: 'createAccount',
      name: 'Checking',
    });
    const { id } = await makeChange(a, {
      type: 'createTransaction',
      accountId,
      date: '2026-01-15',
      amount: -1250,
      notes: 'Groceries',
    });

    await syncBoth();

    expect(await getTransactions(b, accountId)).toMatchObject([
      { id, date: '2026-01-15', amount: -1250, notes: 'Groceries' },
    ]);
    await assertInSync(a, b);
  });

  it('updates and deletes reach the other device', async () => {
    const { a, b } = setup;
    const { id: accountId } = await makeChange(a, {
      type: 'createAccount',
      name: 'Savings',
    });
    const { id } = await makeChange(a, {
      type: 'createTransaction',
      accountId,
      date: '2026-02-01',
      amount: 50000,
    });
    await syncBoth();

    // Updated on B, seen on A
    await makeChange(b, {
      type: 'updateTransaction',
      id,
      fields: { amount: 45000, notes: 'Paycheck' },
    });
    await syncBoth();
    expect(await getTransactions(a, accountId)).toMatchObject([
      { id, amount: 45000, notes: 'Paycheck' },
    ]);

    // Deleted on A, gone from B
    await makeChange(a, { type: 'deleteTransaction', id });
    await syncBoth();
    expect(await getTransactions(b, accountId)).toEqual([]);
    await assertInSync(a, b);
  });
});
