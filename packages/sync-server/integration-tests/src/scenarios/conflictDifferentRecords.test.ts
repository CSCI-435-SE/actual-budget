import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertInSync } from '../assertInSync';
import type { Device } from '../createDevice';
import { makeChange, sync } from '../deviceHelpers';
import type { DeviceSnapshot, TableRow } from '../deviceProtocol';
import { setUpTwoDevices } from '../setUpTwoDevices';
import type { TwoDevices } from '../setUpTwoDevices';

// A and B each change a different record while out of contact. Nothing
// conflicts at the cell level, so after syncing every change should be on
// both devices.
//
// Deletes are soft: loot-core sets `tombstone = 1` on the row (a synced
// field like any other) and the API's getAccounts/getTransactions hide those
// rows. So these tests read the raw table rows with a device snapshot.
//
// One server and pair of devices for the file (sync-server allows one per
// module graph). Each test uses its own records.
describe('concurrent changes to different records', () => {
  let setup: TwoDevices;

  beforeAll(async () => {
    setup = await setUpTwoDevices();
  });

  afterAll(async () => {
    await setup?.tearDown();
  });

  async function syncFully() {
    // A, B, then A again so A also receives what B sent
    await sync(setup.a);
    await sync(setup.b);
    await sync(setup.a);
  }

  /** The raw row for `id` in `table`, including deleted (tombstoned) rows. */
  async function rawRow(
    device: Device,
    table: string,
    id: string,
  ): Promise<TableRow | undefined> {
    const snapshot = await device.request<DeviceSnapshot>({
      type: 'snapshot',
      tables: [table],
    });
    return snapshot.tables[table].find(row => row.id === id);
  }

  async function expectTombstoned(table: string, ids: string[]) {
    for (const device of [setup.a, setup.b]) {
      for (const id of ids) {
        expect(
          await rawRow(device, table, id),
          `${table} ${id} on ${device.name}`,
        ).toMatchObject({ id, tombstone: 1 });
      }
    }
  }

  it('accounts created and deleted on each device', async () => {
    const { a, b } = setup;

    const { id: idA } = await makeChange(a, {
      type: 'createAccount',
      name: 'Temporary on A',
    });
    await makeChange(a, { type: 'deleteAccount', id: idA });

    const { id: idB } = await makeChange(b, {
      type: 'createAccount',
      name: 'Temporary on B',
    });
    await makeChange(b, { type: 'deleteAccount', id: idB });

    // Before syncing, each device only knows its own account
    expect(await rawRow(a, 'accounts', idB)).toBeUndefined();
    expect(await rawRow(b, 'accounts', idA)).toBeUndefined();

    await syncFully();

    await expectTombstoned('accounts', [idA, idB]);
    await assertInSync(a, b);
  });

  it('transactions created and deleted on each device', async () => {
    const { a, b } = setup;

    // A shared account both devices already have
    const { id: accountId } = await makeChange(a, {
      type: 'createAccount',
      name: 'Shared',
    });
    await syncFully();

    const { id: txA } = await makeChange(a, {
      type: 'createTransaction',
      accountId,
      date: '2026-03-01',
      amount: -500,
      notes: 'Created on A',
    });
    await makeChange(a, { type: 'deleteTransaction', id: txA });

    const { id: txB } = await makeChange(b, {
      type: 'createTransaction',
      accountId,
      date: '2026-03-02',
      amount: -700,
      notes: 'Created on B',
    });
    await makeChange(b, { type: 'deleteTransaction', id: txB });

    expect(await rawRow(a, 'transactions', txB)).toBeUndefined();
    expect(await rawRow(b, 'transactions', txA)).toBeUndefined();

    await syncFully();

    await expectTombstoned('transactions', [txA, txB]);
    for (const device of [a, b]) {
      expect(
        await device.api(
          'getTransactions',
          accountId,
          '1900-01-01',
          '9999-12-31',
        ),
      ).toEqual([]);
    }
    await assertInSync(a, b);
  });
});
